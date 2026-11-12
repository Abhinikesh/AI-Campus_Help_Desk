/**
 * server/tests/student_user_index_migration.test.js
 * Phase 3.2.2 — Zero-Gap Student User Index Migration Test Suite.
 *
 * SAFETY MANDATE:
 * - Runs exclusively against an ephemeral MongoMemoryServer.
 * - Asserts the test connection is isolated and database name is NOT 'campus-erp'.
 * - Zero live database mutation.
 *
 * Coverage:
 *  1.  Legacy non-partial 'user_1' detection (STATE_READY_FOR_MIGRATION).
 *  2.  Duplicate non-null ObjectId detection blocks migration.
 *  3.  Coexistence: both 'user_partial_1' and legacy 'user_1' present (STATE_TRANSITION).
 *  4.  Legacy 'user_1' continues to enforce uniqueness while 'user_partial_1' is being created.
 *  5.  'user_partial_1' enforces uniqueness before legacy 'user_1' is removed.
 *  6.  Multiple null/missing user values accepted by the partial index post-migration.
 *  7.  Duplicate ObjectId values rejected by the partial index post-migration.
 *  8.  Interrupted migration (STATE_TRANSITION) safely resumed without dropping 'user_partial_1'.
 *  9.  Unexpected index states fail closed (zero database mutations).
 * 10.  Rollback safeguards — precondition checks, confirmation token, and null-count guard.
 * 11.  Dry-run causes zero database writes or index changes.
 * 12.  Confirmation-token enforcement blocks unauthorized apply.
 * 13.  'user_partial_1' never dropped during normal forward migration.
 * 14.  Document count invariance across the full migration sequence.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  runMigration,
  inspectPreconditions,
  isPartialObjectIdIndex,
  isLegacyNonPartialIndex,
  REQUIRED_CONFIRM_TOKEN,
  REQUIRED_ROLLBACK_TOKEN,
  LEGACY_CONFIRM_TOKEN,
  LEGACY_ROLLBACK_TOKEN,
  INDEX_NAME,         // = 'user_partial_1'
  NEW_INDEX_NAME,     // = 'user_partial_1'
  LEGACY_INDEX_NAME,  // = 'user_1'
  TEMP_INDEX_NAME,    // = 'temp_user_partial_1' (retired)
} = require('../scripts/migrate_student_user_index');

test('Phase 3.2.2: Zero-Gap Student User Index Migration Suite', async (t) => {
  let mongod;
  let testUri;
  let testDb;
  let studentsColl;

  // ──────────────────────────────────────────────────────────────
  // SETUP
  // ──────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer', async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'campus-erp-test-phase3-2-2-isolated',
      },
    });

    testUri = mongod.getUri();
    assert.ok(testUri, 'MongoMemoryServer URI must be valid');
    assert.ok(!testUri.includes('27018'), 'Must not use live port 27018');

    await mongoose.connect(testUri);
    testDb = mongoose.connection.db;
    assert.notEqual(testDb.databaseName, 'campus-erp', 'CRITICAL: Must not connect to campus-erp');

    studentsColl = testDb.collection('students');
    console.log(`✅ [Phase 3.2.2 Test] Connected to isolated test DB: ${testDb.databaseName}`);
  });

  // ──────────────────────────────────────────────────────────────
  // TEST HELPERS
  // ──────────────────────────────────────────────────────────────

  /** Reset to clean legacy state: only legacy non-partial 'user_1' present. */
  async function resetToLegacyState(userDocs = []) {
    await studentsColl.drop().catch(() => {});
    if (userDocs.length > 0) {
      await studentsColl.insertMany(userDocs);
    }
    await studentsColl.createIndex({ user: 1 }, { unique: true, name: LEGACY_INDEX_NAME });
  }

  /** Reset to fully migrated state: only 'user_partial_1' present. */
  async function resetToMigratedState(userDocs = []) {
    await studentsColl.drop().catch(() => {});
    if (userDocs.length > 0) {
      await studentsColl.insertMany(userDocs);
    }
    await studentsColl.createIndex(
      { user: 1 },
      { unique: true, partialFilterExpression: { user: { $type: 'objectId' } }, name: NEW_INDEX_NAME }
    );
  }

  /** Reset to STATE_TRANSITION: both 'user_partial_1' and legacy 'user_1' present. */
  async function resetToTransitionState(userDocs = []) {
    await studentsColl.drop().catch(() => {});
    if (userDocs.length > 0) {
      await studentsColl.insertMany(userDocs);
    }
    // Legacy index first (non-partial — different options, so both coexist)
    await studentsColl.createIndex({ user: 1 }, { unique: true, name: LEGACY_INDEX_NAME });
    // New partial index alongside it
    await studentsColl.createIndex(
      { user: 1 },
      { unique: true, partialFilterExpression: { user: { $type: 'objectId' } }, name: NEW_INDEX_NAME }
    );
  }

  // ──────────────────────────────────────────────────────────────
  // TEST 1: Legacy non-partial 'user_1' detection
  // ──────────────────────────────────────────────────────────────
  await t.test('1. Legacy non-partial user_1 detection (STATE_READY_FOR_MIGRATION)', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    await resetToLegacyState([
      { rollNumber: 'R1', user: id1 },
      { rollNumber: 'R2', user: id2 },
    ]);

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.totalStudents, 2);
    assert.equal(pre.objectIdCount, 2);
    assert.equal(pre.nullCount, 0);
    assert.equal(pre.duplicateObjectIdCount, 0);
    assert.equal(pre.state, 'STATE_READY_FOR_MIGRATION');
    assert.ok(pre.legacyIndex, 'Legacy user_1 index must be detected');
    assert.equal(pre.legacyIndex.unique, true);
    assert.equal(isLegacyNonPartialIndex(pre.legacyIndex), true, 'Legacy index must be non-partial');
    assert.equal(pre.newIndex, undefined, 'New partial index must NOT exist yet');
    assert.equal(pre.isReadyForMigration, true);
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 2: Duplicate non-null ObjectId detection blocks migration
  // ──────────────────────────────────────────────────────────────
  await t.test('2. Duplicate non-null ObjectId detection blocks migration', async () => {
    await studentsColl.drop().catch(() => {});
    const duplicateId = new mongoose.Types.ObjectId();

    // Insert without index so we can seed duplicates
    await studentsColl.insertMany([
      { rollNumber: 'R1', user: duplicateId },
      { rollNumber: 'R2', user: duplicateId },
      { rollNumber: 'R3', user: new mongoose.Types.ObjectId() },
    ]);

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.duplicateObjectIdCount, 1, 'Must detect 1 duplicate user group');
    assert.equal(pre.state, 'STATE_INVALID_PRECONDITIONS');
    assert.equal(pre.isReadyForMigration, false);

    // Apply must fail closed
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          apply: true,
          confirm: REQUIRED_CONFIRM_TOKEN,
          allowTestDb: true,
        });
      },
      (err) => {
        assert.match(err.message, /duplicate user ObjectIds/i);
        return true;
      }
    );

    // Verify zero index mutations occurred
    const indexesAfter = await studentsColl.indexes();
    const userIndexes = indexesAfter.filter((i) => i.key && i.key.user);
    assert.equal(userIndexes.length, 0, 'No user index must have been created by failed migration');
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 3: Coexistence detection (STATE_TRANSITION)
  // ──────────────────────────────────────────────────────────────
  await t.test('3. Both user_partial_1 and legacy user_1 coexist (STATE_TRANSITION)', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToTransitionState([{ rollNumber: 'R1', user: id1 }]);

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.state, 'STATE_TRANSITION');
    assert.equal(pre.isInTransition, true);
    assert.equal(pre.isReadyForMigration, true);
    assert.ok(pre.legacyIndex, 'Legacy user_1 must be present in transition');
    assert.ok(pre.newIndex, 'New user_partial_1 must be present in transition');
    assert.equal(isLegacyNonPartialIndex(pre.legacyIndex), true);
    assert.equal(isPartialObjectIdIndex(pre.newIndex), true);
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 4: Legacy user_1 enforces uniqueness while user_partial_1 is being created
  // ──────────────────────────────────────────────────────────────
  await t.test('4. Legacy user_1 enforces uniqueness during transition window', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    await resetToTransitionState([
      { rollNumber: 'R1', user: id1 },
      { rollNumber: 'R2', user: id2 },
    ]);

    // While both indexes are present, inserting a duplicate ObjectId must be rejected
    // because legacy user_1 is still active and enforcing
    await assert.rejects(
      async () => {
        await studentsColl.insertOne({ rollNumber: 'R_DUP', user: id1 });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'),
          'Legacy index must reject duplicate during coexistence window');
        return true;
      }
    );
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 5: user_partial_1 enforces uniqueness before legacy is removed
  // ──────────────────────────────────────────────────────────────
  await t.test('5. user_partial_1 enforces uniqueness before legacy user_1 is removed', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    await resetToTransitionState([
      { rollNumber: 'R1', user: id1 },
      { rollNumber: 'R2', user: id2 },
    ]);

    // Drop the legacy index manually to simulate post-Step-7 state with only user_partial_1
    await studentsColl.dropIndex(LEGACY_INDEX_NAME);

    // Now only user_partial_1 is present — must still reject duplicate non-null ObjectIds
    await assert.rejects(
      async () => {
        await studentsColl.insertOne({ rollNumber: 'R_DUP', user: id1 });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'),
          'user_partial_1 must reject duplicate ObjectId after legacy index is gone');
        return true;
      }
    );

    // But inserting null users must be allowed
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_A', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_B', user: null });
    const nullCount = await studentsColl.countDocuments({ user: null });
    assert.equal(nullCount, 2, 'Multiple null users accepted by partial index');
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 6: Multiple null/missing user values accepted post-migration
  // ──────────────────────────────────────────────────────────────
  await t.test('6. Multiple null/missing user values accepted by partial index post-migration', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    const res = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });
    assert.equal(res.success, true);
    assert.equal(res.action, 'MIGRATED');

    // Verify user_partial_1 is present and legacy is gone
    const indexes = await studentsColl.indexes();
    assert.ok(indexes.find((i) => i.name === NEW_INDEX_NAME), 'user_partial_1 must exist');
    assert.equal(indexes.find((i) => i.name === LEGACY_INDEX_NAME), undefined, 'user_1 must be gone');

    // Insert multiple offline students
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_1', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_2', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_3' }); // missing user field
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_4', user: null });

    const nullCount = await studentsColl.countDocuments({
      $or: [{ user: null }, { user: { $exists: false } }],
    });
    assert.equal(nullCount, 4, 'All 4 offline records must be persisted successfully');
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 7: Duplicate ObjectId rejection under partial index
  // ──────────────────────────────────────────────────────────────
  await t.test('7. Duplicate ObjectId values rejected by user_partial_1', async () => {
    // State from test 6: user_partial_1 is active
    const sharedUserId = new mongoose.Types.ObjectId();

    await studentsColl.insertOne({ rollNumber: 'STUDENT_A', user: sharedUserId });

    await assert.rejects(
      async () => {
        await studentsColl.insertOne({ rollNumber: 'STUDENT_B_COLLISION', user: sharedUserId });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'),
          'Duplicate non-null ObjectId must trigger E11000');
        return true;
      }
    );
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 8: Interrupted migration (STATE_TRANSITION) safely resumed
  // ──────────────────────────────────────────────────────────────
  await t.test('8. STATE_TRANSITION recovery: resumed without dropping user_partial_1', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    await resetToTransitionState([
      { rollNumber: 'R1', user: id1 },
      { rollNumber: 'R2', user: id2 },
    ]);

    // Confirm STATE_TRANSITION detection
    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.state, 'STATE_TRANSITION');

    // Apply should resume from Step 7 (skip Step 4 since user_partial_1 already exists)
    const recovered = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    assert.equal(recovered.success, true);
    assert.equal(recovered.action, 'MIGRATED');

    const finalIndexes = await studentsColl.indexes();
    const userPartial = finalIndexes.find((i) => i.name === NEW_INDEX_NAME);
    const legacyGone = finalIndexes.find((i) => i.name === LEGACY_INDEX_NAME);
    const tempGone = finalIndexes.find((i) => i.name === TEMP_INDEX_NAME);

    assert.ok(userPartial, 'user_partial_1 must remain active post-recovery');
    assert.equal(isPartialObjectIdIndex(userPartial), true, 'user_partial_1 must have correct partial spec');
    assert.equal(legacyGone, undefined, 'Legacy user_1 must be dropped after recovery');
    assert.equal(tempGone, undefined, 'Retired temp_user_partial_1 must not be present');

    // Document count must be preserved
    const countAfter = await studentsColl.countDocuments();
    assert.equal(countAfter, recovered.documentCount);
    assert.equal(countAfter, 2);
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 9: Unexpected index states fail closed
  // ──────────────────────────────────────────────────────────────
  await t.test('9. Unexpected index specification fails closed (zero mutations)', async () => {
    await studentsColl.drop().catch(() => {});
    // Create a non-unique user_1 — anomalous state
    await studentsColl.createIndex({ user: 1 }, { unique: false, name: LEGACY_INDEX_NAME });

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.state, 'STATE_UNEXPECTED_INDEX_SPEC');
    assert.equal(pre.isReadyForMigration, false);

    // Dry-run must report BLOCKED
    const dryRun = await runMigration({
      db: testDb,
      apply: false,
      allowTestDb: true,
    });
    assert.equal(dryRun.readyToApply, false);
    assert.ok(dryRun.plannedActions[0].includes('BLOCKED'));

    // Apply must fail closed without touching the database
    const indexesBefore = await studentsColl.indexes();
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          apply: true,
          confirm: REQUIRED_CONFIRM_TOKEN,
          allowTestDb: true,
        });
      },
      (err) => {
        assert.match(err.message, /MIGRATION_ABORTED/);
        assert.match(err.message, /STATE_UNEXPECTED_INDEX_SPEC/);
        return true;
      }
    );
    const indexesAfter = await studentsColl.indexes();
    assert.deepEqual(indexesBefore, indexesAfter, 'Index specs must be invariant after failed apply');

    // Also verify retired temp_user_partial_1 is treated as UNEXPECTED_INDEX_SPEC
    await studentsColl.drop().catch(() => {});
    await studentsColl.createIndex(
      { user: 1 },
      { unique: true, partialFilterExpression: { user: { $type: 'objectId' } }, name: TEMP_INDEX_NAME }
    );
    const preRetired = await inspectPreconditions(testDb);
    assert.equal(preRetired.state, 'STATE_UNEXPECTED_INDEX_SPEC');
    assert.equal(preRetired.isInterruptedTempExists, true);
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 10: Rollback safeguards
  // ──────────────────────────────────────────────────────────────
  await t.test('10. Rollback safeguards — preconditions, token, null-count guard', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Migrate forward
    await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    // 10a: Missing rollback token must be rejected
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          rollback: true,
          rollbackConfirm: '',
          allowTestDb: true,
        });
      },
      (err) => { assert.match(err.message, /ROLLBACK_BLOCKED/); return true; }
    );

    // 10b: Wrong rollback token must be rejected
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          rollback: true,
          rollbackConfirm: 'WRONG_TOKEN',
          allowTestDb: true,
        });
      },
      (err) => { assert.match(err.message, /ROLLBACK_BLOCKED/); return true; }
    );

    // 10c: Rollback must refuse if user_partial_1 is NOT the active index
    await studentsColl.drop().catch(() => {});
    await studentsColl.createIndex({ user: 1 }, { unique: true, name: LEGACY_INDEX_NAME });
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          rollback: true,
          rollbackConfirm: REQUIRED_ROLLBACK_TOKEN,
          allowTestDb: true,
        });
      },
      (err) => { assert.match(err.message, /ROLLBACK_BLOCKED/); return true; }
    );

    // 10d: Valid rollback before offline students exist → must succeed
    await resetToMigratedState([{ rollNumber: 'R1', user: id1 }]);
    const rollbackRes = await runMigration({
      db: testDb,
      rollback: true,
      rollbackConfirm: REQUIRED_ROLLBACK_TOKEN,
      allowTestDb: true,
    });
    assert.equal(rollbackRes.success, true);
    assert.equal(rollbackRes.action, 'ROLLED_BACK');

    const restoredIndexes = await studentsColl.indexes();
    const restoredLegacy = restoredIndexes.find((i) => i.name === LEGACY_INDEX_NAME);
    const newGone = restoredIndexes.find((i) => i.name === NEW_INDEX_NAME);
    assert.ok(restoredLegacy, 'Legacy user_1 must be restored');
    assert.equal(isLegacyNonPartialIndex(restoredLegacy), true, 'Restored index must be non-partial');
    assert.equal(newGone, undefined, 'user_partial_1 must be gone after rollback');

    // 10e: Legacy rollback token must also be accepted (backward compat)
    await resetToMigratedState([{ rollNumber: 'R1', user: id1 }]);
    const rollbackResLegacy = await runMigration({
      db: testDb,
      rollback: true,
      rollbackConfirm: LEGACY_ROLLBACK_TOKEN,
      allowTestDb: true,
    });
    assert.equal(rollbackResLegacy.success, true);

    // 10f: Rollback blocked when multiple null records exist
    await resetToMigratedState([{ rollNumber: 'R1', user: id1 }]);
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_A', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_B', user: null });

    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          rollback: true,
          rollbackConfirm: REQUIRED_ROLLBACK_TOKEN,
          allowTestDb: true,
        });
      },
      (err) => {
        assert.match(err.message, /FATAL_ROLLBACK_ERROR/);
        assert.match(err.message, /records with user: null/);
        return true;
      },
      'Rollback must be permanently blocked when multiple null records exist'
    );
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 11: Dry-run causes zero database writes or index changes
  // ──────────────────────────────────────────────────────────────
  await t.test('11. Dry-run performs zero database writes or index changes', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    await resetToLegacyState([
      { rollNumber: 'R1', user: id1 },
      { rollNumber: 'R2', user: id2 },
    ]);

    const countBefore = await studentsColl.countDocuments();
    const indexesBefore = await studentsColl.indexes();

    const dryRun = await runMigration({
      db: testDb,
      apply: false,
      allowTestDb: true,
    });

    assert.equal(dryRun.dryRun, true);
    assert.equal(dryRun.readyToApply, true);
    assert.equal(dryRun.preconditions.totalStudents, 2);
    assert.ok(dryRun.plannedActions.length >= 7, 'Must describe all 7 migration steps');

    const countAfter = await studentsColl.countDocuments();
    const indexesAfter = await studentsColl.indexes();

    assert.equal(countBefore, countAfter, 'Document count must remain invariant in dry-run');
    assert.deepEqual(indexesBefore, indexesAfter, 'Index specifications must remain invariant in dry-run');
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 12: Confirmation-token enforcement blocks unauthorized apply
  // ──────────────────────────────────────────────────────────────
  await t.test('12. Confirmation-token enforcement blocks unauthorized apply', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // No token
    await assert.rejects(
      async () => {
        await runMigration({ db: testDb, apply: true, confirm: '', allowTestDb: true });
      },
      (err) => { assert.match(err.message, /APPLY_BLOCKED/); return true; }
    );

    // Wrong token
    await assert.rejects(
      async () => {
        await runMigration({ db: testDb, apply: true, confirm: 'WRONG_TOKEN', allowTestDb: true });
      },
      (err) => { assert.match(err.message, /APPLY_BLOCKED/); return true; }
    );

    // Legacy token (Phase 3.2) must still be accepted for smooth operator transition
    const resLegacy = await runMigration({
      db: testDb,
      apply: true,
      confirm: LEGACY_CONFIRM_TOKEN,
      allowTestDb: true,
    });
    assert.equal(resLegacy.success, true);
    assert.equal(resLegacy.action, 'MIGRATED');

    // Safety-violation if allowTestDb is false and DB is not campus-erp
    await assert.rejects(
      async () => {
        await runMigration({ db: testDb, apply: false, allowTestDb: false });
      },
      (err) => { assert.match(err.message, /SAFETY_VIOLATION/); return true; }
    );
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 13: user_partial_1 is never dropped during forward migration
  // ──────────────────────────────────────────────────────────────
  await t.test('13. user_partial_1 is never dropped during normal forward migration', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Track index mutations by sampling during migration
    // (we cannot hook into individual steps, so we verify the final state)
    const result = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.action, 'MIGRATED');

    // The afterSnapshot must NOT contain user_1 (legacy) or temp_user_partial_1 (retired)
    const retiredTemp = result.afterSnapshot.find((i) => i.name === TEMP_INDEX_NAME);
    const legacyPresent = result.afterSnapshot.find((i) => i.name === LEGACY_INDEX_NAME);
    const newPresent = result.afterSnapshot.find((i) => i.name === NEW_INDEX_NAME);

    assert.equal(retiredTemp, undefined, 'Retired temp index must never appear in final snapshot');
    assert.equal(legacyPresent, undefined, 'Legacy user_1 must be absent from final snapshot');
    assert.ok(newPresent, 'user_partial_1 must be present in final snapshot');
    assert.equal(isPartialObjectIdIndex(newPresent), true);

    // Also confirm STATE_ALREADY_MIGRATED is returned on a second apply attempt
    const secondApply = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });
    assert.equal(secondApply.action, 'ALREADY_MIGRATED');
  });

  // ──────────────────────────────────────────────────────────────
  // TEST 14: Document count invariance across the full migration sequence
  // ──────────────────────────────────────────────────────────────
  await t.test('14. Document count invariance across full migration sequence', async () => {
    const ids = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
    await resetToLegacyState(
      ids.map((id, i) => ({ rollNumber: `DC_R${i}`, user: id }))
    );

    const countBefore = await studentsColl.countDocuments();
    assert.equal(countBefore, 5);

    const result = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.documentCount, 5, 'documentCount field must reflect preserved count');

    const countAfter = await studentsColl.countDocuments();
    assert.equal(countAfter, 5, 'Live document count must be invariant');
  });

  // ──────────────────────────────────────────────────────────────
  // TEARDOWN
  // ──────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect and terminate isolated MongoMemoryServer', async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('✅ [Phase 3.2.2 Test] Disconnected and destroyed isolated MongoMemoryServer.');
  });
});
