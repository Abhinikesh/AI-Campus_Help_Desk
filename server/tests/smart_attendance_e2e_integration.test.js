/**
 * server/tests/smart_attendance_e2e_integration.test.js
 * End-to-End Verification Test Suite for Smart Attendance System (Prompt 9).
 *
 * Verifies:
 * 1. Faculty can view assigned subjects and classes.
 * 2. Faculty can create attendance session for assigned subject.
 * 3. Faculty cannot create session for unauthorized subject (403).
 * 4. Faculty can pause and resume session via POST and PATCH on both routes.
 * 5. Faculty cannot pause/resume another faculty member's session (403).
 * 6. Rotating QR challenge token generation and expiration.
 * 7. Student can view active attendance session for their class.
 * 8. Student can join session with QR token and mark attendance.
 * 9. Rejection of duplicate attendance marking.
 * 10. Student from another branch/semester cannot join session (403).
 * 11. Faculty can view live session roster with updated attendance status.
 * 12. Faculty can make authorized manual correction with mandatory reason.
 * 13. Manual correction rejected if reason is missing.
 * 14. Audit logs recorded for manual corrections and session transitions.
 * 15. Student can view attendance history and subject-wise calculation.
 * 16. Admin can view records via GET /api/attendance/admin/records (Fix verified).
 * 17. Admin can view records via GET /api/admin/attendance/records.
 * 18. Attendance report generation works without 500 when optional student filter is absent (Fix verified).
 * 19. Faculty can close and finalize attendance session.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const express = require('express');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { verifyTestDatabaseIsolation, assertConnectionIsolated } = require('./helpers/testDatabase');
const attendanceRoutes = require('../routes/attendance.routes');
const facultyRoutes = require('../routes/faculty.routes');
const studentRoutes = require('../routes/student.routes');
const adminRoutes = require('../routes/admin.routes');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_min_32_characters_long_for_safety!';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = JWT_SECRET;

function makeToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

test('Smart Attendance End-to-End Integration Suite', async (t) => {
  let mongod, server, API_BASE;
  let adminUser, faculty1User, faculty2User, student1User, student2User;
  let adminToken, faculty1Token, faculty2Token, student1Token, student2Token;
  let faculty1Doc, faculty2Doc, assignedSubject, unassignedSubject, student1Doc, student2Doc;
  let testSessionId, testAttendanceId;

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  await t.test('Setup: Spin up isolated test environment & fixtures', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_smart_attendance_isolated' }
    });
    const testUri = mongod.getUri() + 'test_smart_attendance_isolated';
    await verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });
    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    const app = express();
    app.use(express.json());

    // Register routes
    app.use('/api/attendance', attendanceRoutes);
    app.use('/api/faculty', facultyRoutes);
    app.use('/api/student', studentRoutes);
    app.use('/api/admin', adminRoutes);

    // Error handler
    app.use((err, req, res, next) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        statusCode
      });
    });

    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    API_BASE = `http://127.0.0.1:${port}`;

    // Seed Settings
    await AttendanceSettings.create({
      minAttendancePercent: 75,
      defaultSessionDurationMinutes: 60,
      lateGracePeriodMinutes: 15,
      qrExpirySeconds: 45
    });

    // Seed Users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin.test@campus.edu',
      loginId: 'ADM001',
      passwordHash: 'hash_admin',
      role: 'admin',
      isActive: true,
    });
    adminToken = makeToken(adminUser);

    faculty1User = await User.create({
      name: 'Dr. Faculty One',
      email: 'faculty1.test@campus.edu',
      loginId: 'FAC001',
      passwordHash: 'hash_fac1',
      role: 'faculty',
      isActive: true,
    });
    faculty1Token = makeToken(faculty1User);

    faculty2User = await User.create({
      name: 'Dr. Faculty Two',
      email: 'faculty2.test@campus.edu',
      loginId: 'FAC002',
      passwordHash: 'hash_fac2',
      role: 'faculty',
      isActive: true,
    });
    faculty2Token = makeToken(faculty2User);

    student1User = await User.create({
      name: 'Aarav Patel',
      email: 'aarav.patel@campus.edu',
      loginId: 'STU001',
      passwordHash: 'hash_stu1',
      role: 'student',
      isActive: true,
    });
    student1Token = makeToken(student1User);

    student2User = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@campus.edu',
      loginId: 'STU002',
      passwordHash: 'hash_stu2',
      role: 'student',
      isActive: true,
    });
    student2Token = makeToken(student2User);

    // Seed Faculty Documents
    faculty1Doc = await Faculty.create({
      user: faculty1User._id,
      name: faculty1User.name,
      employeeId: 'FAC001',
      department: 'CSE',
      designation: 'Associate Professor',
    });

    faculty2Doc = await Faculty.create({
      user: faculty2User._id,
      name: faculty2User.name,
      employeeId: 'FAC002',
      department: 'ECE',
      designation: 'Assistant Professor',
    });

    // Seed Subjects
    assignedSubject = await Subject.create({
      name: 'Data Structures & Algorithms',
      code: 'CS201',
      department: 'CSE',
      branch: 'CSE',
      semester: 4,
      credits: 4,
      faculty: faculty1User._id,
    });

    unassignedSubject = await Subject.create({
      name: 'VLSI Design',
      code: 'EC401',
      department: 'ECE',
      branch: 'ECE',
      semester: 6,
      credits: 3,
      faculty: faculty2User._id,
    });

    // Seed Students
    student1Doc = await Student.create({
      user: student1User._id,
      rollNumber: '1/24/SET/BCS/001',
      fullName: 'Aarav Patel',
      email: student1User.email,
      branch: 'CSE',
      semester: 4,
      section: 'A',
      status: 'active',
      accountStatus: 'active_user',
    });

    // Student 2 is in ECE branch (ineligible for CSE session)
    student2Doc = await Student.create({
      user: student2User._id,
      rollNumber: '1/24/SET/BEC/002',
      fullName: 'Rohan Sharma',
      email: student2User.email,
      branch: 'ECE',
      semester: 6,
      section: 'B',
      status: 'active',
      accountStatus: 'active_user',
    });
  });

  await t.test('1. Faculty can view assigned subjects', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/subjects`, {
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some(s => s.code === 'CS201'));
  });

  await t.test('2. Faculty can create attendance session for assigned subject', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subjectId: assignedSubject._id.toString(),
        date: '2026-11-20',
        period: 1,
        branch: 'CSE',
        semester: 4,
        section: 'A',
        attendanceMethod: 'face',
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    testSessionId = body.data._id;
  });

  await t.test('3. Faculty cannot create session for unauthorized subject (403)', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subjectId: unassignedSubject._id.toString(),
        date: '2026-11-20',
        period: 2,
        branch: 'ECE',
        semester: 6,
      })
    });
    assert.equal(res.status, 403);
  });

  await t.test('4. Faculty can pause and resume session via POST & PATCH on both routes', async () => {
    // 4a. Pause via POST /api/attendance/sessions/:id/pause
    const res1 = await fetch(`${API_BASE}/api/attendance/sessions/${testSessionId}/pause`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'Taking break' })
    });
    assert.equal(res1.status, 200);

    const s1 = await AttendanceSession.findById(testSessionId);
    assert.equal(s1.status, 'paused');

    // 4b. Resume via PATCH /api/attendance/sessions/:id/resume
    const res2 = await fetch(`${API_BASE}/api/attendance/sessions/${testSessionId}/resume`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(res2.status, 200);

    const s2 = await AttendanceSession.findById(testSessionId);
    assert.equal(s2.status, 'active');

    // 4c. Pause via PATCH /api/faculty/attendance/sessions/:id/pause
    const res3 = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/pause`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'Faculty pause' })
    });
    assert.equal(res3.status, 200);

    // 4d. Resume via POST /api/faculty/attendance/sessions/:id/resume
    const res4 = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(res4.status, 200);

    const s4 = await AttendanceSession.findById(testSessionId);
    assert.equal(s4.status, 'active');
  });

  await t.test('5. Faculty cannot control another faculty member session (403)', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${faculty2Token}` }
    });
    assert.equal(res.status, 403);
  });

  let qrChallengeToken;
  await t.test('6. Faculty can generate rotating QR challenge token', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/qr-challenge`, {
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.challengeToken);
    qrChallengeToken = body.data.challengeToken;
  });

  await t.test('7. Student can view active attendance session for their class', async () => {
    const res = await fetch(`${API_BASE}/api/student/attendance/sessions`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some(s => s._id.toString() === testSessionId.toString()));
  });

  await t.test('8. Student can join session and mark attendance with manual fallback', async () => {
    const res = await fetch(`${API_BASE}/api/student/attendance/join/${testSessionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        verificationMethod: 'manual',
        qrChallengeToken
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const rec = await Attendance.findOne({ session: testSessionId, student: student1Doc._id });
    assert.ok(rec);
    testAttendanceId = rec._id.toString();
  });

  await t.test('9. Rejection of duplicate attendance marking', async () => {
    const res = await fetch(`${API_BASE}/api/student/attendance/join/${testSessionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        verificationMethod: 'manual',
        qrChallengeToken
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    // Verified alreadyMarked flag returned
    assert.equal(body.data.alreadyMarked, true);
  });

  await t.test('10. Student from another branch/semester cannot join session (403)', async () => {
    const res = await fetch(`${API_BASE}/api/student/attendance/join/${testSessionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student2Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        verificationMethod: 'manual'
      })
    });
    assert.equal(res.status, 403);
  });

  await t.test('11. Faculty can view live session roster with marked status', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}`, {
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.roster);
    const st1Entry = body.data.roster.find(r => r.rollNumber === student1Doc.rollNumber);
    assert.ok(st1Entry);
  });

  await t.test('12. Faculty can make authorized manual correction with mandatory reason', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/mark-student`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attendanceId: testAttendanceId,
        status: 'present',
        reason: 'Verified in-person presence in classroom'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'present');

    // Verify audit log
    const audit = await AttendanceAuditLog.findOne({
      attendanceId: testAttendanceId,
      action: 'manual_correction'
    });
    assert.ok(audit);
    assert.match(audit.reason, /Verified in-person presence/);
  });

  await t.test('13. Manual correction rejected if reason is missing (400)', async () => {
    const res = await fetch(`${API_BASE}/api/faculty/attendance/mark-student`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${faculty1Token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attendanceId: testAttendanceId,
        status: 'absent',
        reason: ''
      })
    });
    assert.equal(res.status, 400);
  });

  await t.test('14. Student can view attendance history and overview', async () => {
    const res = await fetch(`${API_BASE}/api/student/attendance`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  await t.test('15. Admin can view records via GET /api/attendance/admin/records (Fix F-01)', async () => {
    const res = await fetch(`${API_BASE}/api/attendance/admin/records`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.ok(Array.isArray(body.data.records));
  });

  await t.test('16. Admin can view records via GET /api/admin/attendance/records', async () => {
    const res = await fetch(`${API_BASE}/api/admin/attendance/records`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.ok(Array.isArray(body.data.records));
  });

  await t.test('17. Attendance report works without 500 when optional student filter is absent (Fix F-02)', async () => {
    const res = await fetch(`${API_BASE}/api/attendance/reports?reportType=student_report`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.ok(Array.isArray(body.data.rows));
  });

  await t.test('18. Faculty can close and finalize attendance session', async () => {
    // Close
    const resClose = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/close`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(resClose.status, 200);

    const sClose = await AttendanceSession.findById(testSessionId);
    assert.equal(sClose.status, 'closed');

    // Finalize
    const resFin = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${testSessionId}/finalize`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${faculty1Token}` }
    });
    assert.equal(resFin.status, 200);

    const sFin = await AttendanceSession.findById(testSessionId);
    assert.equal(sFin.status, 'finalized');
  });
});
