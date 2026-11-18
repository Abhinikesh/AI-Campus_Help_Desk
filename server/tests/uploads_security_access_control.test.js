/**
 * server/tests/uploads_security_access_control.test.js
 * Verification Suite for Part 10.2: Critical Security Fix for Publicly Accessible Student Files.
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const express = require('express');
const cookieParser = require('cookie-parser');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const PlacementProfile = require('../models/PlacementProfile');
const PlacementApplication = require('../models/PlacementApplication');
const authRoutes = require('../routes/auth.routes');
const placementRoutes = require('../routes/placement.routes');
const assignmentRoutes = require('../routes/assignment.routes');
const submissionRoutes = require('../routes/submission.routes');

let mongod, server, baseUrl;
let adminUser, faculty1User, faculty2User, studentAUser, studentBUser;
let studentADoc, studentBDoc;
let adminToken, faculty1Token, faculty2Token, studentAToken, studentBToken;
let assignmentDoc, submissionDoc;

// Synthetic test files
const RESUMES_DIR = path.resolve(__dirname, '../uploads/placement/resumes');
const SUBMISSIONS_DIR = path.resolve(__dirname, '../uploads/assignments/submissions');
const SYNTH_RESUME_A = 'synth-resume-a-test.pdf';
const SYNTH_RESUME_B = 'synth-resume-b-test.pdf';
const SYNTH_SUB_A = 'synth-submission-a-test.pdf';

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_uploads_security_part10_2' });

  // Ensure directories exist
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

  // Write synthetic file contents (zero PII)
  fs.writeFileSync(path.join(RESUMES_DIR, SYNTH_RESUME_A), 'SYNTHETIC TEST RESUME FOR STUDENT A');
  fs.writeFileSync(path.join(RESUMES_DIR, SYNTH_RESUME_B), 'SYNTHETIC TEST RESUME FOR STUDENT B');
  fs.writeFileSync(path.join(SUBMISSIONS_DIR, SYNTH_SUB_A), 'SYNTHETIC TEST SUBMISSION FOR STUDENT A');

  const pwHash = await bcrypt.hash('TestPass@123', 10);

  // Users
  adminUser = await User.create({
    name: 'Admin Synth',
    email: 'admin_synth@campus.edu',
    loginId: 'ADMIN_SYNTH',
    passwordHash: pwHash,
    role: 'admin',
  });

  faculty1User = await User.create({
    name: 'Prof. Assigned',
    email: 'fac_assigned@campus.edu',
    loginId: 'FAC_ASSIGNED',
    passwordHash: pwHash,
    role: 'faculty',
  });

  faculty2User = await User.create({
    name: 'Prof. Unassigned',
    email: 'fac_unassigned@campus.edu',
    loginId: 'FAC_UNASSIGNED',
    passwordHash: pwHash,
    role: 'faculty',
  });

  studentAUser = await User.create({
    name: 'Student A Synth',
    email: 'student_a@gmail.com',
    loginId: 'STUDENT_A',
    passwordHash: pwHash,
    role: 'student',
  });

  studentBUser = await User.create({
    name: 'Student B Synth',
    email: 'student_b@gmail.com',
    loginId: 'STUDENT_B',
    passwordHash: pwHash,
    role: 'student',
  });

  studentADoc = await Student.create({
    user: studentAUser._id,
    rollNumber: 'ROLL_A',
    fullName: 'Student A Synth',
    email: 'student_a@gmail.com',
    branch: 'CSE',
    program: 'B.Tech',
    semester: 4,
    admissionYear: 2024,
    status: 'active',
  });

  studentBDoc = await Student.create({
    user: studentBUser._id,
    rollNumber: 'ROLL_B',
    fullName: 'Student B Synth',
    email: 'student_b@gmail.com',
    branch: 'CSE',
    program: 'B.Tech',
    semester: 4,
    admissionYear: 2024,
    status: 'active',
  });

  // Placement profile for Student A
  await PlacementProfile.create({
    student: studentADoc._id,
    user: studentAUser._id,
    resumeUrl: SYNTH_RESUME_A,
    skills: ['JavaScript'],
  });

  // Placement profile for Student B
  await PlacementProfile.create({
    student: studentBDoc._id,
    user: studentBUser._id,
    resumeUrl: SYNTH_RESUME_B,
    skills: ['Python'],
  });

  const subjectDoc = await Subject.create({
    code: 'CS401',
    name: 'Cybersecurity',
    department: 'CSE',
    semester: 4,
    credits: 3,
  });

  // Assignment created by Faculty 1
  assignmentDoc = await Assignment.create({
    title: 'Synthetic Security Assignment',
    description: 'Testing upload security',
    subject: subjectDoc._id,
    department: 'CSE',
    semester: 4,
    faculty: faculty1User._id,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxMarks: 100,
  });

  // Submission by Student A
  submissionDoc = await Submission.create({
    assignment: assignmentDoc._id,
    student: studentADoc._id,
    studentUser: studentAUser._id,
    submissionFiles: [
      {
        name: 'synth-submission-a.pdf',
        filename: SYNTH_SUB_A,
        path: path.join(SUBMISSIONS_DIR, SYNTH_SUB_A),
        size: 35,
        mimeType: 'application/pdf',
      },
    ],
    status: 'submitted',
  });

  // Express App mirroring server/server.js
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Direct Protected Uploads Guard (matches updated server.js)
  app.use('/uploads', (req, res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    return res.status(404).json({
      success: false,
      message: 'Direct access to uploads is disabled. Please use authorized API endpoints.',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/placement', placementRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/submissions', submissionRoutes);

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

  // Helper to get token via login
  const getToken = async (loginId, role) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password: 'TestPass@123', role }),
    });
    const body = await res.json();
    return body.data.token;
  };

  adminToken = await getToken('ADMIN_SYNTH', 'admin');
  faculty1Token = await getToken('FAC_ASSIGNED', 'faculty');
  faculty2Token = await getToken('FAC_UNASSIGNED', 'faculty');
  studentAToken = await getToken('STUDENT_A', 'student');
  studentBToken = await getToken('STUDENT_B', 'student');
});

after(async () => {
  // Clean up synthetic files
  try {
    fs.unlinkSync(path.join(RESUMES_DIR, SYNTH_RESUME_A));
    fs.unlinkSync(path.join(RESUMES_DIR, SYNTH_RESUME_B));
    fs.unlinkSync(path.join(SUBMISSIONS_DIR, SYNTH_SUB_A));
  } catch (_) {}

  if (server) server.close();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});

describe('Part 10.2: Critical Security Fix for Publicly Accessible Student Files', () => {

  test('1. Direct unauthenticated request to /uploads/... is blocked (returns 404)', async () => {
    const res = await fetch(`${baseUrl}/uploads/placement/resumes/${SYNTH_RESUME_A}`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Direct access to uploads is disabled/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('2. Unauthenticated request to /api/placement/resumes/:filename is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/api/placement/resumes/${SYNTH_RESUME_A}`);
    assert.equal(res.status, 401);
  });

  test('3. Student A can download Student A own private resume via authorized API', async () => {
    const res = await fetch(`${baseUrl}/api/placement/resumes/${SYNTH_RESUME_A}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, 'SYNTHETIC TEST RESUME FOR STUDENT A');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  });

  test('4. Student B CANNOT download Student A private resume (Anti-IDOR returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/placement/resumes/${SYNTH_RESUME_A}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Access denied: You can only download your own resume/);
  });

  test('5. Direct unauthenticated request to /uploads/assignments/... is blocked (404)', async () => {
    const res = await fetch(`${baseUrl}/uploads/assignments/submissions/${SYNTH_SUB_A}`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Direct access to uploads is disabled/);
  });

  test('6. Student A can download Student A own assignment submission via authorized API', async () => {
    const fileId = submissionDoc.submissionFiles[0]._id;
    const res = await fetch(`${baseUrl}/api/submissions/${submissionDoc._id}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, 'SYNTHETIC TEST SUBMISSION FOR STUDENT A');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  });

  test('7. Student B CANNOT download Student A assignment submission (Anti-IDOR returns 403)', async () => {
    const fileId = submissionDoc.submissionFiles[0]._id;
    const res = await fetch(`${baseUrl}/api/submissions/${submissionDoc._id}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Access denied: You are not authorized to download this submission/);
  });

  test('8. Assigned Faculty can access Student A submission for grading (returns 200)', async () => {
    const fileId = submissionDoc.submissionFiles[0]._id;
    const res = await fetch(`${baseUrl}/api/submissions/${submissionDoc._id}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, 'SYNTHETIC TEST SUBMISSION FOR STUDENT A');
  });

  test('9. Unassigned Faculty CANNOT access Student A submission (returns 403)', async () => {
    const fileId = submissionDoc.submissionFiles[0]._id;
    const res = await fetch(`${baseUrl}/api/submissions/${submissionDoc._id}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${faculty2Token}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Access denied/);
  });

  test('10. Admin can access files per institutional oversight policy', async () => {
    // Admin downloading Student A resume
    const res1 = await fetch(`${baseUrl}/api/placement/resumes/${SYNTH_RESUME_A}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res1.status, 200);

    // Admin downloading Student A submission
    const fileId = submissionDoc.submissionFiles[0]._id;
    const res2 = await fetch(`${baseUrl}/api/submissions/${submissionDoc._id}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res2.status, 200);
  });

  test('11. Path traversal attempts are rejected safely (returns 400 or 403)', async () => {
    // Attempt directory traversal via filename
    const res = await fetch(`${baseUrl}/api/placement/resumes/..%2f..%2fpackage.json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.ok(res.status === 400 || res.status === 403 || res.status === 404);
  });

  test('12. Direct path traversal through /uploads/../... is blocked by Express guard', async () => {
    const res = await fetch(`${baseUrl}/uploads/..%2fpackage.json`);
    assert.ok(res.status === 404 || res.status === 403);
  });

  test('13. Non-existent file request returns safe 404 error without leaking filesystem paths', async () => {
    const res = await fetch(`${baseUrl}/api/placement/resumes/non-existent-resume.pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(!body.message.includes('/Users/'));
    assert.ok(!body.message.includes('C:\\'));
  });
});
