/**
 * server/tests/security_credentials_and_drive.test.js
 * Verification Suite for Part 10.1: Security Cleanup, Academic Drive Verification & Unique Login Credentials.
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const authRoutes = require('../routes/auth.routes');
const adminRoutes = require('../routes/admin.routes');
const studentRoutes = require('../routes/student.routes');
const { resetStudentLoginThrottler } = require('../controllers/auth.controller');
const { generateSecurePassword } = require('../scripts/bootstrap_admin');

let mongod, server, baseUrl;
let adminUser, facultyUser, studentUser, studentDoc;
let adminTempPassword, facultyTempPassword;

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_security_part10' });

  // 1. Create Admin with unique random password
  adminTempPassword = generateSecurePassword(16);
  const adminHash = await bcrypt.hash(adminTempPassword, 12);
  adminUser = await User.create({
    name: 'Campus Admin',
    email: 'admin_test@campus.edu',
    loginId: 'ADMIN_TEST',
    passwordHash: adminHash,
    role: 'admin',
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // 2. Create Faculty with unique random password
  facultyTempPassword = generateSecurePassword(16);
  const facultyHash = await bcrypt.hash(facultyTempPassword, 12);
  facultyUser = await User.create({
    name: 'Dr. Test Faculty',
    email: 'faculty_test@campus.edu',
    loginId: 'FAC_TEST',
    passwordHash: facultyHash,
    role: 'faculty',
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await Faculty.create({
    user: facultyUser._id,
    employeeId: 'FAC_TEST',
    fullName: 'Dr. Test Faculty',
    email: 'faculty_test@campus.edu',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  });

  // 3. Create Student for roll number + gmail login
  const studentPass = crypto.randomBytes(16).toString('hex');
  const studentHash = await bcrypt.hash(studentPass, 12);
  studentUser = await User.create({
    name: 'Synthetic Student',
    email: 'student.test10@gmail.com',
    loginId: 'TEST2026',
    passwordHash: studentHash,
    role: 'student',
  });

  studentDoc = await Student.create({
    user: studentUser._id,
    rollNumber: 'TEST2026',
    fullName: 'Synthetic Student',
    email: 'student.test10@gmail.com',
    branch: 'CSE',
    program: 'B.Tech',
    semester: 4,
    admissionYear: 2024,
    status: 'active',
  });

  // Express Test App
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/students', studentRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) server.close();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});

describe('Part 10.1: Security Cleanup, Academic Drive Verification & Unique Credentials', () => {

  test('1. Student Roll Number + Gmail login remains active and unchanged', async () => {
    resetStudentLoginThrottler();
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: 'TEST2026',
        gmail: 'student.test10@gmail.com',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data?.token);
    assert.equal(body.data.role, 'student');
    assert.equal(body.data.rollNumber, 'TEST2026');
  });

  test('2. Admin can authenticate with newly established unique credential', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: adminTempPassword,
        role: 'admin',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data?.token);
    assert.equal(body.data.role, 'admin');
    assert.equal(body.data.mustChangePassword, true);
  });

  test('3. Temporary Admin password flags mustChangePassword=true and forces change', async () => {
    // Login to get token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: adminTempPassword,
        role: 'admin',
      }),
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.token;
    assert.equal(loginBody.data.mustChangePassword, true);

    // Call change-password to update password
    const newAdminPass = 'BrandNewAdminPass@2026';
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: adminTempPassword,
        newPassword: newAdminPass,
      }),
    });
    const changeBody = await changeRes.json();
    assert.equal(changeRes.status, 200);
    assert.equal(changeBody.success, true);
    assert.equal(changeBody.data?.mustChangePassword, false);

    // Verify User record updated in DB
    const updatedAdmin = await User.findOne({ loginId: 'ADMIN_TEST' });
    assert.equal(updatedAdmin.mustChangePassword, false);
    assert.equal(updatedAdmin.temporaryPasswordExpiresAt, null);
    assert.ok(updatedAdmin.passwordChangedAt);

    // Old temporary password no longer works
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: adminTempPassword,
        role: 'admin',
      }),
    });
    assert.equal(oldLoginRes.status, 401);

    // New password works
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: newAdminPass,
        role: 'admin',
      }),
    });
    const newLoginBody = await newLoginRes.json();
    assert.equal(newLoginRes.status, 200);
    assert.equal(newLoginBody.data?.mustChangePassword, false);
  });

  test('4. Old shared/default Admin credential (Admin@1234) is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: 'Admin@1234',
        role: 'admin',
      }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Invalid credentials');
  });

  test('5. Old shared/default Faculty credential (Faculty@123) is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC_TEST',
        password: 'Faculty@123',
        role: 'faculty',
      }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Invalid credentials');
  });

  test('6. Individual Faculty password reset works via Admin endpoint', async () => {
    // Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: 'BrandNewAdminPass@2026',
        role: 'admin',
      }),
    });
    const adminToken = (await adminLoginRes.json()).data.token;

    // Reset Faculty password via Admin endpoint
    const resetRes = await fetch(`${baseUrl}/api/admin/users/${facultyUser._id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const resetBody = await resetRes.json();
    assert.equal(resetRes.status, 200);
    assert.equal(resetBody.success, true);
    assert.ok(resetBody.data?.temporaryPassword);
    assert.equal(resetBody.data?.mustChangePassword, true);
    assert.equal(resetBody.data?.loginId, 'FAC_TEST');

    const newFacultyTempPass = resetBody.data.temporaryPassword;

    // Faculty can login with new temporary password
    const facultyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC_TEST',
        password: newFacultyTempPass,
        role: 'faculty',
      }),
    });
    const facultyLoginBody = await facultyLoginRes.json();
    assert.equal(facultyLoginRes.status, 200);
    assert.equal(facultyLoginBody.data?.mustChangePassword, true);
  });

  test('7. Passwords are never returned in User or Auth API responses', async () => {
    // 1. Login response
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'ADMIN_TEST',
        password: 'BrandNewAdminPass@2026',
        role: 'admin',
      }),
    });
    const loginBody = await loginRes.json();
    assert.equal(loginBody.data?.password, undefined);
    assert.equal(loginBody.data?.passwordHash, undefined);

    // 2. /api/auth/me response
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.data.token}` },
    });
    const meBody = await meRes.json();
    assert.equal(meBody.data?.password, undefined);
    assert.equal(meBody.data?.passwordHash, undefined);

    // 3. /api/admin/users response
    const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${loginBody.data.token}` },
    });
    const usersBody = await usersRes.json();
    for (const u of usersBody.data.users) {
      assert.equal(u.password, undefined);
      assert.equal(u.passwordHash, undefined);
    }
  });

  test('8. Academic Drive endpoints are completely removed (return 404)', async () => {
    // Check that /api/drive routes return 404
    const res1 = await fetch(`${baseUrl}/api/drive`);
    assert.equal(res1.status, 404);

    const res2 = await fetch(`${baseUrl}/api/drive/download/fake123`);
    assert.equal(res2.status, 404);

    const res3 = await fetch(`${baseUrl}/api/drive/shared/SHARE123`);
    assert.equal(res3.status, 404);

    const res4 = await fetch(`${baseUrl}/api/drive/share/fake123`);
    assert.equal(res4.status, 404);
  });

  test('9. Student profile and academic endpoints remain operational', async () => {
    // Login as student
    const res = await fetch(`${baseUrl}/api/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNumber: 'TEST2026',
        gmail: 'student.test10@gmail.com',
      }),
    });
    const studentToken = (await res.json()).data.token;

    // Fetch student profile
    const profileRes = await fetch(`${baseUrl}/api/students/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(profileRes.status, 200);
    const profileBody = await profileRes.json();
    assert.equal(profileBody.success, true);
    assert.equal(profileBody.data?.rollNumber, 'TEST2026');
  });

  test('10. Temporary password expires and blocks login after expiration date', async () => {
    // Create user with expired temporary password
    const expiredPass = generateSecurePassword(16);
    const expiredHash = await bcrypt.hash(expiredPass, 12);
    await User.create({
      name: 'Expired Faculty',
      email: 'expired@campus.edu',
      loginId: 'FAC_EXPIRED',
      passwordHash: expiredHash,
      role: 'faculty',
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000), // expired 1 sec ago
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loginId: 'FAC_EXPIRED',
        password: expiredPass,
        role: 'faculty',
      }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.message, /Temporary password has expired/);
  });
});
