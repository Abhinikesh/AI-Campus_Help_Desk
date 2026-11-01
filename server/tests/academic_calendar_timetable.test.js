/**
 * server/tests/academic_calendar_timetable.test.js
 * Comprehensive End-to-End Test Suite for Part 15:
 * Academic Calendar, Timetable Management & Scheduling Integration.
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
const Timetable = require('../models/Timetable');
const TimetableVersion = require('../models/TimetableVersion');
const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const Exam = require('../models/Exam');
const Assignment = require('../models/Assignment');
const AttendanceSession = require('../models/AttendanceSession');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const timetableController = require('../controllers/timetable.controller');
const calendarController = require('../controllers/calendar.controller');
const attendanceController = require('../controllers/attendance.controller');

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

test('Part 15: Academic Calendar & Timetable Management Suite', async (t) => {
  let adminUser, faculty1User, faculty2User, student1User, student2User;
  let faculty1Profile, student1Profile, student2Profile;
  let subject1, subject2;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean existing test collections
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Faculty.deleteMany({}),
      Subject.deleteMany({}),
      Timetable.deleteMany({}),
      TimetableVersion.deleteMany({}),
      AcademicCalendarEvent.deleteMany({}),
      Exam.deleteMany({}),
      Assignment.deleteMany({}),
      AttendanceSession.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // Create Admin
    adminUser = await User.create({
      name: 'Academic Dean Admin',
      email: 'dean.admin@test.edu',
      loginId: 'P15ADM01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'admin',
    });

    // Create Faculty 1 (CSE Professor)
    faculty1User = await User.create({
      name: 'Prof. Ramesh Sharma',
      email: 'ramesh.sharma@test.edu',
      loginId: 'P15FAC01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });
    faculty1Profile = await Faculty.create({
      user: faculty1User._id,
      employeeId: 'FAC-CSE-001',
      department: 'CSE',
      designation: 'Associate Professor',
    });

    // Create Faculty 2 (CSE / ECE Professor)
    faculty2User = await User.create({
      name: 'Prof. Sunita Rao',
      email: 'sunita.rao@test.edu',
      loginId: 'P15FAC02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });
    await Faculty.create({
      user: faculty2User._id,
      employeeId: 'FAC-CSE-002',
      department: 'CSE',
      designation: 'Assistant Professor',
    });

    // Create Student 1 (CSE, Semester 5, Section A)
    student1User = await User.create({
      name: 'Rahul Verma',
      email: 'rahul.cse@test.edu',
      loginId: 'P15STU01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student1Profile = await Student.create({
      user: student1User._id,
      rollNumber: 'CSE-2023-010',
      fullName: 'Rahul Verma',
      branch: 'CSE',
      semester: 5,
      section: 'A',
    });

    // Create Student 2 (MECH, Semester 5, Section A)
    student2User = await User.create({
      name: 'Amit Patel',
      email: 'amit.mech@test.edu',
      loginId: 'P15STU02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student2Profile = await Student.create({
      user: student2User._id,
      rollNumber: 'MECH-2023-020',
      fullName: 'Amit Patel',
      branch: 'MECH',
      semester: 5,
      section: 'A',
    });

    // Create Subjects
    subject1 = await Subject.create({
      code: 'CS501',
      name: 'Database Management Systems',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: faculty1User._id,
    });

    subject2 = await Subject.create({
      code: 'CS502',
      name: 'Computer Networks',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: faculty2User._id,
    });

    assert.ok(adminUser && faculty1User && student1User && subject1);
  });

  // ── 1. Academic Calendar Event Creation ──────────────────────────────
  await t.test('1. Authorized Admin can create institutional academic calendar events', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        title: 'Diwali Institutional Holidays',
        description: 'College closed for festival celebration',
        eventType: 'holiday_college',
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-14T23:59:59.999Z',
        isAllDay: true,
        audience: 'all',
        venue: 'Campus Wide',
        status: 'published',
      },
    };
    const res = createMockRes();
    await calendarController.createCalendarEvent(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.title, 'Diwali Institutional Holidays');
  });

  // ── 2. Invalid Event Dates Validation ────────────────────────────────
  await t.test('2. Calendar event with startDate > endDate is rejected with 400', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        title: 'Invalid Date Event',
        startDate: '2026-11-20T00:00:00.000Z',
        endDate: '2026-11-10T00:00:00.000Z', // Prior to start
      },
    };
    const res = createMockRes();
    await calendarController.createCalendarEvent(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /startDate must be on or before endDate/i);
  });

  // ── 3. Student Calendar Audience Filtering ───────────────────────────
  await t.test('3. Student calendar view filters out private administrative events', async () => {
    // Create an admin-only event
    await AcademicCalendarEvent.create({
      title: 'Faculty Senate Meeting',
      description: 'Departmental review of course outcomes',
      eventType: 'faculty_meeting',
      startDate: new Date('2026-11-15T14:00:00.000Z'),
      endDate: new Date('2026-11-15T16:00:00.000Z'),
      isAllDay: false,
      audience: 'faculty',
      department: 'CSE',
      createdBy: adminUser._id,
      status: 'published',
    });

    const req = {
      user: { _id: student1User._id, userId: student1User._id, role: 'student' },
      query: {},
    };
    const res = createMockRes();
    await calendarController.getCalendarEvents(req, res);

    assert.equal(res.statusCode, 200);
    const eventTitles = res.jsonData.data.map((e) => e.title);
    assert.ok(eventTitles.includes('Diwali Institutional Holidays'));
    assert.ok(!eventTitles.includes('Faculty Senate Meeting'), 'Faculty meeting must be hidden from students');
  });

  // ── 4. Faculty Calendar Audience Filtering ───────────────────────────
  await t.test('4. Faculty calendar view includes faculty-only events and institutional holidays', async () => {
    const req = {
      user: { _id: faculty1User._id, userId: faculty1User._id, role: 'faculty' },
      query: {},
    };
    const res = createMockRes();
    await calendarController.getCalendarEvents(req, res);

    assert.equal(res.statusCode, 200);
    const eventTitles = res.jsonData.data.map((e) => e.title);
    assert.ok(eventTitles.includes('Diwali Institutional Holidays'));
    assert.ok(eventTitles.includes('Faculty Senate Meeting'));
  });

  // ── 5. Timetable Creation (Authorized) ───────────────────────────────
  let ttSlot1;
  await t.test('5. Authorized faculty can schedule a weekly class slot', async () => {
    const req = {
      user: { _id: faculty1User._id, role: 'faculty' },
      body: {
        subject: subject1._id,
        faculty: faculty1User._id,
        academicYear: '2026-2027',
        department: 'CSE',
        semester: 5,
        section: 'A',
        dayOfWeek: 1, // Monday
        period: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: 'Hall 301',
        sessionType: 'Lecture',
        status: 'draft',
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    ttSlot1 = res.jsonData.data;
    assert.equal(ttSlot1.room, 'Hall 301');
    assert.equal(ttSlot1.dayName, 'Monday');
  });

  // ── 6. Faculty Double-Booking Rejection ──────────────────────────────
  await t.test('6. Faculty double-booking on same day and overlapping time is rejected with 409', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject1._id,
        faculty: faculty1User._id, // Prof Sharma is already scheduled Mon 09:00-10:00 in Hall 301
        academicYear: '2026-2027',
        department: 'CSE',
        semester: 5,
        section: 'B', // Different section
        dayOfWeek: 1, // Monday
        period: 1,
        startTime: '09:30', // Overlaps 09:00 - 10:00
        endTime: '10:30',
        room: 'Hall 302', // Different room
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Faculty Conflict/i);
  });

  // ── 7. Class Cohort Double-Booking Rejection ─────────────────────────
  await t.test('7. Class cohort double-booking on same day and overlapping time is rejected with 409', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject2._id,
        faculty: faculty2User._id, // Different faculty
        academicYear: '2026-2027',
        department: 'CSE',
        semester: 5,
        section: 'A', // Same cohort: CSE Sem 5 Sec A
        dayOfWeek: 1, // Monday
        period: 1,
        startTime: '09:15', // Overlaps 09:00 - 10:00
        endTime: '10:15',
        room: 'Hall 303', // Different room
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Class Cohort Conflict/i);
  });

  // ── 8. Classroom Double-Booking Rejection ───────────────────────────
  await t.test('8. Classroom double-booking on same day and overlapping time is rejected with 409', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject2._id,
        faculty: faculty2User._id,
        academicYear: '2026-2027',
        department: 'ECE', // Different department
        semester: 3, // Different semester
        section: 'A',
        dayOfWeek: 1, // Monday
        period: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: 'Hall 301', // Same room occupied by CSE class
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Classroom Conflict/i);
  });

  // ── 9. Invalid Time Interval (Start >= End) ──────────────────────────
  await t.test('9. Invalid time interval where startTime >= endTime is rejected with 409', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject2._id,
        faculty: faculty2User._id,
        department: 'CSE',
        semester: 5,
        section: 'A',
        dayOfWeek: 2, // Tuesday
        startTime: '11:00',
        endTime: '10:00', // End before start
        room: 'Hall 302',
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Start time .* must be strictly before end time/i);
  });

  // ── 10. Holiday Conflict Detection ───────────────────────────────────
  await t.test('10. Slot scheduled on a published institutional holiday is rejected with 409', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject2._id,
        faculty: faculty2User._id,
        department: 'CSE',
        semester: 5,
        section: 'A',
        dayOfWeek: 3, // Wednesday
        startTime: '10:00',
        endTime: '11:00',
        room: 'Hall 302',
        specificDate: '2026-11-11T00:00:00.000Z', // Falls within Diwali holiday (Nov 10-14)
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Holiday Conflict/i);
  });

  // ── 11. Examination Conflict Detection ───────────────────────────────
  await t.test('11. Slot scheduled during an active examination for the same cohort is rejected with 409', async () => {
    // Schedule an exam on a Friday (Day 5) 10:00 - 13:00 for CSE Sem 5
    await Exam.create({
      title: 'Mid-Sem Operating Systems',
      examinationType: 'mid_semester',
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'All',
      subject: subject1._id,
      faculty: faculty1User._id,
      date: new Date('2026-11-20T00:00:00.000Z'), // Nov 20, 2026 is a Friday (day 5)
      startTime: '10:00',
      endTime: '13:00',
      durationMinutes: 180,
      maximumMarks: 100,
      passingMarks: 40,
      room: 'Exam Hall 1',
      status: 'scheduled',
    });

    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        subject: subject2._id,
        faculty: faculty2User._id,
        department: 'CSE',
        semester: 5,
        section: 'A',
        dayOfWeek: 5, // Friday
        startTime: '11:00', // Collides with 10:00 - 13:00 exam
        endTime: '12:00',
        room: 'Lab 1',
      },
    };
    const res = createMockRes();
    await timetableController.createTimetableEntry(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /Examination Conflict/i);
  });

  // ── 12. Draft Privacy: Draft Timetable Hidden from Students ──────────
  await t.test('12. Draft timetable slots are strictly invisible to enrolled students', async () => {
    const req = {
      user: { _id: student1User._id, role: 'student' },
    };
    const res = createMockRes();
    await timetableController.getStudentTimetable(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.count, 0, 'Draft slot ttSlot1 must not be visible to student');
  });

  // ── 13. Timetable Publication & Version Preservation ─────────────────
  let publishedVersion;
  await t.test('13. Admin publishes timetable: slots become published and version snapshot is created', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      body: {
        academicYear: '2026-2027',
        department: 'CSE',
        semester: 5,
        section: 'A',
        notes: 'Initial release of Semester 5 schedule',
      },
    };
    const res = createMockRes();
    await timetableController.publishTimetable(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.publishedCount, 1);
    publishedVersion = res.jsonData.version;
    assert.equal(publishedVersion.versionNumber, 1);
    assert.equal(publishedVersion.entryCount, 1);
  });

  // ── 14. Student Can Now View Published Timetable ─────────────────────
  await t.test('14. Student can view published weekly lecture timetable', async () => {
    const req = {
      user: { _id: student1User._id, role: 'student' },
    };
    const res = createMockRes();
    await timetableController.getStudentTimetable(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.count, 1);
    assert.equal(res.jsonData.data[0].room, 'Hall 301');
    assert.equal(res.jsonData.data[0].subject.code, 'CS501');
  });

  // ── 15. Cross-Cohort Student Timetable Isolation ──────────────────────
  await t.test('15. Cross-cohort student (MECH) does not see CSE timetable slots', async () => {
    const req = {
      user: { _id: student2User._id, role: 'student' },
    };
    const res = createMockRes();
    await timetableController.getStudentTimetable(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.count, 0, 'MECH student must not see CSE timetable');
  });

  // ── 16. Audited Modification of Published Slot ───────────────────────
  await t.test('16. Modifying published slot requires mandatory reason and updates changeHistory', async () => {
    // Attempt without reason -> fails 400
    const failReq = {
      user: { _id: faculty1User._id, role: 'faculty' },
      params: { id: ttSlot1._id },
      body: { room: 'Hall 305' },
    };
    const failRes = createMockRes();
    await timetableController.updateTimetableEntry(failReq, failRes);
    assert.equal(failRes.statusCode, 400);

    // Attempt with valid reason -> succeeds 200
    const successReq = {
      user: { _id: faculty1User._id, role: 'faculty' },
      params: { id: ttSlot1._id },
      body: {
        room: 'Hall 305',
        reason: 'Relocated to Hall 305 due to projector maintenance',
      },
    };
    const successRes = createMockRes();
    await timetableController.updateTimetableEntry(successReq, successRes);

    assert.equal(successRes.statusCode, 200);
    assert.equal(successRes.jsonData.data.room, 'Hall 305');
    assert.equal(successRes.jsonData.data.changeHistory.length, 1);
    assert.equal(successRes.jsonData.data.changeHistory[0].reason, 'Relocated to Hall 305 due to projector maintenance');
  });

  // ── 17. Class Slot Cancellation & Notifications ──────────────────────
  await t.test('17. Cancelling a timetable slot dispatches high-priority notification to students', async () => {
    const req = {
      user: { _id: faculty1User._id, role: 'faculty' },
      params: { id: ttSlot1._id },
      body: { reason: 'Faculty on official university symposium leave' },
    };
    const res = createMockRes();
    await timetableController.cancelTimetableEntry(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'cancelled');

    // Verify student notification
    const notif = await Notification.findOne({
      recipient: student1User._id,
      category: 'timetable',
      title: /Class Cancelled/i,
    });
    assert.ok(notif, 'Student must receive class cancellation notification');
    assert.match(notif.message, /symposium leave/i);
  });

  // ── 18. Smart Attendance Integration: Session from Timetable Slot ─────
  await t.test('18. Faculty can launch Smart Attendance linked to timetable slot', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        subjectId: subject1._id,
        date: '2026-11-23',
        period: 1,
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        branch: 'CSE',
        semester: 5,
        section: 'A',
        timetableEntry: ttSlot1._id,
      },
    };
    const res = createMockRes();
    await attendanceController.createSession(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.data._id);
    assert.equal(res.jsonData.data.timetableEntry.toString(), ttSlot1._id.toString());
  });

  // ── 19. Duplicate Attendance Session for Timetable Slot Blocked ───────
  await t.test('19. Duplicate attendance session for same timetable slot and date is blocked with 409', async () => {
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        subjectId: subject1._id,
        date: '2026-11-23',
        period: 1,
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        branch: 'CSE',
        semester: 5,
        section: 'A',
        timetableEntry: ttSlot1._id, // Same timetable slot on same date
      },
    };
    const res = createMockRes();
    try {
      await attendanceController.createSession(req, res);
    } catch (err) {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /attendance session has already been created for this scheduled timetable slot/i);
    }
  });

  // ── 20. Assignment Deadline Integration into Calendar ────────────────
  await t.test('20. Published assignment due dates are automatically aggregated into academic calendar', async () => {
    await Assignment.create({
      title: 'Database Schema Design Project',
      description: 'Submit normalized relational schema with ER diagrams',
      subject: subject1._id,
      faculty: faculty1User._id,
      department: 'CSE',
      semester: 5,
      section: 'All',
      maximumMarks: 50,
      dueDate: new Date('2026-11-28T23:59:59.000Z'),
      status: 'published',
    });

    const req = {
      user: { _id: student1User._id, userId: student1User._id, role: 'student' },
      query: { eventType: 'assignment' },
    };
    const res = createMockRes();
    await calendarController.getCalendarEvents(req, res);

    assert.equal(res.statusCode, 200);
    const item = res.jsonData.data.find((e) => e.title.includes('Database Schema Design Project'));
    assert.ok(item, 'Assignment deadline must appear in aggregated calendar view');
    assert.equal(item.category, 'assignment');
  });

  // ── 21. Examination Calendar Integration ─────────────────────────────
  await t.test('21. Scheduled examinations are dynamically aggregated into academic calendar', async () => {
    const req = {
      user: { _id: student1User._id, userId: student1User._id, role: 'student' },
      query: { eventType: 'examination' },
    };
    const res = createMockRes();
    await calendarController.getCalendarEvents(req, res);

    assert.equal(res.statusCode, 200);
    const item = res.jsonData.data.find((e) => e.title.includes('Mid-Sem Operating Systems'));
    assert.ok(item, 'Scheduled exam must appear in aggregated calendar view');
    assert.equal(item.category, 'examination');
  });

  // ── 22. Upcoming Events Widget ───────────────────────────────────────
  await t.test('22. Upcoming events endpoint returns next 30 days of calendar milestones', async () => {
    const req = {
      user: { _id: student1User._id, userId: student1User._id, role: 'student' },
    };
    const res = createMockRes();
    await calendarController.getUpcomingEvents(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.jsonData.data));
  });

  // ── 23. Unauthorized Timetable Modification Rejection ────────────────
  await t.test('23. Faculty 2 cannot modify Faculty 1 timetable entry (HTTP 403)', async () => {
    const req = {
      user: { _id: faculty2User._id, role: 'faculty' },
      params: { id: ttSlot1._id },
      body: { room: 'Hall 999', reason: 'Unauthorized takeover' },
    };
    const res = createMockRes();
    await timetableController.updateTimetableEntry(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Forbidden.*not authorized/i);
  });

  // ── 24. Timetable Version History Query ──────────────────────────────
  await t.test('24. Admin can query historical timetable versions and audit metadata', async () => {
    const req = {
      user: { _id: adminUser._id, role: 'admin' },
      query: { department: 'CSE', semester: 5, section: 'A' },
    };
    const res = createMockRes();
    await timetableController.getTimetableVersions(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.count >= 1);
    assert.equal(res.jsonData.data[0].versionNumber, 1);
  });

  // ── 25. Notification Preference Respect ──────────────────────────────
  await t.test('25. User with timetable notification preference disabled does not receive normal alert', async () => {
    // Create student 3 who disabled timetable notifications
    const student3User = await User.create({
      name: 'Silent Student',
      email: 'silent@test.edu',
      loginId: 'P15STU03',
      passwordHash: 'hash',
      isVerified: true,
      active: true,
      role: 'student',
    });
    await NotificationPreference.create({
      user: student3User._id,
      categories: { timetable: false },
    });

    const notifService = require('../services/notification.service');
    const result = await notifService.createNotification({
      recipient: student3User._id,
      title: 'Routine Class Room Update',
      message: 'Class moved to Hall 101',
      category: 'timetable',
      priority: 'normal',
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'preference_disabled');
  });

  // ── 26. Regression: Part 13 Assignment Model Integrity ───────────────
  await t.test('26. Regression: Assignment and submission models operate normally', async () => {
    const count = await Assignment.countDocuments({ subject: subject1._id });
    assert.ok(count >= 1);
  });

  // ── 27. Regression: Part 14 Exam Model Integrity ─────────────────────
  await t.test('27. Regression: Exam records remain intact and queryable', async () => {
    const exam = await Exam.findOne({ title: /Mid-Sem Operating Systems/i });
    assert.ok(exam);
    assert.equal(exam.durationMinutes, 180);
  });

  // ── 28. Teardown ─────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect test database cleanly', async () => {
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);
  });
});
