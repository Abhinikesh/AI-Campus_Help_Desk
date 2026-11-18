/**
 * server/tests/hr_attendance_lifecycle_integrity.test.js
 * Comprehensive Automated Test Suite for Part 10.12:
 * HR Attendance Lifecycle Integrity, Validation, Concurrency & Ownership.
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
const EmployeeAttendance = require('../models/EmployeeAttendance');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'hr_attendance_lifecycle_test_secret_776655';
}
const JWT_SECRET = process.env.JWT_SECRET;

test('Part 10.12: HR Attendance Lifecycle Integrity Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;

  let adminUser, adminToken;
  let deptHeadUser, deptHeadToken;
  let facultyUser1, facultyToken1;
  let facultyUser2, facultyToken2;
  let unprovisionedFacultyUser, unprovisionedFacultyToken;
  let studentUser, studentToken;

  let deptCS, deptEE, profDesig;
  let profile1, profile2, deptHeadProfile;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_hr_attendance_lifecycle_isolated' }
    });
    const testUri = mongod.getUri() + 'test_hr_attendance_lifecycle_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    await User.init();
    await Department.init();
    await Designation.init();
    await EmployeeProfile.init();
    await EmployeeAttendance.init();

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
      name: 'HR Admin User',
      email: 'hr.admin@campus.test',
      role: 'admin',
      loginId: 'ADM_HR_ATT_01',
      passwordHash: 'dummy'
    });
    adminToken = jwt.sign({ userId: adminUser._id, id: adminUser._id, role: adminUser.role }, JWT_SECRET);

    deptHeadUser = await User.create({
      name: 'CS Dept Head',
      email: 'hod.cs@campus.test',
      role: 'department_head',
      loginId: 'HOD_CS_01',
      passwordHash: 'dummy'
    });
    deptHeadToken = jwt.sign({ userId: deptHeadUser._id, id: deptHeadUser._id, role: deptHeadUser.role }, JWT_SECRET);

    facultyUser1 = await User.create({
      name: 'Dr. Faculty One',
      email: 'faculty1@campus.test',
      role: 'faculty',
      loginId: 'FAC_ATT_01',
      passwordHash: 'dummy'
    });
    facultyToken1 = jwt.sign({ userId: facultyUser1._id, id: facultyUser1._id, role: facultyUser1.role }, JWT_SECRET);

    facultyUser2 = await User.create({
      name: 'Dr. Faculty Two',
      email: 'faculty2@campus.test',
      role: 'faculty',
      loginId: 'FAC_ATT_02',
      passwordHash: 'dummy'
    });
    facultyToken2 = jwt.sign({ userId: facultyUser2._id, id: facultyUser2._id, role: facultyUser2.role }, JWT_SECRET);

    unprovisionedFacultyUser = await User.create({
      name: 'Unprovisioned Faculty',
      email: 'unprovisioned@campus.test',
      role: 'faculty',
      loginId: 'FAC_UNPROV_01',
      passwordHash: 'dummy'
    });
    unprovisionedFacultyToken = jwt.sign(
      { userId: unprovisionedFacultyUser._id, id: unprovisionedFacultyUser._id, role: unprovisionedFacultyUser.role },
      JWT_SECRET
    );

    studentUser = await User.create({
      name: 'Test Student',
      email: 'student.att@campus.test',
      role: 'student',
      loginId: 'STU_ATT_01',
      passwordHash: 'dummy'
    });
    studentToken = jwt.sign({ userId: studentUser._id, id: studentUser._id, role: studentUser.role }, JWT_SECRET);

    // Departments & Designations
    deptCS = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE_ATT' });
    deptEE = await Department.create({ name: 'Electrical Engineering', code: 'EE_ATT' });
    profDesig = await Designation.create({
      name: 'Associate Professor',
      title: 'Associate Professor',
      code: 'ASSOC_PROF_ATT'
    });

    // Provisioned profiles
    profile1 = await EmployeeProfile.create({
      employeeId: 'EMP_ATT_001',
      user: facultyUser1._id,
      firstName: 'Faculty',
      lastName: 'One',
      officialEmail: 'faculty1@campus.test',
      employeeCategory: 'teaching_faculty',
      department: deptCS._id,
      designation: profDesig._id,
      joiningDate: new Date('2024-01-01'),
      employmentStatus: 'active'
    });

    profile2 = await EmployeeProfile.create({
      employeeId: 'EMP_ATT_002',
      user: facultyUser2._id,
      firstName: 'Faculty',
      lastName: 'Two',
      officialEmail: 'faculty2@campus.test',
      employeeCategory: 'teaching_faculty',
      department: deptEE._id,
      designation: profDesig._id,
      joiningDate: new Date('2024-01-01'),
      employmentStatus: 'active'
    });

    deptHeadProfile = await EmployeeProfile.create({
      employeeId: 'EMP_HOD_001',
      user: deptHeadUser._id,
      firstName: 'HOD',
      lastName: 'CSE',
      officialEmail: 'hod.cs@campus.test',
      employeeCategory: 'teaching_faculty',
      department: deptCS._id,
      designation: profDesig._id,
      joiningDate: new Date('2024-01-01'),
      employmentStatus: 'active'
    });
  });

  // ── Helper API Requester ───────────────────────────────────────────────────
  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const fetchOptions = {
      method: options.method || 'GET',
      headers
    };
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, ok: res.ok, data };
  }

  // ── 1. Check-in with valid employee profile ────────────────────────────────
  await t.test('1. Check-in with valid employee profile creates active record with present/late status', async () => {
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: facultyToken1,
      body: { verificationMethod: 'web_portal' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.checkIn, 'checkIn timestamp must be populated');
    assert.ok(res.data.data.checkInTime, 'checkInTime timestamp must be populated');
    assert.equal(res.data.data.employee.toString(), profile1._id.toString());
    assert.ok(['present', 'late'].includes(res.data.data.status));
    assert.equal(res.data.data.checkOut, null);
    assert.equal(res.data.data.workingHours, 0);

    const doc = await EmployeeAttendance.findById(res.data.data._id);
    assert.ok(doc, 'Database record must exist');
    assert.equal(doc.employee.toString(), profile1._id.toString());
  });

  // ── 2. Check-in without employee profile ───────────────────────────────────
  await t.test('2. Check-in without employee profile returns HTTP 404', async () => {
    const countBefore = await EmployeeAttendance.countDocuments();
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: unprovisionedFacultyToken,
      body: {}
    });

    assert.equal(res.status, 404);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /profile not found/i);

    const countAfter = await EmployeeAttendance.countDocuments();
    assert.equal(countAfter, countBefore, 'No attendance record must be created for unprovisioned users');
  });

  // ── 3. Duplicate check-in ──────────────────────────────────────────────────
  await t.test('3. Duplicate check-in while already checked in returns HTTP 400 conflict', async () => {
    const countBefore = await EmployeeAttendance.countDocuments();
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: facultyToken1,
      body: {}
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /already checked in/i);

    const countAfter = await EmployeeAttendance.countDocuments();
    assert.equal(countAfter, countBefore, 'Duplicate check-in must not create a new record');
  });

  // ── 4. Check-in identity spoofing ──────────────────────────────────────────
  await t.test('4. Check-in identity spoofing: attempting to check in for another employee is rejected (HTTP 403)', async () => {
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: facultyToken2,
      body: { employeeId: profile1._id.toString() }
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /cannot check in on behalf/i);

    // Also check spoofing userId
    const resUser = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: facultyToken2,
      body: { userId: facultyUser1._id.toString() }
    });

    assert.equal(resUser.status, 403);
    assert.equal(resUser.data.success, false);
    assert.match(resUser.data.message, /cannot check in on behalf/i);
  });

  // ── 5. Check-out with valid active attendance ──────────────────────────────
  await t.test('5. Check-out with valid active attendance completes record and computes working hours', async () => {
    const res = await apiRequest('/attendance/check-out', {
      method: 'POST',
      token: facultyToken1
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.checkOut, 'checkOut timestamp must be set');
    assert.ok(res.data.data.checkOutTime, 'checkOutTime timestamp must be set');
    assert.equal(typeof res.data.data.workingHours, 'number');
    assert.ok(res.data.data.workingHours >= 0, 'workingHours must be >= 0');

    const doc = await EmployeeAttendance.findById(res.data.data._id);
    assert.ok(doc.checkOut, 'checkOut in DB must be set');
    assert.equal(doc.workingHours, res.data.data.workingHours);
  });

  // ── 6. Check-out without active attendance ─────────────────────────────────
  await t.test('6. Check-out without active attendance returns HTTP 400', async () => {
    // facultyUser2 has not checked in today
    const res = await apiRequest('/attendance/check-out', {
      method: 'POST',
      token: facultyToken2
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /no check-in record found/i);
  });

  // ── 7. Duplicate check-out ─────────────────────────────────────────────────
  await t.test('7. Duplicate check-out: calling check-out on an already completed attendance returns HTTP 400 and preserves timestamps', async () => {
    const recordBefore = await EmployeeAttendance.findOne({ employee: profile1._id });
    const checkOutTimeBefore = recordBefore.checkOut.getTime();
    const hoursBefore = recordBefore.workingHours;

    const res = await apiRequest('/attendance/check-out', {
      method: 'POST',
      token: facultyToken1
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /already checked out/i);

    const recordAfter = await EmployeeAttendance.findOne({ employee: profile1._id });
    assert.equal(recordAfter.checkOut.getTime(), checkOutTimeBefore, 'checkOut timestamp must not be overwritten');
    assert.equal(recordAfter.workingHours, hoursBefore, 'workingHours must not be overwritten');
  });

  // ── 8. Invalid timestamp ordering ──────────────────────────────────────────
  await t.test('8. Invalid timestamp ordering: check-out preceding check-in is rejected (HTTP 400)', async () => {
    const record = await EmployeeAttendance.findOne({ employee: profile1._id });

    const now = new Date();
    const pastCheckOut = new Date(now.getTime() - 3600000); // 1 hour ago
    const futureCheckIn = new Date(now.getTime());

    const res = await apiRequest(`/attendance/${record._id}/correct`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        checkIn: futureCheckIn.toISOString(),
        checkOut: pastCheckOut.toISOString(),
        reason: 'Attempting invalid reversed timestamps'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /check-out time cannot precede check-in time/i);
  });

  // ── 9. Concurrent check-in ─────────────────────────────────────────────────
  await t.test('9. Concurrent check-in: simultaneous requests do not create duplicate active records', async () => {
    // facultyUser2 has not checked in yet
    const results = await Promise.all([
      apiRequest('/attendance/check-in', { method: 'POST', token: facultyToken2, body: {} }),
      apiRequest('/attendance/check-in', { method: 'POST', token: facultyToken2, body: {} })
    ]);

    const statusCodes = results.map((r) => r.status).sort();
    assert.deepEqual(statusCodes, [200, 400], 'Exactly one check-in must succeed, other must be rejected with 400');

    const records = await EmployeeAttendance.find({ employee: profile2._id });
    assert.equal(records.length, 1, 'Only one attendance record must exist for faculty 2 today');
  });

  // ── 10. Concurrent check-out ───────────────────────────────────────────────
  await t.test('10. Concurrent check-out: simultaneous check-out requests complete atomically without corrupting data', async () => {
    // facultyUser2 is checked in, now run 2 concurrent check-outs
    const results = await Promise.all([
      apiRequest('/attendance/check-out', { method: 'POST', token: facultyToken2 }),
      apiRequest('/attendance/check-out', { method: 'POST', token: facultyToken2 })
    ]);

    const statusCodes = results.map((r) => r.status).sort();
    assert.deepEqual(statusCodes, [200, 400], 'Exactly one check-out must succeed, other must receive 400');

    const doc = await EmployeeAttendance.findOne({ employee: profile2._id });
    assert.ok(doc.checkOut, 'checkOut must be recorded');
    assert.equal(typeof doc.workingHours, 'number');
  });

  // ── 11. Employee attendance ownership ──────────────────────────────────────
  await t.test('11. Employee attendance ownership: getMyAttendance returns strictly authenticated user records', async () => {
    const res = await apiRequest('/attendance/my-attendance', {
      method: 'GET',
      token: facultyToken1
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));

    for (const record of res.data.data) {
      assert.equal(
        record.employee.toString(),
        profile1._id.toString(),
        'Faculty 1 must never see records of other employees'
      );
    }
  });

  // ── 12. Unauthorized HR attendance access ──────────────────────────────────
  await t.test('12. Unauthorized HR attendance access: student or unauthenticated users cannot access HR endpoints', async () => {
    // Unauthenticated request
    const unauthRes = await apiRequest('/attendance/roster', { method: 'GET' });
    assert.equal(unauthRes.status, 401);

    // Student role
    const studentRes = await apiRequest('/attendance/roster', {
      method: 'GET',
      token: studentToken
    });
    assert.equal(studentRes.status, 403);

    // Faculty role trying to access admin roster
    const facultyRosterRes = await apiRequest('/attendance/roster', {
      method: 'GET',
      token: facultyToken1
    });
    assert.equal(facultyRosterRes.status, 403);
  });

  // ── 13. Attendance history filtering ───────────────────────────────────────
  await t.test('13. Attendance history filtering: date range and month/year filters function accurately', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Query with explicit month & year
    const now = new Date();
    const resMonth = await apiRequest(`/attendance/my-attendance?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, {
      method: 'GET',
      token: facultyToken1
    });
    assert.equal(resMonth.status, 200);
    assert.ok(resMonth.data.count >= 1);

    // Query with explicit date range
    const resRange = await apiRequest(`/attendance/my-attendance?startDate=${todayStr}&endDate=${todayStr}`, {
      method: 'GET',
      token: facultyToken1
    });
    assert.equal(resRange.status, 200);
    assert.equal(resRange.data.count, 1);
    assert.equal(resRange.data.data[0].date, todayStr);
  });

  // ── 14. Accurate duration calculation ──────────────────────────────────────
  await t.test('14. Accurate duration calculation: workingHours equals difference between checkOut and checkIn', async () => {
    const rec = await EmployeeAttendance.findOne({ employee: profile1._id });

    // Correct attendance to exact 4.5 hours difference
    const baseIn = new Date('2026-11-19T09:00:00.000Z');
    const baseOut = new Date('2026-11-19T13:30:00.000Z'); // 4.5 hours

    const res = await apiRequest(`/attendance/${rec._id}/correct`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        checkIn: baseIn.toISOString(),
        checkOut: baseOut.toISOString(),
        reason: 'Adjusting to exact 4.5 hours for audit verification'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.workingHours, 4.5);
    assert.equal(res.data.data.hoursWorked, 4.5);
  });

  // ── 15. Failed operations leave no partial records ─────────────────────────
  await t.test('15. Failed operations leave no partial records', async () => {
    const countBefore = await EmployeeAttendance.countDocuments();

    // Invalid employee check-in attempt
    const res = await apiRequest('/attendance/check-in', {
      method: 'POST',
      token: unprovisionedFacultyToken,
      body: {}
    });
    assert.equal(res.status, 404);

    const countAfter = await EmployeeAttendance.countDocuments();
    assert.equal(countAfter, countBefore, 'Failed check-in must not write any records to the database');
  });

  // ── 16. Existing attendance records remain unchanged by read operations ────
  await t.test('16. Existing attendance records remain unchanged by read operations', async () => {
    const docsBefore = await EmployeeAttendance.find().lean();

    for (let i = 0; i < 3; i++) {
      await apiRequest('/attendance/my-attendance', { method: 'GET', token: facultyToken1 });
      await apiRequest('/attendance/roster', { method: 'GET', token: adminToken });
    }

    const docsAfter = await EmployeeAttendance.find().lean();
    assert.equal(docsAfter.length, docsBefore.length, 'Read operations must not change record counts');

    for (let i = 0; i < docsBefore.length; i++) {
      assert.equal(docsAfter[i]._id.toString(), docsBefore[i]._id.toString());
      assert.equal(docsAfter[i].workingHours, docsBefore[i].workingHours);
      assert.equal(docsAfter[i].status, docsBefore[i].status);
    }
  });

  // ── 17. Bug fix: getAttendanceRoster returns accurate targetDateStr ────────
  await t.test('17. Bug fix: getAttendanceRoster returns 200 without ReferenceError and accurate date', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/attendance/roster?date=${todayStr}`, {
      method: 'GET',
      token: adminToken
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.date, todayStr);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length >= 2, 'Must include both faculty records');
  });

  // ── 18. Department head scope restriction in roster ────────────────────────
  await t.test('18. Department head scope: department_head can only see their department records in getAttendanceRoster', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/attendance/roster?date=${todayStr}`, {
      method: 'GET',
      token: deptHeadToken
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    // Dept head is CSE: should only see CSE employees (profile1), NOT EE (profile2)
    for (const record of res.data.data) {
      assert.equal(
        record.employee.department._id.toString(),
        deptCS._id.toString(),
        'Department head must only view records within their department'
      );
    }
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
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
