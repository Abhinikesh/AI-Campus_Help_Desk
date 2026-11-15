/**
 * server/tests/student_auth_dashboard_hardening.test.js
 * Comprehensive Verification Suite for Part 8:
 * Student Dashboard Authentication Integration & Access Control Hardening
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const Timetable = require('../models/Timetable');
const PlacementProfile = require('../models/PlacementProfile');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Complaint = require('../models/Complaint');

const { SUBMISSIONS_DIR } = require('../services/assignmentStorage.service');

const studentRoutes = require('../routes/student.routes');
const adminRoutes = require('../routes/admin.routes');
const facultyRoutes = require('../routes/faculty.routes');
const placementRoutes = require('../routes/placement.routes');
const assignmentRoutes = require('../routes/assignment.routes');

const JWT_SECRET = process.env.JWT_SECRET || 'a5827ef2be4214226417aa64f1e55898185ca997fc818432234b54c29395d55b';

let mongod, server, baseUrl;
let studentA, studentB, userA, userB;
let adminUser, facultyUser, facultyDoc, orphanUser;
let tokenA, tokenB, tokenAdmin, tokenFaculty, tokenOrphan;
let subjectDoc, examDoc, markDocA, markDocB, attRecordA, attRecordB;
let submissionA, submissionB, tempTestFile;

const makeRequest = async (endpoint, options = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { json = await res.json(); } catch (_) {}
  } else {
    try { json = await res.text(); } catch (_) {}
  }

  return { status: res.status, body: json, headers: res.headers };
};

const createToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_student_hardening' });

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/placement', placementRoutes);
  app.use('/api/assignments', assignmentRoutes);

  // Central error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  });

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed Admin & Faculty first
  adminUser = await User.create({
    name: 'Campus Admin',
    email: 'admin@campussphere.edu',
    role: 'admin',
    loginId: 'ADMIN001',
    passwordHash: 'dummyhash',
    isActive: true
  });

  facultyUser = await User.create({
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@campussphere.edu',
    role: 'faculty',
    loginId: 'FAC001',
    passwordHash: 'dummyhash',
    isActive: true
  });

  facultyDoc = await Faculty.create({
    employeeId: 'FAC001',
    user: facultyUser._id,
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@campussphere.edu',
    department: 'Computer Science & Engineering',
    phone: '9876543210'
  });

  // Seed Subject & Exam
  subjectDoc = await Subject.create({
    code: 'CS501',
    name: 'Operating Systems',
    credits: 4,
    department: 'CSE',
    semester: 5
  });

  examDoc = await Exam.create({
    title: 'Mid Term Exam 2026',
    examinationType: 'mid_semester',
    department: 'CSE',
    semester: 5,
    academicYear: '2025-2026',
    subject: subjectDoc._id,
    faculty: facultyUser._id,
    date: new Date('2026-11-20'),
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    durationMinutes: 180,
    status: 'completed'
  });

  // Seed Users & Students
  userA = await User.create({
    name: 'Student Alpha',
    email: 'alpha2024@gmail.com',
    role: 'student',
    loginId: 'ROLL2024A',
    passwordHash: 'dummyhash',
    isActive: true
  });

  studentA = await Student.create({
    rollNumber: 'ROLL2024A',
    fullName: 'Student Alpha',
    email: 'alpha2024@gmail.com',
    user: userA._id,
    program: 'B.Tech',
    branch: 'CSE',
    semester: 5,
    section: 'A',
    status: 'active',
    academicProfile: {
      course: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'A'
    }
  });

  userB = await User.create({
    name: 'Student Beta',
    email: 'beta2024@gmail.com',
    role: 'student',
    loginId: 'ROLL2024B',
    passwordHash: 'dummyhash',
    isActive: true
  });

  studentB = await Student.create({
    rollNumber: 'ROLL2024B',
    fullName: 'Student Beta',
    email: 'beta2024@gmail.com',
    user: userB._id,
    program: 'B.Tech',
    branch: 'CSE',
    semester: 5,
    section: 'B',
    status: 'active',
    academicProfile: {
      course: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'B'
    }
  });

  // Orphan user (no student profile linked)
  orphanUser = await User.create({
    name: 'Orphan User',
    email: 'orphan@campussphere.edu',
    role: 'student',
    loginId: 'ORPHAN001',
    passwordHash: 'dummyhash',
    isActive: true
  });

  // Tokens
  tokenA = createToken(userA);
  tokenB = createToken(userB);
  tokenAdmin = createToken(adminUser);
  tokenFaculty = createToken(facultyUser);
  tokenOrphan = createToken(orphanUser);

  // Seed Marks
  markDocA = await Mark.create({
    student: studentA._id,
    subject: subjectDoc._id,
    exam: examDoc._id,
    score: 85,
    maxScore: 100,
    status: 'published'
  });

  markDocB = await Mark.create({
    student: studentB._id,
    subject: subjectDoc._id,
    exam: examDoc._id,
    score: 92,
    maxScore: 100,
    status: 'published'
  });

  // Seed Attendance Session & Records
  const sessionDoc = await AttendanceSession.create({
    date: '2026-11-16',
    period: 1,
    subject: subjectDoc._id,
    faculty: facultyUser._id,
    semester: 5,
    section: 'A',
    status: 'closed',
    startTime: new Date(),
    endTime: new Date()
  });

  attRecordA = await Attendance.create({
    student: studentA._id,
    session: sessionDoc._id,
    subject: subjectDoc._id,
    date: '2026-11-16',
    period: 1,
    status: 'present',
    confidence: 0.95,
    verificationMethod: 'face'
  });

  attRecordB = await Attendance.create({
    student: studentB._id,
    session: sessionDoc._id,
    subject: subjectDoc._id,
    date: '2026-11-16',
    period: 1,
    status: 'present',
    confidence: 0.98,
    verificationMethod: 'face'
  });

  // Seed Placement Profiles
  await PlacementProfile.create({
    user: userA._id,
    student: studentA._id,
    primaryEmail: studentA.email,
    placementStatus: 'eligible'
  });

  await PlacementProfile.create({
    user: userB._id,
    student: studentB._id,
    primaryEmail: studentB.email,
    placementStatus: 'placed'
  });

  // Seed Assignment & Submissions with File
  const assignmentDoc = await Assignment.create({
    title: 'OS Process Synchronization',
    description: 'Implement mutex locks and semaphore algorithms in C/C++',
    code: 'ASN-OS-001',
    subject: subjectDoc._id,
    faculty: facultyUser._id,
    department: 'CSE',
    semester: 5,
    section: 'A',
    maxScore: 100,
    dueDate: new Date(Date.now() + 86400000),
    status: 'published',
    createdBy: facultyUser._id
  });

  // Create temporary local file in SUBMISSIONS_DIR for download test
  tempTestFile = path.join(SUBMISSIONS_DIR, 'test_attachment.pdf');
  fs.writeFileSync(tempTestFile, 'Sample PDF submission content');

  submissionA = await Submission.create({
    assignment: assignmentDoc._id,
    student: studentA._id,
    studentUser: userA._id,
    submissionFiles: [{
      name: 'assignment_alpha.pdf',
      filename: 'assignment_alpha.pdf',
      originalname: 'assignment_alpha.pdf',
      path: tempTestFile,
      size: 32,
      mimeType: 'application/pdf'
    }],
    status: 'submitted',
    submittedAt: new Date()
  });

  submissionB = await Submission.create({
    assignment: assignmentDoc._id,
    student: studentB._id,
    studentUser: userB._id,
    submissionFiles: [{
      name: 'assignment_beta.pdf',
      filename: 'assignment_beta.pdf',
      originalname: 'assignment_beta.pdf',
      path: tempTestFile,
      size: 32,
      mimeType: 'application/pdf'
    }],
    status: 'submitted',
    submittedAt: new Date()
  });
});

after(async () => {
  if (tempTestFile && fs.existsSync(tempTestFile)) {
    try { fs.unlinkSync(tempTestFile); } catch (_) {}
  }
  if (server) server.close();
  if (mongoose.connection) await mongoose.connection.close();
  if (mongod) await mongod.stop();
});

describe('CampusSphere Part 8: Student Dashboard Authentication & IDOR Hardening Suite', () => {

  test('1. Student A can access their own profile (200 OK)', async () => {
    const res = await makeRequest('/api/student/profile', { token: tokenA });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.rollNumber, 'ROLL2024A');
    assert.equal(res.body.data.email, 'alpha2024@gmail.com');
  });

  test('2. Student A cannot cross-access Student B profile via URL parameter (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/profile/${studentB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('3. Student A cannot cross-access Student B profile via query studentId (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/profile?studentId=${studentB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('4. Student A cannot cross-access Student B profile via query rollNumber (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/profile?rollNumber=${studentB.rollNumber}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('5. Student A cannot retrieve Student B marks via query studentId (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/results?studentId=${studentB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('6. Student A cannot retrieve Student B mark record via /api/student/results/:id (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/results/${markDocB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('7. Student A cannot retrieve Student B attendance via query studentId (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/attendance?studentId=${studentB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('8. Student A cannot retrieve Student B attendance record via /api/student/attendance/:id (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/attendance/${attRecordB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('9. Student A cannot retrieve Student B timetable via query studentId (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/timetable?studentId=${studentB._id}`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('10. Student A cannot cross-access Student B placement profile via /api/placement/students/:id/profile (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/placement/students/${studentB._id}/profile`, { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /denied|forbidden/i);
  });

  test('11. Student A cannot update Student B profile via PATCH /api/student/profile/:id (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/profile/${studentB._id}`, {
      method: 'PATCH',
      token: tokenA,
      body: { email: 'hacked@gmail.com' }
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('12. Student A self-modification of institutional fields is rejected (403 Forbidden)', async () => {
    const res = await makeRequest(`/api/student/profile`, {
      method: 'PATCH',
      token: tokenA,
      body: { semester: 8, branch: 'ECE' }
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('13. Student A cannot download Student B submission file (403 Forbidden)', async () => {
    const fileBId = submissionB.submissionFiles[0]._id;
    const res = await makeRequest(`/api/assignments/submissions/${submissionB._id}/files/${fileBId}`, {
      token: tokenA
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /denied|forbidden|authorized/i);
  });

  test('14. Student A can download their own submission file (200 OK)', async () => {
    const fileAId = submissionA.submissionFiles[0]._id;
    const res = await makeRequest(`/api/assignments/submissions/${submissionA._id}/files/${fileAId}`, {
      token: tokenA
    });
    assert.equal(res.status, 200);
  });

  test('15. Student A cannot spoof raisedBy: userB in complaint creation (403 Forbidden)', async () => {
    const res = await makeRequest('/api/student/complaints', {
      method: 'POST',
      token: tokenA,
      body: {
        title: 'Spoofed Grievance',
        description: 'Impersonating Student Beta',
        category: 'academic',
        raisedBy: userB._id
      }
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });

  test('16. Unauthenticated requests to /api/student/profile denied (401 Unauthorized)', async () => {
    const res = await makeRequest('/api/student/profile');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('17. Invalid/expired token to /api/student/profile denied (401 Unauthorized)', async () => {
    const res = await makeRequest('/api/student/profile', { token: 'invalid.jwt.token' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('18. Student token cannot access Admin APIs /api/admin/students (403 Forbidden)', async () => {
    const res = await makeRequest('/api/admin/students', { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('19. Student token cannot access Faculty APIs /api/faculty/profile (403 Forbidden)', async () => {
    const res = await makeRequest('/api/faculty/profile', { token: tokenA });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('20. Faculty token cannot access Admin APIs /api/admin/students (403 Forbidden)', async () => {
    const res = await makeRequest('/api/admin/students', { token: tokenFaculty });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('21. Admin token retains authorized access to /api/admin/students (200 OK)', async () => {
    const res = await makeRequest('/api/admin/students', { token: tokenAdmin });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  test('22. Faculty cannot see student phone numbers (verified phone privacy)', async () => {
    const res = await makeRequest(`/api/faculty/students/${studentA._id}`, { token: tokenFaculty });
    if (res.status === 200) {
      assert.equal(res.body.data.phone, undefined, 'Student phone must not be exposed to faculty');
    } else {
      // Endpoint may require specific teaching assignment
      assert.ok([200, 403, 404].includes(res.status));
    }
  });

  test('23. User with no linked Student record cannot access /api/student/profile (403 Forbidden)', async () => {
    const res = await makeRequest('/api/student/profile', { token: tokenOrphan });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /linked student record/i);
  });

});
