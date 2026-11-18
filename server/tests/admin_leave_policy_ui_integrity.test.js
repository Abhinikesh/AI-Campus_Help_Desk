/**
 * server/tests/admin_leave_policy_ui_integrity.test.js
 * Comprehensive Automated Test Suite for Part 10.11:
 * Admin HR Leave Policy Administration UI Integrity, Validation & Data Invariance.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  verifyTestDatabaseIsolation,
  assertConnectionIsolated
} = require('./helpers/testDatabase');

const hrRoutes = require('../routes/hr.routes');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'admin_leave_policy_ui_test_secret_998877';
}
const JWT_SECRET = process.env.JWT_SECRET;

test('Part 10.11: Admin HR Leave Policy Administration UI Integrity Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;

  let adminUser, adminToken;
  let hrAdminUser, hrAdminToken;
  let hrOfficerUser, hrOfficerToken;
  let facultyUser, facultyToken;
  let studentUser, studentToken;

  let academicDept, profDesig;
  let facultyEmployee;
  let initialPolicy;
  let initialBalance;
  let initialLedger;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_admin_leave_policy_ui_isolated' }
    });
    const testUri = mongod.getUri() + 'test_admin_leave_policy_ui_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    await User.init();
    await Department.init();
    await Designation.init();
    await EmployeeProfile.init();
    await LeavePolicy.init();
    await EmployeeLeaveBalance.init();
    await LeaveLedgerEntry.init();

    // Create Express test app
    const app = express();
    app.use(express.json());
    app.use('/api/hr', hrRoutes);

    // Global error handler
    app.use((err, req, res, next) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error'
      });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/hr`;

    // Seed test users
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin.policy@campus.test',
      role: 'admin',
      loginId: 'ADM_POL_01',
      passwordHash: 'dummy'
    });
    adminToken = jwt.sign({ userId: adminUser._id, id: adminUser._id, role: adminUser.role }, JWT_SECRET);

    hrAdminUser = await User.create({
      name: 'HR Director',
      email: 'hradmin.policy@campus.test',
      role: 'hr_admin',
      loginId: 'HR_POL_01',
      passwordHash: 'dummy'
    });
    hrAdminToken = jwt.sign({ userId: hrAdminUser._id, id: hrAdminUser._id, role: hrAdminUser.role }, JWT_SECRET);

    hrOfficerUser = await User.create({
      name: 'HR Officer',
      email: 'hrofficer.policy@campus.test',
      role: 'hr_officer',
      loginId: 'HR_OFF_POL_01',
      passwordHash: 'dummy'
    });
    hrOfficerToken = jwt.sign({ userId: hrOfficerUser._id, id: hrOfficerUser._id, role: hrOfficerUser.role }, JWT_SECRET);

    facultyUser = await User.create({
      name: 'Dr. Anita Roy',
      email: 'anita.roy@campus.test',
      role: 'faculty',
      loginId: 'FAC_ROY_01',
      passwordHash: 'dummy'
    });
    facultyToken = jwt.sign({ userId: facultyUser._id, id: facultyUser._id, role: facultyUser.role }, JWT_SECRET);

    studentUser = await User.create({
      name: 'Kunal Student',
      email: 'kunal.student@campus.test',
      role: 'student',
      loginId: 'STU_KUNAL_01',
      passwordHash: 'dummy'
    });
    studentToken = jwt.sign({ userId: studentUser._id, id: studentUser._id, role: studentUser.role }, JWT_SECRET);

    // Seed academic department & designation
    academicDept = await Department.create({
      name: 'Chemical Engineering',
      code: 'CHEM_ENG',
      type: 'academic',
      isActive: true
    });

    profDesig = await Designation.create({
      name: 'Professor',
      title: 'Professor',
      code: 'PROF_CHEM',
      category: 'teaching_faculty',
      department: academicDept._id,
      reportingLevel: 1
    });

    // Seed employee profile
    facultyEmployee = await EmployeeProfile.create({
      employeeId: 'EMP-POL-0001',
      user: facultyUser._id,
      firstName: 'Anita',
      lastName: 'Roy',
      displayName: 'Dr. Anita Roy',
      officialEmail: 'anita.roy@campus.test',
      employeeCategory: 'teaching_faculty',
      department: academicDept._id,
      designation: profDesig._id,
      employmentType: 'permanent',
      employmentStatus: 'active',
      joiningDate: new Date('2021-01-01')
    });

    // Seed baseline approved policy
    initialPolicy = await LeavePolicy.create({
      name: 'Institutional Casual Leave',
      code: 'EXISTING_CL',
      description: 'Approved baseline casual leave quota',
      annualEntitlement: 10,
      applicableCategory: 'all',
      accrualFrequency: 'annual',
      maxConsecutiveDays: 5,
      minNoticeDays: 1,
      isActive: true
    });

    // Seed baseline leave balance for employee
    initialBalance = await EmployeeLeaveBalance.create({
      employee: facultyEmployee._id,
      policy: initialPolicy._id,
      leaveCode: initialPolicy.code,
      year: 2026,
      openingBalance: 10,
      accrued: 0,
      used: 0,
      adjusted: 0,
      currentBalance: 10
    });

    // Seed baseline ledger entry
    initialLedger = await LeaveLedgerEntry.create({
      entryNumber: 'LED-2026-INIT-001',
      employee: facultyEmployee._id,
      policy: initialPolicy._id,
      leaveCode: initialPolicy.code,
      year: 2026,
      type: 'opening_balance',
      reason: 'Approved Institutional Annual Opening Balance',
      days: 10,
      previousBalance: 0,
      newBalance: 10,
      performedBy: adminUser._id
    });
  });

  // ── 1. Authorized policy creation ───────────────────────────────────────────
  let createdPolicyMed;
  await t.test('1. Authorized policy creation: admin and hr_admin can create leave policies', async () => {
    // 1. Admin creates Medical Leave policy
    const medPayload = {
      name: 'Medical Leave',
      code: 'MED_LEAVE',
      description: 'Medical and sick leave for attested health conditions',
      annualEntitlement: 15,
      applicableCategory: 'all',
      accrualFrequency: 'annual',
      maxConsecutiveDays: 14,
      minNoticeDays: 0,
      carryForwardMax: 5,
      allowNegativeBalance: false,
      isActive: true
    };

    const res1 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(medPayload)
    });

    assert.equal(res1.status, 201);
    const json1 = await res1.json();
    assert.equal(json1.success, true);
    assert.equal(json1.data.code, 'MED_LEAVE');
    assert.equal(json1.data.annualEntitlement, 15);
    assert.equal(json1.data.isActive, true);
    createdPolicyMed = json1.data;

    // 2. HR Admin creates Earned Leave policy
    const elPayload = {
      name: 'Earned Leave',
      code: 'EL_LEAVE',
      description: 'Annual earned leave for continuous service',
      annualEntitlement: 20,
      applicableCategory: 'teaching_faculty',
      accrualFrequency: 'annual',
      maxConsecutiveDays: 30,
      minNoticeDays: 7,
      carryForwardMax: 10,
      allowNegativeBalance: false,
      isActive: true
    };

    const res2 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrAdminToken}`
      },
      body: JSON.stringify(elPayload)
    });

    assert.equal(res2.status, 201);
    const json2 = await res2.json();
    assert.equal(json2.success, true);
    assert.equal(json2.data.code, 'EL_LEAVE');
    assert.equal(json2.data.annualEntitlement, 20);
  });

  // ── 2. Unauthorized policy creation rejection ───────────────────────────────
  await t.test('2. Unauthorized policy creation rejection: faculty, student and hr_officer are rejected (HTTP 403)', async () => {
    const dummyPayload = {
      name: 'Unauthorized Policy',
      code: 'UNAUTH_POL',
      annualEntitlement: 10
    };

    // Student request -> 403
    const studentRes = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify(dummyPayload)
    });
    assert.equal(studentRes.status, 403);

    // Faculty request -> 403
    const facultyRes = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify(dummyPayload)
    });
    assert.equal(facultyRes.status, 403);

    // HR Officer request (not admin or hr_admin) -> 403
    const officerRes = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrOfficerToken}`
      },
      body: JSON.stringify(dummyPayload)
    });
    assert.equal(officerRes.status, 403);

    // Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dummyPayload)
    });
    assert.equal(unauthRes.status, 401);
  });

  // ── 3. Required field validation ───────────────────────────────────────────
  await t.test('3. Required field validation: missing name, code, or annualEntitlement rejected (HTTP 400)', async () => {
    // Missing name
    const res1 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ code: 'NO_NAME', annualEntitlement: 10 })
    });
    assert.equal(res1.status, 400);

    // Missing code
    const res2 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'No Code Policy', annualEntitlement: 10 })
    });
    assert.equal(res2.status, 400);

    // Missing annualEntitlement
    const res3 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'No Entitlement', code: 'NO_ENT' })
    });
    assert.equal(res3.status, 400);

    // Negative annualEntitlement
    const res4 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Negative Entitlement', code: 'NEG_ENT', annualEntitlement: -5 })
    });
    assert.equal(res4.status, 400);

    // Empty string annualEntitlement
    const res5 = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Empty Entitlement', code: 'EMP_ENT', annualEntitlement: '' })
    });
    assert.equal(res5.status, 400);
  });

  // ── 4. Duplicate policy code rejection ─────────────────────────────────────
  await t.test('4. Duplicate policy code rejection (HTTP 400/409)', async () => {
    // Attempt to create policy with already existing code 'MED_LEAVE'
    const duplicatePayload = {
      name: 'Duplicate Medical',
      code: 'med_leave', // test case-insensitive match
      annualEntitlement: 12
    };

    const res = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(duplicatePayload)
    });

    assert.ok(res.status === 400 || res.status === 409, `Expected 400 or 409, got ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /already exists/i);
  });

  // ── 5. Correct frontend request payload handling ───────────────────────────
  await t.test('5. Correct frontend request payload: persists all supported fields accurately', async () => {
    const fullPayload = {
      name: 'Sabbatical Research Leave',
      code: 'SABBATICAL',
      description: 'Extended leave for advanced academic research and publication',
      annualEntitlement: 60,
      applicableCategory: 'teaching_faculty',
      accrualFrequency: 'none',
      maxConsecutiveDays: 180,
      minNoticeDays: 30,
      carryForwardMax: 0,
      allowNegativeBalance: false,
      isActive: true
    };

    const res = await fetch(`${baseUrl}/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(fullPayload)
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Sabbatical Research Leave');
    assert.equal(json.data.code, 'SABBATICAL');
    assert.equal(json.data.annualEntitlement, 60);
    assert.equal(json.data.applicableCategory, 'teaching_faculty');
    assert.equal(json.data.accrualFrequency, 'none');
    assert.equal(json.data.maxConsecutiveDays, 180);
    assert.equal(json.data.minNoticeDays, 30);
    assert.equal(json.data.isActive, true);

    // Verify in database
    const dbRecord = await LeavePolicy.findOne({ code: 'SABBATICAL' });
    assert.ok(dbRecord);
    assert.equal(dbRecord.name, 'Sabbatical Research Leave');
    assert.equal(dbRecord.annualEntitlement, 60);
  });

  // ── 6. Correct list refresh after creation ─────────────────────────────────
  await t.test('6. Correct list refresh: GET /leave-policies reflects newly created policies', async () => {
    const res = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const codes = json.data.map((p) => p.code);
    assert.ok(codes.includes('EXISTING_CL'));
    assert.ok(codes.includes('MED_LEAVE'));
    assert.ok(codes.includes('EL_LEAVE'));
    assert.ok(codes.includes('SABBATICAL'));
    assert.equal(json.count, codes.length);
  });

  // ── 7. GET remains strictly read-only ──────────────────────────────────────
  await t.test('7. GET /leave-policies is strictly read-only: creates zero records', async () => {
    const countBefore = await LeavePolicy.countDocuments();

    // 1. Standard GET
    await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // 2. Filtered GET
    await fetch(`${baseUrl}/leave-policies?category=teaching_faculty&isActive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // 3. Faculty GET
    await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });

    const countAfter = await LeavePolicy.countDocuments();
    assert.equal(countBefore, countAfter, 'GET must never insert policy records');
  });

  // ── 8. Existing policies remain unchanged ──────────────────────────────────
  await t.test('8. Existing policies remain unchanged when new policies are created', async () => {
    const baselinePolicy = await LeavePolicy.findOne({ code: 'EXISTING_CL' });
    assert.equal(baselinePolicy.name, 'Institutional Casual Leave');
    assert.equal(baselinePolicy.annualEntitlement, 10);
    assert.equal(baselinePolicy.maxConsecutiveDays, 5);
    assert.equal(baselinePolicy.minNoticeDays, 1);
  });

  // ── 9. Existing balances remain unchanged ──────────────────────────────────
  await t.test('9. Existing EmployeeLeaveBalance records remain invariant after policy creation', async () => {
    const balance = await EmployeeLeaveBalance.findById(initialBalance._id);
    assert.equal(balance.openingBalance, 10);
    assert.equal(balance.currentBalance, 10);
    assert.equal(balance.used, 0);
    assert.equal(balance.accrued, 0);

    // Verify count of balances did not change unexpectedly
    const balanceCount = await EmployeeLeaveBalance.countDocuments();
    assert.equal(balanceCount, 1);
  });

  // ── 10. Existing ledgers remain unchanged ──────────────────────────────────
  await t.test('10. Existing LeaveLedgerEntry records remain invariant after policy creation', async () => {
    const ledger = await LeaveLedgerEntry.findById(initialLedger._id);
    assert.equal(ledger.days, 10);
    assert.equal(ledger.newBalance, 10);
    assert.equal(ledger.previousBalance, 0);

    const ledgerCount = await LeaveLedgerEntry.countDocuments();
    assert.equal(ledgerCount, 1);
  });

  // ── 11. No automatic default policies when collection is empty ─────────────
  await t.test('11. No automatic default policies: empty collection returns empty array with zero auto-seeding', async () => {
    // Delete all policies temporarily in isolated DB
    await LeavePolicy.deleteMany({});

    const emptyCount = await LeavePolicy.countDocuments();
    assert.equal(emptyCount, 0);

    const res = await fetch(`${baseUrl}/leave-policies`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.count, 0);
    assert.deepEqual(json.data, []);

    // Verify still zero records
    const afterCount = await LeavePolicy.countDocuments();
    assert.equal(afterCount, 0, 'Must never auto-seed default policies on empty collection');

    // Restore baseline policy for teardown
    await LeavePolicy.create({
      _id: initialPolicy._id,
      name: 'Institutional Casual Leave',
      code: 'EXISTING_CL',
      annualEntitlement: 10,
      applicableCategory: 'all',
      isActive: true
    });
  });

  // ── 12. Policy editing and activation toggle ───────────────────────────────
  await t.test('12. Policy editing and activation toggle via PUT /api/hr/leave-policies/:id', async () => {
    const policyToUpdate = await LeavePolicy.findOne({ code: 'EXISTING_CL' });

    // 1. Admin deactivates policy
    const deactivateRes = await fetch(`${baseUrl}/leave-policies/${policyToUpdate._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ isActive: false, maxConsecutiveDays: 7 })
    });

    assert.equal(deactivateRes.status, 200);
    const deactivateJson = await deactivateRes.json();
    assert.equal(deactivateJson.success, true);
    assert.equal(deactivateJson.data.isActive, false);
    assert.equal(deactivateJson.data.maxConsecutiveDays, 7);

    // Verify in database
    const dbUpdated = await LeavePolicy.findById(policyToUpdate._id);
    assert.equal(dbUpdated.isActive, false);
    assert.equal(dbUpdated.maxConsecutiveDays, 7);

    // 2. Unauthorized faculty cannot edit policy -> 403
    const unauthEditRes = await fetch(`${baseUrl}/leave-policies/${policyToUpdate._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({ isActive: true })
    });
    assert.equal(unauthEditRes.status, 403);
  });

  // ── Teardown ────────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect and stop isolated MongoMemoryServer', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });
});
