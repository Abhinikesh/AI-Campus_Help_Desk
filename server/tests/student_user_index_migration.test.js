/**
 * server/tests/student_user_index_migration.test.js
 * Comprehensive Isolated Test Suite for Phase 3.2:
 * Controlled Student User Index Migration Preparation.
 *
 * SAFETY MANDATE:
 * - Runs exclusively against an ephemeral MongoMemoryServer.
 * - Asserts test connection is isolated and database name is NOT 'campus-erp'.
 * - Verifies all 9 Phase 3.2 requirements.
 * - ZERO live database mutation.
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
  REQUIRED_CONFIRM_TOKEN,
  REQUIRED_ROLLBACK_TOKEN,
  INDEX_NAME,
  TEMP_INDEX_NAME,
} = require('../scripts/migrate_student_user_index');

test('Phase 3.2: Controlled Student User Index Migration Suite', async (t) => {
  let mongod;
  let testUri;
  let testDb;
  let studentsColl;

  await t.test('Setup: Spin up isolated MongoMemoryServer', async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'campus-erp-test-phase3-2-isolated',
      },
    });

    testUri = mongod.getUri();
    assert.ok(testUri, 'MongoMemoryServer URI must be valid');
    assert.ok(!testUri.includes('27018'), 'Must not use live port 27018');

    await mongoose.connect(testUri);
    testDb = mongoose.connection.db;
    assert.notEqual(testDb.databaseName, 'campus-erp', 'CRITICAL: Must not connect to campus-erp');

    studentsColl = testDb.collection('students');
    console.log(`✅ [Phase 3.2 Test] Connected to isolated test DB: ${testDb.databaseName}`);
  });

  // Helper to reset collection to clean initial legacy state
  async function resetToLegacyState(userDocs = []) {
    await studentsColl.drop().catch(() => {});
    if (userDocs.length > 0) {
      await studentsColl.insertMany(userDocs);
    }
    // Create legacy non-partial unique index
    await studentsColl.createIndex({ user: 1 }, { unique: true, name: INDEX_NAME });
  }

  // -------------------------------------------------------------
  // TEST 1: Existing non-partial unique index detection
  // -------------------------------------------------------------
  await t.test('1. Existing non-partial unique index detection', async () => {
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
    assert.ok(pre.currentIndex, 'user_1 index must exist');
    assert.equal(pre.currentIndex.unique, true);
    assert.equal(isPartialObjectIdIndex(pre.currentIndex), false, 'Legacy index must not be partial');
    assert.equal(pre.isReadyForMigration, true);
  });

  // -------------------------------------------------------------
  // TEST 2: Duplicate non-null ObjectId detection blocks migration
  // -------------------------------------------------------------
  await t.test('2. Duplicate non-null ObjectId detection blocks migration', async () => {
    await studentsColl.drop().catch(() => {});
    const duplicateId = new mongoose.Types.ObjectId();

    // Insert records with duplicate user (without index initially)
    await studentsColl.insertMany([
      { rollNumber: 'R1', user: duplicateId },
      { rollNumber: 'R2', user: duplicateId },
      { rollNumber: 'R3', user: new mongoose.Types.ObjectId() },
    ]);

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.duplicateObjectIdCount, 1, 'Must detect 1 duplicate user group');
    assert.equal(pre.state, 'STATE_INVALID_PRECONDITIONS');
    assert.equal(pre.isReadyForMigration, false);

    // Attempting migration must fail closed
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
  });

  // -------------------------------------------------------------
  // TEST 3: Multiple null user values under desired partial index
  // -------------------------------------------------------------
  await t.test('3. Multiple null user values under desired partial index', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Migrate to partial index
    const res = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });
    assert.equal(res.success, true);
    assert.equal(res.action, 'MIGRATED');

    // Insert multiple offline students with user: null and undefined
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_1', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_2', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_3' }); // missing user field
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_4', user: null });

    const nullRecordsCount = await studentsColl.countDocuments({
      $or: [{ user: null }, { user: { $exists: false } }],
    });
    assert.equal(nullRecordsCount, 4, 'All 4 offline records must be persisted successfully');
  });

  // -------------------------------------------------------------
  // TEST 4: Duplicate ObjectId rejection under partial index
  // -------------------------------------------------------------
  await t.test('4. Duplicate ObjectId rejection under partial index', async () => {
    const sharedUserId = new mongoose.Types.ObjectId();

    await studentsColl.insertOne({ rollNumber: 'STUDENT_A', user: sharedUserId });

    // Inserting another student with the same non-null user ObjectId must fail with E11000
    await assert.rejects(
      async () => {
        await studentsColl.insertOne({ rollNumber: 'STUDENT_B_COLLISION', user: sharedUserId });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate non-null ObjectId must trigger E11000'
    );
  });

  // -------------------------------------------------------------
  // TEST 5: Unexpected index specification handling (fail closed)
  // -------------------------------------------------------------
  await t.test('5. Unexpected index specification handling (fails closed)', async () => {
    await studentsColl.drop().catch(() => {});
    // Create an unexpected index: user_1 is non-unique
    await studentsColl.createIndex({ user: 1 }, { unique: false, name: INDEX_NAME });

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.state, 'STATE_UNEXPECTED_INDEX_SPEC');
    assert.equal(pre.isReadyForMigration, false);

    // Dry-run reports not ready
    const dryRunResult = await runMigration({
      db: testDb,
      apply: false,
      allowTestDb: true,
    });
    assert.equal(dryRunResult.readyToApply, false);
    assert.ok(dryRunResult.plannedActions[0].includes('BLOCKED'));
  });

  // -------------------------------------------------------------
  // TEST 6: Dry-run performs zero writes and zero index changes
  // -------------------------------------------------------------
  await t.test('6. Dry-run performs zero writes and zero index changes', async () => {
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
    assert.equal(dryRun.plannedActions.length, 6);

    const countAfter = await studentsColl.countDocuments();
    const indexesAfter = await studentsColl.indexes();

    assert.equal(countBefore, countAfter, 'Document count must remain invariant in dry-run');
    assert.deepEqual(indexesBefore, indexesAfter, 'Index specifications must remain invariant in dry-run');
  });

  // -------------------------------------------------------------
  // TEST 7: Interrupted migration recovery
  // -------------------------------------------------------------
  await t.test('7. Interrupted migration recovery', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Simulate interrupted state: temp_user_partial_1 was created before a crash
    await studentsColl.createIndex(
      { user: 1 },
      {
        unique: true,
        partialFilterExpression: { user: { $type: 'objectId' } },
        name: TEMP_INDEX_NAME,
      }
    );

    const pre = await inspectPreconditions(testDb);
    assert.equal(pre.isInterruptedTempExists, true);
    assert.equal(pre.state, 'STATE_INTERRUPTED_TEMP_EXISTS');

    // Run migration in apply mode to recover
    const recovered = await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    assert.equal(recovered.success, true);
    assert.equal(recovered.action, 'MIGRATED');

    const finalIndexes = await studentsColl.indexes();
    const tempIndex = finalIndexes.find((i) => i.name === TEMP_INDEX_NAME);
    const finalIndex = finalIndexes.find((i) => i.name === INDEX_NAME);

    assert.equal(tempIndex, undefined, 'Temporary index must be cleaned up');
    assert.ok(finalIndex, 'Canonical user_1 index must exist');
    assert.equal(isPartialObjectIdIndex(finalIndex), true, 'Canonical index must be partial unique');
  });

  // -------------------------------------------------------------
  // TEST 8: Rollback before offline students are inserted vs after
  // -------------------------------------------------------------
  await t.test('8. Rollback before offline students are inserted vs blocked after', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Migrate to partial
    await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    // Rollback before any null students are inserted -> Must succeed
    const rollbackRes = await runMigration({
      db: testDb,
      rollback: true,
      rollbackConfirm: REQUIRED_ROLLBACK_TOKEN,
      allowTestDb: true,
    });

    assert.equal(rollbackRes.success, true);
    assert.equal(rollbackRes.action, 'ROLLED_BACK');

    const restoredIndexes = await studentsColl.indexes();
    const restoredUserIdx = restoredIndexes.find((i) => i.name === INDEX_NAME);
    assert.ok(restoredUserIdx);
    assert.equal(restoredUserIdx.unique, true);
    assert.equal(isPartialObjectIdIndex(restoredUserIdx), false, 'Must be restored to non-partial');

    // Now re-migrate to partial and insert offline students
    await runMigration({
      db: testDb,
      apply: true,
      confirm: REQUIRED_CONFIRM_TOKEN,
      allowTestDb: true,
    });

    await studentsColl.insertOne({ rollNumber: 'OFFLINE_A', user: null });
    await studentsColl.insertOne({ rollNumber: 'OFFLINE_B', user: null });

    // Attempting rollback now MUST FAIL CLOSED because multiple nulls exist
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
      'Rollback must be blocked when multiple null records exist'
    );
  });

  // -------------------------------------------------------------
  // TEST 9: Explicit APPLY flag and confirmation-token enforcement
  // -------------------------------------------------------------
  await t.test('9. Explicit APPLY flag and confirmation-token enforcement', async () => {
    const id1 = new mongoose.Types.ObjectId();
    await resetToLegacyState([{ rollNumber: 'R1', user: id1 }]);

    // Case A: apply: true without token
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          apply: true,
          confirm: '',
          allowTestDb: true,
        });
      },
      (err) => {
        assert.match(err.message, /APPLY_BLOCKED/);
        return true;
      }
    );

    // Case B: apply: true with incorrect token
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb,
          apply: true,
          confirm: 'WRONG_TOKEN_VALUE',
          allowTestDb: true,
        });
      },
      (err) => {
        assert.match(err.message, /APPLY_BLOCKED/);
        return true;
      }
    );

    // Case C: Target DB safety - without allowTestDb flag, refuses non-campus-erp DB
    await assert.rejects(
      async () => {
        await runMigration({
          db: testDb, // name is campus-erp-test-phase3-2-isolated
          apply: false,
          allowTestDb: false,
        });
      },
      (err) => {
        assert.match(err.message, /SAFETY_VIOLATION/);
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // TEARDOWN
  // -------------------------------------------------------------
  await t.test('Teardown: Disconnect and terminate isolated MongoMemoryServer', async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('✅ [Phase 3.2 Test] Disconnected and destroyed isolated MongoMemoryServer.');
  });
});
