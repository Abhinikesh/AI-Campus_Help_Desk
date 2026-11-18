/**
 * server/tests/hr_employee_profile_provisioning_integrity.test.js
 * Comprehensive automated verification for Part 10.8:
 * HR Employee Profile Provisioning Integrity, Read-Only GET Endpoints,
 * RBAC Boundaries, and Concurrency-Safe Provisioning.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { verifyTestDatabaseIsolation, assertConnectionIsolated } = require('./helpers/testDatabase');
const hrController = require('../controllers/hr.controller');
const { hrService } = require('../services/hr.service');
const { syncFacultyProfiles } = require('../scripts/sync_faculty_employee_profiles');

const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');
const EmployeeLeaveApplication = require('../models/EmployeeLeaveApplication');
const EmployeeAttendance = require('../models/EmployeeAttendance');

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

test('Part 10.8: HR Employee Profile Provisioning Integrity Suite', async (t) => {
  let mongod;
  let testUri;
  let unprovisionedFacultyUser, unprovisionedFacultyDoc;
  let provisionedFacultyUser, provisionedFacultyDoc, provisionedProfile;
  let adminUser;
  let testDept, testDesig, approvedPolicy;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and seed base fixtures', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_hr_profile_provisioning_isolated' }
    });
    testUri = mongod.getUri() + 'test_hr_profile_provisioning_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    // Ensure database indexes are fully built on the ephemeral instance
    await EmployeeProfile.init();
    await EmployeeLeaveBalance.init();
    await LeaveLedgerEntry.init();
    await Department.init();
    await Designation.init();

    // Create Departments and Designations
    testDept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      type: 'academic',
      isActive: true
    });

    testDesig = await Designation.create({
      name: 'Assistant Professor',
      title: 'Assistant Professor',
      code: 'ASST_PROF',
      category: 'teaching_faculty',
      department: testDept._id,
      level: 3,
      isActive: true
    });

    // Create Approved Leave Policy
    approvedPolicy = await LeavePolicy.create({
      name: 'Casual Leave',
      code: 'TEST-CL',
      description: 'Approved casual leave policy',
      applicableCategory: 'all',
      annualEntitlement: 12,
      maxConsecutiveDays: 3,
      requiresProof: false,
      isActive: true
    });

    // Create Admin User
    adminUser = await User.create({
      name: 'HR Admin System',
      email: 'hradmin@test.local',
      role: 'hr_admin',
      loginId: 'ADM_HR_001',
      passwordHash: 'dummyhash'
    });

    // 1. Unprovisioned Faculty (User + Faculty document, but NO EmployeeProfile)
    unprovisionedFacultyUser = await User.create({
      name: 'Dr. Suresh Kumar',
      email: 'suresh.kumar@test.local',
      role: 'faculty',
      loginId: 'FAC_UNPROV_001',
      passwordHash: 'dummyhash'
    });

    unprovisionedFacultyDoc = await Faculty.create({
      user: unprovisionedFacultyUser._id,
      employeeId: 'FAC-SK01',
      name: 'Dr. Suresh Kumar',
      email: unprovisionedFacultyUser.email,
      department: 'Computer Science & Engineering',
      designation: 'Assistant Professor'
    });

    // 2. Provisioned Faculty (User + Faculty document + explicit EmployeeProfile + LeaveBalance)
    provisionedFacultyUser = await User.create({
      name: 'Dr. Meera Iyer',
      email: 'meera.iyer@test.local',
      role: 'faculty',
      loginId: 'FAC_PROV_001',
      passwordHash: 'dummyhash'
    });

    provisionedFacultyDoc = await Faculty.create({
      user: provisionedFacultyUser._id,
      employeeId: 'FAC-MI01',
      name: 'Dr. Meera Iyer',
      email: provisionedFacultyUser.email,
      department: 'Computer Science & Engineering',
      designation: 'Assistant Professor'
    });

    provisionedProfile = await EmployeeProfile.create({
      employeeId: 'EMP-PROV-001',
      user: provisionedFacultyUser._id,
      firstName: 'Meera',
      lastName: 'Iyer',
      displayName: 'Dr. Meera Iyer',
      officialEmail: provisionedFacultyUser.email,
      employeeCategory: 'teaching_faculty',
      department: testDept._id,
      designation: testDesig._id,
      employmentType: 'permanent',
      employmentStatus: 'active',
      joiningDate: new Date('2024-01-01'),
      onboardingStatus: 'completed'
    });

    // Initialize leave balance for provisioned faculty
    await hrService.initializeLeaveBalancesForEmployee(provisionedProfile._id, 2026, adminUser._id);
  });

  // ── 1. Faculty GET profile with no EmployeeProfile creates no records ──────
  await t.test('1. Faculty GET profile with no EmployeeProfile returns 404 and creates zero records', async () => {
    const profileCountBefore = await EmployeeProfile.countDocuments();
    const deptCountBefore = await Department.countDocuments();
    const desigCountBefore = await Designation.countDocuments();

    const req = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' }
    };
    const res = createMockRes();

    await hrController.getMyProfile(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.message, /No employee profile linked/i);

    const profileCountAfter = await EmployeeProfile.countDocuments();
    const deptCountAfter = await Department.countDocuments();
    const desigCountAfter = await Designation.countDocuments();

    assert.equal(profileCountAfter, profileCountBefore, 'EmployeeProfile count must not change on GET');
    assert.equal(deptCountAfter, deptCountBefore, 'Department count must not change on GET');
    assert.equal(desigCountAfter, desigCountBefore, 'Designation count must not change on GET');

    const checkProfile = await EmployeeProfile.findOne({ user: unprovisionedFacultyUser._id });
    assert.equal(checkProfile, null, 'No EmployeeProfile should exist for unprovisioned user');
  });

  // ── 2. Faculty GET leave balances with no EmployeeProfile creates no records
  await t.test('2. Faculty GET leave balances with no EmployeeProfile returns 404 and creates zero records', async () => {
    const balanceCountBefore = await EmployeeLeaveBalance.countDocuments();
    const ledgerCountBefore = await LeaveLedgerEntry.countDocuments();

    const req = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' },
      query: { year: 2026 }
    };
    const res = createMockRes();

    await hrController.getMyLeaveBalances(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonData.success, false);

    const balanceCountAfter = await EmployeeLeaveBalance.countDocuments();
    const ledgerCountAfter = await LeaveLedgerEntry.countDocuments();

    assert.equal(balanceCountAfter, balanceCountBefore, 'Leave balances must not be created on read request');
    assert.equal(ledgerCountAfter, ledgerCountBefore, 'Leave ledger entries must not be created on read request');
  });

  // ── 3. Faculty GET attendance with no EmployeeProfile creates no records ───
  await t.test('3. Faculty GET attendance with no EmployeeProfile returns 404 and creates zero records', async () => {
    const attCountBefore = await EmployeeAttendance.countDocuments();

    const req = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' },
      query: {}
    };
    const res = createMockRes();

    await hrController.getMyAttendance(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonData.success, false);

    const attCountAfter = await EmployeeAttendance.countDocuments();
    assert.equal(attCountAfter, attCountBefore, 'Attendance records must not be created on read request');
  });

  // ── 4. Applying for leave without a provisioned profile does not create one ─
  await t.test('4. Applying for leave without a provisioned profile returns 404 and creates no profile or application', async () => {
    const appCountBefore = await EmployeeLeaveApplication.countDocuments();
    const profileCountBefore = await EmployeeProfile.countDocuments();

    const req = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' },
      body: {
        policy: approvedPolicy._id,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        reason: 'Personal emergency'
      }
    };
    const res = createMockRes();

    await hrController.applyForLeave(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Employee profile not found/i);

    const appCountAfter = await EmployeeLeaveApplication.countDocuments();
    const profileCountAfter = await EmployeeProfile.countDocuments();

    assert.equal(appCountAfter, appCountBefore, 'No leave application should be created');
    assert.equal(profileCountAfter, profileCountBefore, 'No employee profile should be created');
  });

  // ── 5. Check-in/check-out without a provisioned profile does not create one ─
  await t.test('5. Check-in and check-out without a provisioned profile return 404 and create no records', async () => {
    const attCountBefore = await EmployeeAttendance.countDocuments();
    const profileCountBefore = await EmployeeProfile.countDocuments();

    // Attempt check-in
    const checkInReq = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' },
      body: { verificationMethod: 'web_portal' }
    };
    const checkInRes = createMockRes();
    await hrController.checkIn(checkInReq, checkInRes);

    assert.equal(checkInRes.statusCode, 404);
    assert.equal(checkInRes.jsonData.success, false);

    // Attempt check-out
    const checkOutReq = {
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' }
    };
    const checkOutRes = createMockRes();
    await hrController.checkOut(checkOutReq, checkOutRes);

    assert.equal(checkOutRes.statusCode, 404);
    assert.equal(checkOutRes.jsonData.success, false);

    const attCountAfter = await EmployeeAttendance.countDocuments();
    const profileCountAfter = await EmployeeProfile.countDocuments();

    assert.equal(attCountAfter, attCountBefore, 'Zero attendance records created');
    assert.equal(profileCountAfter, profileCountBefore, 'Zero employee profile records created');
  });

  // ── 6. Existing provisioned faculty profiles continue to work ──────────────
  await t.test('6. Existing provisioned faculty profiles continue to function properly across all HR endpoints', async () => {
    // 6a. GET /employees/me
    const profReq = {
      user: { userId: provisionedFacultyUser._id, role: 'faculty' }
    };
    const profRes = createMockRes();
    await hrController.getMyProfile(profReq, profRes);

    assert.equal(profRes.statusCode, 200);
    assert.equal(profRes.jsonData.success, true);
    assert.equal(profRes.jsonData.data.employeeId, 'EMP-PROV-001');
    assert.equal(profRes.jsonData.data.department?.code, 'CSE');

    // 6b. GET /leaves/my-balances
    const balReq = {
      user: { userId: provisionedFacultyUser._id, role: 'faculty' },
      query: { year: 2026 }
    };
    const balRes = createMockRes();
    await hrController.getMyLeaveBalances(balReq, balRes);

    assert.equal(balRes.statusCode, 200);
    assert.equal(balRes.jsonData.success, true);
    assert.equal(balRes.jsonData.data.length, 1);
    assert.equal(balRes.jsonData.data[0].policy?.code, 'TEST-CL');
    assert.equal(balRes.jsonData.data[0].currentBalance, 12);

    // 6c. Attendance check-in and check-out
    const inReq = {
      user: { userId: provisionedFacultyUser._id, role: 'faculty' },
      body: { verificationMethod: 'web_portal' }
    };
    const inRes = createMockRes();
    await hrController.checkIn(inReq, inRes);

    assert.equal(inRes.statusCode, 200);
    assert.equal(inRes.jsonData.success, true);
    assert.equal(inRes.jsonData.data.status, 'present');

    const outReq = {
      user: { userId: provisionedFacultyUser._id, role: 'faculty' }
    };
    const outRes = createMockRes();
    await hrController.checkOut(outReq, outRes);

    assert.equal(outRes.statusCode, 200);
    assert.equal(outRes.jsonData.success, true);
    assert.ok(outRes.jsonData.data.checkOut);

    // 6d. GET /attendance/my-attendance
    const attReq = {
      user: { userId: provisionedFacultyUser._id, role: 'faculty' },
      query: { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
    };
    const attRes = createMockRes();
    await hrController.getMyAttendance(attReq, attRes);

    assert.equal(attRes.statusCode, 200);
    assert.equal(attRes.jsonData.success, true);
    assert.equal(attRes.jsonData.count, 1);
  });

  // ── 7. Existing leave balances and ledgers remain unchanged ─────────────────
  await t.test('7. Multiple repeated GET requests leave existing balances and ledgers strictly unchanged', async () => {
    const balancesBefore = await EmployeeLeaveBalance.find({ employee: provisionedProfile._id }).lean();
    const ledgersBefore = await LeaveLedgerEntry.find({ employee: provisionedProfile._id }).lean();

    for (let i = 0; i < 3; i++) {
      const balReq = {
        user: { userId: provisionedFacultyUser._id, role: 'faculty' },
        query: { year: 2026 }
      };
      const balRes = createMockRes();
      await hrController.getMyLeaveBalances(balReq, balRes);
      assert.equal(balRes.statusCode, 200);
    }

    const balancesAfter = await EmployeeLeaveBalance.find({ employee: provisionedProfile._id }).lean();
    const ledgersAfter = await LeaveLedgerEntry.find({ employee: provisionedProfile._id }).lean();

    assert.equal(balancesAfter.length, balancesBefore.length);
    assert.equal(ledgersAfter.length, ledgersBefore.length);
    assert.equal(balancesAfter[0].currentBalance, balancesBefore[0].currentBalance);
    assert.equal(balancesAfter[0].used, balancesBefore[0].used);
  });

  // ── 8. Unauthorized users cannot provision or access another profile ───────
  await t.test('8. Unauthorized users cannot update or access another employee profile', async () => {
    // Non-admin faculty attempting to update someone else's profile
    const updateReq = {
      params: { id: provisionedProfile._id },
      user: { userId: unprovisionedFacultyUser._id, role: 'faculty' },
      body: { firstName: 'HackedName' }
    };
    const updateRes = createMockRes();
    await hrController.updateEmployee(updateReq, updateRes);

    assert.equal(updateRes.statusCode, 403);
    assert.equal(updateRes.jsonData.success, false);
    assert.match(updateRes.jsonData.message, /Unauthorized to update this profile/i);

    // Verify database record was NOT updated
    const freshProfile = await EmployeeProfile.findById(provisionedProfile._id);
    assert.equal(freshProfile.firstName, 'Meera');
  });

  // ── 9. Concurrent provisioning cannot create duplicate EmployeeProfiles ───
  await t.test('9. Concurrent administrative provisioning cannot create duplicate EmployeeProfile records', async () => {
    const newFacultyUser = await User.create({
      name: 'Dr. Vikram Seth',
      email: 'vikram.seth@test.local',
      role: 'faculty',
      loginId: 'FAC_RACE_001',
      passwordHash: 'dummyhash'
    });

    const createBody = {
      employeeId: 'EMP-VIK-001',
      user: newFacultyUser._id,
      firstName: 'Vikram',
      lastName: 'Seth',
      displayName: 'Dr. Vikram Seth',
      officialEmail: newFacultyUser.email,
      employeeCategory: 'teaching_faculty',
      department: testDept._id,
      designation: testDesig._id,
      joiningDate: '2025-01-01'
    };

    // Simulate 3 concurrent creation requests for the exact same employeeId and user
    const results = await Promise.all([
      (async () => {
        const req = { user: { userId: adminUser._id, role: 'hr_admin' }, body: { ...createBody } };
        const res = createMockRes();
        await hrController.createEmployee(req, res);
        return res;
      })(),
      (async () => {
        const req = { user: { userId: adminUser._id, role: 'hr_admin' }, body: { ...createBody } };
        const res = createMockRes();
        await hrController.createEmployee(req, res);
        return res;
      })(),
      (async () => {
        const req = { user: { userId: adminUser._id, role: 'hr_admin' }, body: { ...createBody } };
        const res = createMockRes();
        await hrController.createEmployee(req, res);
        return res;
      })()
    ]);

    const createdCount = results.filter((r) => r.statusCode === 201).length;
    const conflictCount = results.filter((r) => r.statusCode === 409 || r.statusCode === 400).length;

    assert.equal(createdCount, 1, 'Exactly one concurrent request must succeed with 201');
    assert.equal(conflictCount, 2, 'Competing concurrent requests must be rejected with 409 or 400');

    const totalProfilesForVikram = await EmployeeProfile.countDocuments({ user: newFacultyUser._id });
    assert.equal(totalProfilesForVikram, 1, 'Database must contain exactly 1 profile for user');
  });

  // ── 10. Concurrent balance initialization cannot create duplicate balances ──
  await t.test('10. Concurrent balance initialization cannot create duplicate balances or ledger entries', async () => {
    const newFacultyUser = await User.create({
      name: 'Dr. Kavita Krishnan',
      email: 'kavita.krishnan@test.local',
      role: 'faculty',
      loginId: 'FAC_BAL_RACE_001',
      passwordHash: 'dummyhash'
    });

    const newProfile = await EmployeeProfile.create({
      employeeId: 'EMP-KAV-001',
      user: newFacultyUser._id,
      firstName: 'Kavita',
      lastName: 'Krishnan',
      officialEmail: newFacultyUser.email,
      employeeCategory: 'teaching_faculty',
      department: testDept._id,
      designation: testDesig._id,
      joiningDate: new Date('2025-01-01')
    });

    // Run 4 concurrent initializeLeaveBalancesForEmployee calls
    const parallelCalls = await Promise.all([
      hrService.initializeLeaveBalancesForEmployee(newProfile._id, 2026, adminUser._id),
      hrService.initializeLeaveBalancesForEmployee(newProfile._id, 2026, adminUser._id),
      hrService.initializeLeaveBalancesForEmployee(newProfile._id, 2026, adminUser._id),
      hrService.initializeLeaveBalancesForEmployee(newProfile._id, 2026, adminUser._id)
    ]);

    assert.equal(parallelCalls.length, 4, 'All concurrent calls must resolve cleanly');

    const balances = await EmployeeLeaveBalance.find({
      employee: newProfile._id,
      policy: approvedPolicy._id,
      year: 2026
    });
    assert.equal(balances.length, 1, 'Must have exactly 1 balance record for employee and policy');

    const ledgers = await LeaveLedgerEntry.find({
      employee: newProfile._id,
      policy: approvedPolicy._id,
      year: 2026,
      reason: 'annual_grant'
    });
    assert.equal(ledgers.length, 1, 'Must have exactly 1 ledger entry for annual_grant');
  });

  // ── 11. Migration script handles concurrent execution idempotently ──────────
  await t.test('11. Migration script handles concurrent execution idempotently with zero duplicate profiles', async () => {
    // Add two synthetic faculty users without employee profiles
    const facU1 = await User.create({
      name: 'Dr. Arjun Rampal',
      email: 'arjun.rampal@test.local',
      role: 'faculty',
      loginId: 'FAC_MIG_RACE_1',
      passwordHash: 'dummyhash'
    });
    await Faculty.create({
      user: facU1._id,
      employeeId: 'FAC-AR01',
      name: 'Dr. Arjun Rampal',
      email: facU1.email,
      department: 'Computer Science & Engineering',
      designation: 'Assistant Professor'
    });

    // Run 2 parallel migrations
    const [res1, res2] = await Promise.all([
      syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true }),
      syncFacultyProfiles({ mongoUri: testUri, skipDisconnect: true })
    ]);

    assert.ok(res1.totalSynced >= 1);
    assert.ok(res2.totalSynced >= 1);

    const profilesForArjun = await EmployeeProfile.find({ user: facU1._id });
    assert.equal(profilesForArjun.length, 1, 'Exactly one profile created for Arjun');
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
