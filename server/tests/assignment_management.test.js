/**
 * server/tests/assignment_management.test.js
 * Comprehensive End-to-End Test Suite for Part 13 Assignment Management System.
 *
 * Test Sections:
 * 1. Assignment Creation, Validation & Academic Ownership Enforcement
 * 2. Student Assignment Visibility Scoping & Draft Privacy
 * 3. Student Submission Workflow & Compound Unique Index Enforcement
 * 4. Versioned Resubmissions & previousVersions History Preservation
 * 5. Deadline Enforcement & Late Submission Policies (None, Allowed, Grace Period)
 * 6. Faculty Evaluation & Academic Marks Validation
 * 7. Unpublished Evaluation Grade Privacy (Student Isolation)
 * 8. Result Publication & Student Notification Delivery
 * 9. Authorized File Downloads & Directory Traversal Defense
 * 10. Administrator Institutional Oversight Metrics
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Notification = require('../models/Notification');
const assignmentController = require('../controllers/assignment.controller');
const { verifySafePath, ATTACHMENTS_DIR, SUBMISSIONS_DIR } = require('../services/assignmentStorage.service');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    jsonData: null,
    downloadFile: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    download(filePath, originalName) {
      this.downloadFile = { filePath, originalName };
      return this;
    },
  };
}

test('Part 13: Assignment Management, Submissions & Evaluation Test Suite', async (t) => {
  verifyTestDatabaseIsolation(TEST_DB_URI);

  let adminUser, faculty1User, faculty2User, student1User, student2User, student3OtherBranch;
  let faculty1Doc, faculty2Doc, student1Doc, student2Doc, student3Doc;
  let cseSubject, eceSubject;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    // Clean tables
    await Assignment.deleteMany({});
    await Submission.deleteMany({});
    await Notification.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});

    // Ensure models sync compound indexes
    await Assignment.syncIndexes();
    await Submission.syncIndexes();

    // Create Admin
    adminUser = await User.create({
      name: 'System Admin',
      email: 'p13admin@campus.edu',
      loginId: 'P13ADM01',
      role: 'admin',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });

    // Create Faculty 1 (CSE)
    faculty1User = await User.create({
      name: 'Dr. Alan Turing',
      email: 'p13turing@campus.edu',
      loginId: 'P13FAC01',
      role: 'faculty',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    faculty1Doc = await Faculty.create({
      user: faculty1User._id,
      employeeId: 'EMP-P13-001',
      department: 'CSE',
      designation: 'Professor',
    });

    // Create Faculty 2 (ECE)
    faculty2User = await User.create({
      name: 'Dr. Claude Shannon',
      email: 'p13shannon@campus.edu',
      loginId: 'P13FAC02',
      role: 'faculty',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    faculty2Doc = await Faculty.create({
      user: faculty2User._id,
      employeeId: 'EMP-P13-002',
      department: 'ECE',
      designation: 'Associate Professor',
    });

    // Create Student 1 (CSE, Sem 4, Sec A)
    student1User = await User.create({
      name: 'Alice Cooper',
      email: 'p13alice@campus.edu',
      loginId: 'P13STU01',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Alice Cooper',
      rollNumber: '23CSE01',
      rollNo: '23CSE01',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Create Student 2 (CSE, Sem 4, Sec A)
    student2User = await User.create({
      name: 'Bob Martin',
      email: 'p13bob@campus.edu',
      loginId: 'P13STU02',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Bob Martin',
      rollNumber: '23CSE02',
      rollNo: '23CSE02',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Create Student 3 (ECE, Sem 4 - Different branch)
    student3OtherBranch = await User.create({
      name: 'Charlie ECE',
      email: 'p13charlie@campus.edu',
      loginId: 'P13STU03',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student3Doc = await Student.create({
      user: student3OtherBranch._id,
      fullName: 'Charlie ECE',
      rollNumber: '23ECE01',
      rollNo: '23ECE01',
      branch: 'ECE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Subjects
    cseSubject = await Subject.create({
      name: 'Database Management Systems',
      code: 'CS401',
      credits: 4,
      branch: 'CSE',
      semester: 4,
      faculty: faculty1User._id,
    });

    eceSubject = await Subject.create({
      name: 'Digital Signal Processing',
      code: 'EC401',
      credits: 4,
      branch: 'ECE',
      semester: 4,
      faculty: faculty2User._id,
    });
  });

  // ── 1. ASSIGNMENT CREATION & ACADEMIC OWNERSHIP ─────────────────────────────
  let createdAssignment;
  let draftAssignment;

  await t.test('1. Faculty can create assignment for assigned subject', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Assignment 1: SQL Relational Algebra & Indexing',
        description: 'Design schema, construct queries, and provide query execution plans.',
        subject: cseSubject._id.toString(),
        department: 'CSE',
        semester: 4,
        section: 'A',
        maximumMarks: 50,
        assignmentType: 'homework',
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        latePolicy: 'allowed',
        status: 'published',
      },
      files: [],
    };
    const res = createMockRes();

    await assignmentController.createAssignment(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.title, 'Assignment 1: SQL Relational Algebra & Indexing');
    assert.equal(res.jsonData.data.status, 'published');
    assert.ok(res.jsonData.data.publishedAt);

    createdAssignment = res.jsonData.data;
  });

  await t.test('1.1. Unauthorized faculty cannot create assignment for a subject they do not teach', async () => {
    const req = {
      user: { userId: faculty2User._id, role: 'faculty' }, // Faculty 2 teaches ECE, not CSE
      body: {
        title: 'Intruder Assignment',
        description: 'Trying to create assignment for CSE subject',
        subject: cseSubject._id.toString(),
        dueDate: new Date(Date.now() + 3600000).toISOString(),
      },
      files: [],
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await assignmentController.createAssignment(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /You do not teach this subject/i);
        return true;
      }
    );
  });

  await t.test('1.2. Faculty can create assignment in draft status', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Upcoming Midterm Project Draft',
        description: 'Draft problem description for project',
        subject: cseSubject._id.toString(),
        department: 'CSE',
        semester: 4,
        maximumMarks: 100,
        dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        status: 'draft',
      },
      files: [],
    };
    const res = createMockRes();

    await assignmentController.createAssignment(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'draft');
    assert.equal(res.jsonData.data.publishedAt, null);

    draftAssignment = res.jsonData.data;
  });

  // ── 2. STUDENT VISIBILITY & DRAFT PRIVACY ───────────────────────────────────
  await t.test('2. Enrolled students can view published assignments for their class', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      query: {},
    };
    const res = createMockRes();

    await assignmentController.getStudentAssignments(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.data));

    const assignmentIds = res.jsonData.data.map((a) => a._id.toString());
    assert.ok(assignmentIds.includes(createdAssignment._id.toString()));
  });

  await t.test('2.1. Draft assignments are strictly hidden from students', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      query: {},
    };
    const res = createMockRes();

    await assignmentController.getStudentAssignments(req, res);
    const assignmentIds = res.jsonData.data.map((a) => a._id.toString());
    assert.ok(!assignmentIds.includes(draftAssignment._id.toString()), 'Draft assignment must not be visible to student');
  });

  await t.test('2.2. Student in different department does not see the CSE assignment', async () => {
    const req = {
      user: { userId: student3OtherBranch._id, role: 'student' }, // ECE student
      query: {},
    };
    const res = createMockRes();

    await assignmentController.getStudentAssignments(req, res);
    const assignmentIds = res.jsonData.data.map((a) => a._id.toString());
    assert.ok(!assignmentIds.includes(createdAssignment._id.toString()), 'ECE student must not see CSE assignment');
  });

  // ── 3. STUDENT SUBMISSION WORKFLOW ──────────────────────────────────────────
  let student1Submission;

  await t.test('3. Student submits assignment with files and text response', async () => {
    const dummyPath = path.join(SUBMISSIONS_DIR, 'test-submission-file.pdf');
    fs.writeFileSync(dummyPath, 'Dummy PDF submission content');

    const req = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: createdAssignment._id.toString() },
      body: {
        textResponse: 'Here is my solution with queries and execution plans.',
      },
      files: [
        {
          originalname: 'Alice_DBMS_Assignment1.pdf',
          filename: 'test-submission-file.pdf',
          path: dummyPath,
          size: 1024,
          mimetype: 'application/pdf',
        },
      ],
    };
    const res = createMockRes();

    await assignmentController.submitAssignment(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.version, 1);
    assert.equal(res.jsonData.data.isLate, false);
    assert.equal(res.jsonData.data.status, 'submitted');
    assert.equal(res.jsonData.data.submissionFiles.length, 1);
    assert.equal(res.jsonData.data.submissionFiles[0].name, 'Alice_DBMS_Assignment1.pdf');

    student1Submission = res.jsonData.data;
  });

  await t.test('3.1. Compound unique index { assignment: 1, student: 1 } prevents duplicate root docs', async () => {
    // Attempting direct raw DB duplicate creation must throw duplicate key error (code 11000)
    await assert.rejects(
      async () => {
        await Submission.create({
          assignment: createdAssignment._id,
          student: student1Doc._id,
          studentUser: student1User._id,
          status: 'submitted',
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  // ── 4. RESUBMISSION VERSIONING & HISTORY PRESERVATION ───────────────────────
  await t.test('4. Resubmitting coursework increments version and stores previous snapshot in previousVersions', async () => {
    const dummyPathV2 = path.join(SUBMISSIONS_DIR, 'test-submission-file-v2.pdf');
    fs.writeFileSync(dummyPathV2, 'Dummy PDF submission content v2 revised');

    const req = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: createdAssignment._id.toString() },
      body: {
        textResponse: 'Revised submission v2: Fixed execution plan for query 4.',
      },
      files: [
        {
          originalname: 'Alice_DBMS_Assignment1_v2.pdf',
          filename: 'test-submission-file-v2.pdf',
          path: dummyPathV2,
          size: 2048,
          mimetype: 'application/pdf',
        },
      ],
    };
    const res = createMockRes();

    await assignmentController.submitAssignment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.version, 2);
    assert.equal(res.jsonData.data.textResponse, 'Revised submission v2: Fixed execution plan for query 4.');
    assert.equal(res.jsonData.data.previousVersions.length, 1);
    assert.equal(res.jsonData.data.previousVersions[0].version, 1);
    assert.equal(res.jsonData.data.previousVersions[0].textResponse, 'Here is my solution with queries and execution plans.');
    assert.equal(res.jsonData.data.previousVersions[0].submissionFiles[0].name, 'Alice_DBMS_Assignment1.pdf');

    student1Submission = res.jsonData.data;
  });

  // ── 5. DEADLINE ENFORCEMENT & LATE SUBMISSION POLICIES ──────────────────────
  let strictAssignment;
  let lateAllowedAssignment;

  await t.test('5. Policy "none" rejects submissions after deadline', async () => {
    // Create an assignment whose deadline passed 1 hour ago with latePolicy 'none'
    strictAssignment = await Assignment.create({
      title: 'Strict Pop Quiz',
      description: 'Zero tolerance for late submissions',
      subject: cseSubject._id,
      faculty: faculty1User._id,
      department: 'CSE',
      semester: 4,
      section: 'A',
      maximumMarks: 20,
      status: 'published',
      dueDate: new Date(Date.now() - 3600 * 1000), // Past
      latePolicy: 'none',
    });

    const req = {
      user: { userId: student2User._id, role: 'student' },
      params: { id: strictAssignment._id.toString() },
      body: { textResponse: 'Late attempt' },
      files: [],
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await assignmentController.submitAssignment(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Late submissions are not permitted/i);
        return true;
      }
    );
  });

  await t.test('5.1. Policy "allowed" accepts submissions after deadline and tags isLate: true', async () => {
    lateAllowedAssignment = await Assignment.create({
      title: 'Term Project Proposal',
      description: 'Accepts late submissions with penalty tag',
      subject: cseSubject._id,
      faculty: faculty1User._id,
      department: 'CSE',
      semester: 4,
      section: 'A',
      maximumMarks: 50,
      status: 'published',
      dueDate: new Date(Date.now() - 3600 * 1000), // Past
      latePolicy: 'allowed',
    });

    const req = {
      user: { userId: student2User._id, role: 'student' },
      params: { id: lateAllowedAssignment._id.toString() },
      body: { textResponse: 'Submitting 1 hour late' },
      files: [],
    };
    const res = createMockRes();

    await assignmentController.submitAssignment(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.isLate, true);
    assert.equal(res.jsonData.data.status, 'late');
  });

  // ── 6. FACULTY EVALUATION & MARKS VALIDATION ────────────────────────────────
  await t.test('6. Faculty evaluates submission with marks and feedback', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: student1Submission._id.toString() },
      body: {
        marksAwarded: 46,
        feedback: 'Excellent schema design and accurate B-tree index explain plans.',
      },
    };
    const res = createMockRes();

    await assignmentController.evaluateSubmission(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.marksAwarded, 46);
    assert.equal(res.jsonData.data.feedback, 'Excellent schema design and accurate B-tree index explain plans.');
    assert.equal(res.jsonData.data.status, 'evaluated');
    assert.equal(res.jsonData.data.isResultPublished, false); // Remains unpublished until explicit action
  });

  await t.test('6.1. Rejects marks greater than maximumMarks', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: student1Submission._id.toString() },
      body: {
        marksAwarded: 999, // Max is 50
        feedback: 'Too generous',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await assignmentController.evaluateSubmission(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot exceed maximum marks/i);
        return true;
      }
    );
  });

  await t.test('6.2. Rejects negative marks', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: student1Submission._id.toString() },
      body: {
        marksAwarded: -5,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await assignmentController.evaluateSubmission(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot be negative/i);
        return true;
      }
    );
  });

  // ── 7. UNPUBLISHED EVALUATION GRADE PRIVACY ─────────────────────────────────
  await t.test('7. Student cannot see marks or feedback before result is published', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: createdAssignment._id.toString() },
    };
    const res = createMockRes();

    await assignmentController.getStudentAssignmentDetails(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(res.jsonData.data.submission);
    assert.equal(res.jsonData.data.submission.isResultPublished, false);
    assert.equal(res.jsonData.data.submission.marksAwarded, null, 'Unpublished marks must be hidden from student');
    assert.equal(res.jsonData.data.submission.feedback, null, 'Unpublished feedback must be hidden from student');
  });

  // ── 8. RESULT PUBLICATION & NOTIFICATION ────────────────────────────────────
  await t.test('8. Faculty publishes result, making grades visible to student and delivering notification', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: student1Submission._id.toString() },
    };
    const res = createMockRes();

    await assignmentController.publishSubmissionResult(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.isResultPublished, true);

    // Verify student can now see grades
    const studentReq = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: createdAssignment._id.toString() },
    };
    const studentRes = createMockRes();

    await assignmentController.getStudentAssignmentDetails(studentReq, studentRes);
    assert.equal(studentRes.jsonData.data.submission.isResultPublished, true);
    assert.equal(studentRes.jsonData.data.submission.marksAwarded, 46);
    assert.equal(studentRes.jsonData.data.submission.feedback, 'Excellent schema design and accurate B-tree index explain plans.');

    // Check notification in database
    const notif = await Notification.findOne({
      recipient: student1User._id,
      category: 'assignment',
    });
    assert.ok(notif, 'Student should receive an assignment notification about published grade');
    assert.match(notif.title, /Assignment Graded/i);
  });

  // ── 9. AUTHORIZED DOWNLOADS & SECURITY ──────────────────────────────────────
  await t.test('9. Student owner and assigned faculty can download submission file', async () => {
    const subDoc = await Submission.findById(student1Submission._id);
    const fileId = subDoc.submissionFiles[0]._id.toString();

    // Student owner download
    const ownerReq = {
      user: { userId: student1User._id, role: 'student' },
      params: { submissionId: student1Submission._id.toString(), fileId },
    };
    const ownerRes = createMockRes();
    await assignmentController.downloadSubmissionFile(ownerReq, ownerRes);
    assert.ok(ownerRes.downloadFile);
    assert.equal(ownerRes.downloadFile.originalName, 'Alice_DBMS_Assignment1_v2.pdf');

    // Faculty download
    const facultyReq = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { submissionId: student1Submission._id.toString(), fileId },
    };
    const facultyRes = createMockRes();
    await assignmentController.downloadSubmissionFile(facultyReq, facultyRes);
    assert.ok(facultyRes.downloadFile);
  });

  await t.test('9.1. Unauthorized student is forbidden from downloading another student submission', async () => {
    const subDoc = await Submission.findById(student1Submission._id);
    const fileId = subDoc.submissionFiles[0]._id.toString();

    const strangerReq = {
      user: { userId: student2User._id, role: 'student' }, // Student 2 trying to download Student 1's work
      params: { submissionId: student1Submission._id.toString(), fileId },
    };
    const strangerRes = createMockRes();

    await assert.rejects(
      async () => {
        await assignmentController.downloadSubmissionFile(strangerReq, strangerRes);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );
  });

  await t.test('9.2. Directory traversal attempt is intercepted and blocked', async () => {
    assert.throws(
      () => {
        verifySafePath('/etc/passwd');
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Path traversal detected/i);
        return true;
      }
    );
  });

  // ── 10. ADMIN INSTITUTIONAL OVERSIGHT ───────────────────────────────────────
  await t.test('10. Admin can view institutional assignment overview metrics', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: {},
    };
    const res = createMockRes();

    await assignmentController.getAdminAssignmentOverview(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(res.jsonData.data.totalAssignments >= 3);
    assert.ok(res.jsonData.data.totalSubmissions >= 2);
    assert.ok(res.jsonData.data.evaluatedSubmissions >= 1);
  });

  await t.test('Teardown: Disconnect test database cleanly', async () => {
    await mongoose.disconnect();
  });
});
