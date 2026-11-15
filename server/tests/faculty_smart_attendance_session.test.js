/**
 * server/tests/faculty_smart_attendance_session.test.js
 * Verification Suite for Faculty Smart Attendance:
 * - Assigned Subject Loading and Dropdown Contracts
 * - Multi-Branch / Semester Filtering
 * - Timetable Resolution (including legacy entries without status field)
 * - Session Creation, Validation, Authorization & Conflict Prevention
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
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');

const facultyRoutes = require('../routes/faculty.routes');
const attendanceRoutes = require('../routes/attendance.routes');

let mongod, server, baseUrl;
let tokenFaculty1, tokenFaculty2, tokenFacultyNoSubjects, tokenStudent;
let facultyUser1, facultyUser2, facultyUserNoSubjects, studentUser;
let facultyDoc1, facultyDoc2, facultyDocNoSubjects;
let subjectCS201, subjectCS202, subjectEC301, subjectCS501;
let studentDoc1, studentDoc2;

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_smart_attendance' });

  // Test Express app harness
  const app = express();
  app.use(express.json());
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/attendance', attendanceRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal Server Error',
      errors: err.errors || [],
    });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // 1. Create Faculty 1 (Dr. Priya Mehta - 3 assigned subjects)
  facultyUser1 = await User.create({
    loginId: 'FAC_PRIYA',
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta.test@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'faculty',
    status: 'active',
  });
  facultyDoc1 = await Faculty.create({
    user: facultyUser1._id,
    employeeId: 'FAC001',
    department: 'CSE',
    designation: 'Associate Professor',
    phone: '9876543210',
  });

  // 2. Create Faculty 2 (Prof. Vikram Sen - 1 assigned subject)
  facultyUser2 = await User.create({
    loginId: 'FAC_VIKRAM',
    name: 'Prof. Vikram Sen',
    email: 'vikram.sen.test@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'faculty',
    status: 'active',
  });
  facultyDoc2 = await Faculty.create({
    user: facultyUser2._id,
    employeeId: 'FAC002',
    department: 'ECE',
    designation: 'Assistant Professor',
    phone: '9876543211',
  });

  // 3. Create Faculty with NO assigned subjects
  facultyUserNoSubjects = await User.create({
    loginId: 'FAC_NEW',
    name: 'Dr. New Faculty',
    email: 'new.faculty.test@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'faculty',
    status: 'active',
  });
  facultyDocNoSubjects = await Faculty.create({
    user: facultyUserNoSubjects._id,
    employeeId: 'FAC099',
    department: 'CSE',
    designation: 'Assistant Professor',
  });

  // 4. Create Student User
  studentUser = await User.create({
    loginId: 'STU001',
    name: 'Aarav Sharma',
    email: 'aarav.test@campus.edu',
    passwordHash: 'hashed_pw',
    role: 'student',
    status: 'active',
  });
  studentDoc1 = await Student.create({
    user: studentUser._id,
    rollNumber: '2026CSE001',
    fullName: 'Aarav Sharma',
    branch: 'CSE',
    semester: 4,
    section: 'A',
  });
  studentDoc2 = await Student.create({
    rollNumber: '2026CSE002',
    fullName: 'Bhavna Rao',
    branch: 'CSE',
    semester: 4,
    section: 'A',
  });

  // 5. Create Subjects assigned to Faculty 1
  subjectCS201 = await Subject.create({
    code: 'CS201',
    name: 'Data Structures & Algorithms',
    credits: 4,
    branch: 'CSE',
    semester: 4,
    faculty: facultyUser1._id,
  });

  subjectCS202 = await Subject.create({
    code: 'CS202',
    name: 'Database Management Systems',
    credits: 4,
    branch: 'CSE',
    semester: 4,
    faculty: facultyUser1._id,
  });

  subjectCS501 = await Subject.create({
    code: 'CS501',
    name: 'Design Analysis of Algorithms',
    credits: 3,
    branch: 'CSE',
    semester: 5,
    faculty: facultyUser1._id,
  });

  // 6. Create Subject assigned to Faculty 2
  subjectEC301 = await Subject.create({
    code: 'EC301',
    name: 'Digital Signal Processing',
    credits: 4,
    branch: 'ECE',
    semester: 5,
    faculty: facultyUser2._id,
  });

  // 7. Create Timetable Entries for Faculty 1:
  // - Entry 1: Standard published entry
  await Timetable.create({
    subject: subjectCS201._id,
    faculty: facultyUser1._id,
    dayOfWeek: 1,
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    room: 'Hall 301',
    semester: 4,
    section: 'A',
    department: 'CSE',
    status: 'published',
  });

  // - Entry 2: Legacy seed entry where `status` field is missing/undefined and faculty is null
  await Timetable.create({
    subject: subjectCS202._id,
    dayOfWeek: 2,
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    room: 'Hall 302',
    semester: 4,
    section: 'A',
    department: 'CSE',
  });

  // Generate JWTs
  const secret = JWT_SECRET || 'test_secret_default_jwt_123';
  tokenFaculty1 = jwt.sign(
    { userId: facultyUser1._id.toString(), role: 'faculty', name: facultyUser1.name },
    secret,
    { expiresIn: '1h' }
  );
  tokenFaculty2 = jwt.sign(
    { userId: facultyUser2._id.toString(), role: 'faculty', name: facultyUser2.name },
    secret,
    { expiresIn: '1h' }
  );
  tokenFacultyNoSubjects = jwt.sign(
    { userId: facultyUserNoSubjects._id.toString(), role: 'faculty', name: facultyUserNoSubjects.name },
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

describe('Faculty Smart Attendance: Subject Loading and Session Creation Suite', () => {

  test('1. Faculty with assigned subjects receives only their assigned subjects', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/subjects`, {
      headers: { Authorization: `Bearer ${tokenFaculty1}` },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.equal(data.data.length, 3); // CS201, CS202, CS501

    const codes = data.data.map(s => s.code);
    assert.ok(codes.includes('CS201'));
    assert.ok(codes.includes('CS202'));
    assert.ok(codes.includes('CS501'));
    // Ensure Faculty 2's subject is NOT exposed
    assert.ok(!codes.includes('EC301'));

    // Check dropdown contract fields: _id, name, code, credits, branch, semester
    const first = data.data[0];
    assert.ok(first._id, 'Subject must have database _id');
    assert.ok(first.name, 'Subject must have name');
    assert.ok(first.code, 'Subject must have code');
  });

  test('2. Faculty without assigned subjects receives an empty list with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/subjects`, {
      headers: { Authorization: `Bearer ${tokenFacultyNoSubjects}` },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.deepEqual(data.data, []);
  });

  test('3. Subjects can be filtered by branch and semester for class-specific sessions', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/subjects?branch=CSE&semester=4`, {
      headers: { Authorization: `Bearer ${tokenFaculty1}` },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.length, 2); // CS201 and CS202 (both Sem 4)
    data.data.forEach(s => {
      assert.equal(s.branch, 'CSE');
      assert.equal(s.semester, 4);
    });
  });

  test('4. Attendance-mounted alias /api/attendance/faculty/subjects returns assigned subjects identically', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/faculty/subjects`, {
      headers: { Authorization: `Bearer ${tokenFaculty1}` },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.length, 3);
  });

  test('5. Timetable retrieval includes legacy entries where status field is unpopulated', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/timetable`, {
      headers: { Authorization: `Bearer ${tokenFaculty1}` },
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    // Must find both CS201 (published) and CS202 (legacy unpopulated status)
    assert.equal(data.data.length, 2);

    const codes = data.data.map(t => t.subject?.code);
    assert.ok(codes.includes('CS201'));
    assert.ok(codes.includes('CS202'));
  });

  test('6. Session creation succeeds with valid subject and persists AttendanceSession in DB', async () => {
    const payload = {
      subjectId: subjectCS201._id.toString(),
      date: '2026-11-16',
      period: 1,
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      attendanceMethod: 'face',
      sessionType: 'regular',
    };

    const res = await fetch(`${baseUrl}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty1}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.data._id);
    assert.equal(data.data.subject._id.toString(), subjectCS201._id.toString());
    assert.equal(data.data.date, '2026-11-16');
    assert.equal(data.data.period, 1);
    assert.equal(data.data.status, 'open');

    // Verify database persistence
    const saved = await AttendanceSession.findById(data.data._id);
    assert.ok(saved);
    assert.equal(saved.faculty.toString(), facultyUser1._id.toString());
    assert.equal(saved.subject.toString(), subjectCS201._id.toString());

    // Verify student attendance records pre-populated as pending
    const attendanceRecords = await Attendance.find({ session: saved._id });
    assert.equal(attendanceRecords.length, 2); // 2 students in CSE Sem 4
    attendanceRecords.forEach(att => {
      assert.equal(att.status, 'pending');
      assert.equal(att.verificationMethod, 'face');
    });
  });

  test('7. Session creation is rejected with 400 when subjectId is missing', async () => {
    const payload = {
      date: '2026-11-16',
      period: 2,
    };

    const res = await fetch(`${baseUrl}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty1}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /subject is required/i);
  });

  test('8. Session creation is rejected with 404 when subjectId does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const payload = {
      subjectId: nonExistentId.toString(),
      date: '2026-11-16',
      period: 2,
    };

    const res = await fetch(`${baseUrl}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty1}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    assert.equal(res.status, 404);
    assert.equal(data.success, false);
    assert.match(data.message, /subject not found/i);
  });

  test('9. Session creation is rejected with 403 when faculty is unauthorized for the subject', async () => {
    // Faculty 1 tries to create session for Faculty 2's subject (EC301)
    const payload = {
      subjectId: subjectEC301._id.toString(),
      date: '2026-11-16',
      period: 3,
      branch: 'ECE',
      semester: 5,
    };

    const res = await fetch(`${baseUrl}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty1}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    assert.equal(res.status, 403);
    assert.equal(data.success, false);
    assert.match(data.message, /not authorized/i);
  });

  test('10. Duplicate active session creation on the same date and period is prevented with 409 Conflict', async () => {
    // An active session for subjectCS201 on '2026-11-16' period 1 was already created in Test 6
    const payload = {
      subjectId: subjectCS201._id.toString(),
      date: '2026-11-16',
      period: 1,
      startTime: '09:00 AM',
      endTime: '10:00 AM',
    };

    const res = await fetch(`${baseUrl}/api/faculty/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty1}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    assert.equal(res.status, 409);
    assert.equal(data.success, false);
    assert.match(data.message, /active attendance session already exists/i);
  });

  test('11. Unauthorized access (unauthenticated / non-faculty) is strictly rejected', async () => {
    // Unauthenticated
    const resNoAuth = await fetch(`${baseUrl}/api/faculty/subjects`);
    assert.equal(resNoAuth.status, 401);

    // Student trying to access faculty subjects
    const resStudent = await fetch(`${baseUrl}/api/faculty/subjects`, {
      headers: { Authorization: `Bearer ${tokenStudent}` },
    });
    assert.equal(resStudent.status, 403);
  });
});

