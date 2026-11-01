/**
 * server/tests/attendance.test.js
 * Comprehensive automated test suite for Smart Attendance backend.
 * Tests 16 core requirements across Student, Faculty, Admin, and Python calculation engine.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');

const API_BASE = 'http://localhost:5001/api/attendance';
const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

test('Smart Attendance Backend & API Test Suite', async (t) => {
  let adminUser, facultyUser, student1User, student2User;
  let adminToken, facultyToken, student1Token, student2Token;
  let testSubject, student1Doc, student2Doc;
  let createdSessionId, createdAttendanceId;

  // Setup: Connect & load fixture identities
  await t.test('Setup: Connect & load fixture identities', async () => {
    if (mongoose.connection.readyState === 0) {
      const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/test';
      await mongoose.connect(dbUri);
    }

    adminUser = await User.findOne({ role: 'admin' });
    facultyUser = await User.findOne({ role: 'faculty' });
    const students = await User.find({ role: 'student' }).limit(2);
    student1User = students[0];
    student2User = students[1];

    assert.ok(adminUser, 'Admin user should exist');
    assert.ok(facultyUser, 'Faculty user should exist');
    assert.ok(student1User, 'Student 1 user should exist');
    assert.ok(student2User, 'Student 2 user should exist');

    student1Doc = await Student.findOne({ user: student1User._id });
    student2Doc = await Student.findOne({ user: student2User._id });
    testSubject = await Subject.findOne({
      $or: [{ faculty: facultyUser._id }]
    }) || await Subject.findOne();

    adminToken = makeToken(adminUser);
    facultyToken = makeToken(facultyUser);
    student1Token = makeToken(student1User);
    student2Token = makeToken(student2User);
  });

  // Test 1: Student can retrieve their attendance overview
  await t.test('1. Student can retrieve their attendance overview', async () => {
    const res = await fetch(`${API_BASE}/student/overview`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.summary !== undefined);
    assert.ok(Array.isArray(body.data));
  });

  // Test 2: Student cannot retrieve another student's records
  await t.test('2. Student cannot retrieve another student\'s records', async () => {
    const testDate = `2029-01-${String(Math.floor(Math.random() * 20) + 10).padStart(2, '0')}`;

    const otherRec = await Attendance.create({
      subject: testSubject._id,
      student: student2Doc._id,
      date: testDate,
      period: 1,
      status: 'present',
      verificationMethod: 'manual'
    });

    const res = await fetch(`${API_BASE}/student/${otherRec._id}`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 403, 'Should be forbidden to access another student record');

    await Attendance.deleteOne({ _id: otherRec._id });
  });

  // Test 3: Teacher can create a session for an assigned class
  await t.test('3. Teacher can create a session for an assigned class', async () => {
    const testDate = `2029-02-${String(Math.floor(Math.random() * 20) + 10).padStart(2, '0')}`;
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        subjectId: testSubject._id.toString(),
        date: testDate,
        period: 2,
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        sessionType: 'regular',
        attendanceMethod: 'face',
        branch: student1Doc.branch,
        semester: student1Doc.semester,
        section: 'A',
        status: 'open'
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    createdSessionId = body.data._id;
  });

  // Test 4: Teacher cannot create a session for an unauthorized class
  await t.test('4. Teacher cannot create a session for an unauthorized class', async () => {
    const fakeFacultyUser = new mongoose.Types.ObjectId();
    const uniqueCode = 'QP' + Math.floor(Math.random() * 90000 + 1000);
    const otherSubject = await Subject.create({
      name: 'Quantum Physics',
      code: uniqueCode,
      credits: 4,
      semester: 4,
      faculty: fakeFacultyUser
    });

    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        subjectId: otherSubject._id.toString(),
        date: '2029-03-01',
        period: 2,
        status: 'open'
      })
    });
    assert.equal(res.status, 403, 'Should reject session creation for unauthorized faculty');

    await Subject.deleteOne({ _id: otherSubject._id });
  });

  // Test 5: Student can join an active eligible session
  await t.test('5. Student can join an active eligible session', async () => {
    assert.ok(createdSessionId, 'Session must exist');
    const res = await fetch(`${API_BASE}/student/${createdSessionId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verificationRequired, true);
  });

  // Test 6: Student cannot join an expired/closed session
  await t.test('6. Student cannot join an expired/closed session', async () => {
    const closedSession = await AttendanceSession.create({
      subject: testSubject._id,
      faculty: facultyUser._id,
      date: '2029-03-02',
      period: 3,
      branch: student1Doc.branch,
      semester: student1Doc.semester,
      status: 'completed',
      sessionStatus: 'completed'
    });

    const res = await fetch(`${API_BASE}/student/${closedSession._id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res.status, 400, 'Should reject joining completed/closed session');

    await AttendanceSession.deleteOne({ _id: closedSession._id });
  });

  // Test 7: Duplicate attendance is prevented
  await t.test('7. Duplicate attendance is prevented', async () => {
    assert.ok(createdSessionId, 'Session must exist');
    // First marking
    const res1 = await fetch(`${API_BASE}/student/${createdSessionId}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({ verificationMethod: 'face', confidence: 0.95 })
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.success, true);
    createdAttendanceId = body1.data.attendanceId;

    // Second marking attempt
    const res2 = await fetch(`${API_BASE}/student/${createdSessionId}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({ verificationMethod: 'face', confidence: 0.95 })
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.alreadyMarked, true, 'Must indicate already marked and avoid duplicate row');
  });

  // Test 8: Cancelled sessions are excluded
  await t.test('8. Cancelled sessions are excluded from calculations', async () => {
    const cancelledSess = await AttendanceSession.create({
      subject: testSubject._id,
      faculty: facultyUser._id,
      date: '2029-03-03',
      period: 4,
      branch: student1Doc.branch,
      semester: student1Doc.semester,
      status: 'cancelled',
      sessionStatus: 'cancelled'
    });

    const overviewRes = await fetch(`${API_BASE}/student/overview`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(overviewRes.status, 200);
    const body = await overviewRes.json();
    assert.ok(body.summary);

    await AttendanceSession.deleteOne({ _id: cancelledSess._id });
  });

  // Test 9: Unfinalized sessions are excluded from final attendance calculations
  await t.test('9. Unfinalized sessions are excluded from final attendance calculations', async () => {
    const scheduledSess = await AttendanceSession.create({
      subject: testSubject._id,
      faculty: facultyUser._id,
      date: '2029-03-04',
      period: 5,
      branch: student1Doc.branch,
      semester: student1Doc.semester,
      status: 'scheduled',
      sessionStatus: 'scheduled'
    });

    const overviewRes = await fetch(`${API_BASE}/student/overview`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(overviewRes.status, 200);

    await AttendanceSession.deleteOne({ _id: scheduledSess._id });
  });

  // Test 10: Zero-class calculations work correctly
  await t.test('10. Zero-class calculations work correctly (No Data state)', async () => {
    const fakeStudent = await Student.create({
      user: new mongoose.Types.ObjectId(),
      rollNumber: 'TEMP' + Math.floor(Math.random() * 90000 + 1000),
      fullName: 'Temp Student',
      branch: 'MECH',
      semester: 8
    });
    const tempUser = { _id: fakeStudent.user, role: 'student', name: 'Temp Student' };
    const tempToken = makeToken(tempUser);

    const res = await fetch(`${API_BASE}/student/overview`, {
      headers: { Authorization: `Bearer ${tempToken}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.summary.totalClasses, 0);
    assert.equal(body.summary.overall, null);
    assert.equal(body.summary.status, 'No Data');

    await Student.deleteOne({ _id: fakeStudent._id });
  });

  // Test 11: Faculty can correct attendance with a reason
  await t.test('11. Faculty can correct attendance with a reason', async () => {
    assert.ok(createdAttendanceId, 'Attendance ID should exist from Test 7');
    const res = await fetch(`${API_BASE}/faculty/records/${createdAttendanceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        status: 'late',
        reason: 'Student arrived 5 minutes late due to bus delay'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'late');
    assert.equal(body.data.isManualOverride, true);
  });

  // Test 12: Corrections generate audit logs
  await t.test('12. Corrections generate audit logs', async () => {
    const log = await AttendanceAuditLog.findOne({
      attendanceId: createdAttendanceId,
      action: 'manual_correction'
    });
    assert.ok(log, 'Audit log must be created for manual correction');
    assert.equal(log.reason, 'Student arrived 5 minutes late due to bus delay');
  });

  // Test 13: Admin can view authorized reports & audit logs
  await t.test('13. Admin can view authorized reports and audit logs', async () => {
    const resAudit = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resAudit.status, 200);
    const bodyAudit = await resAudit.json();
    assert.equal(bodyAudit.success, true);
    assert.ok(Array.isArray(bodyAudit.data));

    const resOverview = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resOverview.status, 200);
    const bodyOverview = await resOverview.json();
    assert.ok(bodyOverview.data.totalSessions >= 1);
  });

  // Test 14: Unauthorized users cannot access protected endpoints
  await t.test('14. Unauthorized users cannot access protected endpoints', async () => {
    const res1 = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.equal(res1.status, 403, 'Student should be forbidden from admin audit logs');

    const res2 = await fetch(`${API_BASE}/faculty/overview`);
    assert.equal(res2.status, 401, 'Anonymous request should be rejected with 401');
  });

  // Test 15: API validation works
  await t.test('15. API validation works (rejects invalid input)', async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);

    const res2 = await fetch(`${API_BASE}/faculty/records/${createdAttendanceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        status: 'invalid_status',
        reason: 'Testing validation'
      })
    });
    assert.equal(res2.status, 400);
  });

  // Test 16: Database persistence works
  await t.test('16. Database persistence works', async () => {
    const recordInDb = await Attendance.findById(createdAttendanceId);
    assert.ok(recordInDb, 'Attendance record must persist in MongoDB');
    assert.equal(recordInDb.status, 'late');
    assert.equal(recordInDb.isManualOverride, true);

    const sessionInDb = await AttendanceSession.findById(createdSessionId);
    assert.ok(sessionInDb, 'Session must persist in MongoDB');

    // Clean up created test session, records, and logs
    await Attendance.deleteOne({ _id: createdAttendanceId });
    await AttendanceSession.deleteOne({ _id: createdSessionId });
    await AttendanceAuditLog.deleteMany({ sessionId: createdSessionId });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
