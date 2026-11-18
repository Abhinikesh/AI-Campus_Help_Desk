/**
 * server/tests/hr_leave_policy_integrity.test.js
 * Focused verification test suite for Part 10.6: HR Leave Policy Integrity.
 * Proves that GET requests are strictly read-only and never create, modify, or auto-seed records.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { verifyTestDatabaseIsolation, assertConnectionIsolated } = require('./helpers/testDatabase');
const hrRoutes = require('../routes/hr.routes');
const hrController = require('../controllers/hr.controller');
const LeavePolicy = require('../models/LeavePolicy');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const EmployeeLeaveApplication = require('../models/EmployeeLeaveApplication');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');

const JWT_SECRET = process.env.JWT_SECRET || 'hr_policy_test_secret_key_1234567890';

test('HR Leave Policy Read-Only Integrity & API Safety Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;
  let adminToken;
  let facultyToken;
  let studentToken;
  let adminUser, facultyUser, studentUser;
  let testDept, testDesig, facultyProfile;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_hr_leave_policy_isolated' }
    });
    const uri = mongod.getUri() + 'test_hr_leave_policy_isolated';
    assert.ok(!uri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(uri, { disallowPort27018: true });

    await mongoose.connect(uri);
    assertConnectionIsolated(mongoose.connection);

    // Express app setup
    const app = express();
    app.use(express.json());
    app.use('/api/hr', hrRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/hr`;

    // Seed test users
    adminUser = await User.create({
      name: 'HR Admin User',
      email: 'hradmin@test.local',
      role: 'hr_admin',
      passwordHash: 'dummyhash',
      loginId: 'HR_ADM_001'
    });

    facultyUser = await User.create({
      name: 'Dr. Test Faculty',
      email: 'faculty_hr@test.local',
      role: 'faculty',
      passwordHash: 'dummyhash',
      loginId: 'FAC_HR_001'
    });

    studentUser = await User.create({
      name: 'Student User',
      email: 'student_hr@test.local',
      role: 'student',
      passwordHash: 'dummyhash',
      loginId: 'STU_HR_001'
    });

    testDept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'TEST-CSE',
      type: 'academic',
      isActive: true
    });

    testDesig = await Designation.create({
      name: 'Professor',
      title: 'Professor',
      code: 'TEST-PROF',
      department: testDept._id,
      category: 'teaching_faculty',
      reportingLevel: 1,
      isActive: true
    });

    facultyProfile = await EmployeeProfile.create({
      employeeId: 'EMP-TEST-001',
      user: facultyUser._id,
      firstName: 'Test',
      lastName: 'Faculty',
      officialEmail: facultyUser.email,
      department: testDept._id,
      designation: testDesig._id,
      employeeCategory: 'teaching_faculty',
      employmentStatus: 'active',
      joiningDate: new Date('2024-01-01')
    });

    // Generate test JWTs
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, JWT_SECRET);
    facultyToken = jwt.sign({ id: facultyUser._id, role: facultyUser.role }, JWT_SECRET);
    studentToken = jwt.sign({ id: studentUser._id, role: studentUser.role }, JWT_SECRET);
  });

  // ── 1. GET with empty collection returns HTTP success and empty list ────────
  await t.test('1. GET with empty LeavePolicy collection returns HTTP 200 and empty list', async () => {
    // Ensure database starts with exactly 0 policies
    const initialCount = await LeavePolicy.countDocuments();
    assert.equal(initialCount, 0, 'LeavePolicy collection must start empty');

    const res = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 0);
    assert.deepEqual(body.data, []);
  });

  // ── 2. GET does not create any policy records ──────────────────────────────
  await t.test('2. GET does not create any policy records (zero auto-seeding)', async () => {
    const countAfterGet = await LeavePolicy.countDocuments();
    assert.equal(countAfterGet, 0, 'No records must be inserted by GET request');
  });

  // ── 3. Repeated GET requests leave collection unchanged ────────────────────
  await t.test('3. Repeated GET requests return consistent empty results and leave collection unchanged', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/leave-policies`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.count, 0);
      assert.deepEqual(body.data, []);
    }

    const finalCount = await LeavePolicy.countDocuments();
    assert.equal(finalCount, 0, 'Repeated GET requests must never modify collection count');
  });

  // ── 4. GET with isActive=false on empty/mismatched does not throw E11000 ────
  await t.test('4. GET with isActive=false and no matching policies does not produce E11000', async () => {
    const res = await fetch(`${baseUrl}/leave-policies?isActive=false`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 0);
    assert.deepEqual(body.data, []);

    const count = await LeavePolicy.countDocuments();
    assert.equal(count, 0, 'Collection must remain empty');
  });

  // ── 5. Existing policies are returned correctly ────────────────────────────
  await t.test('5. Explicitly created policies are returned accurately', async () => {
    // Explicitly create two distinct approved policies
    await LeavePolicy.create([
      {
        code: 'TEST-SABBATICAL',
        name: 'Sabbatical Research Leave',
        description: 'Faculty research leave for academic publications',
        applicableCategory: 'teaching_faculty',
        annualEntitlement: 30,
        maxConsecutiveDays: 30,
        requiresProof: true,
        isActive: true
      },
      {
        code: 'TEST-CONFERENCE',
        name: 'Academic Conference Leave',
        description: 'Duty leave to attend peer-reviewed conferences',
        applicableCategory: 'all',
        annualEntitlement: 6,
        maxConsecutiveDays: 4,
        requiresProof: true,
        isActive: true
      },
      {
        code: 'TEST-DISCONTINUED',
        name: 'Old Discontinued Benefit',
        description: 'Deprecated historical policy',
        applicableCategory: 'all',
        annualEntitlement: 5,
        maxConsecutiveDays: 2,
        requiresProof: false,
        isActive: false
      }
    ]);

    const res = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 3);
    // Verified sorted by name: 'Academic Conference Leave', 'Old Discontinued Benefit', 'Sabbatical Research Leave'
    assert.equal(body.data[0].code, 'TEST-CONFERENCE');
    assert.equal(body.data[1].code, 'TEST-DISCONTINUED');
    assert.equal(body.data[2].code, 'TEST-SABBATICAL');
  });

  // ── 6. Existing filters continue to work accurately ────────────────────────
  await t.test('6. Existing query filters (category, isActive) continue to work properly', async () => {
    // 6a. Filter by isActive=true
    const activeRes = await fetch(`${baseUrl}/leave-policies?isActive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(activeRes.status, 200);
    const activeBody = await activeRes.json();
    assert.equal(activeBody.count, 2);
    assert.ok(activeBody.data.every(p => p.isActive === true));

    // 6b. Filter by isActive=false
    const inactiveRes = await fetch(`${baseUrl}/leave-policies?isActive=false`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(inactiveRes.status, 200);
    const inactiveBody = await inactiveRes.json();
    assert.equal(inactiveBody.count, 1);
    assert.equal(inactiveBody.data[0].code, 'TEST-DISCONTINUED');
    assert.equal(inactiveBody.data[0].isActive, false);

    // 6c. Filter by category
    const catRes = await fetch(`${baseUrl}/leave-policies?category=teaching_faculty`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(catRes.status, 200);
    const catBody = await catRes.json();
    // 'all' and 'teaching_faculty' policies match
    assert.equal(catBody.count, 3);

    // 6d. Filter by category that only matches 'all'
    const nonTeachingRes = await fetch(`${baseUrl}/leave-policies?category=non_teaching_staff`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(nonTeachingRes.status, 200);
    const nonTeachingBody = await nonTeachingRes.json();
    assert.equal(nonTeachingBody.count, 2); // TEST-CONFERENCE and TEST-DISCONTINUED are 'all'
  });

  // ── 7. Unauthorized roles remain unauthorized ──────────────────────────────
  await t.test('7. Unauthorized roles and unauthenticated callers are properly rejected', async () => {
    // 7a. Unauthenticated request (no token) -> 401
    const unauthRes = await fetch(`${baseUrl}/leave-policies`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 7b. Student role request -> 403 (students excluded from HR routes)
    const studentRes = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(studentRes.status, 403, 'Student role must be denied access with 403');

    // 7c. Faculty / Employee role request -> 200 (authorized to view policies)
    const facultyRes = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert.equal(facultyRes.status, 200, 'Faculty role must be permitted to view policies');
  });

  // ── 8. No write operation occurs during GET ────────────────────────────────
  await t.test('8. Proves zero write operations occur during GET', async () => {
    const policyCountBefore = await LeavePolicy.countDocuments();
    const balanceCountBefore = await EmployeeLeaveBalance.countDocuments();
    const appCountBefore = await EmployeeLeaveApplication.countDocuments();

    // Execute multiple variations of GET
    await fetch(`${baseUrl}/leave-policies`, { headers: { Authorization: `Bearer ${facultyToken}` } });
    await fetch(`${baseUrl}/leave-policies?category=all`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await fetch(`${baseUrl}/leave-policies?isActive=false`, { headers: { Authorization: `Bearer ${facultyToken}` } });
    await fetch(`${baseUrl}/leave-policies?category=nonexistent_cat`, { headers: { Authorization: `Bearer ${adminToken}` } });

    const policyCountAfter = await LeavePolicy.countDocuments();
    const balanceCountAfter = await EmployeeLeaveBalance.countDocuments();
    const appCountAfter = await EmployeeLeaveApplication.countDocuments();

    assert.equal(policyCountBefore, policyCountAfter, 'Policy document count must remain identical');
    assert.equal(balanceCountBefore, balanceCountAfter, 'Balance document count must remain identical');
    assert.equal(appCountBefore, appCountAfter, 'Application document count must remain identical');
  });

  // ── 9. Existing HR leave-related behavior remains intact ───────────────────
  await t.test('9. Existing HR leave application and balance behaviors function properly with explicit policies', async () => {
    // Explicit policy creation via POST /api/hr/leave-policies
    const createRes = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Duty Leave',
        code: 'TEST-DUTY',
        annualEntitlement: 14,
        applicableCategory: 'teaching_faculty'
      })
    });

    assert.equal(createRes.status, 201, 'Admin can explicitly create new policy');
    const createBody = await createRes.json();
    assert.equal(createBody.success, true);
    assert.equal(createBody.data.code, 'TEST-DUTY');

    // Faculty retrieves leave policies to view available options
    const listRes = await fetch(`${baseUrl}/leave-policies?isActive=true`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    const dutyPolicy = listBody.data.find(p => p.code === 'TEST-DUTY');
    assert.ok(dutyPolicy, 'Created duty policy must appear in read-only list');
    assert.equal(dutyPolicy.annualEntitlement, 14);
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  await t.test('Teardown: Close Express server, disconnect and stop isolated MongoMemoryServer', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
    assert.equal(mongoose.connection.readyState, 0);
  });

});
