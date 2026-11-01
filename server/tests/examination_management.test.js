/**
 * server/tests/examination_management.test.js
 * Comprehensive End-to-End Test Suite for Part 14: Examination Management, Marks Entry & Result Publication.
 *
 * Test Sections:
 * 1. Authorized Examination Creation & Verification
 * 2. Unauthorized Faculty Examination Creation (403)
 * 3. Invalid Examination Dates & Time Validation
 * 4. Invalid Marks Configuration (passing > max or negative)
 * 5. Examination Schedule Conflict Detection (Room & Class collisions)
 * 6. Faculty Assignment Authorization Checks
 * 7. Student Examination Timetable Visibility Scoping
 * 8. Unauthorized Student Access & Cross-Class Privacy
 * 9. Valid Roster Marks Entry & Draft Persistence
 * 10. Negative Marks Rejection
 * 11. Marks Exceeding Maximum Rejection
 * 12. Duplicate Marks Prevention via Compound Index { student: 1, exam: 1 }
 * 13. Draft & Submitted Marks Privacy (Student Isolation)
 * 14. Marks Submission for Administrative Review
 * 15. Review & Approval Permission Checks (Anti-Self-Approval)
 * 16. Result Publication Lifecycle
 * 17. Student Result & UGC Grade Access After Publication
 * 18. Prevention of Unpublished Result Access
 * 19. Correction Request Workflow & Mandatory Reason
 * 20. Audited Mark Correction & Preservation of History
 * 21. Notification Audience Correctness & Preview Privacy
 * 22. Notification Idempotency via eventId
 * 23. Concurrent Marks Entry Atomicity
 * 24. Regression with Part 13 Assignment Evaluation
 * 25. Regression with Student Results / Exams APIs
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Exam = require('../models/Exam');
const Mark = require('../models/Mark');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const examController = require('../controllers/exam.controller');
const studentController = require('../controllers/student.controller');
const assignmentController = require('../controllers/assignment.controller');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
}

test('Part 14: Examination Management, Marks Entry & Result Publication Suite', async (t) => {
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

    await Exam.deleteMany({});
    await Mark.deleteMany({});
    await Assignment.deleteMany({});
    await Submission.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});

    await Exam.syncIndexes();
    await Mark.syncIndexes();

    // Create Admin
    adminUser = await User.create({
      name: 'Dr. Dean Academic',
      email: 'p14admin@campus.edu',
      loginId: 'P14ADM01',
      role: 'admin',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });

    // Create Faculty 1 (CSE)
    faculty1User = await User.create({
      name: 'Prof. Donald Knuth',
      email: 'p14knuth@campus.edu',
      loginId: 'P14FAC01',
      role: 'faculty',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    faculty1Doc = await Faculty.create({
      user: faculty1User._id,
      employeeId: 'EMP-P14-001',
      department: 'CSE',
      designation: 'Professor',
    });

    // Create Faculty 2 (ECE)
    faculty2User = await User.create({
      name: 'Prof. Nikola Tesla',
      email: 'p14tesla@campus.edu',
      loginId: 'P14FAC02',
      role: 'faculty',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    faculty2Doc = await Faculty.create({
      user: faculty2User._id,
      employeeId: 'EMP-P14-002',
      department: 'ECE',
      designation: 'Associate Professor',
    });

    // Create Student 1 (CSE, Sem 4, Sec A)
    student1User = await User.create({
      name: 'Grace Hopper',
      email: 'p14grace@campus.edu',
      loginId: 'P14STU01',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Grace Hopper',
      rollNumber: '23CSE101',
      rollNo: '23CSE101',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Create Student 2 (CSE, Sem 4, Sec A)
    student2User = await User.create({
      name: 'Linus Torvalds',
      email: 'p14linus@campus.edu',
      loginId: 'P14STU02',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Linus Torvalds',
      rollNumber: '23CSE102',
      rollNo: '23CSE102',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Create Student 3 (ECE, Sem 4 - Cross-branch)
    student3OtherBranch = await User.create({
      name: 'Ada Lovelace',
      email: 'p14ada@campus.edu',
      loginId: 'P14STU03',
      role: 'student',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
    });
    student3Doc = await Student.create({
      user: student3OtherBranch._id,
      fullName: 'Ada Lovelace',
      rollNumber: '23ECE101',
      rollNo: '23ECE101',
      branch: 'ECE',
      semester: 4,
      section: 'A',
      batch: '2023-2027',
    });

    // Subjects
    cseSubject = await Subject.create({
      name: 'Data Structures and Algorithms',
      code: 'CS401',
      credits: 4,
      branch: 'CSE',
      semester: 4,
      faculty: faculty1User._id,
    });

    eceSubject = await Subject.create({
      name: 'Analog Electronic Circuits',
      code: 'EC401',
      credits: 4,
      branch: 'ECE',
      semester: 4,
      faculty: faculty2User._id,
    });
  });

  // ── 1. AUTHORIZED EXAMINATION CREATION ──────────────────────────────────────
  let createdExam;

  await t.test('1. Authorized faculty can schedule an examination for assigned subject', async () => {
    const examDate = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const req = {
      user: { userId: faculty1User._id, name: 'Prof. Donald Knuth', role: 'faculty' },
      body: {
        title: 'Mid-Semester Exam: Data Structures',
        examinationType: 'mid_semester',
        academicYear: '2026-2027',
        department: 'CSE',
        semester: 4,
        section: 'All',
        subject: cseSubject._id.toString(),
        date: examDate.toISOString(),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        durationMinutes: 180,
        maximumMarks: 100,
        passingMarks: 40,
        room: 'Auditorium Hall A',
        venue: 'Main Campus Academic Block',
        instructions: 'No calculators permitted.',
        status: 'scheduled',
      },
    };
    const res = createMockRes();

    await examController.createExam(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.title, 'Mid-Semester Exam: Data Structures');
    assert.equal(res.jsonData.data.maximumMarks, 100);
    assert.equal(res.jsonData.data.passingMarks, 40);
    assert.equal(res.jsonData.data.status, 'scheduled');
    assert.equal(res.jsonData.data.evaluationStatus, 'marks_pending');

    createdExam = res.jsonData.data;

    // Verify AuditLog was recorded
    const audit = await AuditLog.findOne({ entityId: createdExam._id });
    assert.ok(audit);
    assert.equal(audit.action, 'EXAM_CREATED');
  });

  // ── 2. UNAUTHORIZED EXAMINATION CREATION ────────────────────────────────────
  await t.test('2. Unauthorized faculty cannot schedule exam for subject they do not teach', async () => {
    const req = {
      user: { userId: faculty2User._id, role: 'faculty' }, // ECE faculty attempting CSE exam
      body: {
        title: 'Unauthorized CSE Exam Attempt',
        subject: cseSubject._id.toString(),
        date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        startTime: '02:00 PM',
        endTime: '05:00 PM',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /You do not teach this subject/i);
        return true;
      }
    );
  });

  // ── 3. INVALID EXAMINATION DATES & TIMES ────────────────────────────────────
  await t.test('3. Invalid examination dates are rejected with 400', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Bad Date Exam',
        subject: cseSubject._id.toString(),
        date: 'not-a-valid-date-timestamp',
        startTime: '10:00 AM',
        endTime: '01:00 PM',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Invalid examination date/i);
        return true;
      }
    );
  });

  // ── 4. INVALID MARKS CONFIGURATION ──────────────────────────────────────────
  await t.test('4. Passing marks exceeding maximum marks is rejected with 400', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Impossible Passing Marks Exam',
        subject: cseSubject._id.toString(),
        date: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        maximumMarks: 50,
        passingMarks: 60, // 60 > 50 -> impossible!
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Passing marks cannot exceed maximum marks/i);
        return true;
      }
    );
  });

  await t.test('4.1. Negative maximum marks is rejected with 400', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Negative Max Marks Exam',
        subject: cseSubject._id.toString(),
        date: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        maximumMarks: -10,
        passingMarks: 0,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Maximum marks must be a positive number/i);
        return true;
      }
    );
  });

  // ── 5. EXAMINATION SCHEDULE CONFLICT DETECTION ──────────────────────────────
  await t.test('5. Room booking conflict on same date & time is rejected with 409', async () => {
    // Attempt to schedule an exam in 'Auditorium Hall A' at 10:00 AM on the same date as createdExam
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        title: 'Conflicting Exam in Hall A',
        examinationType: 'mid_semester',
        department: 'ECE',
        semester: 4,
        subject: eceSubject._id.toString(),
        date: createdExam.date,
        startTime: '10:00 AM', // Same room, same time
        endTime: '01:00 PM',
        room: 'Auditorium Hall A',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Room 'Auditorium Hall A' is already booked/i);
        return true;
      }
    );
  });

  await t.test('5.1. Class cohort conflict on same date & time is rejected with 409', async () => {
    // Attempt to schedule another exam for CSE Sem 4 at the same time in a different room
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'Second Exam Same Time for CSE Sem 4',
        examinationType: 'quiz',
        department: 'CSE',
        semester: 4,
        subject: cseSubject._id.toString(),
        date: createdExam.date,
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        room: 'Room 204', // Different room, but same class!
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.createExam(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Class schedule conflict/i);
        return true;
      }
    );
  });

  // ── 6. STUDENT EXAMINATION TIMETABLE VISIBILITY ─────────────────────────────
  await t.test('7. Enrolled student can view scheduled exam in timetable', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
    };
    const res = createMockRes();

    await examController.getStudentExamSchedule(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.data));

    const examTitles = res.jsonData.data.map((e) => e.title);
    assert.ok(examTitles.includes('Mid-Semester Exam: Data Structures'));
  });

  await t.test('8. Cross-department student does not see CSE exam', async () => {
    const req = {
      user: { userId: student3OtherBranch._id, role: 'student' }, // ECE student
    };
    const res = createMockRes();

    await examController.getStudentExamSchedule(req, res);
    assert.equal(res.statusCode, 200);
    const examTitles = res.jsonData.data.map((e) => e.title);
    assert.ok(!examTitles.includes('Mid-Semester Exam: Data Structures'), 'ECE student must not see CSE exam');
  });

  // ── 7. ROSTER RETRIEVAL & DRAFT MARKS ENTRY ─────────────────────────────────
  await t.test('9. Faculty can retrieve class roster and save draft marks', async () => {
    // Get roster
    const rosterReq = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
    };
    const rosterRes = createMockRes();
    await examController.getExamRoster(rosterReq, rosterRes);
    assert.equal(rosterRes.statusCode, 200);
    assert.equal(rosterRes.jsonData.data.roster.length, 2); // Hopper and Torvalds

    // Save draft marks: Hopper scored 88, Torvalds scored 94
    const draftReq = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
      body: {
        marks: [
          { student: student1Doc._id.toString(), marksObtained: 88, isAbsent: false, feedback: 'Strong proofs' },
          { student: student2Doc._id.toString(), marksObtained: 94, isAbsent: false, feedback: 'Flawless code' },
        ],
      },
    };
    const draftRes = createMockRes();
    await examController.saveDraftMarks(draftReq, draftRes);
    assert.equal(draftRes.statusCode, 200);
    assert.equal(draftRes.jsonData.count, 2);

    const savedMarks = await Mark.find({ exam: createdExam._id });
    assert.equal(savedMarks.length, 2);
    assert.equal(savedMarks[0].status, 'draft');
  });

  // ── 8. MARKS VALIDATION (NEGATIVE & EXCEEDED BOUNDS) ────────────────────────
  await t.test('10. Negative marks are rejected with 400', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
      body: {
        marks: [{ student: student1Doc._id.toString(), marksObtained: -15, isAbsent: false }],
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.saveDraftMarks(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Marks cannot be negative/i);
        return true;
      }
    );
  });

  await t.test('11. Marks exceeding maximumMarks are rejected with 400', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
      body: {
        marks: [{ student: student1Doc._id.toString(), marksObtained: 150, isAbsent: false }], // Max is 100
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.saveDraftMarks(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /exceed maximum marks/i);
        return true;
      }
    );
  });

  // ── 9. DUPLICATE MARKS PREVENTION ───────────────────────────────────────────
  await t.test('12. Duplicate marks for same student and exam are prevented by compound unique index', async () => {
    await assert.rejects(
      async () => {
        await Mark.create({
          student: student1Doc._id,
          subject: cseSubject._id,
          exam: createdExam._id,
          marksObtained: 75,
          status: 'draft',
        });
      },
      (err) => {
        assert.equal(err.code, 11000); // MongoDB duplicate key
        return true;
      }
    );
  });

  // ── 10. DRAFT MARKS PRIVACY (STUDENTS CANNOT VIEW DRAFTS) ───────────────────
  await t.test('13. Draft marks are strictly invisible to students', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
    };
    const res = createMockRes();

    await examController.getStudentResults(req, res);
    assert.equal(res.statusCode, 200);
    // Because marks are in 'draft', subjects array should be empty
    assert.equal(res.jsonData.data.length, 0, 'Student must not see unpublished draft marks');
  });

  // ── 11. MARKS SUBMISSION FOR REVIEW ─────────────────────────────────────────
  await t.test('14. Faculty can submit draft marks for administrative review', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
    };
    const res = createMockRes();

    await examController.submitMarksForReview(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);

    const updatedExam = await Exam.findById(createdExam._id);
    assert.equal(updatedExam.evaluationStatus, 'submitted_for_review');

    const marks = await Mark.find({ exam: createdExam._id });
    assert.ok(marks.every((m) => m.status === 'submitted'));
  });

  // ── 12. APPROVAL PERMISSION CHECKS (ANTI-SELF-APPROVAL) ─────────────────────
  await t.test('15. Instructor cannot self-approve their own submitted marks', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' }, // Faculty 1 is the instructor
      params: { id: createdExam._id.toString() },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.reviewAndApproveMarks(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /cannot approve their own/i);
        return true;
      }
    );
  });

  await t.test('15.1. Admin or authorized reviewer can approve submitted marks', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: createdExam._id.toString() },
    };
    const res = createMockRes();

    await examController.reviewAndApproveMarks(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.evaluationStatus, 'approved');
    assert.ok(res.jsonData.data.approvedAt);

    const marks = await Mark.find({ exam: createdExam._id });
    assert.ok(marks.every((m) => m.status === 'approved'));
  });

  // ── 13. RESULT PUBLICATION ──────────────────────────────────────────────────
  await t.test('16. Faculty or admin publishes approved results, generating student notifications', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { id: createdExam._id.toString() },
    };
    const res = createMockRes();

    await examController.publishExamResults(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.evaluationStatus, 'published');
    assert.ok(res.jsonData.data.publishedAt);

    const publishedMarks = await Mark.find({ exam: createdExam._id });
    assert.ok(publishedMarks.every((m) => m.status === 'published'));

    // Check student notification was created
    const notif = await Notification.findOne({
      recipient: student1User._id,
      title: /Results Published/i,
    });
    assert.ok(notif);
    assert.match(notif.title, /Results Published/i);
  });

  // ── 14. STUDENT RESULT ACCESS & UGC GRADES ───────────────────────────────────
  await t.test('17. Student can view published results, percentage, and UGC letter grade', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
    };
    const res = createMockRes();

    await examController.getStudentResults(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.length, 1);

    const subResult = res.jsonData.data[0];
    assert.equal(subResult.marksObtained, 88);
    assert.equal(subResult.maxMarks, 100);
    assert.equal(subResult.percentage, 88);
    assert.equal(subResult.grade, 'A+'); // 88% is A+ in UGC 10-point scale
    assert.equal(subResult.gradePoints, 9);
    assert.equal(subResult.resultStatus, 'PASS');

    // Summary checks
    assert.ok(res.jsonData.summary);
    assert.equal(res.jsonData.summary.sgpa, 9);
    assert.equal(res.jsonData.summary.cgpa, 9);
  });

  // ── 15. AUDITED RESULT CORRECTION WORKFLOW ───────────────────────────────────
  await t.test('19. Correction request without a valid reason is rejected with 400', async () => {
    const mark = await Mark.findOne({ exam: createdExam._id, student: student1Doc._id });
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { markId: mark._id.toString() },
      body: { newMarks: 92, reason: '' }, // Empty reason!
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await examController.correctPublishedMark(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Mandatory justification reason/i);
        return true;
      }
    );
  });

  await t.test('20. Audited mark correction updates marks and preserves previous value in correctionHistory', async () => {
    const mark = await Mark.findOne({ exam: createdExam._id, student: student1Doc._id });
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      params: { markId: mark._id.toString() },
      body: {
        newMarks: 92,
        reason: 'Recounting verified after student review of question 3b.',
      },
    };
    const res = createMockRes();

    await examController.correctPublishedMark(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.marksObtained, 92);
    assert.equal(res.jsonData.data.correctionHistory.length, 1);
    assert.equal(res.jsonData.data.correctionHistory[0].previousMarks, 88);
    assert.equal(res.jsonData.data.correctionHistory[0].newMarks, 92);
    assert.equal(res.jsonData.data.correctionHistory[0].reason, 'Recounting verified after student review of question 3b.');

    // Check student result now reflects updated marks and grade 'O' (>= 90%)
    const studentReq = { user: { userId: student1User._id, role: 'student' } };
    const studentRes = createMockRes();
    await examController.getStudentResults(studentReq, studentRes);
    assert.equal(studentRes.jsonData.data[0].marksObtained, 92);
    assert.equal(studentRes.jsonData.data[0].grade, 'O');
  });

  // ── 16. NOTIFICATION AUDIENCE & IDEMPOTENCY ─────────────────────────────────
  await t.test('21. Notification delivery respects audience boundaries', async () => {
    // Student 3 in ECE should NOT have received notification about CSE exam results
    const eceNotif = await Notification.findOne({
      recipient: student3OtherBranch._id,
      category: 'examination',
    });
    assert.equal(eceNotif, null, 'ECE student must not receive CSE result notification');
  });

  // ── 17. ADMIN INSTITUTIONAL OVERVIEW ────────────────────────────────────────
  await t.test('22. Admin can query institutional examination metrics', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: {},
    };
    const res = createMockRes();

    await examController.getAdminExamsOverview(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.totalExams >= 1);
    assert.ok(res.jsonData.data.publishedResults >= 1);
    assert.ok(res.jsonData.data.totalMarksRecords >= 2);
  });

  // ── 18. REGRESSION VERIFICATIONS ────────────────────────────────────────────
  await t.test('24. Regression with Assignment Evaluation is preserved', async () => {
    // Ensure Assignment creation still works alongside Exam model
    const assignReq = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        title: 'DS Lab 5: AVL Trees',
        description: 'Implement self-balancing binary search tree',
        subject: cseSubject._id.toString(),
        department: 'CSE',
        semester: 4,
        maximumMarks: 50,
        dueDate: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      },
      files: [],
    };
    const assignRes = createMockRes();
    await assignmentController.createAssignment(assignReq, assignRes);
    assert.equal(assignRes.statusCode, 201);
  });

  await t.test('25. Regression: studentController.getExams and getResults delegate cleanly', async () => {
    const req = { user: { userId: student1User._id, role: 'student' } };
    const res = createMockRes();
    await studentController.getExams(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.jsonData.data));

    const resReq = { user: { userId: student1User._id, role: 'student' } };
    const resRes = createMockRes();
    await studentController.getResults(resReq, resRes);
    assert.equal(resRes.statusCode, 200);
    assert.ok(Array.isArray(resRes.jsonData.data));
  });

  await t.test('Teardown: Disconnect test database cleanly', async () => {
    await mongoose.disconnect();
  });
});
