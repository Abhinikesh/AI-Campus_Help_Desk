/**
 * server/tests/hr_leave_policy_seed_migration_integrity.test.js
 * Focused automated verification for Part 10.7: Leave Policy Seed & Migration Integrity.
 * Proves that seed and synchronization scripts never fabricate or auto-seed unapproved leave policies.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { verifyTestDatabaseIsolation, assertConnectionIsolated } = require('./helpers/testDatabase');
const { syncFacultyProfiles } = require('../scripts/sync_faculty_employee_profiles');
const hrController = require('../controllers/hr.controller');
const LeavePolicy = require('../models/LeavePolicy');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
}

test('Part 10.7: Leave Policy Seed & Migration Integrity Suite', async (t) => {
  let mongod;
  let testUri;
  let facultyUser1, facultyUser2, facultyDoc1, facultyDoc2;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and seed synthetic faculty users', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_hr_policy_seed_migration_isolated' }
    });
    testUri = mongod.getUri() + 'test_hr_policy_seed_migration_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    // Create synthetic faculty users (no EmployeeProfile yet)
    facultyUser1 = await User.create({
      name: 'Dr. Anita Desai',
      email: 'anita.desai@test.local',
      role: 'faculty',
      loginId: 'FAC_SEED_001',
      passwordHash: 'dummyhash'
    });

    facultyDoc1 = await Faculty.create({
      user: facultyUser1._id,
      employeeId: 'FAC-D001',
      name: 'Dr. Anita Desai',
      email: facultyUser1.email,
      department: 'Computer Science & Engineering',
      designation: 'Associate Professor'
    });

    facultyUser2 = await User.create({
      name: 'Prof. Ramesh Rao',
      email: 'ramesh.rao@test.local',
      role: 'faculty',
      loginId: 'FAC_SEED_002',
      passwordHash: 'dummyhash'
    });

    facultyDoc2 = await Faculty.create({
      user: facultyUser2._id,
      employeeId: 'FAC-D002',
      name: 'Prof. Ramesh Rao',
      email: facultyUser2.email,
      department: 'Electronics & Communication Engineering',
      designation: 'Professor'
    });
  });

  // ── 1. Running sync logic on empty database does not create unapproved policies ─
  await t.test('1. Employee-profile synchronization does not create unapproved leave policies', async () => {
    const policyCountBefore = await LeavePolicy.countDocuments();
    assert.equal(policyCountBefore, 0, 'LeavePolicy collection must start empty');

    const result = await syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true });

    const policyCountAfter = await LeavePolicy.countDocuments();
    assert.equal(policyCountAfter, 0, 'Synchronization script must NEVER insert unapproved leave policies');
    assert.equal(result.createdCount, 2, 'Must create EmployeeProfile for both faculty members');
    assert.equal(result.activePoliciesCount, 0, 'Must record 0 active policies in preflight');
    assert.equal(result.balancesInitializedCount, 0, 'Must skip balance initialization when no policies exist');
  });

  // ── 2. Missing policies are detected safely during preflight ───────────────
  await t.test('2. Missing required policies produce safe preflight handling with zero balance fabrication', async () => {
    // Confirm zero balances and zero ledger entries exist
    const balanceCount = await EmployeeLeaveBalance.countDocuments();
    const ledgerCount = await LeaveLedgerEntry.countDocuments();

    assert.equal(balanceCount, 0, 'No leave balances should exist when policies are missing');
    assert.equal(ledgerCount, 0, 'No leave ledger entries should exist when policies are missing');
  });

  // ── 3. Script remains idempotent and does not duplicate EmployeeProfiles ───
  await t.test('3. Re-running synchronization script is strictly idempotent and creates zero duplicates', async () => {
    const profileCountBefore = await EmployeeProfile.countDocuments();
    assert.equal(profileCountBefore, 2);

    const reRunResult = await syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true });

    const profileCountAfter = await EmployeeProfile.countDocuments();
    assert.equal(profileCountAfter, profileCountBefore, 'EmployeeProfile count must remain exactly 2');
    assert.equal(reRunResult.createdCount, 0, 'Must create 0 new profiles on re-run');
    assert.equal(reRunResult.existingCount, 2, 'Must recognize all existing profiles');
  });

  // ── 4. Explicit admin policy creation still works via POST endpoint ────────
  await t.test('4. Explicit administrative policy creation works and enforces uniqueness', async () => {
    const req = {
      user: { role: 'admin' },
      body: {
        name: 'Official Annual Leave',
        code: 'TEST-OAL',
        description: 'Officially approved institution-wide annual quota',
        annualEntitlement: 20,
        applicableCategory: 'all'
      }
    };
    const res = createMockRes();
    await hrController.createLeavePolicy(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.code, 'TEST-OAL');

    const totalPolicies = await LeavePolicy.countDocuments();
    assert.equal(totalPolicies, 1, 'Only explicitly created policy exists');
  });

  // ── 5. Existing policies are preserved when sync is re-run ──────────────────
  await t.test('5. Existing approved policies are preserved and not overwritten on subsequent sync', async () => {
    const syncWithPolicy = await syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true });

    assert.equal(syncWithPolicy.activePoliciesCount, 1, 'Preflight detects approved policy');
    assert.equal(syncWithPolicy.createdCount, 0, 'No duplicate profiles created');
    assert.equal(syncWithPolicy.existingCount, 2);

    // Verify existing policy is unmodified
    const policyDoc = await LeavePolicy.findOne({ code: 'TEST-OAL' });
    assert.ok(policyDoc, 'Existing approved policy TEST-OAL must still exist');
    assert.equal(policyDoc.annualEntitlement, 20);

    // Verify balances were initialized for the approved policy
    const balances = await EmployeeLeaveBalance.find({ policy: policyDoc._id });
    assert.equal(balances.length, 2, 'Both faculty members receive balances for the approved policy');
    assert.equal(balances[0].currentBalance, 20);
    assert.equal(balances[1].currentBalance, 20);
  });

  // ── 6. Existing balances and ledgers are not duplicated on re-sync ──────────
  await t.test('6. Existing balances and ledgers remain invariant on subsequent sync runs', async () => {
    const balancesBefore = await EmployeeLeaveBalance.countDocuments();
    const ledgersBefore = await LeaveLedgerEntry.countDocuments();

    await syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true });

    const balancesAfter = await EmployeeLeaveBalance.countDocuments();
    const ledgersAfter = await LeaveLedgerEntry.countDocuments();

    assert.equal(balancesBefore, balancesAfter, 'Balances must not be duplicated');
    assert.equal(ledgersBefore, ledgersAfter, 'Ledger entries must not be duplicated');
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect and stop isolated MongoMemoryServer', async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
    assert.equal(mongoose.connection.readyState, 0);
  });

});
