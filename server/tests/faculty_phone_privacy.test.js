/**
 * server/tests/faculty_phone_privacy.test.js
 * Verification Suite for Part 6.2: Enforce Faculty Phone Number Privacy.
 *
 * Verifies:
 * 1. Admin Student list returns the full phone number.
 * 2. Admin Student details return the full phone number.
 * 3. Admin Faculty list returns the full phone number.
 * 4. Admin Faculty details return the full phone number.
 * 5. Admin can update phone numbers (both Student and Faculty).
 * 6. Faculty Student 360 does not return a phone-number field.
 * 7. Faculty student-search responses do not return a phone-number field.
 * 8. Populated User objects do not leak phone numbers to Faculty.
 * 9. Unauthorized access remains rejected (unauthenticated 401, student 403).
 * 10. Audit logs never contain actual phone-number values.
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
const Subject = require('../models/Subject');
const AuditLog = require('../models/AuditLog');

const adminRoutes = require('../routes/admin.routes');
const facultyRoutes = require('../routes/faculty.routes');

let mongod, server, baseUrl;
let tokenAdmin, tokenFaculty, tokenStudent;
let adminUser, facultyUser, studentUser;
let studentDoc, facultyDoc, subjectDoc;

const RAW_STUDENT_PHONE = '9876543210';
const RAW_FACULTY_PHONE = '9876500001';

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_faculty_phone_privacy' });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);

  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Server error',
      errors: err.errors || [],
    });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 1. Admin User
  adminUser = await User.create({
    loginId: 'ADM_PRIVACY_01',
    name: 'Administrator',
    email: 'admin.privacy@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'admin',
    status: 'active',
  });

  // 2. Faculty User & Profile
  facultyUser = await User.create({
    loginId: 'FAC_PRIVACY_01',
    name: 'Prof. Privacy Tester',
    email: 'faculty.privacy@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'faculty',
    status: 'active',
  });
  facultyDoc = await Faculty.create({
    user: facultyUser._id,
    employeeId: 'EMP_PRIV_01',
    department: 'CSE',
    designation: 'Assistant Professor',
    phone: RAW_FACULTY_PHONE,
  });

  // 3. Student User & Profile
  studentUser = await User.create({
    loginId: 'STU_PRIVACY_01',
    name: 'Rohan Sharma',
    email: 'rohan.privacy@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'student',
    status: 'active',
  });
  studentDoc = await Student.create({
    user: studentUser._id,
    rollNumber: '2026CSE999',
    fullName: 'Rohan Sharma',
    branch: 'CSE',
    semester: 4,
    section: 'A',
    phone: RAW_STUDENT_PHONE,
  });

  // 4. Subject assigned to Faculty
  subjectDoc = await Subject.create({
    code: 'CS499',
    name: 'Privacy Engineering',
    credits: 4,
    branch: 'CSE',
    semester: 4,
    faculty: facultyUser._id,
  });

  // Tokens
  const secret = JWT_SECRET || 'test_secret_privacy_jwt_123';
  tokenAdmin = jwt.sign(
    { userId: adminUser._id.toString(), role: 'admin', name: adminUser.name },
    secret,
    { expiresIn: '1h' }
  );
  tokenFaculty = jwt.sign(
    { userId: facultyUser._id.toString(), role: 'faculty', name: facultyUser.name },
    secret,
    { expiresIn: '1h' }
  );
  tokenStudent = jwt.sign(
    { userId: studentUser._id.toString(), role: 'student', name: studentUser.name },
    secret,
    { expiresIn: '1h' }
  );
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Part 6.2: Enforce Faculty Phone Number Privacy Suite', () => {

  test('1. Admin Student list returns the full phone number', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const found = body.data.find(s => s._id.toString() === studentDoc._id.toString());
    assert.ok(found, 'Student must be returned in Admin list');
    assert.equal(found.phone, RAW_STUDENT_PHONE, 'Admin Student list must return full phone number');
    assert.ok(!found.phone.includes('*') && !found.phone.includes('•'), 'Phone must not be masked for Admin');
  });

  test('2. Admin Student details return the full phone number', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${studentDoc._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.student);
    assert.equal(body.data.student.phone, RAW_STUDENT_PHONE, 'Admin Student details must return full phone number');
    assert.ok(!body.data.student.phone.includes('*') && !body.data.student.phone.includes('•'));
  });

  test('3. Admin Faculty list returns the full phone number', async () => {
    const res = await fetch(`${baseUrl}/api/admin/faculty`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const found = body.data.find(f => f._id.toString() === facultyDoc._id.toString());
    assert.ok(found, 'Faculty must be returned in Admin Faculty list');
    assert.equal(found.phone, RAW_FACULTY_PHONE, 'Admin Faculty list must return full phone number');
    assert.ok(!found.phone.includes('*') && !found.phone.includes('•'));
  });

  test('4. Admin Faculty details return the full phone number', async () => {
    const res = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.faculty);
    assert.equal(body.data.faculty.phone, RAW_FACULTY_PHONE, 'Admin Faculty details must return full phone number');
    assert.ok(!body.data.faculty.phone.includes('*') && !body.data.faculty.phone.includes('•'));
  });

  test('5. Admin can update phone numbers', async () => {
    // 5a. Update Student phone number
    const UPDATED_STUDENT_PHONE = '9123456789';
    const resStuUpdate = await fetch(`${baseUrl}/api/admin/students/${studentDoc._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ phone: UPDATED_STUDENT_PHONE }),
    });
    const bodyStuUpdate = await resStuUpdate.json();
    assert.equal(resStuUpdate.status, 200);
    assert.equal(bodyStuUpdate.success, true);

    const verifiedStudent = await Student.findById(studentDoc._id);
    assert.equal(verifiedStudent.phone, UPDATED_STUDENT_PHONE);

    // 5b. Update Faculty phone number
    const UPDATED_FACULTY_PHONE = '9876599999';
    const resFacUpdate = await fetch(`${baseUrl}/api/admin/faculty/${facultyDoc._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ phone: UPDATED_FACULTY_PHONE }),
    });
    const bodyFacUpdate = await resFacUpdate.json();
    assert.equal(resFacUpdate.status, 200);
    assert.equal(bodyFacUpdate.success, true);

    const verifiedFaculty = await Faculty.findById(facultyDoc._id);
    assert.equal(verifiedFaculty.phone, UPDATED_FACULTY_PHONE);
  });

  test('6. Faculty Student 360 does not return a phone-number field', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentDoc._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFaculty}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data);

    // Section 1: Basic Profile must have rollNumber and class, but NO phone or phoneNumber
    const basicProfile = body.data.basicProfile;
    assert.ok(basicProfile, 'Basic Profile must exist');
    assert.equal(basicProfile.rollNumber, '2026CSE999');
    assert.equal(basicProfile.phoneNumber, undefined, 'phoneNumber must be undefined');
    assert.equal(basicProfile.phone, undefined, 'phone must be undefined');
    assert.ok(!('phoneNumber' in basicProfile), 'phoneNumber key must not exist');
    assert.ok(!('phone' in basicProfile), 'phone key must not exist');

    // Ensure raw data does not expose phone in other sections
    const rawDataString = JSON.stringify(body.data);
    assert.ok(!rawDataString.includes('9123456789'), 'Student phone number must not appear anywhere in Student 360 JSON');
  });

  test('7. Faculty student-search responses do not return a phone-number field', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=Rohan`, {
      headers: { Authorization: `Bearer ${tokenFaculty}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);

    const result = body.data[0];
    assert.equal(result.rollNumber, '2026CSE999');
    assert.equal(result.phone, undefined, 'phone field must be undefined in search response');
    assert.equal(result.phoneNumber, undefined, 'phoneNumber field must be undefined in search response');
    assert.ok(!('phone' in result), 'phone key must not exist in search item');
    assert.ok(!('phoneNumber' in result), 'phoneNumber key must not exist in search item');

    const searchJson = JSON.stringify(body.data);
    assert.ok(!searchJson.includes('9123456789'), 'Student phone number must not appear in search JSON');
  });

  test('8. Populated User objects do not leak phone numbers to Faculty', async () => {
    // Check GET /api/faculty/students endpoint
    const res = await fetch(`${baseUrl}/api/faculty/students?branch=CSE&semester=4`, {
      headers: { Authorization: `Bearer ${tokenFaculty}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);

    for (const st of body.data) {
      assert.equal(st.phone, undefined, 'Student phone must not be returned');
      assert.equal(st.phoneNumber, undefined, 'Student phoneNumber must not be returned');
      if (st.user && typeof st.user === 'object') {
        assert.equal(st.user.phone, undefined, 'Populated User phone must not be exposed');
        assert.equal(st.user.phoneNumber, undefined, 'Populated User phoneNumber must not be exposed');
      }
    }
  });

  test('9. Unauthorized access remains rejected', async () => {
    // 9a. Unauthenticated request to Student 360
    const resUnauth = await fetch(`${baseUrl}/api/faculty/students/${studentDoc._id}/360`);
    assert.equal(resUnauth.status, 401);

    // 9b. Student role accessing Faculty Student 360
    const resStudentForbidden = await fetch(`${baseUrl}/api/faculty/students/${studentDoc._id}/360`, {
      headers: { Authorization: `Bearer ${tokenStudent}` },
    });
    assert.equal(resStudentForbidden.status, 403);

    // 9c. Student role accessing Admin Students API
    const resAdminForbidden = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${tokenStudent}` },
    });
    assert.equal(resAdminForbidden.status, 403);
  });

  test('10. Audit logs never contain actual phone-number values', async () => {
    const logs = await AuditLog.find().lean();
    assert.ok(logs.length >= 1, 'Audit logs must have been recorded during tests');

    for (const log of logs) {
      const summary = String(log.summary || '');
      assert.ok(
        !summary.includes('9123456789') && !summary.includes('9876543210') && !summary.includes('9876500001'),
        `Audit log summary must never leak actual phone numbers: "${summary}"`
      );
    }
  });

});
