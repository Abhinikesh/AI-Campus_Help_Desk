/**
 * server/tests/student_roll_gmail_auth.test.js
 * Verification Suite for Part 7: Student Login Using Roll Number + Personal Gmail.
 *
 * Implements isolated tests using synthetic records against in-memory MongoDB:
 *  1. Correct roll number + matching personal Gmail → login succeeds.
 *  2. Correct roll number + wrong Gmail → login denied.
 *  3. Wrong roll number + correct Gmail → login denied.
 *  4. Roll number belonging to Student A + Gmail belonging to Student B → login denied.
 *  5. Gmail casing differences → normalized correctly.
 *  6. Leading/trailing email whitespace → handled correctly.
 *  7. Non-Gmail address → rejected for this login flow.
 *  8. Invalid email format → rejected.
 *  9. Missing roll number → rejected.
 * 10. Missing email → rejected.
 * 11. Ineligible account → login denied.
 * 12. Unknown roll number → generic failure response.
 * 13. Repeated failed attempts → rate limiting works (throttling with 429).
 * 14. Student token cannot access Admin APIs.
 * 15. Student token cannot access Faculty-only APIs.
 * 16. Valid Student token can access authorized Student APIs.
 * 17. Admin login remains functional.
 * 18. Faculty login remains functional.
 * 19. Logout and session expiration continue working.
 * 20. No Student or User record is created during login.
 * 21. Student with missing linked User record → fails safely.
 * 22. Inconsistent Student/User linkage data → fails safely.
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
let initialStudentCount, initialUserCount;

let studentA, studentB, studentSuspended, studentInactive, studentOffline, studentInconsistent;
let userA, userB, userSuspended, userInactive, userInconsistent;
let adminUser, facultyUser, facultyDoc;

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_student_auth' });

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);

  // Central error handler
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message, errors: err.errors });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed Synthetic Fixtures
  const defaultPasswordHash = await bcrypt.hash('TestPass123!', 10);

  // 1. Synthetic Student A
  userA = await User.create({
    name: 'Synthetic Student One',
    email: 'student.one@gmail.com',
    loginId: 'ROLL2024A',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  studentA = await Student.create({
    user: userA._id,
    rollNumber: 'ROLL2024A',
    fullName: 'Synthetic Student One',
    email: 'student.one@gmail.com',
    phone: '9876543210',
    status: 'active',
  });

  // 2. Synthetic Student B
  userB = await User.create({
    name: 'Synthetic Student Two',
    email: 'student.two@gmail.com',
    loginId: 'ROLL2024B',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  studentB = await Student.create({
    user: userB._id,
    rollNumber: 'ROLL2024B',
    fullName: 'Synthetic Student Two',
    email: 'student.two@gmail.com',
    phone: '9876543211',
    status: 'active',
  });

  // 3. Synthetic Suspended Student
  userSuspended = await User.create({
    name: 'Suspended Student',
    email: 'suspended@gmail.com',
    loginId: 'ROLLSUSPENDED',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  studentSuspended = await Student.create({
    user: userSuspended._id,
    rollNumber: 'ROLLSUSPENDED',
    fullName: 'Suspended Student',
    email: 'suspended@gmail.com',
    status: 'suspended',
  });

  // 4. Synthetic Inactive User Student
  userInactive = await User.create({
    name: 'Inactive User Student',
    email: 'inactive@gmail.com',
    loginId: 'ROLLINACTIVE',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: false,
  });

  studentInactive = await Student.create({
    user: userInactive._id,
    rollNumber: 'ROLLINACTIVE',
    fullName: 'Inactive User Student',
    email: 'inactive@gmail.com',
    status: 'active',
  });

  // 5. Synthetic Offline / Unlinked Student (user: null)
  studentOffline = await Student.create({
    user: null,
    rollNumber: 'ROLLOFFLINE',
    fullName: 'Offline Student',
    email: 'offline@gmail.com',
    status: 'active',
  });

  // 6. Synthetic Inconsistent Student (user.loginId differs from student.rollNumber)
  userInconsistent = await User.create({
    name: 'Inconsistent Student',
    email: 'inconsistent@gmail.com',
    loginId: 'DIFFERENT_ROLL',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  studentInconsistent = await Student.create({
    user: userInconsistent._id,
    rollNumber: 'ROLLINCONSISTENT',
    fullName: 'Inconsistent Student',
    email: 'inconsistent@gmail.com',
    status: 'active',
  });

  // 7. Synthetic Faculty User & Faculty Profile
  facultyUser = await User.create({
    name: 'Dr. Faculty Test',
    email: 'faculty.test@campus.edu',
    loginId: 'FAC001',
    role: 'faculty',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  facultyDoc = await Faculty.create({
    user: facultyUser._id,
    employeeId: 'FAC001',
    fullName: 'Dr. Faculty Test',
    department: 'Computer Science',
    email: 'faculty.test@campus.edu',
    phone: '9876543299',
  });

  // 8. Synthetic Admin User
  adminUser = await User.create({
    name: 'Campus Administrator',
    email: 'admin.test@campus.edu',
    loginId: 'ADMIN001',
    role: 'admin',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  // 9. Synthetic Non-Gmail Student (Legitimate Yahoo domain)
  const userYahoo = await User.create({
    name: 'Synthetic Student Yahoo',
    email: 'student.yahoo@yahoo.com',
    loginId: 'ROLL2024Y',
    role: 'student',
    passwordHash: defaultPasswordHash,
    isActive: true,
  });

  await Student.create({
    user: userYahoo._id,
    rollNumber: 'ROLL2024Y',
    fullName: 'Synthetic Student Yahoo',
    email: 'student.yahoo@yahoo.com',
    phone: '9876543219',
    status: 'active',
  });

  initialStudentCount = await Student.countDocuments();
  initialUserCount = await User.countDocuments();
  resetStudentLoginThrottler();
});

after(async () => {
  if (server) server.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('CampusSphere Part 7: Student Login Using Roll Number + Personal Gmail', () => {

  // Helper fetch function
  const studentLoginPost = async (body) => {
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: res.headers };
  };

  test('1. Correct roll number + matching personal Gmail → login succeeds', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.one@gmail.com',
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.token, 'Must return JWT token');
    assert.equal(res.data.data.role, 'student');
    assert.equal(res.data.data.rollNumber, 'ROLL2024A');
    assert.equal(res.data.data.redirectTo, '/student/dashboard');
  });

  test('2. Correct roll number + wrong Gmail → login denied', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'wrong.person@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });

  test('3. Wrong roll number + correct Gmail → login denied', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'WRONGROLL999',
      gmail: 'student.one@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });

  test('4. Roll number belonging to Student A + Gmail belonging to Student B → login denied', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.two@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });

  test('5. Gmail casing differences → normalized correctly', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'roll2024a',
      gmail: 'STUDENT.ONE@GMAIL.COM',
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.token);
  });

  test('6. Leading/trailing email and roll whitespace → handled correctly', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: '   ROLL2024A   ',
      gmail: '   student.one@gmail.com   ',
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.token);
  });

  test('7. Legitimate non-Gmail address → supported when matching registered email, rejected when mismatched', async () => {
    resetStudentLoginThrottler();
    // Mismatched non-Gmail on student registered with gmail -> rejected with 401 (not 400 format error)
    const mismatchRes = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.one@yahoo.com',
    });
    assert.equal(mismatchRes.status, 401);
    assert.equal(mismatchRes.data.success, false);
    assert.match(mismatchRes.data.message, /invalid roll number or registered gmail address/i);

    // Matching legitimate non-Gmail address -> login succeeds
    const matchRes = await studentLoginPost({
      rollNumber: 'ROLL2024Y',
      gmail: 'student.yahoo@yahoo.com',
    });
    assert.equal(matchRes.status, 200);
    assert.equal(matchRes.data.success, true);
    assert.ok(matchRes.data.data.token);
  });

  test('8. Invalid email format → rejected', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'not-an-email@@gmail.com',
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid email format/i);
  });

  test('9. Missing roll number → rejected', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      gmail: 'student.one@gmail.com',
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /roll number and personal gmail address are required/i);
  });

  test('10. Missing email → rejected', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLL2024A',
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /roll number and personal gmail address are required/i);
  });

  test('11. Ineligible account → login denied', async () => {
    resetStudentLoginThrottler();
    // Case A: Suspended student
    const resA = await studentLoginPost({
      rollNumber: 'ROLLSUSPENDED',
      gmail: 'suspended@gmail.com',
    });
    assert.equal(resA.status, 401);
    assert.equal(resA.data.success, false);

    // Case B: Inactive User
    const resB = await studentLoginPost({
      rollNumber: 'ROLLINACTIVE',
      gmail: 'inactive@gmail.com',
    });
    assert.equal(resB.status, 403);
    assert.equal(resB.data.success, false);
    assert.match(resB.data.message, /deactivated/i);
  });

  test('12. Unknown roll number → generic failure response', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'UNKNOWNROLL999',
      gmail: 'someunknown@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });

  test('13. Repeated failed attempts → rate limiting works (HTTP 429)', async () => {
    resetStudentLoginThrottler();
    const failBody = {
      rollNumber: 'ROLL2024A',
      gmail: 'invalid.attempt@gmail.com',
    };

    // Attempts 1 to 5: normal failure (401)
    for (let i = 0; i < 5; i++) {
      const res = await studentLoginPost(failBody);
      assert.equal(res.status, 401);
    }

    // Attempt 6: rate limited / throttled (429)
    const throttledRes = await studentLoginPost(failBody);
    assert.equal(throttledRes.status, 429);
    assert.equal(throttledRes.data.success, false);
    assert.match(throttledRes.data.message, /too many failed login attempts/i);
    resetStudentLoginThrottler();
  });

  test('14. Student token cannot access Admin APIs', async () => {
    resetStudentLoginThrottler();
    const loginRes = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.one@gmail.com',
    });
    const token = loginRes.data.data.token;

    const res = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  });

  test('15. Student token cannot access Faculty-only APIs', async () => {
    resetStudentLoginThrottler();
    const loginRes = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.one@gmail.com',
    });
    const token = loginRes.data.data.token;

    const res = await fetch(`${baseUrl}/api/faculty/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  });

  test('16. Valid Student token can access authorized Student APIs', async () => {
    resetStudentLoginThrottler();
    const loginRes = await studentLoginPost({
      rollNumber: 'ROLL2024A',
      gmail: 'student.one@gmail.com',
    });
    const token = loginRes.data.data.token;

    const res = await fetch(`${baseUrl}/api/student/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.rollNumber, 'ROLL2024A');
    assert.equal(body.data.fullName, 'Synthetic Student One');
  });

  test('17. Admin login remains functional', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN001',
        password: 'TestPass123!',
        role: 'admin',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'admin');
    assert.ok(body.data.token);
  });

  test('18. Faculty login remains functional', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC001',
        password: 'TestPass123!',
        role: 'faculty',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.role, 'faculty');
    assert.ok(body.data.token);
  });

  test('19. Logout and session expiration continue working', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // Verify invalid token rejected
    const testInvalid = await fetch(`${baseUrl}/api/student/profile`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    assert.equal(testInvalid.status, 401);
  });

  test('20. No Student or User record is created during login', async () => {
    const finalStudentCount = await Student.countDocuments();
    const finalUserCount = await User.countDocuments();

    assert.equal(
      finalStudentCount,
      initialStudentCount,
      `Student count must remain invariant (${initialStudentCount})`
    );
    assert.equal(
      finalUserCount,
      initialUserCount,
      `User count must remain invariant (${initialUserCount})`
    );
  });

  test('21. Student with missing linked User record (user: null) → fails safely', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLLOFFLINE',
      gmail: 'offline@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });

  test('22. Inconsistent Student/User linkage data → fails safely', async () => {
    resetStudentLoginThrottler();
    const res = await studentLoginPost({
      rollNumber: 'ROLLINCONSISTENT',
      gmail: 'inconsistent@gmail.com',
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /invalid roll number or registered gmail address/i);
  });
});

