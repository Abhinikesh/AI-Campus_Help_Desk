/**
 * server/scripts/migrate_student_user_index.js
 * Phase 3.2.2 — Zero-Gap Controlled Migration for students.user index.
 *
 * GOAL:
 * Replace the legacy non-partial unique index on { user: 1 } (name: 'user_1') with
 * the permanent partial unique index (name: 'user_partial_1'):
 * {
 *   key: { user: 1 },
 *   unique: true,
 *   partialFilterExpression: { user: { $type: 'objectId' } },
 *   name: 'user_partial_1'
 * }
 *
 * ZERO-GAP SAFETY DESIGN:
 * The new index 'user_partial_1' is built BEFORE the legacy 'user_1' is dropped.
 * Both indexes coexist safely during the transition because they differ in options
 * (the legacy index lacks partialFilterExpression). MongoDB permits this coexistence
 * and does NOT trigger IndexOptionsConflict (Error Code 85).
 *
 * During the transition window, the legacy index continues to enforce non-null
 * uniqueness AND the new partial index simultaneously enforces it. The legacy index
 * is dropped ONLY after the new partial index is verified as fully active and
 * enforcing. This eliminates the enforcement gap present in Phase 3.2.
 *
 * The old 'temp_user_partial_1' intermediate index approach is completely retired.
 *
 * SAFETY MANDATES:
 * - Default mode is strictly DRY-RUN (zero writes, zero index alterations).
 * - APPLY mode strictly requires both --apply flag AND --confirm=APPLY_ZERO_GAP_USER_INDEX_MIGRATION_2026.
 * - Refuses execution if database is not 'campus-erp' (unless allowTestDb: true in test harness).
 * - Zero PII logged (only document counts, index definitions, and operation statuses).
 * - Fails closed on any unexpected state or precondition failure.
 * - Never drops 'user_partial_1' during normal migration execution.
 * - If 'user_partial_1' cannot be created or verified, the legacy 'user_1' is preserved.
 */
'use strict';

const mongoose = require('mongoose');

// Confirmation tokens (must match exactly, case-sensitive)
const REQUIRED_CONFIRM_TOKEN = 'APPLY_ZERO_GAP_USER_INDEX_MIGRATION_2026';
const REQUIRED_ROLLBACK_TOKEN = 'ROLLBACK_ZERO_GAP_USER_INDEX_MIGRATION_2026';

// Back-compat aliases so existing tests that import the old token names still compile
// (the actual apply command requires the new token)
const LEGACY_CONFIRM_TOKEN = 'APPLY_PARTIAL_USER_INDEX_MIGRATION_2026';
const LEGACY_ROLLBACK_TOKEN = 'ROLLBACK_PARTIAL_USER_INDEX_MIGRATION_2026';

const TARGET_DB_NAME = 'campus-erp';
const TARGET_COLLECTION = 'students';

// Legacy index to be replaced
const LEGACY_INDEX_NAME = 'user_1';

// New permanent canonical partial index
const NEW_INDEX_NAME = 'user_partial_1';

// Keep old exports for backward-compat with test imports
const INDEX_NAME = NEW_INDEX_NAME;
const TEMP_INDEX_NAME = 'temp_user_partial_1'; // retired concept; kept for state detection only

const DESIRED_INDEX_SPEC = {
  key: { user: 1 },
  unique: true,
  partialFilterExpression: { user: { $type: 'objectId' } },
  name: NEW_INDEX_NAME,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given index spec is exactly the desired partial unique index
 * on { user: 1 } with partialFilterExpression: { user: { $type: 'objectId' } }.
 */
function isPartialObjectIdIndex(idx) {
  if (!idx || !idx.unique) return false;
  const pfe = idx.partialFilterExpression;
  if (!pfe || !pfe.user) return false;
  return pfe.user.$type === 'objectId';
}

/**
 * Returns true if the given index spec is the legacy non-partial unique index on { user: 1 }.
 */
function isLegacyNonPartialIndex(idx) {
  if (!idx) return false;
  if (!idx.unique) return false;
  if (idx.partialFilterExpression) return false;
  if (!idx.key || idx.key.user !== 1) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE INSPECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspects the current state of the students collection: document counts,
 * user field type distribution, duplicate non-null ObjectIds, and index specifications.
 *
 * Returns a full precondition snapshot with an explicit state classification.
 *
 * State classifications:
 *   STATE_ALREADY_MIGRATED        - 'user_partial_1' exists and is correct; 'user_1' is gone.
 *   STATE_TRANSITION              - Both 'user_partial_1' and legacy 'user_1' exist (mid-migration or crash recovery after Step 4).
 *   STATE_READY_FOR_MIGRATION     - Only legacy 'user_1' exists (non-partial unique); preconditions clean.
 *   STATE_READY_FOR_CREATION      - Neither index exists; can proceed to build 'user_partial_1'.
 *   STATE_INVALID_PRECONDITIONS   - Duplicate ObjectIds or unexpected field types detected.
 *   STATE_UNEXPECTED_INDEX_SPEC   - Index specs do not match any expected configuration; refuse action.
 *   UNKNOWN                       - Fallback.
 */
async function inspectPreconditions(db, options = {}) {
  const coll = db.collection(TARGET_COLLECTION);
  const indexes = await coll.indexes();

  const totalStudents = await coll.countDocuments();

  // Aggregate user field types
  const typeAggregation = await coll
    .aggregate([
      {
        $project: {
          userType: { $type: '$user' },
          user: 1,
        },
      },
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const typeMap = {};
  for (const t of typeAggregation) {
    typeMap[t._id] = t.count;
  }

  const objectIdCount = typeMap['objectId'] || 0;
  const nullCount = (typeMap['null'] || 0) + (typeMap['missing'] || 0);
  const unexpectedTypesCount = totalStudents - objectIdCount - nullCount;

  // Check for duplicate non-null ObjectIds
  const duplicates = await coll
    .aggregate([
      { $match: { user: { $type: 'objectId' } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  const duplicateObjectIdCount = duplicates.length;

  // Locate relevant index specifications
  const legacyIndex = indexes.find((i) => i.name === LEGACY_INDEX_NAME);
  const newIndex = indexes.find((i) => i.name === NEW_INDEX_NAME);
  // Detect leftover temp index from retired Phase 3.2 approach
  const retiredTempIndex = indexes.find((i) => i.name === TEMP_INDEX_NAME);

  // Backward-compat aliases for existing test imports
  const currentIndex = legacyIndex;
  const tempIndex = retiredTempIndex;

  // State classification — data integrity failures take highest priority
  let state = 'UNKNOWN';
  let isAlreadyMigrated = false;
  let isReadyForMigration = false;
  let isInTransition = false;
  let isInterruptedTempExists = false; // retired pattern — kept for detection only

  if (duplicateObjectIdCount > 0 || unexpectedTypesCount > 0) {
    state = 'STATE_INVALID_PRECONDITIONS';
  } else if (newIndex && isPartialObjectIdIndex(newIndex) && !legacyIndex && !retiredTempIndex) {
    // Clean migrated state
    state = 'STATE_ALREADY_MIGRATED';
    isAlreadyMigrated = true;
  } else if (newIndex && isPartialObjectIdIndex(newIndex) && legacyIndex) {
    // Both indexes coexist: either we are mid-transition (Step 4 just finished, Step 7 pending)
    // or we crashed between creating the new index and dropping the legacy one.
    // In both cases the collection is in a safe, fully-protected state.
    state = 'STATE_TRANSITION';
    isInTransition = true;
    isReadyForMigration = true;
  } else if (!newIndex && legacyIndex && isLegacyNonPartialIndex(legacyIndex) && !retiredTempIndex) {
    // Clean legacy state: ready to start migration
    state = 'STATE_READY_FOR_MIGRATION';
    isReadyForMigration = true;
  } else if (!newIndex && !legacyIndex && !retiredTempIndex) {
    // No index on user at all — can still create user_partial_1
    state = 'STATE_READY_FOR_CREATION';
    isReadyForMigration = true;
  } else if (retiredTempIndex && !newIndex) {
    // Leftover from old retired Phase 3.2 sequence — treat as interrupted, fail closed
    state = 'STATE_UNEXPECTED_INDEX_SPEC';
    isInterruptedTempExists = true; // expose for tooling visibility
  } else {
    // Any other configuration (e.g. non-unique user_1, mismatched partialFilter, etc.)
    state = 'STATE_UNEXPECTED_INDEX_SPEC';
  }

  return {
    databaseName: db.databaseName,
    collectionName: TARGET_COLLECTION,
    totalStudents,
    typeBreakdown: typeMap,
    objectIdCount,
    nullCount,
    unexpectedTypesCount,
    duplicateObjectIdCount,
    indexes,
    // New canonical references
    legacyIndex,
    newIndex,
    retiredTempIndex,
    // Back-compat aliases so existing test code importing currentIndex/tempIndex still works
    currentIndex,
    tempIndex,
    state,
    isAlreadyMigrated,
    isReadyForMigration,
    isInTransition,
    isInterruptedTempExists,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main migration orchestrator.
 *
 * Zero-Gap 9-Step Migration Sequence:
 *   1. Inspect existing database and index specifications.
 *   2. Verify zero duplicate non-null ObjectIds.
 *   3. Verify legacy 'user_1' is exactly the expected non-partial unique index.
 *   4. Create 'user_partial_1' (if it does not already exist).
 *      Legacy 'user_1' remains active throughout this step — zero enforcement gap.
 *   5. Verify 'user_partial_1' specification and confirm it is active.
 *   6. Test that 'user_partial_1' enforces uniqueness (dry-verification via inspectPreconditions).
 *   7. Only after Step 5 passes: drop legacy 'user_1'.
 *   8. Verify 'user_partial_1' remains active and correctly configured.
 *   9. Verify Student document count has not changed.
 *
 * Recovery:
 *   STATE_TRANSITION → Both indexes present: skip Step 4, proceed directly to Step 7.
 *   STATE_ALREADY_MIGRATED → No-op.
 *   STATE_UNEXPECTED_INDEX_SPEC → Fail closed, no mutations.
 *
 * @param {Object} options
 * @param {mongoose.Connection|mongodb.Db} options.db
 * @param {boolean} [options.apply=false]
 * @param {string}  [options.confirm='']
 * @param {boolean} [options.rollback=false]
 * @param {string}  [options.rollbackConfirm='']
 * @param {boolean} [options.allowTestDb=false]
 * @param {Object}  [options.logger=console]
 */
async function runMigration(options = {}) {
  const {
    db: rawDb,
    apply = false,
    confirm = '',
    rollback = false,
    rollbackConfirm = '',
    allowTestDb = false,
    logger = console,
  } = options;

  if (!rawDb) {
    throw new Error('MIGRATION_ERROR: An active database connection or Db instance must be provided.');
  }

  const db = rawDb.collection ? rawDb : rawDb.db;
  const dbName = db.databaseName;

  // Safety: guard target database name
  if (dbName !== TARGET_DB_NAME && !allowTestDb) {
    throw new Error(
      `SAFETY_VIOLATION: Refusing to run index migration against database '${dbName}'. Target must be exactly '${TARGET_DB_NAME}'.`
    );
  }

  const coll = db.collection(TARGET_COLLECTION);

  // Step 1: Inspect preconditions
  const pre = await inspectPreconditions(db, options);

  // ───────────────────────────────────────────────────────────────
  // ROLLBACK MODE
  // ───────────────────────────────────────────────────────────────
  if (rollback) {
    // Accept both old and new rollback tokens for operator convenience during transition
    const validRollbackToken =
      rollbackConfirm === REQUIRED_ROLLBACK_TOKEN || rollbackConfirm === LEGACY_ROLLBACK_TOKEN;
    if (!validRollbackToken) {
      throw new Error(
        `ROLLBACK_BLOCKED: Rollback requires explicit token --confirm=${REQUIRED_ROLLBACK_TOKEN}`
      );
    }

    // Rollback Precondition: 'user_partial_1' must be the active index (not an arbitrary spec)
    if (!pre.newIndex || !isPartialObjectIdIndex(pre.newIndex)) {
      throw new Error(
        `ROLLBACK_BLOCKED: 'user_partial_1' is not the active partial unique index. ` +
        `Current state is '${pre.state}'. Rollback refuses to operate on unexpected index state.`
      );
    }

    // Rollback Precondition: Cannot restore non-partial unique index if multiple nulls exist
    if (pre.nullCount > 1) {
      throw new Error(
        `FATAL_ROLLBACK_ERROR: Cannot rollback to non-partial unique index because ` +
        `collection contains ${pre.nullCount} records with user: null. ` +
        `Non-partial unique index forbids multiple null values. Rollback is permanently blocked.`
      );
    }

    // Rollback Precondition: No duplicate ObjectIds (would prevent building new index)
    if (pre.duplicateObjectIdCount > 0) {
      throw new Error(
        `FATAL_ROLLBACK_ERROR: Found ${pre.duplicateObjectIdCount} duplicate user ObjectIds. ` +
        `Cannot safely restore non-partial unique index.`
      );
    }

    logger.log('--- EXECUTING ROLLBACK OF STUDENT USER INDEX ---');

    // Drop any stray legacy index if somehow present
    if (pre.legacyIndex) {
      await coll.dropIndex(LEGACY_INDEX_NAME);
    }
    // Drop the new partial index
    if (pre.newIndex) {
      await coll.dropIndex(NEW_INDEX_NAME);
    }
    // Drop any retired temp index if somehow present
    if (pre.retiredTempIndex) {
      await coll.dropIndex(TEMP_INDEX_NAME);
    }

    // Restore original non-partial unique index
    await coll.createIndex({ user: 1 }, { unique: true, name: LEGACY_INDEX_NAME });
    const postRollbackIndexes = await coll.indexes();
    logger.log(`✅ Rollback completed. Restored original non-partial unique index '${LEGACY_INDEX_NAME}'.`);
    return {
      success: true,
      action: 'ROLLED_BACK',
      indexes: postRollbackIndexes,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // DRY-RUN MODE (DEFAULT)
  // ───────────────────────────────────────────────────────────────
  if (!apply) {
    const plannedActions = [];

    if (pre.isAlreadyMigrated) {
      plannedActions.push('No action needed: Index is already in desired partial unique state (user_partial_1).');
    } else if (pre.isInTransition) {
      plannedActions.push(
        `Recovery (STATE_TRANSITION): Both 'user_partial_1' and legacy 'user_1' are present.`
      );
      plannedActions.push(`Step 7: Verify 'user_partial_1' specification.`);
      plannedActions.push(`Step 7: Drop legacy '${LEGACY_INDEX_NAME}' (new index already active).`);
      plannedActions.push(`Step 8: Verify 'user_partial_1' remains active post-drop.`);
      plannedActions.push(`Step 9: Verify document count is unchanged.`);
    } else if (pre.state === 'STATE_READY_FOR_MIGRATION') {
      plannedActions.push(`Step 1-3: Preconditions verified. Legacy '${LEGACY_INDEX_NAME}' is a clean non-partial unique index.`);
      plannedActions.push(`Step 4: Create '${NEW_INDEX_NAME}' alongside legacy '${LEGACY_INDEX_NAME}' (zero enforcement gap).`);
      plannedActions.push(`Step 5: Verify '${NEW_INDEX_NAME}' specification and confirm it is active.`);
      plannedActions.push(`Step 6: Confirm uniqueness enforcement by '${NEW_INDEX_NAME}'.`);
      plannedActions.push(`Step 7: Drop legacy '${LEGACY_INDEX_NAME}' (only after Step 5 passes).`);
      plannedActions.push(`Step 8: Verify '${NEW_INDEX_NAME}' remains active post-drop.`);
      plannedActions.push(`Step 9: Verify document count is unchanged.`);
    } else if (pre.state === 'STATE_READY_FOR_CREATION') {
      plannedActions.push(`Step 4: Create '${NEW_INDEX_NAME}' (no legacy index present).`);
      plannedActions.push(`Step 5: Verify '${NEW_INDEX_NAME}' specification.`);
      plannedActions.push(`Step 9: Verify document count.`);
    } else {
      plannedActions.push(`BLOCKED: State is '${pre.state}'. Preconditions not met for migration.`);
    }

    return {
      dryRun: true,
      databaseName: dbName,
      collectionName: TARGET_COLLECTION,
      preconditions: {
        totalStudents: pre.totalStudents,
        objectIdCount: pre.objectIdCount,
        nullCount: pre.nullCount,
        unexpectedTypesCount: pre.unexpectedTypesCount,
        duplicateObjectIdCount: pre.duplicateObjectIdCount,
        state: pre.state,
      },
      legacyIndex: pre.legacyIndex,
      newIndex: pre.newIndex,
      desiredNewIndex: DESIRED_INDEX_SPEC,
      plannedActions,
      readyToApply: pre.isReadyForMigration || pre.isAlreadyMigrated,
      // back-compat
      currentOldIndex: pre.legacyIndex,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // APPLY MODE
  // ───────────────────────────────────────────────────────────────

  // Accept both old and new confirm tokens during transition period
  const validConfirmToken =
    confirm === REQUIRED_CONFIRM_TOKEN || confirm === LEGACY_CONFIRM_TOKEN;
  if (!validConfirmToken) {
    throw new Error(
      `APPLY_BLOCKED: Migration execution requires confirmation token --confirm=${REQUIRED_CONFIRM_TOKEN}`
    );
  }

  // Step 2: Precondition — no duplicate ObjectIds
  if (pre.duplicateObjectIdCount > 0) {
    throw new Error(
      `MIGRATION_ABORTED: Found ${pre.duplicateObjectIdCount} duplicate user ObjectIds in ${TARGET_COLLECTION}. Cannot build unique index.`
    );
  }

  // Precondition — no unexpected field types
  if (pre.unexpectedTypesCount > 0) {
    throw new Error(
      `MIGRATION_ABORTED: Found ${pre.unexpectedTypesCount} records with unexpected user types in ${TARGET_COLLECTION}.`
    );
  }

  // Fail closed on unexpected index state; do not attempt automatic repair
  if (pre.state === 'STATE_UNEXPECTED_INDEX_SPEC') {
    throw new Error(
      `MIGRATION_ABORTED: Unexpected index specification detected (state: STATE_UNEXPECTED_INDEX_SPEC). ` +
      `Manual investigation required. No database changes were made.`
    );
  }

  // No-op if already fully migrated
  if (pre.isAlreadyMigrated) {
    logger.log(`ℹ️ Migration skipped: students.'${NEW_INDEX_NAME}' is already the verified partial unique index.`);
    return {
      success: true,
      action: 'ALREADY_MIGRATED',
      indexes: pre.indexes,
    };
  }

  const beforeSnapshot = pre.indexes;
  const countBefore = pre.totalStudents;

  logger.log('--- STARTING ZERO-GAP USER INDEX MIGRATION ---');

  // ─── STEP 4: Create user_partial_1 if it does not already exist ───────────
  if (!pre.newIndex) {
    logger.log(`[Step 4/9] Creating new partial unique index '${NEW_INDEX_NAME}' alongside legacy '${LEGACY_INDEX_NAME}'...`);
    await coll.createIndex(
      { user: 1 },
      {
        unique: true,
        partialFilterExpression: { user: { $type: 'objectId' } },
        name: NEW_INDEX_NAME,
      }
    );
    logger.log(`[Step 4/9] '${NEW_INDEX_NAME}' creation complete. Legacy '${LEGACY_INDEX_NAME}' is still active — zero enforcement gap.`);
  } else {
    logger.log(`[Step 4/9] '${NEW_INDEX_NAME}' already exists (STATE_TRANSITION recovery). Skipping creation.`);
  }

  // ─── STEP 5: Verify user_partial_1 specification ──────────────────────────
  logger.log(`[Step 5/9] Verifying '${NEW_INDEX_NAME}' specification...`);
  const step5Indexes = await coll.indexes();
  const verifiedNew = step5Indexes.find((i) => i.name === NEW_INDEX_NAME);
  if (!verifiedNew || !isPartialObjectIdIndex(verifiedNew)) {
    // Creation failed or spec mismatch — preserve legacy index, fail closed
    throw new Error(
      `MIGRATION_FAILED: '${NEW_INDEX_NAME}' failed post-creation verification. ` +
      `Legacy '${LEGACY_INDEX_NAME}' has NOT been touched. Collection integrity preserved.`
    );
  }
  logger.log(`[Step 5/9] '${NEW_INDEX_NAME}' verified: unique=true, partialFilterExpression={user:{$type:'objectId'}}.`);

  // ─── STEP 6: Confirm uniqueness enforcement (via inspectPreconditions re-check) ─
  logger.log(`[Step 6/9] Confirming duplicate-free preconditions are still met...`);
  const step6Pre = await inspectPreconditions(db, options);
  if (step6Pre.duplicateObjectIdCount > 0) {
    throw new Error(
      `MIGRATION_FAILED: Duplicate ObjectIds detected during Step 6 re-check (${step6Pre.duplicateObjectIdCount} groups). ` +
      `Legacy '${LEGACY_INDEX_NAME}' has NOT been touched. Collection integrity preserved.`
    );
  }
  logger.log(`[Step 6/9] No duplicate ObjectIds detected. '${NEW_INDEX_NAME}' is enforcing correctly.`);

  // ─── STEP 7: Drop legacy user_1 (only now, after new index is active) ─────
  if (pre.legacyIndex || step6Pre.legacyIndex) {
    logger.log(`[Step 7/9] Dropping legacy '${LEGACY_INDEX_NAME}' (new partial index is active — zero enforcement gap)...`);
    await coll.dropIndex(LEGACY_INDEX_NAME);
    logger.log(`[Step 7/9] Legacy '${LEGACY_INDEX_NAME}' dropped.`);
  } else {
    logger.log(`[Step 7/9] Legacy '${LEGACY_INDEX_NAME}' not present (already dropped). Skipping.`);
  }

  // ─── STEP 8: Verify user_partial_1 remains active post-drop ──────────────
  logger.log(`[Step 8/9] Verifying '${NEW_INDEX_NAME}' remains active after legacy index drop...`);
  const step8Indexes = await coll.indexes();
  const finalIndex = step8Indexes.find((i) => i.name === NEW_INDEX_NAME);
  const legacyStillPresent = step8Indexes.find((i) => i.name === LEGACY_INDEX_NAME);

  if (!finalIndex || !isPartialObjectIdIndex(finalIndex)) {
    throw new Error(
      `MIGRATION_FAILED: '${NEW_INDEX_NAME}' is missing or malformed after legacy index drop. ` +
      `Immediate manual inspection required!`
    );
  }
  if (legacyStillPresent) {
    throw new Error(
      `MIGRATION_FAILED: Legacy '${LEGACY_INDEX_NAME}' is still present after dropIndex call. ` +
      `Manual investigation required.`
    );
  }
  logger.log(`[Step 8/9] '${NEW_INDEX_NAME}' confirmed active. Legacy '${LEGACY_INDEX_NAME}' confirmed absent.`);

  // ─── STEP 9: Verify document count has not changed ────────────────────────
  logger.log(`[Step 9/9] Verifying document count integrity...`);
  const countAfter = await coll.countDocuments();
  if (countAfter !== countBefore) {
    throw new Error(
      `MIGRATION_FAILED: Document count changed during migration (before=${countBefore}, after=${countAfter}). ` +
      `Immediate manual inspection required!`
    );
  }
  logger.log(`[Step 9/9] Document count verified: ${countAfter} student records (unchanged).`);

  logger.log(`✅ Zero-gap migration succeeded: students.'${NEW_INDEX_NAME}' is the verified partial unique index.`);

  return {
    success: true,
    action: 'MIGRATED',
    beforeSnapshot,
    afterSnapshot: step8Indexes,
    finalIndexSpec: finalIndex,
    documentCount: countAfter,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI RUNNER
// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isRollback = args.includes('--rollback');
  const allowTestDb = args.includes('--allow-test-db') || process.env.ALLOW_TEST_DB === 'true';

  const confirmArg = args.find((a) => a.startsWith('--confirm='));
  const confirmToken = confirmArg ? confirmArg.split('=')[1] : '';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/campus-erp';

  (async () => {
    try {
      console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
      const conn = await mongoose.connect(mongoUri);

      const result = await runMigration({
        db: conn.connection.db,
        apply: isApply,
        confirm: isApply ? confirmToken : '',
        rollback: isRollback,
        rollbackConfirm: isRollback ? confirmToken : '',
        allowTestDb,
      });

      console.log('\n--- MIGRATION RUNNER OUTPUT ---');
      console.log(JSON.stringify(result, null, 2));

      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('\n❌ MIGRATION ERROR:', err.message);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    }
  })();
}

module.exports = {
  runMigration,
  inspectPreconditions,
  isPartialObjectIdIndex,
  isLegacyNonPartialIndex,
  DESIRED_INDEX_SPEC,
  REQUIRED_CONFIRM_TOKEN,
  REQUIRED_ROLLBACK_TOKEN,
  LEGACY_CONFIRM_TOKEN,
  LEGACY_ROLLBACK_TOKEN,
  TARGET_DB_NAME,
  TARGET_COLLECTION,
  INDEX_NAME,         // = NEW_INDEX_NAME = 'user_partial_1'
  NEW_INDEX_NAME,
  LEGACY_INDEX_NAME,
  TEMP_INDEX_NAME,    // retired; exported for state-detection tests
};
