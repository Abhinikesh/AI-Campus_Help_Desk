/**
 * server/tests/faculty_student_360.test.js
 * Comprehensive Test Suite for Faculty Student Search & Student 360 Profile.
 * Uses an isolated test database (campus-erp-test-isolated) on port 27018.
 * Verifies search accuracy, fail-closed authorization, 4-section field limits, HTTP routes, and audit logging.
 */
'use strict';

process.env.FACULTY_STUDENT_ACCESS_POLICY = 'teaching_scope';
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const AuditLog = require('../models/AuditLog');
const { verifyTestDatabaseIsolation } = require('./helpers/testDatabase');
const { JWT_SECRET } = require('../config/env');
const facultyScopeService = require('../services/facultyScope.service');
const facultyRoutes = require('../routes/faculty.routes');

const ISOLATED_TEST_DB = 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';

test('Faculty Student Search & Student 360 Verification Suite', async (t) => {
  let facultyUserA, facultyDocA; // Teaches CSE Sem 5
  let facultyUserB, facultyDocB; // Teaches MECH Sem 8
  let facultyUserNoScope;       // Teaches nothing
  let studentUser1, studentUserMech;
  let studentCse1, studentCse2, studentMech;
  let subjectCse1, subjectCse2, subjectMech;
  let slotCse1;

  let server, baseUrl;
  let tokenFacultyA, tokenFacultyB, tokenFacultyNoScope, tokenStudent;

  await t.test('Setup: Connect to isolated test database and seed fixtures', async () => {
    verifyTestDatabaseIsolation(ISOLATED_TEST_DB);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(ISOLATED_TEST_DB);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    // Clean test collections
    await User.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await Subject.deleteMany({});
    await Timetable.deleteMany({});
    await Mark.deleteMany({});
    await Exam.deleteMany({});
    await AuditLog.deleteMany({});

    // 1. Create Faculty A (Teaches CSE Sem 5)
    facultyUserA = await User.create({
      name: 'Dr. Priya Mehta',
      email: 'priya.mehta@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
      loginId: 'FAC001',
    });
    facultyDocA = await Faculty.create({
      user: facultyUserA._id,
      employeeId: 'EMP001',
      department: 'CSE',
    });

    // 2. Create Faculty B (Teaches MECH Sem 8)
    facultyUserB = await User.create({
      name: 'Dr. Rajesh Sharma',
      email: 'rajesh.sharma@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
      loginId: 'FAC002',
    });
    facultyDocB = await Faculty.create({
      user: facultyUserB._id,
      employeeId: 'EMP002',
      department: 'MECH',
    });

    // 3. Create Faculty with No Scope
    facultyUserNoScope = await User.create({
      name: 'Prof. Aman Prasad',
      email: 'aman.prasad@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
      loginId: 'FAC003',
    });

    // 4. Create Subjects
    subjectCse1 = await Subject.create({
      code: 'CS501',
      name: 'Design Analysis of Algorithms',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: facultyUserA._id,
    });
    subjectCse2 = await Subject.create({
      code: 'CS502',
      name: 'Formal Languages & Automata',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: facultyUserA._id,
    });
    subjectMech = await Subject.create({
      code: 'ME801',
      name: 'Robotics & Automation',
      credits: 3,
      branch: 'MECH',
      semester: 8,
      faculty: facultyUserB._id,
    });

    // 5. Create Students
    studentUser1 = await User.create({
      name: 'Arjun Sharma',
      email: 'arjun@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20240001',
    });
    studentCse1 = await Student.create({
      user: studentUser1._id,
      rollNumber: '20240001',
      fullName: 'Arjun Sharma',
      phone: '9876543210',
      branch: 'CSE',
      program: 'B.Tech',
      semester: 5,
      section: 'A',
      status: 'active',
    });

    const studentUser2 = await User.create({
      name: 'Sneha Patel',
      email: 'sneha@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20240004',
    });
    studentCse2 = await Student.create({
      user: studentUser2._id,
      rollNumber: '20240004',
      fullName: 'Sneha Patel',
      phone: '9876543211',
      branch: 'CSE',
      program: 'B.Tech',
      semester: 5,
      section: 'A',
      status: 'active',
    });

    studentUserMech = await User.create({
      name: 'Vikas Kumar',
      email: 'vikas@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: 'MECH0001',
    });
    studentMech = await Student.create({
      user: studentUserMech._id,
      rollNumber: 'MECH0001',
      fullName: 'Vikas Kumar',
      phone: '9876543212',
      branch: 'MECH',
      program: 'B.Tech',
      semester: 8,
      section: 'A',
      status: 'active',
    });

    // 6. Create Timetable Slot for CSE Sem 5 Sec A
    slotCse1 = await Timetable.create({
      subject: subjectCse1._id,
      faculty: facultyUserA._id,
      academicYear: '2026-2027',
      department: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      dayOfWeek: 1,
      dayName: 'Monday',
      period: 1,
      startTime: '08:10 AM',
      endTime: '09:00 AM',
      room: 'AS17',
      status: 'published',
    });

    // 7. Generate JWT Auth Tokens
    tokenFacultyA = jwt.sign(
      { userId: facultyUserA._id, role: 'faculty', email: facultyUserA.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenFacultyB = jwt.sign(
      { userId: facultyUserB._id, role: 'faculty', email: facultyUserB.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenFacultyNoScope = jwt.sign(
      { userId: facultyUserNoScope._id, role: 'faculty', email: facultyUserNoScope.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    tokenStudent = jwt.sign(
      { userId: studentUser1._id, role: 'student', email: studentUser1.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 8. Start Ephemeral Express Server
    const app = express();
    app.use(express.json());
    app.use('/api/faculty', facultyRoutes);
    // Generic error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  // ── TEST SUITE 1: Teaching Scope Derivation ──────────────────────
  await t.test('Scope: Faculty A has scope for CSE Sem 5; Faculty B has MECH Sem 8; Faculty NoScope fails closed', async () => {
    const scopeA = await facultyScopeService.getFacultyTeachingScope(facultyUserA._id);
    assert.equal(scopeA.hasScope, true);
    assert.deepEqual(scopeA.branches, ['CSE']);
    assert.deepEqual(scopeA.semesters, [5]);
    assert.equal(facultyScopeService.isStudentInScope(studentCse1, scopeA), true);
    assert.equal(facultyScopeService.isStudentInScope(studentCse2, scopeA), true);
    assert.equal(facultyScopeService.isStudentInScope(studentMech, scopeA), false, 'MECH student must be outside Faculty A scope');

    const scopeB = await facultyScopeService.getFacultyTeachingScope(facultyUserB._id);
    assert.equal(scopeB.hasScope, true);
    assert.equal(facultyScopeService.isStudentInScope(studentMech, scopeB), true);
    assert.equal(facultyScopeService.isStudentInScope(studentCse1, scopeB), false, 'CSE student must be outside Faculty B scope');

    const scopeEmpty = await facultyScopeService.getFacultyTeachingScope(facultyUserNoScope._id);
    assert.equal(scopeEmpty.hasScope, false, 'Faculty with no assignments must have hasScope = false');
    assert.equal(scopeEmpty.studentQuery, null);
    assert.equal(facultyScopeService.isStudentInScope(studentCse1, scopeEmpty), false);
  });

  // ── TEST SUITE 2: HTTP Search API Authorization & Functionality ──
  await t.test('HTTP Search: Unauthenticated request is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search`);
    assert.equal(res.status, 401);
  });

  await t.test('HTTP Search: Student role is rejected with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search`, {
      headers: { Authorization: `Bearer ${tokenStudent}` },
    });
    assert.equal(res.status, 403);
  });

  await t.test('HTTP Search: Faculty A retrieves authorized CSE students only', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    const rolls = body.data.map((s) => s.rollNumber).sort();
    assert.deepEqual(rolls, ['20240001', '20240004']);
    // MECH student MECH0001 must not be present
    assert.ok(!rolls.includes('MECH0001'), 'MECH student must not leak into Faculty A search');
  });

  await t.test('HTTP Search: Query by exact roll number ranks exact match first', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=20240001`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].rollNumber, '20240001');
    assert.equal(body.data[0].fullName, 'Arjun Sharma');
  });

  await t.test('HTTP Search: Query by case-insensitive name returns matches', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=sneha`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].fullName, 'Sneha Patel');
  });

  await t.test('HTTP Search: Out-of-scope name search yields zero results', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=Vikas`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 0);
  });

  await t.test('HTTP Search: Unassigned faculty search returns empty array (fail-closed)', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search`, {
      headers: { Authorization: `Bearer ${tokenFacultyNoScope}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data, []);
    assert.equal(body.pagination.total, 0);
  });

  // ── TEST SUITE 3: HTTP Student 360 Profile API & Scope Security ──
  await t.test('HTTP Student 360: Faculty A can access authorized student (Arjun Sharma)', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentCse1._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.basicProfile);
    assert.ok(body.data.academicDetails);
    assert.ok(body.data.marksAndResults);
    assert.ok(body.data.timetable);

    // Verify Section 1: Basic Profile has STRICTLY 3 fields
    const bp = body.data.basicProfile;
    assert.deepEqual(Object.keys(bp).sort(), ['class', 'phoneNumber', 'rollNumber']);
    assert.equal(bp.rollNumber, '20240001');
    assert.equal(bp.phoneNumber, '9876543210');
    assert.match(bp.class, /5/);

    // Verify Section 2: Academic Details
    assert.equal(body.data.academicDetails.enrolledSubjects.length, 2);
    assert.equal(body.data.academicDetails.enrolledSubjects[0].assignedFaculty, 'Dr. Priya Mehta');

    // Verify Section 3: Marks & Results is unreleased (no fabrication)
    assert.equal(body.data.marksAndResults.status, 'unreleased');
    assert.equal(body.data.marksAndResults.message, 'Marks have not been published for this examination.');
    assert.equal(body.data.marksAndResults.sgpa, null);
    assert.equal(body.data.marksAndResults.cgpa, null);

    // Verify Section 4: Timetable
    assert.equal(body.data.timetable.status, 'published');
    assert.equal(body.data.timetable.slots.length, 1);
    assert.equal(body.data.timetable.slots[0].room, 'AS17');
  });

  await t.test('HTTP Student 360: Direct URL access to out-of-scope student is rejected with 403', async () => {
    // Faculty A (CSE) attempts to view Vikas Kumar (MECH)
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentMech._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 403, 'Direct access to out-of-scope student must return 403 Forbidden');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /not authorized/i);
  });

  await t.test('HTTP Student 360: Unassigned faculty profile access is rejected with 403 (fail-closed)', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentCse1._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyNoScope}` },
    });
    assert.equal(res.status, 403);
  });

  await t.test('HTTP Student 360: Invalid ObjectId format returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/not-a-valid-id/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 400);
  });

  await t.test('HTTP Student 360: Non-existent student ID returns 404 Not Found', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await fetch(`${baseUrl}/api/faculty/students/${nonExistentId}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 404);
  });

  // ── TEST SUITE 4: Audit Logging ─────────────────────────────────
  await t.test('AuditLog: Profile view event was recorded in database', async () => {
    const log = await AuditLog.findOne({
      actor: facultyUserA._id,
      entityId: studentCse1._id,
      action: 'STUDENT_360_VIEW',
    }).lean();

    assert.ok(log, 'Audit log entry must exist for Student 360 view');
    assert.equal(log.action, 'STUDENT_360_VIEW');
    assert.equal(log.entityType, 'Student');
    assert.match(log.summary, /Faculty viewed.*Student 360 profile/i);
    assert.doesNotMatch(log.summary, /20240001/, 'Audit summary must not contain student roll number');
  });

  // Teardown
  await t.test('Teardown: Close server and disconnect test database', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });
});
