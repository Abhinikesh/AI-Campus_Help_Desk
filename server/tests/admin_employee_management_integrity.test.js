/**
 * server/tests/admin_employee_management_integrity.test.js
 * Comprehensive Automated Test Suite for Part 10.10:
 * Admin HR Employee Management UX, RBAC Authorization & Explicit Provisioning Integrity.
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
const EmploymentHistory = require('../models/EmploymentHistory');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'admin_employee_mgmt_test_jwt_secret_key_998877';
}
const JWT_SECRET = process.env.JWT_SECRET;

test('Part 10.10: Admin HR Employee Management UX and Provisioning Integrity Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;

  let adminUser, adminToken;
  let hrAdminUser, hrAdminToken;
  let hrOfficerUser, hrOfficerToken;
  let facultyUserA, facultyTokenA;
  let facultyUserB, facultyTokenB;
  let studentUser, studentToken;

  let academicDept, adminDept;
  let professorDesig, officerDesig;
  let testCasualPolicy;
  let initialEmployeeA;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_admin_employee_mgmt_isolated' }
    });
    const testUri = mongod.getUri() + 'test_admin_employee_mgmt_isolated';
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
      email: 'admin.hr@campus.test',
      role: 'admin',
      loginId: 'ADM_HR_01',
      passwordHash: 'dummyhash'
    });
    adminToken = jwt.sign({ userId: adminUser._id, id: adminUser._id, role: adminUser.role }, JWT_SECRET);

    hrAdminUser = await User.create({
      name: 'HR Director',
      email: 'hradmin@campus.test',
      role: 'hr_admin',
      loginId: 'HR_ADM_01',
      passwordHash: 'dummyhash'
    });
    hrAdminToken = jwt.sign({ userId: hrAdminUser._id, id: hrAdminUser._id, role: hrAdminUser.role }, JWT_SECRET);

    hrOfficerUser = await User.create({
      name: 'HR Officer',
      email: 'hrofficer@campus.test',
      role: 'hr_officer',
      loginId: 'HR_OFF_01',
      passwordHash: 'dummyhash'
    });
    hrOfficerToken = jwt.sign({ userId: hrOfficerUser._id, id: hrOfficerUser._id, role: hrOfficerUser.role }, JWT_SECRET);

    facultyUserA = await User.create({
      name: 'Dr. Suresh Kumar',
      email: 'suresh.kumar@campus.test',
      role: 'faculty',
      loginId: 'FAC_SK_01',
      passwordHash: 'dummyhash'
    });
    facultyTokenA = jwt.sign({ userId: facultyUserA._id, id: facultyUserA._id, role: facultyUserA.role }, JWT_SECRET);

    facultyUserB = await User.create({
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@campus.test',
      role: 'faculty',
      loginId: 'FAC_PS_02',
      passwordHash: 'dummyhash'
    });
    facultyTokenB = jwt.sign({ userId: facultyUserB._id, id: facultyUserB._id, role: facultyUserB.role }, JWT_SECRET);

    studentUser = await User.create({
      name: 'Rohan Student',
      email: 'rohan.student@campus.test',
      role: 'student',
      loginId: 'STU_2026_01',
      passwordHash: 'dummyhash'
    });
    studentToken = jwt.sign({ userId: studentUser._id, id: studentUser._id, role: studentUser.role }, JWT_SECRET);

    // Seed test departments
    academicDept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      type: 'academic',
      isActive: true
    });

    adminDept = await Department.create({
      name: 'Human Resources & Personnel',
      code: 'HR_ADMIN',
      type: 'administrative',
      isActive: true
    });

    // Seed test designations
    professorDesig = await Designation.create({
      name: 'Professor',
      title: 'Professor',
      code: 'PROF',
      category: 'teaching_faculty',
      department: academicDept._id,
      reportingLevel: 1
    });

    officerDesig = await Designation.create({
      name: 'HR Specialist',
      title: 'HR Specialist',
      code: 'HR_SPEC',
      category: 'administrative_staff',
      department: adminDept._id,
      reportingLevel: 2
    });

    // Seed an approved leave policy for auto-balance initialization
    testCasualPolicy = await LeavePolicy.create({
      name: 'Casual Leave',
      code: 'CL',
      annualEntitlement: 12,
      applicableCategory: 'all',
      isActive: true
    });

    // Seed initial provisioned EmployeeProfile for facultyUserA
    initialEmployeeA = await EmployeeProfile.create({
      employeeId: 'EMP-2026-0001',
      user: facultyUserA._id,
      firstName: 'Suresh',
      lastName: 'Kumar',
      displayName: 'Dr. Suresh Kumar',
      officialEmail: 'suresh.kumar@campus.test',
      employeeCategory: 'teaching_faculty',
      department: academicDept._id,
      designation: professorDesig._id,
      employmentType: 'permanent',
      employmentStatus: 'active',
      joiningDate: new Date('2020-01-15'),
      workLocation: 'Main Campus',
      onboardingStatus: 'verified'
    });
  });

  // ── 1. Authorized employee listing ──────────────────────────────────────────
  await t.test('1. Authorized admin and hr_admin can list employee profiles', async () => {
    // Admin request
    const adminRes = await fetch(`${baseUrl}/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminRes.status, 200);
    const adminData = await adminRes.json();
    assert.equal(adminData.success, true);
    assert.ok(Array.isArray(adminData.data));
    assert.equal(adminData.data.length, 1);
    assert.equal(adminData.total, 1);
    assert.equal(adminData.data[0].employeeId, 'EMP-2026-0001');

    // HR Admin request
    const hrAdminRes = await fetch(`${baseUrl}/employees`, {
      headers: { Authorization: `Bearer ${hrAdminToken}` }
    });
    assert.equal(hrAdminRes.status, 200);
    const hrAdminData = await hrAdminRes.json();
    assert.equal(hrAdminData.success, true);
    assert.equal(hrAdminData.data[0].employeeId, 'EMP-2026-0001');
  });

  // ── 2. Unauthorized employee listing rejection ──────────────────────────────
  await t.test('2. Unauthorized roles (student/faculty) cannot list employee directory (HTTP 403)', async () => {
    // Student request
    const studentRes = await fetch(`${baseUrl}/employees`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(studentRes.status, 403);

    // Faculty request (not department head or HR)
    const facultyRes = await fetch(`${baseUrl}/employees`, {
      headers: { Authorization: `Bearer ${facultyTokenA}` }
    });
    assert.equal(facultyRes.status, 403);

    // Unauthenticated request
    const unauthRes = await fetch(`${baseUrl}/employees`);
    assert.equal(unauthRes.status, 401);
  });

  // ── 3. Employee creation via authorized endpoints ───────────────────────────
  let createdEmployeeB;
  await t.test('3. Employee creation via authorized endpoints explicitly provisions new profile', async () => {
    const payload = {
      firstName: 'Priya',
      lastName: 'Sharma',
      displayName: 'Dr. Priya Sharma',
      officialEmail: 'priya.sharma@campus.test',
      employeeCategory: 'teaching_faculty',
      department: academicDept._id.toString(),
      designation: professorDesig._id.toString(),
      employmentType: 'permanent',
      employmentStatus: 'active',
      joiningDate: '2026-07-01',
      phone: '+91 9876543210',
      workLocation: 'North Campus'
    };

    const res = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrAdminToken}`
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data._id);
    assert.match(json.data.employeeId, /^EMP-\d{4}-\d{4}$/);
    assert.equal(json.data.firstName, 'Priya');
    assert.equal(json.data.lastName, 'Sharma');
    assert.equal(json.data.officialEmail, 'priya.sharma@campus.test');
    assert.equal(json.data.workLocation, 'North Campus');

    createdEmployeeB = json.data;

    // Verify auto-linked user
    assert.equal(json.data.user.toString(), facultyUserB._id.toString());

    // Verify leave balances automatically created
    const balances = await EmployeeLeaveBalance.find({ employee: json.data._id });
    assert.ok(balances.length >= 1, 'Leave balances must be initialized');

    // Verify employment history created
    const history = await EmploymentHistory.findOne({ employee: json.data._id });
    assert.ok(history, 'EmploymentHistory record must exist');
    assert.equal(history.changeType, 'onboarding');
  });

  // ── 4. Employee editing via PUT /api/hr/employees/:id ───────────────────────
  await t.test('4. Employee editing persists valid changes and returns populated details', async () => {
    const updatePayload = {
      firstName: 'Priya',
      lastName: 'Sharma-Verma',
      displayName: 'Dr. Priya Sharma-Verma',
      phone: '+91 9999988888',
      workLocation: 'Main Campus - Block C',
      department: adminDept._id.toString(),
      designation: officerDesig._id.toString(),
      employmentStatus: 'confirmed'
    };

    const res = await fetch(`${baseUrl}/employees/${createdEmployeeB._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.lastName, 'Sharma-Verma');
    assert.equal(json.data.displayName, 'Dr. Priya Sharma-Verma');
    assert.equal(json.data.phone, '+91 9999988888');
    assert.equal(json.data.workLocation, 'Main Campus - Block C');
    assert.equal(json.data.employmentStatus, 'confirmed');
    assert.equal(json.data.department.code, 'HR_ADMIN');
    assert.equal(json.data.designation.code, 'HR_SPEC');

    // Verify persisted record in database
    const dbRecord = await EmployeeProfile.findById(createdEmployeeB._id);
    assert.equal(dbRecord.lastName, 'Sharma-Verma');
    assert.equal(dbRecord.employmentStatus, 'confirmed');
  });

  // ── 5. Duplicate employee ID rejection ──────────────────────────────────────
  await t.test('5. Duplicate employee ID rejection (HTTP 409/400)', async () => {
    const duplicatePayload = {
      employeeId: 'EMP-2026-0001', // Already belongs to Suresh Kumar
      firstName: 'New',
      lastName: 'Person',
      officialEmail: 'new.person@campus.test',
      employeeCategory: 'administrative_staff',
      department: adminDept._id.toString(),
      designation: officerDesig._id.toString(),
      joiningDate: '2026-08-01'
    };

    const res = await fetch(`${baseUrl}/employees`, {
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

  // ── 6. Duplicate user assignment rejection ──────────────────────────────────
  await t.test('6. Duplicate user assignment rejection (HTTP 409/400)', async () => {
    const duplicateUserPayload = {
      user: facultyUserA._id.toString(), // Already linked to EMP-2026-0001
      firstName: 'Another',
      lastName: 'Profile',
      officialEmail: 'another.profile@campus.test',
      employeeCategory: 'teaching_faculty',
      department: academicDept._id.toString(),
      designation: professorDesig._id.toString(),
      joiningDate: '2026-08-01'
    };

    const res = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrAdminToken}`
      },
      body: JSON.stringify(duplicateUserPayload)
    });

    assert.ok(res.status === 400 || res.status === 409, `Expected 400 or 409, got ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /already linked|already exists/i);
  });

  // ── 7. Invalid department or designation rejection ──────────────────────────
  await t.test('7. Invalid department or designation rejection (HTTP 400)', async () => {
    const fakeObjectId = new mongoose.Types.ObjectId().toString();

    // Invalid non-existent Department
    const badDeptPayload = {
      firstName: 'Test',
      lastName: 'InvalidDept',
      officialEmail: 'bad.dept@campus.test',
      employeeCategory: 'teaching_faculty',
      department: fakeObjectId,
      designation: professorDesig._id.toString(),
      joiningDate: '2026-08-01'
    };

    const res1 = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(badDeptPayload)
    });
    assert.equal(res1.status, 400);
    const json1 = await res1.json();
    assert.match(json1.message, /Department not found/i);

    // Invalid non-existent Designation
    const badDesigPayload = {
      firstName: 'Test',
      lastName: 'InvalidDesig',
      officialEmail: 'bad.desig@campus.test',
      employeeCategory: 'teaching_faculty',
      department: academicDept._id.toString(),
      designation: fakeObjectId,
      joiningDate: '2026-08-01'
    };

    const res2 = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(badDesigPayload)
    });
    assert.equal(res2.status, 400);
    const json2 = await res2.json();
    assert.match(json2.message, /Designation not found/i);

    // Malformed ObjectId string
    const malformedPayload = {
      firstName: 'Test',
      lastName: 'Malformed',
      officialEmail: 'malformed@campus.test',
      employeeCategory: 'teaching_faculty',
      department: 'invalid-not-an-objectid',
      designation: professorDesig._id.toString(),
      joiningDate: '2026-08-01'
    };

    const res3 = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(malformedPayload)
    });
    assert.equal(res3.status, 400);
  });

  // ── 8. Employee detail authorization ────────────────────────────────────────
  await t.test('8. Employee detail authorization: authorized admin/self allowed, unauthorized user rejected (HTTP 403)', async () => {
    // 1. Authorized HR Admin views employee A detail -> 200 OK
    const hrRes = await fetch(`${baseUrl}/employees/${initialEmployeeA._id}`, {
      headers: { Authorization: `Bearer ${hrAdminToken}` }
    });
    assert.equal(hrRes.status, 200);
    const hrJson = await hrRes.json();
    assert.equal(hrJson.success, true);
    assert.equal(hrJson.data.employeeId, 'EMP-2026-0001');

    // 2. Employee A retrieves own profile by ID -> 200 OK
    const selfRes = await fetch(`${baseUrl}/employees/${initialEmployeeA._id}`, {
      headers: { Authorization: `Bearer ${facultyTokenA}` }
    });
    assert.equal(selfRes.status, 200);
    const selfJson = await selfRes.json();
    assert.equal(selfJson.success, true);

    // 3. Employee B attempts to view Employee A profile by ID -> 403 Forbidden
    const unauthRes = await fetch(`${baseUrl}/employees/${initialEmployeeA._id}`, {
      headers: { Authorization: `Bearer ${facultyTokenB}` }
    });
    assert.equal(unauthRes.status, 403);
    const unauthJson = await unauthRes.json();
    assert.equal(unauthJson.success, false);
    assert.match(unauthJson.message, /unauthorized/i);
  });

  // ── 9. Search and filtering behavior ────────────────────────────────────────
  await t.test('9. Search and filtering behavior across supported fields with pagination', async () => {
    // Search by name ('Suresh')
    const searchRes1 = await fetch(`${baseUrl}/employees?search=Suresh`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(searchRes1.status, 200);
    const data1 = await searchRes1.json();
    assert.equal(data1.data.length, 1);
    assert.equal(data1.data[0].employeeId, 'EMP-2026-0001');

    // Search by employeeId ('EMP-2026-0001')
    const searchRes2 = await fetch(`${baseUrl}/employees?search=EMP-2026-0001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(searchRes2.status, 200);
    const data2 = await searchRes2.json();
    assert.equal(data2.data.length, 1);

    // Search by officialEmail ('priya.sharma@campus.test')
    const searchRes3 = await fetch(`${baseUrl}/employees?search=priya.sharma@campus.test`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(searchRes3.status, 200);
    const data3 = await searchRes3.json();
    assert.equal(data3.data.length, 1);
    assert.equal(data3.data[0].firstName, 'Priya');

    // Filter by department (academicDept._id -> only Suresh Kumar, as Priya was moved to adminDept)
    const deptRes = await fetch(`${baseUrl}/employees?department=${academicDept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(deptRes.status, 200);
    const deptData = await deptRes.json();
    assert.equal(deptData.data.length, 1);
    assert.equal(deptData.data[0].employeeId, 'EMP-2026-0001');

    // Pagination (limit=1, page=1)
    const pageRes1 = await fetch(`${baseUrl}/employees?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(pageRes1.status, 200);
    const pageData1 = await pageRes1.json();
    assert.equal(pageData1.data.length, 1);
    assert.equal(pageData1.total, 2);
    assert.equal(pageData1.totalPages, 2);
    assert.equal(pageData1.page, 1);

    // Pagination (limit=1, page=2)
    const pageRes2 = await fetch(`${baseUrl}/employees?page=2&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(pageRes2.status, 200);
    const pageData2 = await pageRes2.json();
    assert.equal(pageData2.data.length, 1);
    assert.notEqual(pageData2.data[0]._id, pageData1.data[0]._id);
  });

  // ── 10. Preservation of existing records ────────────────────────────────────
  await t.test('10. Preservation of existing records: updating one profile does not alter others', async () => {
    const countBefore = await EmployeeProfile.countDocuments();
    const empABefore = await EmployeeProfile.findById(initialEmployeeA._id);

    // Update Employee B
    const res = await fetch(`${baseUrl}/employees/${createdEmployeeB._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ workLocation: 'South Campus Annex' })
    });
    assert.equal(res.status, 200);

    const countAfter = await EmployeeProfile.countDocuments();
    assert.equal(countBefore, countAfter);

    const empAAfter = await EmployeeProfile.findById(initialEmployeeA._id);
    assert.equal(empABefore.firstName, empAAfter.firstName);
    assert.equal(empABefore.lastName, empAAfter.lastName);
    assert.equal(empABefore.workLocation, empAAfter.workLocation);
    assert.equal(empABefore.department.toString(), empAAfter.department.toString());
  });

  // ── 11. Zero implicit provisioning ──────────────────────────────────────────
  await t.test('11. Zero implicit provisioning: read requests never create database records', async () => {
    const profileCountBefore = await EmployeeProfile.countDocuments();
    const deptCountBefore = await Department.countDocuments();
    const desigCountBefore = await Designation.countDocuments();

    // Listing employees
    await fetch(`${baseUrl}/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Query non-existent ID
    const fakeId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await fetch(`${baseUrl}/employees/${fakeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(notFoundRes.status, 404);

    const profileCountAfter = await EmployeeProfile.countDocuments();
    const deptCountAfter = await Department.countDocuments();
    const desigCountAfter = await Designation.countDocuments();

    assert.equal(profileCountBefore, profileCountAfter);
    assert.equal(deptCountBefore, deptCountAfter);
    assert.equal(desigCountBefore, desigCountAfter);
  });

  // ── 12. Part 10.8 provisioning regression check ─────────────────────────────
  await t.test('12. Part 10.8 provisioning regression check: unprovisioned faculty get 404 with zero creation', async () => {
    // Create new unprovisioned faculty user
    const unprovisionedFaculty = await User.create({
      name: 'Unprovisioned Faculty Member',
      email: 'unprovisioned.fac@campus.test',
      role: 'faculty',
      loginId: 'FAC_UNPROV_01',
      passwordHash: 'dummy'
    });
    const unprovToken = jwt.sign(
      { userId: unprovisionedFaculty._id, id: unprovisionedFaculty._id, role: unprovisionedFaculty.role },
      JWT_SECRET
    );

    const countBefore = await EmployeeProfile.countDocuments();

    // 1. GET /employees/me -> 404
    const res1 = await fetch(`${baseUrl}/employees/me`, {
      headers: { Authorization: `Bearer ${unprovToken}` }
    });
    assert.equal(res1.status, 404);

    // 2. GET /leaves/my-balances -> 404
    const res2 = await fetch(`${baseUrl}/leaves/my-balances`, {
      headers: { Authorization: `Bearer ${unprovToken}` }
    });
    assert.equal(res2.status, 404);

    // 3. GET /attendance/my-attendance -> 404
    const res3 = await fetch(`${baseUrl}/attendance/my-attendance`, {
      headers: { Authorization: `Bearer ${unprovToken}` }
    });
    assert.equal(res3.status, 404);

    const countAfter = await EmployeeProfile.countDocuments();
    assert.equal(countBefore, countAfter, 'Must create zero EmployeeProfile records for unprovisioned users');
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
