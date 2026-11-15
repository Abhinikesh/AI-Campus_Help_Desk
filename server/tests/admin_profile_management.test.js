/**
 * server/tests/admin_profile_management.test.js
 * Verification Suite for Admin Student & Faculty Profile Management (Part 6).
 *
 * Verifies:
 * 1. Admin Student profile retrieval (list and detail).
 * 2. Admin Student profile updates (permitted fields).
 * 3. Filling missing Student fields (e.g. phone, branch, semester, section).
 * 4. Admin Faculty profile retrieval (list and detail).
 * 5. Admin Faculty profile updates (permitted fields: department, designation, phone, name, email).
 * 6. Filling missing Faculty fields.
 * 7. Duplicate institutional identifier prevention (rollNumber and employeeId immutable).
 * 8. Invalid phone and email format rejection (HTTP 400).
 * 9. Unauthorized update denial (non-admin roles rejected with 403, unauthenticated with 401).
 * 10. Protection of role and identity fields (status, role, password).
 * 11. Audit history creation with field change tracking and non-PII summaries.
 * 12. No unintended database mutation invariance.
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/admin.routes');

let mongod, server, baseUrl;
let tokenAdmin, tokenFaculty, tokenStudent;
let adminUser, facultyUser, studentUser;
let studentDoc1, studentDocMissing, facultyDoc1;

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_admin_profile_mgmt' });

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message, errors: err.errors });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed Users
  adminUser = await User.create({
    name: 'Master Admin',
    email: 'admin@campussphere.edu',
    loginId: 'ADM001',
    passwordHash: 'HashedPassword123!',
    role: 'admin',
  });

  facultyUser = await User.create({
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@campussphere.edu',
    loginId: 'FAC001',
    passwordHash: 'HashedPassword123!',
    role: 'faculty',
  });

  studentUser = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul.sharma@campussphere.edu',
    loginId: '20240001',
    passwordHash: 'HashedPassword123!',
    role: 'student',
  });

  // Seed Canonical Student 1
  studentDoc1 = await Student.create({
    user: studentUser._id,
    rollNumber: '20240001',
    fullName: 'Rahul Sharma',
    email: 'rahul.sharma@campussphere.edu',
    phone: '9876543210',
    branch: 'CSE',
    program: 'B.Tech',
    semester: 5,
    section: 'A',
    admissionYear: 2024,
    status: 'active',
  });

  // Seed Canonical Student 2 (with missing fields)
  studentDocMissing = await Student.create({
    user: null,
    rollNumber: '20240002',
    fullName: 'Ananya Sen',
    email: null,
    phone: null,
    branch: null,
    program: 'B.Tech',
    semester: null,
    section: null,
    admissionYear: null,
    status: 'active',
  });

  // Seed Canonical Faculty
  facultyDoc1 = await Faculty.create({
    user: facultyUser._id,
    employeeId: 'EMP-FAC-001',
    department: 'CSE',
    designation: 'Associate Professor',
    phone: '9876500001',
  });

  // Mint Tokens
  const secret = JWT_SECRET || 'test-jwt-secret';
  tokenAdmin = jwt.sign({ userId: adminUser._id.toString(), role: 'admin' }, secret, { expiresIn: '1h' });
  tokenFaculty = jwt.sign({ userId: facultyUser._id.toString(), role: 'faculty' }, secret, { expiresIn: '1h' });
  tokenStudent = jwt.sign({ userId: studentUser._id.toString(), role: 'student' }, secret, { expiresIn: '1h' });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('Admin Student & Faculty Profile Management Suite', async (t) => {

  // ── TEST 1: Admin Student Profile Retrieval ─────────────────────────────
  await t.test('1. Admin Student profile retrieval (list & detail)', async () => {
    // 1a. List students
    const resList = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resList.status, 200);
    const bodyList = await resList.json();
    assert.equal(bodyList.success, true);
    assert.ok(bodyList.data.length >= 2);
    assert.equal(bodyList.pagination.total >= 2, true);

    // 1b. Search student by roll number
    const resSearch = await fetch(`${baseUrl}/api/admin/students?search=20240001`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const bodySearch = await resSearch.json();
    assert.equal(bodySearch.data.length, 1);
    assert.equal(bodySearch.data[0].rollNumber, '20240001');

    // 1c. Get single student detail
    const resDetail = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resDetail.status, 200);
    const bodyDetail = await resDetail.json();
    assert.equal(bodyDetail.data.student.rollNumber, '20240001');
    assert.equal(bodyDetail.data.student.fullName, 'Rahul Sharma');
    assert.ok(Array.isArray(bodyDetail.data.auditHistory));
  });

  // ── TEST 2: Admin Student Profile Updates ───────────────────────────────
  await t.test('2. Admin Student profile updates permitted fields', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Rahul S. Sharma',
        section: 'B',
        admissionYear: 2024,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.updatedFields.sort(), ['fullName', 'section'].sort());

    const updated = await Student.findById(studentDoc1._id);
    assert.equal(updated.fullName, 'Rahul S. Sharma');
    assert.equal(updated.section, 'B');

    // Verify User name synchronized
    const updatedUser = await User.findById(studentUser._id);
    assert.equal(updatedUser.name, 'Rahul S. Sharma');
  });

  // ── TEST 3: Filling Missing Student Fields ───────────────────────────────
  await t.test('3. Filling missing Student fields safely', async () => {
    // studentDocMissing has null branch, null semester, null phone, null email
    const res = await fetch(`${baseUrl}/api/admin/students/${studentDocMissing._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch: 'ECE',
        semester: 3,
        section: 'A',
        phone: '9876541111',
        email: 'ananya.sen@campussphere.edu',
        admissionYear: 2025,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const filled = await Student.findById(studentDocMissing._id);
    assert.equal(filled.branch, 'ECE');
    assert.equal(filled.semester, 3);
    assert.equal(filled.section, 'A');
    assert.equal(filled.phone, '9876541111');
    assert.equal(filled.email, 'ananya.sen@campussphere.edu');
    assert.equal(filled.admissionYear, 2025);
  });

  // ── TEST 4: Admin Faculty Profile Retrieval ─────────────────────────────
  await t.test('4. Admin Faculty profile retrieval (list & detail)', async () => {
    const resList = await fetch(`${baseUrl}/api/admin/faculty`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resList.status, 200);
    const bodyList = await resList.json();
    assert.equal(bodyList.data.length >= 1, true);
    assert.equal(bodyList.data[0].employeeId, 'EMP-FAC-001');

    const resDetail = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc1._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resDetail.status, 200);
    const bodyDetail = await resDetail.json();
    assert.equal(bodyDetail.data.faculty.employeeId, 'EMP-FAC-001');
    assert.equal(bodyDetail.data.faculty.designation, 'Associate Professor');
    assert.ok(Array.isArray(bodyDetail.data.auditHistory));
  });

  // ── TEST 5: Admin Faculty Profile Updates ───────────────────────────────
  await t.test('5. Admin Faculty profile updates permitted fields', async () => {
    const res = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        designation: 'Professor & Head',
        department: 'CSE-AI',
        name: 'Dr. Priya M. Mehta',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.updatedFields.sort(), ['department', 'designation', 'name'].sort());

    const updated = await Faculty.findById(facultyDoc1._id).populate('user');
    assert.equal(updated.designation, 'Professor & Head');
    assert.equal(updated.department, 'CSE-AI');
    assert.equal(updated.user.name, 'Dr. Priya M. Mehta');
  });

  // ── TEST 6: Filling Missing Faculty Fields ───────────────────────────────
  await t.test('6. Filling missing Faculty fields safely', async () => {
    // Create faculty with empty phone and department
    const userIncomplete = await User.create({
      name: 'Prof. Amit Roy',
      email: 'amit.roy@campussphere.edu',
      loginId: 'FAC099',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
    });
    const facIncomplete = await Faculty.create({
      user: userIncomplete._id,
      employeeId: 'EMP-FAC-099',
      department: '',
      designation: 'Assistant Professor',
      phone: '',
    });

    const res = await fetch(`${baseUrl}/api/admin/faculty/${facIncomplete._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        department: 'Mathematics',
        phone: '9876540099',
      }),
    });
    assert.equal(res.status, 200);

    const filled = await Faculty.findById(facIncomplete._id);
    assert.equal(filled.department, 'Mathematics');
    assert.equal(filled.phone, '9876540099');
  });

  // ── TEST 7: Duplicate Institutional Identifier Prevention ───────────────
  await t.test('7. Institutional identifiers (rollNumber & employeeId) are immutable', async () => {
    // 7a. Attempt to alter Student rollNumber
    const resStudentRoll = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rollNumber: 'NEW_ROLL_999999' }),
    });
    assert.equal(resStudentRoll.status, 400);
    const bodyStudentRoll = await resStudentRoll.json();
    assert.match(bodyStudentRoll.message, /immutable/i);

    // 7b. Attempt to alter Faculty employeeId
    const resFacEmpId = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employeeId: 'NEW_EMP_999999' }),
    });
    assert.equal(resFacEmpId.status, 400);
    const bodyFacEmpId = await resFacEmpId.json();
    assert.match(bodyFacEmpId.message, /immutable/i);
  });

  // ── TEST 8: Invalid Phone and Email Rejection ───────────────────────────
  await t.test('8. Rejection of invalid phone and email formats with 400', async () => {
    // 8a. Invalid phone format
    const resBadPhone = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: 'not-a-phone-123' }),
    });
    assert.equal(resBadPhone.status, 400);
    const bodyBadPhone = await resBadPhone.json();
    assert.match(bodyBadPhone.message, /phone/i);

    // 8b. Invalid email format
    const resBadEmail = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'invalid_email_format' }),
    });
    assert.equal(resBadEmail.status, 400);
    const bodyBadEmail = await resBadEmail.json();
    assert.match(bodyBadEmail.message, /email/i);

    // 8c. Duplicate email rejection (409 Conflict)
    const resDupEmail = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'ananya.sen@campussphere.edu' }), // already used by Student 2
    });
    assert.equal(resDupEmail.status, 409);
    const bodyDupEmail = await resDupEmail.json();
    assert.match(bodyDupEmail.message, /already in use/i);
  });

  // ── TEST 9: Unauthorized Update Denial ──────────────────────────────────
  await t.test('9. Unauthorized update denial (unauthenticated 401, student/faculty 403)', async () => {
    // 9a. Unauthenticated student update
    const resNoAuth = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Hacker Name' }),
    });
    assert.equal(resNoAuth.status, 401);

    // 9b. Student role attempting admin student update
    const resStudent = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenStudent}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: 'Hacker Name' }),
    });
    assert.equal(resStudent.status, 403);

    // 9c. Faculty role attempting admin faculty update
    const resFaculty = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenFaculty}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ designation: 'Dean of Everything' }),
    });
    assert.equal(resFaculty.status, 403);
  });

  // ── TEST 10: Protection of Role and Identity Fields ─────────────────────
  await t.test('10. Protection of role and status fields from modification', async () => {
    // 10a. Attempt to modify Student verification status
    const resStudentStatus = await fetch(`${baseUrl}/api/admin/students/${studentDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'graduated' }),
    });
    assert.equal(resStudentStatus.status, 400);
    const bodyStatus = await resStudentStatus.json();
    assert.match(bodyStatus.message, /status/i);

    // 10b. Attempt to escalate Faculty user role to admin
    const resFacRole = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert.equal(resFacRole.status, 400);
    const bodyRole = await resFacRole.json();
    assert.match(bodyRole.message, /role/i);
  });

  // ── TEST 11: Audit History Creation ─────────────────────────────────────
  await t.test('11. Audit history records updated fields, actor, and non-PII summary', async () => {
    const auditLogs = await AuditLog.find({
      action: { $in: ['ADMIN_STUDENT_PROFILE_UPDATE', 'ADMIN_FACULTY_PROFILE_UPDATE'] },
    }).sort({ createdAt: -1 });

    assert.ok(auditLogs.length >= 3, 'Audit logs must have been created for profile edits');
    const studentLog = auditLogs.find((l) => l.action === 'ADMIN_STUDENT_PROFILE_UPDATE');
    assert.equal(studentLog.actor.toString(), adminUser._id.toString());
    assert.equal(studentLog.entityType, 'Student');
    assert.match(studentLog.summary, /Admin updated student profile fields:/);
    assert.doesNotMatch(studentLog.summary, /password|token/i);

    const facultyLog = auditLogs.find((l) => l.action === 'ADMIN_FACULTY_PROFILE_UPDATE');
    assert.equal(facultyLog.actor.toString(), adminUser._id.toString());
    assert.equal(facultyLog.entityType, 'Faculty');
    assert.match(facultyLog.summary, /Admin updated faculty profile fields:/);
  });

  // ── TEST 12: Zero-Mutation Invariance Check ─────────────────────────────
  await t.test('12. Invariance check: record counts remain consistent across operations', async () => {
    const studentCountBefore = await Student.countDocuments();
    const facultyCountBefore = await Faculty.countDocuments();
    const userCountBefore = await User.countDocuments();

    // Query profiles without writing
    await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    await fetch(`${baseUrl}/api/admin/faculty`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });

    const studentCountAfter = await Student.countDocuments();
    const facultyCountAfter = await Faculty.countDocuments();
    const userCountAfter = await User.countDocuments();

    assert.equal(studentCountAfter, studentCountBefore);
    assert.equal(facultyCountAfter, facultyCountBefore);
    assert.equal(userCountAfter, userCountBefore);
  });
});
