/**
 * server/scripts/migrate_student_user_index.js
 * Controlled, Safe, Reversible Migration Script for students.user_1 Index.
 *
 * GOAL:
 * Replace the existing non-partial unique index on students.user with:
 * {
 *   key: { user: 1 },
 *   unique: true,
 *   partialFilterExpression: { user: { $type: 'objectId' } },
 *   name: 'user_1'
 * }
 *
 * SAFETY MANDATES:
 * - Default mode is strictly DRY-RUN (zero writes, zero index alterations).
 * - APPLY mode strictly requires both --apply flag AND --confirm=APPLY_PARTIAL_USER_INDEX_MIGRATION_2026.
 * - Refuses execution if database is not 'campus-erp' (unless allowTestDb: true in test harness).
 * - Zero PII logged (only document counts, index definitions, and operation statuses).
 * - Fails closed on any unexpected state or precondition failure.
 */
'use strict';

const mongoose = require('mongoose');

const REQUIRED_CONFIRM_TOKEN = 'APPLY_PARTIAL_USER_INDEX_MIGRATION_2026';
const REQUIRED_ROLLBACK_TOKEN = 'ROLLBACK_PARTIAL_USER_INDEX_MIGRATION_2026';

const TARGET_DB_NAME = 'campus-erp';
const TARGET_COLLECTION = 'students';
const INDEX_NAME = 'user_1';
const TEMP_INDEX_NAME = 'temp_user_partial_1';

const DESIRED_INDEX_SPEC = {
  key: { user: 1 },
  unique: true,
  partialFilterExpression: { user: { $type: 'objectId' } },
  name: INDEX_NAME,
};

/**
 * Normalizes index partialFilterExpression for comparison.
 */
function isPartialObjectIdIndex(idx) {
  if (!idx || !idx.unique) return false;
  const pfe = idx.partialFilterExpression;
  if (!pfe || !pfe.user) return false;
  return pfe.user.$type === 'objectId';
}

/**
 * Inspects the collection state, counts, data types, and index specifications.
 */
async function inspectPreconditions(db, options = {}) {
  const coll = db.collection(TARGET_COLLECTION);
  const indexes = await coll.indexes();

  const totalStudents = await coll.countDocuments();

  // Aggregate user field types and duplicates
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

  const currentIndex = indexes.find((i) => i.name === INDEX_NAME);
  const tempIndex = indexes.find((i) => i.name === TEMP_INDEX_NAME);

  // Determine state classification
  let state = 'UNKNOWN';
  let isAlreadyMigrated = false;
  let isReadyForMigration = false;
  let isInterruptedTempExists = false;

  if (duplicateObjectIdCount > 0 || unexpectedTypesCount > 0) {
    state = 'STATE_INVALID_PRECONDITIONS';
    isReadyForMigration = false;
  } else if (currentIndex && isPartialObjectIdIndex(currentIndex) && !tempIndex) {
    state = 'STATE_ALREADY_MIGRATED';
    isAlreadyMigrated = true;
  } else if (tempIndex && (!currentIndex || !isPartialObjectIdIndex(currentIndex))) {
    state = 'STATE_INTERRUPTED_TEMP_EXISTS';
    isInterruptedTempExists = true;
  } else if (currentIndex && currentIndex.unique && !currentIndex.partialFilterExpression) {
    state = 'STATE_READY_FOR_MIGRATION';
    isReadyForMigration = true;
  } else if (!currentIndex) {
    state = 'STATE_READY_FOR_CREATION';
    isReadyForMigration = true;
  } else {
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
    currentIndex,
    tempIndex,
    state,
    isAlreadyMigrated,
    isReadyForMigration,
    isInterruptedTempExists,
  };
}

/**
 * Main Migration Orchestrator.
 *
 * @param {Object} options
 * @param {mongoose.Connection|mongodb.Db} options.db - Active MongoDB connection or Db instance
 * @param {boolean} [options.apply=false] - Explicit flag required to perform mutations
 * @param {string} [options.confirm=''] - Confirmation token required for apply
 * @param {boolean} [options.rollback=false] - Flag to run rollback
 * @param {string} [options.rollbackConfirm=''] - Confirmation token for rollback
 * @param {boolean} [options.allowTestDb=false] - Internal flag to permit isolated test DBs
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

  // Operational Safety: Guard target database name
  if (dbName !== TARGET_DB_NAME && !allowTestDb) {
    throw new Error(
      `SAFETY_VIOLATION: Refusing to run index migration against database '${dbName}'. Target must be exactly '${TARGET_DB_NAME}'.`
    );
  }

  const coll = db.collection(TARGET_COLLECTION);
  const pre = await inspectPreconditions(db, options);

  // -------------------------------------------------------------
  // ROLLBACK MODE
  // -------------------------------------------------------------
  if (rollback) {
    if (rollbackConfirm !== REQUIRED_ROLLBACK_TOKEN) {
      throw new Error(
        `ROLLBACK_BLOCKED: Rollback requires explicit token --confirm=${REQUIRED_ROLLBACK_TOKEN}`
      );
    }

    // Rollback Precondition Check: Can we safely restore non-partial unique index?
    if (pre.nullCount > 1) {
      throw new Error(
        `FATAL_ROLLBACK_ERROR: Cannot rollback to non-partial unique index because collection contains ${pre.nullCount} records with user: null. Non-partial unique index forbids multiple null values.`
      );
    }

    logger.log('--- EXECUTING ROLLBACK OF STUDENT USER INDEX ---');
    if (pre.currentIndex) {
      await coll.dropIndex(INDEX_NAME);
    }
    if (pre.tempIndex) {
      await coll.dropIndex(TEMP_INDEX_NAME);
    }

    // Restore original non-partial unique index
    await coll.createIndex({ user: 1 }, { unique: true, name: INDEX_NAME });
    const postRollbackIndexes = await coll.indexes();
    logger.log('✅ Rollback completed. Restored original non-partial unique index user_1.');
    return {
      success: true,
      action: 'ROLLED_BACK',
      indexes: postRollbackIndexes,
    };
  }

  // -------------------------------------------------------------
  // DRY-RUN MODE (DEFAULT)
  // -------------------------------------------------------------
  if (!apply) {
    const plannedActions = [];

    if (pre.isAlreadyMigrated) {
      plannedActions.push('No action needed: Index is already in desired partial unique state.');
    } else if (pre.isReadyForMigration) {
      plannedActions.push(`1. Create temporary partial unique index '${TEMP_INDEX_NAME}'.`);
      plannedActions.push(`2. Verify '${TEMP_INDEX_NAME}' is active and enforcing partial uniqueness.`);
      if (pre.currentIndex) {
        plannedActions.push(`3. Drop existing non-partial index '${INDEX_NAME}'.`);
      }
      plannedActions.push(`4. Drop temporary index '${TEMP_INDEX_NAME}' immediately before final index creation.`);
      plannedActions.push(`5. Create final partial unique index '${INDEX_NAME}'.`);
      plannedActions.push(`6. Verify final index state and post-conditions.`);
    } else if (pre.isInterruptedTempExists) {
      plannedActions.push(`Recovery action: Drop temporary index '${TEMP_INDEX_NAME}' and complete final index creation.`);
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
      currentOldIndex: pre.currentIndex,
      desiredNewIndex: DESIRED_INDEX_SPEC,
      plannedActions,
      readyToApply: pre.isReadyForMigration || pre.isAlreadyMigrated,
    };
  }

  // -------------------------------------------------------------
  // APPLY MODE
  // -------------------------------------------------------------
  if (confirm !== REQUIRED_CONFIRM_TOKEN) {
    throw new Error(
      `APPLY_BLOCKED: Migration execution requires confirmation token --confirm=${REQUIRED_CONFIRM_TOKEN}`
    );
  }

  // Precondition validations
  if (pre.duplicateObjectIdCount > 0) {
    throw new Error(
      `MIGRATION_ABORTED: Found ${pre.duplicateObjectIdCount} duplicate user ObjectIds in ${TARGET_COLLECTION}. Cannot build unique index.`
    );
  }

  if (pre.unexpectedTypesCount > 0) {
    throw new Error(
      `MIGRATION_ABORTED: Found ${pre.unexpectedTypesCount} records with unexpected user types in ${TARGET_COLLECTION}.`
    );
  }

  if (pre.isAlreadyMigrated) {
    logger.log('ℹ️ Migration skipped: students.user_1 is already migrated to partial unique index.');
    return {
      success: true,
      action: 'ALREADY_MIGRATED',
      indexes: pre.indexes,
    };
  }

  // Handle recovery if temporary index was left by previous interrupted run
  if (pre.isInterruptedTempExists) {
    logger.log(`⚠️ Interrupted state detected: '${TEMP_INDEX_NAME}' exists. Cleaning up temporary index...`);
    await coll.dropIndex(TEMP_INDEX_NAME);
  }

  logger.log('--- STARTING CONTROLLED USER INDEX MIGRATION ---');
  const beforeSnapshot = pre.indexes;

  // Step 1: Pre-validate data by building temporary partial unique index
  logger.log(`[Step 1/5] Building temporary partial unique index '${TEMP_INDEX_NAME}'...`);
  await coll.createIndex(
    { user: 1 },
    {
      unique: true,
      partialFilterExpression: { user: { $type: 'objectId' } },
      name: TEMP_INDEX_NAME,
    }
  );

  // Step 2: Verify temporary index is active
  logger.log(`[Step 2/5] Verifying temporary index '${TEMP_INDEX_NAME}'...`);
  const step2Indexes = await coll.indexes();
  const verifiedTemp = step2Indexes.find((i) => i.name === TEMP_INDEX_NAME);
  if (!verifiedTemp || !isPartialObjectIdIndex(verifiedTemp)) {
    throw new Error(`MIGRATION_FAILED: Temporary index '${TEMP_INDEX_NAME}' failed verification.`);
  }

  // Step 3: Drop old non-partial index if present
  if (pre.currentIndex) {
    logger.log(`[Step 3/5] Dropping legacy index '${INDEX_NAME}'...`);
    await coll.dropIndex(INDEX_NAME);
  }

  // Step 4: Drop temporary index to clear way for canonical name
  logger.log(`[Step 4/5] Dropping temporary index '${TEMP_INDEX_NAME}' to assign canonical name...`);
  await coll.dropIndex(TEMP_INDEX_NAME);

  // Step 5: Immediately create final partial unique index under canonical name
  logger.log(`[Step 5/5] Creating canonical partial unique index '${INDEX_NAME}'...`);
  await coll.createIndex(
    { user: 1 },
    {
      unique: true,
      partialFilterExpression: { user: { $type: 'objectId' } },
      name: INDEX_NAME,
    }
  );

  // Post-migration Verification
  const afterSnapshot = await coll.indexes();
  const finalIndex = afterSnapshot.find((i) => i.name === INDEX_NAME);

  if (!finalIndex || !isPartialObjectIdIndex(finalIndex)) {
    throw new Error(
      `MIGRATION_FAILED: Final index '${INDEX_NAME}' does not match expected partialFilterExpression specification.`
    );
  }

  logger.log('✅ Migration succeeded: students.user_1 is now a verified partial unique index.');

  return {
    success: true,
    action: 'MIGRATED',
    beforeSnapshot,
    afterSnapshot,
    finalIndexSpec: finalIndex,
  };
}

// -------------------------------------------------------------
// CLI RUNNER
// -------------------------------------------------------------
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
  DESIRED_INDEX_SPEC,
  REQUIRED_CONFIRM_TOKEN,
  REQUIRED_ROLLBACK_TOKEN,
  TARGET_DB_NAME,
  TARGET_COLLECTION,
  INDEX_NAME,
  TEMP_INDEX_NAME,
};
