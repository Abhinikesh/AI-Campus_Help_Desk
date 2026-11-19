/**
 * Live End-to-End Verification of Smart Attendance System
 * Runs against live running servers:
 * - Backend: http://localhost:5001
 * - Python AI: http://localhost:5002
 * - MongoDB: campus-erp on port 27018
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5001';
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

async function main() {
  console.log('--- STARTING LIVE SMART ATTENDANCE E2E VERIFICATION ---');

  // Step 0: Connect to MongoDB campus-erp to fetch rotated user credentials for live testing
  await mongoose.connect('mongodb://127.0.0.1:27018/campus-erp');
  const User = require('../models/User');
  const Student = require('../models/Student');
  const Faculty = require('../models/Faculty');
  const Subject = require('../models/Subject');
  const AttendanceSession = require('../models/AttendanceSession');
  const Attendance = require('../models/Attendance');
  const AttendanceAuditLog = require('../models/AttendanceAuditLog');

  // Find Faculty FAC001
  const facUser = await User.findOne({ loginId: 'FAC001' });
  assert.ok(facUser, 'Faculty user FAC001 must exist');
  const facDoc = await Faculty.findOne({ user: facUser._id });
  assert.ok(facDoc, 'Faculty profile for FAC001 must exist');

  // Find Student 1/24/SET/BCS/231
  const studentDoc = await Student.findOne({ rollNumber: '1/24/SET/BCS/231' }).populate('user');
  assert.ok(studentDoc, 'Student 1/24/SET/BCS/231 must exist');
  const stuUser = await User.findById(studentDoc.user);
  assert.ok(stuUser, 'Student user must exist');

  // Find Admin ADMIN001
  const adminUser = await User.findOne({ loginId: 'ADMIN001' });
  assert.ok(adminUser, 'Admin user ADMIN001 must exist');

  // Find a subject taught by faculty or assign one for test
  let subject = await Subject.findOne({ faculty: facUser._id });
  if (!subject) {
    subject = await Subject.findOne({ branch: 'CSE', semester: 4 }) ||
              await Subject.findOne({ branch: 'CSE' }) ||
              await Subject.findOne({});
  }
  assert.ok(subject, 'At least one subject must exist');
  console.log(`[Setup] Using Faculty: ${facUser.name} (${facUser.loginId}), Subject: ${subject.name} (${subject.code}), Student: ${studentDoc.fullName} (${studentDoc.rollNumber})`);

  // To authenticate against live API without hardcoded plaintext passwords,
  // we generate valid JWT tokens directly with JWT_SECRET
  const facultyToken = jwt.sign(
    { userId: facUser._id.toString(), role: 'faculty', email: facUser.email, name: facUser.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || '1h' }
  );

  const studentToken = jwt.sign(
    { userId: stuUser._id.toString(), role: 'student', email: stuUser.email, name: stuUser.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || '1h' }
  );

  const adminToken = jwt.sign(
    { userId: adminUser._id.toString(), role: 'admin', email: adminUser.email, name: adminUser.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || '1h' }
  );

  console.log('✅ Generated authoritative session tokens for Faculty, Student, and Admin.');

  let liveSessionId = null;

  try {
    // Clean up any stale sessions from earlier runs
    await AttendanceSession.deleteMany({
      faculty: facUser._id,
      subject: subject._id,
      date: new Date().toISOString().split('T')[0],
      status: { $in: ['open', 'active', 'paused'] },
    });
  console.log('\n[Step 1] Faculty views assigned subjects...');
  const subRes = await fetch(`${API_BASE}/api/faculty/subjects`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const subJson = await subRes.json();
  assert.strictEqual(subRes.status, 200);
  assert.strictEqual(subJson.success, true);
  console.log(`✅ Faculty subjects retrieved: ${subJson.data?.length || 0} subjects`);

  // ── Step 2: Faculty Creates Attendance Session ──
  console.log('\n[Step 2] Faculty starts attendance session...');
  const sessionPayload = {
    subjectId: subject._id.toString(),
    branch: subject.branch || 'CSE',
    semester: subject.semester || 4,
    section: 'A',
    date: new Date().toISOString().split('T')[0],
    period: 1,
    periods: [1],
    periodCount: 1,
    attendanceMethod: 'qr_face',
    durationMinutes: 45,
  };

  const createRes = await fetch(`${API_BASE}/api/faculty/attendance/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionPayload),
  });
  const createJson = await createRes.json();
  assert.strictEqual(createRes.status, 201, `Create session failed: ${JSON.stringify(createJson)}`);
  assert.strictEqual(createJson.success, true);
  const liveSessionId = createJson.data._id;
  console.log(`✅ Attendance session created: ${liveSessionId} (status: ${createJson.data.status})`);

  // ── Step 3: Rotating QR Challenge Generation ──
  console.log('\n[Step 3] Faculty generates dynamic rotating QR challenge token...');
  const qrRes = await fetch(`${API_BASE}/api/attendance/sessions/${liveSessionId}/qr-challenge`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const qrJson = await qrRes.json();
  assert.strictEqual(qrRes.status, 200);
  assert.strictEqual(qrJson.success, true);
  const qrChallengeVal = qrJson.data.challengeToken || qrJson.data.token;
  assert.ok(qrChallengeVal, 'QR token must be non-empty');
  assert.ok(qrJson.data.expiresInSeconds > 0, 'Expiration must be positive');
  console.log(`✅ Dynamic QR challenge generated: token length ${qrChallengeVal.length}, expires in ${qrJson.data.expiresInSeconds}s`);

  // ── Step 4: Pause and Resume Session ──
  console.log('\n[Step 4] Faculty pauses attendance session...');
  const pauseRes = await fetch(`${API_BASE}/api/attendance/sessions/${liveSessionId}/pause`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Temporary instructor pause for lecture delivery' }),
  });
  const pauseJson = await pauseRes.json();
  assert.strictEqual(pauseRes.status, 200);
  assert.strictEqual(pauseJson.data.status, 'paused');
  console.log('✅ Session successfully paused.');

  console.log('[Step 4b] Faculty resumes attendance session...');
  const resumeRes = await fetch(`${API_BASE}/api/attendance/sessions/${liveSessionId}/resume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Resumed attendance scanning' }),
  });
  const resumeJson = await resumeRes.json();
  assert.strictEqual(resumeRes.status, 200);
  assert.strictEqual(resumeJson.data.status, 'active');
  console.log('✅ Session successfully resumed.');

  // ── Step 5: Live Roster & Attendance Counts ──
  console.log('\n[Step 5] Faculty inspects live attendance roster...');
  const rosterRes = await fetch(`${API_BASE}/api/faculty/attendance/sessions/${liveSessionId}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const rosterJson = await rosterRes.json();
  assert.strictEqual(rosterRes.status, 200);
  assert.strictEqual(rosterJson.success, true);
  assert.ok(Array.isArray(rosterJson.data.roster), 'Roster must be an array');
  console.log(`✅ Live roster retrieved: ${rosterJson.data.roster.length} students, Stats: ${JSON.stringify(rosterJson.data.stats)}`);

  // ── Step 6: Manual Attendance Correction with Mandatory Reason ──
  console.log('\n[Step 6] Faculty performs manual attendance correction with reason...');
  const firstRosterStudent = rosterJson.data.roster[0] || {
    _id: `pending-${studentDoc._id}`,
    studentId: studentDoc._id.toString(),
  };

  const correctionPayload = {
    attendanceId: firstRosterStudent._id,
    sessionId: liveSessionId,
    studentId: firstRosterStudent.studentId || studentDoc._id.toString(),
    status: 'present',
    reason: 'Verified physical presence and authorized manual override',
    note: 'Verified physical presence and authorized manual override',
  };

  const correctRes = await fetch(`${API_BASE}/api/faculty/attendance/mark-student`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(correctionPayload),
  });
  const correctJson = await correctRes.json();
  assert.strictEqual(correctRes.status, 200, `Correction failed: ${JSON.stringify(correctJson)}`);
  assert.strictEqual(correctJson.data.status, 'present');
  assert.strictEqual(correctJson.data.isManualOverride, true);
  console.log(`✅ Manual attendance correction applied: status is present, overrideNote confirmed.`);

  // Verify Audit Log
  const auditEntry = await AttendanceAuditLog.findOne({
    sessionId: new mongoose.Types.ObjectId(liveSessionId),
    action: 'manual_correction',
  });
  assert.ok(auditEntry, 'AttendanceAuditLog record must exist for manual correction');
  console.log(`✅ Immutable audit log verified: Action ${auditEntry.action}, Reason: "${auditEntry.reason}"`);

  // ── Step 7: Negative Test — Missing Reason Rejected ──
  console.log('\n[Step 7] Negative Test: Correction rejected without reason...');
  const badCorrectRes = await fetch(`${API_BASE}/api/faculty/attendance/mark-student`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attendanceId: correctJson.data._id,
      status: 'absent',
      reason: '   ',
      note: '',
    }),
  });
  assert.strictEqual(badCorrectRes.status, 400);
  console.log('✅ Correctly rejected with HTTP 400 when reason is missing.');

  // ── Step 8: Faculty Finalizes Attendance Session ──
  console.log('\n[Step 8] Faculty finalizes attendance session...');
  const finalizeRes = await fetch(`${API_BASE}/api/attendance/sessions/${liveSessionId}/finalize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Lecture concluded and roster locked' }),
  });
  const finalizeJson = await finalizeRes.json();
  assert.strictEqual(finalizeRes.status, 200);
  assert.strictEqual(finalizeJson.data.status, 'finalized');
  console.log(`✅ Session finalized: presentCount=${finalizeJson.data.presentCount}`);

  // ── Step 9: Negative Test — Marking on Finalized Session Rejected ──
  console.log('\n[Step 9] Negative Test: Joining finalized session rejected...');
  const closedJoinRes = await fetch(`${API_BASE}/api/student/attendance/join/${liveSessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ verificationMethod: 'manual' }),
  });
  assert.strictEqual(closedJoinRes.status, 400);
  console.log('✅ Correctly rejected with HTTP 400 for joining finalized session.');

  // ── Step 10: Student Attendance Overview & History ──
  console.log('\n[Step 10] Student views attendance overview & history...');
  const stuOverviewRes = await fetch(`${API_BASE}/api/student/attendance`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const stuOverviewJson = await stuOverviewRes.json();
  assert.strictEqual(stuOverviewRes.status, 200);
  assert.strictEqual(stuOverviewJson.success, true);

  const stuHistRes = await fetch(`${API_BASE}/api/student/attendance/history`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const stuHistJson = await stuHistRes.json();
  assert.strictEqual(stuHistRes.status, 200);
  assert.strictEqual(stuHistJson.success, true);
  console.log(`✅ Student attendance view verified: ${stuHistJson.data?.records?.length || 0} history records`);

  // ── Step 11: Admin Attendance Overview & Monitoring ──
  console.log('\n[Step 11] Admin views institutional attendance overview...');
  const adminOverviewRes = await fetch(`${API_BASE}/api/admin/attendance/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminOverviewJson = await adminOverviewRes.json();
  assert.strictEqual(adminOverviewRes.status, 200);
  assert.strictEqual(adminOverviewJson.success, true);
  console.log(`✅ Admin overview: totalSessions=${adminOverviewJson.data?.totalSessions || adminOverviewJson.data?.finalizedSessions}, branches=${adminOverviewJson.data?.branches?.length || 0}`);

  // ── Step 12: Admin Records Search & Pagination ──
  console.log('\n[Step 12] Admin searches attendance records with pagination...');
  const adminRecRes = await fetch(`${API_BASE}/api/admin/attendance/records?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminRecJson = await adminRecRes.json();
  assert.strictEqual(adminRecRes.status, 200);
  assert.strictEqual(adminRecJson.success, true);
  assert.ok(adminRecJson.data.pagination, 'Pagination object must exist');
  console.log(`✅ Admin records verified: ${adminRecJson.data.records?.length || 0} records on page 1 of ${adminRecJson.data.pagination.totalPages}`);

  // ── Step 13: Attendance CSV Export ──
  console.log('\n[Step 13] Admin exports attendance report as CSV...');
  const csvRes = await fetch(`${API_BASE}/api/attendance/reports/export?reportType=department_report&format=csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.length > 0, 'CSV export must not be empty');
  console.log(`✅ CSV report generated: ${csvText.split('\n').length} lines`);

  } finally {
    // ── Cleanup Test Session ──
    if (liveSessionId) {
      console.log('\n[Cleanup] Cleaning up test session artifacts...');
      await Attendance.deleteMany({ session: new mongoose.Types.ObjectId(liveSessionId) });
      await AttendanceSession.findByIdAndDelete(liveSessionId);
      await AttendanceAuditLog.deleteMany({ sessionId: new mongoose.Types.ObjectId(liveSessionId) });
      console.log('✅ Test session cleaned up safely without touching historical records.');
    }
    await mongoose.disconnect();
  }

  console.log('\n🎉 ALL 13 LIVE SMART ATTENDANCE INTEGRATION CHECKS PASSED PERFECTLY!');
}

main().catch((err) => {
  console.error('\n❌ LIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
