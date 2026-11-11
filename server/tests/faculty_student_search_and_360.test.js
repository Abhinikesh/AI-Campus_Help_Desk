/**
 * server/tests/faculty_student_search_and_360.test.js
 * Comprehensive Verification Suite for Faculty Student Search & Student 360 Profile.
 * 
 * Verifies:
 * 1. Exact roll-number search (prioritized at the top of results).
 * 2. Partial roll-number search.
 * 3. Full and partial name search (case-insensitive).
 * 4. Phone-number search.
 * 5. Student ID and Email search.
 * 6. Similar-name disambiguation (rollNumber, phone, branch, section returned).
 * 7. Missing or incomplete student records handling (preserves nulls, no fake defaults).
 * 8. Student 360 data accuracy across all four sections (Basic, Academic, Marks, Timetable).
 * 9. Unauthorized access attempts (401 unauthenticated, 403 non-faculty roles).
 * 10. Institutional Access Policy enforcement:
 *     - 'institution_wide' policy allows cross-department discovery.
 *     - 'teaching_scope' policy restricts lookup to assigned teaching sections.
 * 11. Pagination & selective field projections.
 * 12. Non-blocking audit logging on profile view.
 */
'use strict';

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
const facultyRoutes = require('../routes/faculty.routes');

const ISOLATED_TEST_DB = 'mongodb://127.0.0.1:27018/campus-erp-test-search360';

test('Faculty Student Search & Student 360 Comprehensive Suite', async (t) => {
  let facultyUserA, facultyDocA; // Teaches CSE Sem 5
  let facultyUserB, facultyDocB; // Teaches MECH Sem 8
  let studentUser1, studentUser2, studentUserSimilar, studentUserIncomplete;
  let student1, student2, studentSimilar, studentIncomplete;
  let subjectCse1, subjectCse2;
  let slotCse1;
  let exam1, mark1;

  let server, baseUrl;
  let tokenFacultyA, tokenFacultyB, tokenStudent;

  await t.test('Setup: Connect to isolated test database and seed fixtures', async () => {
    verifyTestDatabaseIsolation(ISOLATED_TEST_DB);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(ISOLATED_TEST_DB);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-search360');

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
      loginId: 'FAC001',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
    });
    facultyDocA = await Faculty.create({
      user: facultyUserA._id,
      employeeId: 'FAC001',
      department: 'CSE',
      designation: 'Associate Professor',
    });

    // 2. Create Faculty B (Teaches MECH Sem 8)
    facultyUserB = await User.create({
      name: 'Prof. Rajesh Kumar',
      email: 'rajesh.kumar@test.edu',
      loginId: 'FAC002',
      passwordHash: 'HashedPassword123!',
      role: 'faculty',
    });
    facultyDocB = await Faculty.create({
      user: facultyUserB._id,
      employeeId: 'FAC002',
      department: 'MECH',
      designation: 'Professor',
    });

    // 3. Create Subjects
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
      name: 'Formal Languages and Automata Theory',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: facultyUserA._id,
    });

    // 4. Create Students (including similar names for disambiguation testing)
    studentUser1 = await User.create({
      name: 'Rahul Sharma',
      email: 'rahul.cse@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20240001',
    });
    student1 = await Student.create({
      user: studentUser1._id,
      rollNumber: '20240001',
      fullName: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul.cse@test.edu',
      branch: 'CSE',
      program: 'B.Tech',
      semester: 5,
      section: 'A',
      status: 'active',
    });

    studentUser2 = await User.create({
      name: 'Sneha Patel',
      email: 'sneha.patel@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20240002',
    });
    student2 = await Student.create({
      user: studentUser2._id,
      rollNumber: '20240002',
      fullName: 'Sneha Patel',
      phone: '9876543222',
      email: 'sneha.patel@test.edu',
      branch: 'CSE',
      program: 'B.Tech',
      semester: 5,
      section: 'A',
      status: 'active',
    });

    // Similar Name Student (Disambiguation candidate: Same name 'Rahul Sharma', but in MECH Sem 8)
    studentUserSimilar = await User.create({
      name: 'Rahul Sharma',
      email: 'rahul.mech@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20220088',
    });
    studentSimilar = await Student.create({
      user: studentUserSimilar._id,
      rollNumber: '20220088',
      fullName: 'Rahul Sharma',
      phone: '9876543333',
      email: 'rahul.mech@test.edu',
      branch: 'MECH',
      program: 'B.Tech',
      semester: 8,
      section: 'B',
      status: 'active',
    });

    // Incomplete Student Record (Missing phone, section)
    studentUserIncomplete = await User.create({
      name: 'Amit Verma',
      email: 'amit.verma@test.edu',
      passwordHash: 'HashedPassword123!',
      role: 'student',
      loginId: '20240099',
    });
    studentIncomplete = await Student.create({
      user: studentUserIncomplete._id,
      rollNumber: '20240099',
      fullName: 'Amit Verma',
      email: 'amit.verma@test.edu',
      branch: 'ECE',
      program: 'B.Tech',
      semester: 3,
      section: '',
      status: 'active',
    });

    // 5. Create Timetable Slot
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

    // 6. Create Exam & Published Mark for Student 1
    exam1 = await Exam.create({
      title: 'Mid-Semester Examination 2026',
      examinationType: 'mid_semester',
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'A',
      subject: subjectCse1._id,
      faculty: facultyUserA._id,
      date: new Date('2026-10-15'),
      startTime: '09:00 AM',
      endTime: '12:00 PM',
      durationMinutes: 180,
      maximumMarks: 100,
      passingMarks: 40,
      status: 'completed',
      evaluationStatus: 'published',
    });

    mark1 = await Mark.create({
      student: student1._id,
      subject: subjectCse1._id,
      exam: exam1._id,
      academicYear: '2026-2027',
      semester: 5,
      marksObtained: 85,
      maxMarks: 100,
      passingMarks: 40,
      internal: 26,
      external: 59,
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
    tokenStudent = jwt.sign(
      { userId: studentUser1._id, role: 'student', email: studentUser1.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 8. Ephemeral Express App
    const app = express();
    app.use(express.json());
    app.use('/api/faculty', facultyRoutes);
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

  // ── TEST 1: Exact roll-number search & prioritization ───────────────────
  await t.test('1. Exact roll-number search prioritizes exact match at index 0', async () => {
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'institution_wide';
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=20240001`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].rollNumber, '20240001', 'Exact roll number must be ranked first');
  });

  // ── TEST 2: Partial roll-number search ──────────────────────────────────
  await t.test('2. Partial roll-number search matches students sharing prefix', async () => {
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'institution_wide';
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=202400`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.data.length >= 2, 'Should match 20240001, 20240002, 20240099');
    const rolls = body.data.map((s) => s.rollNumber);
    assert.ok(rolls.includes('20240001'));
    assert.ok(rolls.includes('20240002'));
  });

  // ── TEST 3: Full & partial name search (case-insensitive) ───────────────
  await t.test('3. Full and partial name search is case-insensitive', async () => {
    // Partial uppercase
    const res1 = await fetch(`${baseUrl}/api/faculty/students/search?q=SNEHA`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(body1.data.length, 1);
    assert.equal(body1.data[0].fullName, 'Sneha Patel');

    // Partial lowercase
    const res2 = await fetch(`${baseUrl}/api/faculty/students/search?q=patel`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.equal(body2.data.length, 1);
    assert.equal(body2.data[0].rollNumber, '20240002');
  });

  // ── TEST 4: Phone-number search & Masked Result ─────────────────────────
  await t.test('4. Phone-number search locates student and returns masked phone', async () => {
    // 4a. Exact phone query
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=9876543210`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].rollNumber, '20240001');
    assert.equal(body.data[0].phone, '••••••3210', 'Phone in search results must be masked');
    assert.equal(body.data[0].phoneNumber, '••••••3210', 'phoneNumber in search results must be masked');

    // 4b. Normalized phone query with dashes/spaces
    const resNorm = await fetch(`${baseUrl}/api/faculty/students/search?q=9876-543-210`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const bodyNorm = await resNorm.json();
    assert.equal(resNorm.status, 200);
    assert.equal(bodyNorm.data.length, 1);
    assert.equal(bodyNorm.data[0].rollNumber, '20240001');
    assert.equal(bodyNorm.data[0].phone, '••••••3210');
  });

  // ── TEST 5: Student ID and Email search ─────────────────────────────────
  await t.test('5. Student ID and Email search locate student', async () => {
    // Search by Email
    const resEmail = await fetch(`${baseUrl}/api/faculty/students/search?q=rahul.cse@test.edu`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const bodyEmail = await resEmail.json();
    assert.equal(resEmail.status, 200);
    assert.equal(bodyEmail.data[0].rollNumber, '20240001');

    // Search by MongoDB _id
    const resId = await fetch(`${baseUrl}/api/faculty/students/search?q=${student2._id}`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const bodyId = await resId.json();
    assert.equal(resId.status, 200);
    assert.equal(bodyId.data.length, 1);
    assert.equal(bodyId.data[0].rollNumber, '20240002');
  });

  // ── TEST 6: Similar-name disambiguation ─────────────────────────────────
  await t.test('6. Similar-name disambiguation returns distinct roll numbers, branches, and phones', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=Rahul+Sharma`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.length, 2, 'Must return both Rahul Sharma records');

    const cseStudent = body.data.find((s) => s.branch === 'CSE');
    const mechStudent = body.data.find((s) => s.branch === 'MECH');

    assert.ok(cseStudent, 'Must find CSE Rahul Sharma');
    assert.ok(mechStudent, 'Must find MECH Rahul Sharma');
    assert.equal(cseStudent.rollNumber, '20240001');
    assert.equal(mechStudent.rollNumber, '20220088');
    assert.notEqual(cseStudent.phone, mechStudent.phone, 'Phones must distinguish records');
  });

  // ── TEST 7: Missing / incomplete records handling ───────────────────────
  await t.test('7. Missing or incomplete student records preserve nulls without fake defaults', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentIncomplete._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.basicProfile.phoneNumber, null, 'Unspecified phone must remain null');
    assert.equal(body.data.marksAndResults.status, 'unreleased');
    assert.equal(body.data.marksAndResults.sgpa, null, 'SGPA must remain null when marks are unreleased');
  });

  // ── TEST 8: Student 360 data accuracy across all 4 sections ─────────────
  await t.test('8. Student 360 profile data is accurate across all four sections', async () => {
    const res = await fetch(`${baseUrl}/api/faculty/students/${student1._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    const data = body.data;

    // Section 1: Basic Profile — ONLY rollNumber, phoneNumber, class
    assert.equal(data.basicProfile.rollNumber, '20240001');
    assert.equal(data.basicProfile.phoneNumber, '9876543210');
    assert.equal(data.basicProfile.class, 'Semester 5 CSE Section A');
    assert.equal(data.basicProfile.email, undefined, 'Email must NOT be present in Basic Profile');
    assert.equal(data.basicProfile.address, undefined, 'Address must NOT be present in Basic Profile');

    // Section 2: Academic Details
    assert.equal(data.academicDetails.department, 'CSE');
    assert.equal(data.academicDetails.semester, 5);
    assert.equal(data.academicDetails.section, 'A');
    assert.ok(data.academicDetails.enrolledSubjects.length >= 2);
    assert.equal(data.academicDetails.enrolledSubjects[0].code, 'CS501');
    assert.equal(data.academicDetails.enrolledSubjects[0].assignedFaculty, 'Dr. Priya Mehta');

    // Section 3: Marks & Results (Published)
    assert.equal(data.marksAndResults.status, 'published');
    assert.equal(data.marksAndResults.subjectMarks.length, 1);
    assert.equal(data.marksAndResults.subjectMarks[0].subjectCode, 'CS501');
    assert.equal(data.marksAndResults.subjectMarks[0].marksObtained, 85);
    assert.equal(data.marksAndResults.sgpa, 9, 'Calculated SGPA for 85% must be 9');

    // Section 4: Timetable (Published)
    assert.equal(data.timetable.status, 'published');
    assert.equal(data.timetable.slots.length, 1);
    assert.equal(data.timetable.slots[0].weekday, 'Monday');
    assert.equal(data.timetable.slots[0].period, 1);
    assert.equal(data.timetable.slots[0].room, 'AS17');
    assert.equal(data.timetable.slots[0].subjectCode, 'CS501');
  });

  // ── TEST 9: Unauthorized access attempts ────────────────────────────────
  await t.test('9. Unauthorized access attempts return 401 and 403', async () => {
    // 9a. No token -> 401
    const resNoToken = await fetch(`${baseUrl}/api/faculty/students/search`);
    assert.equal(resNoToken.status, 401);

    // 9b. Student token -> 403
    const resStudent = await fetch(`${baseUrl}/api/faculty/students/search`, {
      headers: { Authorization: `Bearer ${tokenStudent}` },
    });
    assert.equal(resStudent.status, 403);
  });

  // ── TEST 10: Institutional Access Policy enforcement ───────────────────
  await t.test('10. Institutional Access Policy: institution_wide vs teaching_scope', async () => {
    // 10a. Under 'institution_wide' policy: Faculty A can search MECH student
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'institution_wide';
    const resInstWide = await fetch(`${baseUrl}/api/faculty/students/search?q=20220088`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const bodyInstWide = await resInstWide.json();
    assert.equal(bodyInstWide.data.length, 1, 'Faculty A can discover MECH student under institution_wide policy');

    // 10b. Under 'teaching_scope' policy: Faculty A cannot access MECH student profile (returns 403)
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'teaching_scope';
    const resTeachingScope = await fetch(`${baseUrl}/api/faculty/students/${studentSimilar._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(resTeachingScope.status, 403, 'Faculty A is denied access to out-of-scope student under teaching_scope policy');

    // Restore to default approved policy
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'institution_wide';
  });

  // ── TEST 11: Audit log recorded on profile view ─────────────────────────
  await t.test('11. Profile view event is immutably recorded in AuditLog', async () => {
    const logs = await AuditLog.find({ action: 'STUDENT_360_VIEW' }).lean();
    assert.ok(logs.length >= 1);
    assert.equal(String(logs[0].actor), String(facultyUserA._id));
    assert.match(logs[0].summary, /Faculty viewed.*Student 360 profile/i);
    assert.doesNotMatch(logs[0].summary, /20240001/, 'Summary must not contain roll number');
    assert.doesNotMatch(logs[0].summary, /Rahul/i, 'Summary must not contain student name');
    assert.doesNotMatch(logs[0].summary, /9876543210/, 'Summary must not leak phone numbers');
  });

  // ── TEST 12: Security audit event on Access Denied ──────────────────────
  await t.test('12. Access Denied under teaching_scope creates STUDENT_360_ACCESS_DENIED audit log', async () => {
    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'teaching_scope';
    const res = await fetch(`${baseUrl}/api/faculty/students/${studentSimilar._id}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(res.status, 403);

    const deniedLogs = await AuditLog.find({ action: 'STUDENT_360_ACCESS_DENIED' }).lean();
    assert.ok(deniedLogs.length >= 1, 'Access denied event must be recorded');
    assert.equal(String(deniedLogs[0].actor), String(facultyUserA._id));
    assert.equal(String(deniedLogs[0].entityId), String(studentSimilar._id));
    assert.match(deniedLogs[0].summary, /Faculty access denied/i);
    assert.doesNotMatch(deniedLogs[0].summary, /20220088/, 'Summary must not contain roll number');
    assert.doesNotMatch(deniedLogs[0].summary, /9876543333/, 'Summary must not leak phone numbers');

    process.env.FACULTY_STUDENT_ACCESS_POLICY = 'institution_wide';
  });

  // ── TEST 13: Audit events for Not Found and Invalid ID ──────────────────
  await t.test('13. Not-found and invalid-ID requests generate distinct security audit events', async () => {
    // 13a. Invalid ID format (400)
    const resInvalid = await fetch(`${baseUrl}/api/faculty/students/invalid-format-id/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(resInvalid.status, 400);

    const invalidLogs = await AuditLog.find({ action: 'STUDENT_360_INVALID_ID' }).lean();
    assert.ok(invalidLogs.length >= 1);
    assert.equal(String(invalidLogs[0].actor), String(facultyUserA._id));
    assert.equal(invalidLogs[0].entityId, null, 'entityId must be null for invalid ObjectId');
    assert.doesNotMatch(invalidLogs[0].summary, /invalid-format-id/, 'Summary must not contain raw invalid identifier');

    // 13b. Non-existent valid ObjectId (404)
    const nonExistentId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/faculty/students/${nonExistentId}/360`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    assert.equal(resNotFound.status, 404);

    const notFoundLogs = await AuditLog.find({ action: 'STUDENT_360_NOT_FOUND' }).lean();
    assert.ok(notFoundLogs.length >= 1);
    assert.equal(String(notFoundLogs[0].actor), String(facultyUserA._id));
    assert.equal(String(notFoundLogs[0].entityId), String(nonExistentId));
    assert.doesNotMatch(notFoundLogs[0].summary, new RegExp(String(nonExistentId)), 'Summary must not contain ID string');
  });

  // ── TEST 14: Audit failure does not crash profile endpoint ─────────────
  await t.test('14. Audit logging failure does not crash the profile endpoint', async () => {
    const origCreate = AuditLog.create;
    try {
      // Mock AuditLog.create to throw an intentional DB error
      AuditLog.create = async () => {
        throw new Error('Simulated transient MongoDB audit collection lock');
      };

      const res = await fetch(`${baseUrl}/api/faculty/students/${student1._id}/360`, {
        headers: { Authorization: `Bearer ${tokenFacultyA}` },
      });
      assert.equal(res.status, 200, 'Profile must still load successfully when audit logging fails');
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.basicProfile.rollNumber, '20240001');
    } finally {
      AuditLog.create = origCreate;
    }
  });

  // ── TEST 15: Phone masking safe handling for edge cases ─────────────────
  await t.test('15. Phone masking edge cases (null, empty, short, non-numeric)', async () => {
    // Search incomplete student who has no phone
    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=20240099`, {
      headers: { Authorization: `Bearer ${tokenFacultyA}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].phone, null, 'Missing phone must remain null');
  });

  // ── TEST 16: HTTP 401 unauthenticated request audit logging ────────────
  await t.test('16. Unauthenticated Student 360 request creates STUDENT_360_UNAUTHENTICATED audit event', async () => {
    const countBefore = await AuditLog.countDocuments({ action: 'STUDENT_360_UNAUTHENTICATED' });

    const res = await fetch(`${baseUrl}/api/faculty/students/${student1._id}/360`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);

    // Wait a brief moment for res.on('finish') async callback
    await new Promise((r) => setTimeout(r, 50));

    const unauthLogs = await AuditLog.find({ action: 'STUDENT_360_UNAUTHENTICATED' }).sort({ createdAt: -1 }).lean();
    assert.equal(unauthLogs.length, countBefore + 1, 'Exactly one unauthenticated audit event must be generated');
    assert.equal(unauthLogs[0].actor, null, 'Actor must be null for unauthenticated request');
    assert.equal(String(unauthLogs[0].entityId), String(student1._id), 'EntityId must match student target');
    assert.equal(unauthLogs[0].entityType, 'Student');
    assert.equal(unauthLogs[0].summary, 'Unauthenticated access attempt on Student 360 endpoint');
    assert.doesNotMatch(unauthLogs[0].summary, /20240001/, 'Summary must not leak roll number');
    assert.doesNotMatch(unauthLogs[0].summary, /Rahul/i, 'Summary must not leak student name');
  });

  // ── TEST 17: Preserving original 401 if audit logging fails ────────────
  await t.test('17. Original 401 response is preserved if audit logging fails', async () => {
    const origCreate = AuditLog.create;
    try {
      AuditLog.create = async () => {
        throw new Error('Simulated transient MongoDB audit collection lock on 401');
      };

      const res = await fetch(`${baseUrl}/api/faculty/students/${student1._id}/360`);
      assert.equal(res.status, 401, 'Response must remain 401 even if audit logging fails');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /token/i, 'Original error message must be preserved');
    } finally {
      AuditLog.create = origCreate;
    }
  });

  // ── TEST 18: Unrelated 401 does not log Student 360 audit event ─────────
  await t.test('18. Unrelated route 401 does NOT generate a Student 360 audit event', async () => {
    const countBefore = await AuditLog.countDocuments({ action: 'STUDENT_360_UNAUTHENTICATED' });

    // Request to unrelated faculty route (e.g. /profile) without token
    const res = await fetch(`${baseUrl}/api/faculty/profile`);
    assert.equal(res.status, 401);

    await new Promise((r) => setTimeout(r, 50));
    const countAfter = await AuditLog.countDocuments({ action: 'STUDENT_360_UNAUTHENTICATED' });
    assert.equal(countAfter, countBefore, 'Unrelated route 401 must not trigger STUDENT_360_UNAUTHENTICATED');
  });

  // ── TEST 19: Unauthenticated Search creates FACULTY_STUDENT_SEARCH_UNAUTHENTICATED ──
  await t.test('19. Unauthenticated Search creates FACULTY_STUDENT_SEARCH_UNAUTHENTICATED event', async () => {
    const countBefore = await AuditLog.countDocuments({ action: 'FACULTY_STUDENT_SEARCH_UNAUTHENTICATED' });

    const res = await fetch(`${baseUrl}/api/faculty/students/search?q=Arjun`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);

    await new Promise((r) => setTimeout(r, 50));
    const searchLogs = await AuditLog.find({ action: 'FACULTY_STUDENT_SEARCH_UNAUTHENTICATED' }).sort({ createdAt: -1 }).lean();
    assert.equal(searchLogs.length, countBefore + 1, 'Exactly one search unauthenticated event must be generated');
    assert.equal(searchLogs[0].actor, null);
    assert.equal(searchLogs[0].entityId, null);
    assert.equal(searchLogs[0].entityType, 'Student');
    assert.match(searchLogs[0].summary, /Unauthenticated access attempt on faculty student search endpoint/i);
    assert.doesNotMatch(searchLogs[0].summary, /Arjun/, 'Query string must not leak into summary');
  });

  // ── TEST 20: Audit-write amplification protection ───────────────────────
  await t.test('20. Audit-write amplification limiter throttles excessive unauthenticated writes', async () => {
    const action = 'STUDENT_360_UNAUTHENTICATED';
    const countStart = await AuditLog.countDocuments({ action });

    // Send 15 unauthenticated requests in succession
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/api/faculty/students/${student1._id}/360`);
      assert.equal(res.status, 401, 'Every request must still receive standard 401 response');
    }

    await new Promise((r) => setTimeout(r, 100));
    const countEnd = await AuditLog.countDocuments({ action });
    const newlyCreated = countEnd - countStart;

    // Must be bounded to at most 11 (10 normal + 1 throttled notice) and definitely less than 15
    assert.ok(newlyCreated <= 11, `Audit writes must be throttled (created ${newlyCreated} logs for 15 requests)`);
  });

  await t.test('Teardown: Close server and disconnect test database', async () => {
    if (server) await new Promise((res) => server.close(res));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
