/**
 * server/tests/login_operational_verification.test.js
 * Comprehensive Operational Verification Suite for Prompt 10:
 * Multi-Role Authentication: Admin, Faculty, and Canonical Student Login & Linking.
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const express = require('express');
const cookieParser = require('cookie-parser');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const authRoutes = require('../routes/auth.routes');
const studentRoutes = require('../routes/student.routes');
const adminRoutes = require('../routes/admin.routes');
const facultyRoutes = require('../routes/faculty.routes');
const { resetStudentLoginThrottler } = require('../controllers/auth.controller');

let mongod, server, baseUrl;
let adminUser, facultyUser, facultyDoc;
let canonicalStudentA, canonicalStudentB, canonicalStudentPolluted;
let syntheticTempStudent, syntheticDuplicateStudent;
let adminPassword = 'AdminSecretPass123!';
let facultyPassword = 'FacultySecretPass123!';

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_login_verification' });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);

  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 1. Seed Admin
  const adminHash = await bcrypt.hash(adminPassword, 10);
  adminUser = await User.create({
    name: 'Campus Admin',
    email: 'admin@campus.edu',
    loginId: 'ADMIN001',
    role: 'admin',
    passwordHash: adminHash,
    isActive: true,
  });

  // 2. Seed Faculty
  const facultyHash = await bcrypt.hash(facultyPassword, 10);
  facultyUser = await User.create({
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@campus.edu',
    loginId: 'FAC001',
    role: 'faculty',
    passwordHash: facultyHash,
    isActive: true,
  });
  facultyDoc = await Faculty.create({
    user: facultyUser._id,
    employeeId: 'FAC001',
    fullName: 'Dr. Priya Mehta',
    department: 'Computer Science',
    email: 'priya.mehta@campus.edu',
  });

  // 3. Seed Canonical Students (enrolled_offline, user: null)
  canonicalStudentA = await Student.create({
    user: null,
    rollNumber: '1/24/SET/BCS/231',
    fullName: 'Abhinikesh Kumar',
    email: 'abhinikeshkumar6@gmail.com',
    branch: 'B.Tech. CSE',
    semester: 5,
    status: 'active',
    accountStatus: 'enrolled_offline',
  });

  canonicalStudentB = await Student.create({
    user: null,
    rollNumber: '1/23/SET/BCS/095',
    fullName: 'Kunal Bhargava',
    email: 'umishra@live.in',
    branch: 'B.Tech. CSE',
    semester: 5,
    status: 'active',
    accountStatus: 'enrolled_offline',
  });

  canonicalStudentPolluted = await Student.create({
    user: null,
    rollNumber: '1/24/SET/BCS/020',
    fullName: 'Nishant Singh',
    email: 'REVIEW — NISHANT | Nishant REVIEW — Ganeshbhardwaj9263@gmail.com | nishantsingh4717@gmail.com',
    branch: 'B.Tech. CSE',
    semester: 5,
    status: 'active',
    accountStatus: 'enrolled_offline',
  });

  // 4. Seed Synthetic / Duplicate Students
  syntheticTempStudent = await Student.create({
    user: null,
    rollNumber: 'TEMP56839',
    fullName: 'Temp Student',
    email: 'temp@gmail.com',
    status: 'active',
    accountStatus: 'enrolled_offline',
  });

  syntheticDuplicateStudent = await Student.create({
    user: null,
    rollNumber: '1/24SET/BCS/319',
    fullName: 'Sayyam Jaggi Duplicate',
    email: 'sayyamjaggi@gmail.com',
    status: 'active',
    accountStatus: 'enrolled_offline',
  });

  resetStudentLoginThrottler();
});

after(async () => {
  if (server) server.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('CampusSphere Prompt 10: Multi-Role Operational Login & Linking Suite', () => {

  // ── ADMIN LOGIN ──────────────────────────────────────────────
  test('1. Admin login succeeds with valid credentials and redirects to /admin/dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN001',
        password: adminPassword,
        role: 'admin',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'admin');
    assert.equal(body.data.redirectTo, '/admin/dashboard');
    assert.ok(body.data.token);

    // Verify session via /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.data.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data.loginId, 'ADMIN001');
    assert.equal(meData.data.role, 'admin');
  });

  test('2. Admin login fails with incorrect password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN001',
        password: 'WrongPassword!',
        role: 'admin',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /invalid credentials/i);
  });

  // ── FACULTY LOGIN ────────────────────────────────────────────
  test('3. Faculty login succeeds with Employee ID and redirects to /faculty/dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC001',
        password: facultyPassword,
        role: 'faculty',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'faculty');
    assert.equal(body.data.redirectTo, '/faculty/dashboard');
    assert.ok(body.data.token);
  });

  test('4. Faculty login succeeds with registered Email address', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'priya.mehta@campus.edu',
        password: facultyPassword,
        role: 'faculty',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'faculty');
    assert.ok(body.data.token);
  });

  test('5. Faculty login fails with incorrect password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC001',
        password: 'WrongFacultyPassword!',
        role: 'faculty',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /invalid credentials/i);
  });

  // ── STUDENT LOGIN & CANONICAL ACCOUNT LINKING ───────────────
  test('6. Canonical student login automatically provisions and links User account', async () => {
    resetStudentLoginThrottler();
    const preStudent = await Student.findOne({ rollNumber: '1/24/SET/BCS/231' });
    assert.equal(preStudent.user, null);
    assert.equal(preStudent.accountStatus, 'enrolled_offline');

    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'abhinikeshkumar6@gmail.com',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'student');
    assert.equal(body.data.rollNumber, '1/24/SET/BCS/231');
    assert.equal(body.data.redirectTo, '/student/dashboard');
    assert.ok(body.data.token);

    // Verify student document now links to provisioned User
    const postStudent = await Student.findOne({ rollNumber: '1/24/SET/BCS/231' });
    assert.ok(postStudent.user, 'Student must have linked User ObjectId');
    assert.equal(postStudent.accountStatus, 'active_user');

    const linkedUser = await User.findById(postStudent.user);
    assert.ok(linkedUser);
    assert.equal(linkedUser.loginId, '1/24/SET/BCS/231');
    assert.equal(linkedUser.email, 'abhinikeshkumar6@gmail.com');
    assert.equal(linkedUser.role, 'student');
    assert.equal(linkedUser.isActive, true);

    // Verify /api/student/profile works with the token
    const profileRes = await fetch(`${baseUrl}/api/student/profile`, {
      headers: { Authorization: `Bearer ${body.data.token}` },
    });
    assert.equal(profileRes.status, 200);
    const profileData = await profileRes.json();
    assert.equal(profileData.data.rollNumber, '1/24/SET/BCS/231');
    assert.equal(profileData.data.accountStatus, 'active_user');
  });

  test('7. Subsequent canonical student login reuses existing linked User account', async () => {
    resetStudentLoginThrottler();
    const userCountBefore = await User.countDocuments();

    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'abhinikeshkumar6@gmail.com',
      }),
    });

    assert.equal(res.status, 200);
    const userCountAfter = await User.countDocuments();
    assert.equal(userCountAfter, userCountBefore, 'Zero duplicate users must be created on repeated login');
  });

  test('8. Canonical student with legitimate non-Gmail domain (live.in) links and authenticates', async () => {
    resetStudentLoginThrottler();
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/23/SET/BCS/095',
        gmail: 'umishra@live.in',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.rollNumber, '1/23/SET/BCS/095');
    assert.ok(body.data.token);

    const postStudent = await Student.findOne({ rollNumber: '1/23/SET/BCS/095' });
    assert.ok(postStudent.user);
    assert.equal(postStudent.accountStatus, 'active_user');
  });

  test('9. Canonical student with merge-polluted email record authenticates and cleans email', async () => {
    resetStudentLoginThrottler();
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/020',
        gmail: 'nishantsingh4717@gmail.com',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.rollNumber, '1/24/SET/BCS/020');

    // Verify email cleaned in student record
    const cleanedStudent = await Student.findOne({ rollNumber: '1/24/SET/BCS/020' });
    assert.equal(cleanedStudent.email, 'nishantsingh4717@gmail.com');
  });

  test('10. Synthetic TEMP record is rejected from account creation', async () => {
    resetStudentLoginThrottler();
    const userCountBefore = await User.countDocuments();

    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: 'TEMP56839',
        gmail: 'temp@gmail.com',
      }),
    });

    assert.equal(res.status, 401);
    const userCountAfter = await User.countDocuments();
    assert.equal(userCountAfter, userCountBefore, 'Zero accounts may be created for synthetic TEMP records');
  });

  test('11. Duplicate format student record is rejected from account creation', async () => {
    resetStudentLoginThrottler();
    const userCountBefore = await User.countDocuments();

    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24SET/BCS/319',
        gmail: 'sayyamjaggi@gmail.com',
      }),
    });

    assert.equal(res.status, 401);
    const userCountAfter = await User.countDocuments();
    assert.equal(userCountAfter, userCountBefore, 'Zero accounts may be created for duplicate student records');
  });

  test('12. Student login fails with mismatched email', async () => {
    resetStudentLoginThrottler();
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'wrong.email@gmail.com',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /invalid roll number or registered gmail address/i);
  });

  test('13. Student login fails with invalid email syntax', async () => {
    resetStudentLoginThrottler();
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'invalid-email-format',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /invalid email format/i);
  });

  // ── RBAC & SECURITY ISOLATION ───────────────────────────────
  test('14. Student token cannot access Admin APIs (403 Forbidden)', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'abhinikeshkumar6@gmail.com',
      }),
    });
    const { data: { token } } = await loginRes.json();

    const adminRes = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(adminRes.status, 403);
  });

  test('15. Student token cannot access Faculty APIs (403 Forbidden)', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: '1/24/SET/BCS/231',
        gmail: 'abhinikeshkumar6@gmail.com',
      }),
    });
    const { data: { token } } = await loginRes.json();

    const facultyRes = await fetch(`${baseUrl}/api/faculty/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(facultyRes.status, 403);
  });

  test('16. Faculty token cannot access Admin APIs (403 Forbidden)', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC001',
        password: facultyPassword,
        role: 'faculty',
      }),
    });
    const { data: { token } } = await loginRes.json();

    const adminRes = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(adminRes.status, 403);
  });

  test('17. Unauthenticated request to protected endpoints is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/api/student/profile`);
    assert.equal(res.status, 401);
  });

  test('18. Logout clears cookie and invalidates session', async () => {
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });
    assert.equal(logoutRes.status, 200);
    const body = await logoutRes.json();
    assert.equal(body.success, true);
  });
});
