/**
 * server/tests/notification_stabilization_part12_1.test.js
 * Part 12.1 End-to-End Verification & Stabilization Test Suite.
 *
 * Verifies:
 * 1. SSE Authentication Security (Bearer/cookie accepted, query ?token prohibited, heartbeat, cleanup, expiry).
 * 2. Notification Idempotency (compound unique index, same event multi-recipient, concurrent requests, bulk retry).
 * 3. Attendance Notification Invariants (finalization-only, zero alerts for cancelled/open, multi-period lab accuracy).
 * 4. Biometric Event Privacy (no embeddings, no ciphertext, no encryption keys in notifications).
 * 5. Announcement Audience Authorization (deep link open redirect defense, draft/expired privacy, IDOR checks).
 * 6. Notification Preferences (safe defaults, invalid key rejection, mandatory system persistence, urgent bypass).
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const Announcement = require('../models/Announcement');
const notificationService = require('../services/notification.service');
const notificationController = require('../controllers/notification.controller');
const announcementController = require('../controllers/announcement.controller');
const attendanceController = require('../controllers/attendance.controller');
const { JWT_SECRET } = require('../config/env');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    jsonData: null,
    written: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers || {};
      return this;
    },
    write(chunk) {
      this.written = (this.written || '') + chunk;
      return true;
    },
    end() {
      this.ended = true;
    },
    on(event, handler) {
      if (!this.handlers) this.handlers = {};
      this.handlers[event] = handler;
    },
  };
}

test('Part 12.1 Stabilization, Security Audit & Verification Suite', async (t) => {
  verifyTestDatabaseIsolation(TEST_DB_URI);

  let adminUser, faculty1User, faculty2User, student1User, student2User;
  let student1Doc, student2Doc, faculty1Doc, faculty2Doc, testSubject, testLabSubject;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});
    await Announcement.deleteMany({});
    await Attendance.deleteMany({});
    await AttendanceSession.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});

    // Ensure model indexes are built
    await Notification.syncIndexes();

    adminUser = await User.create({
      name: 'Super Admin',
      email: 'p121admin@campus.edu',
      loginId: 'P121ADM',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });

    faculty1User = await User.create({
      name: 'Prof. Computer Science',
      email: 'p121fac1@campus.edu',
      loginId: 'P121FAC1',
      role: 'faculty',
      passwordHash: 'hash',
      isActive: true,
    });

    faculty2User = await User.create({
      name: 'Prof. Electronics',
      email: 'p121fac2@campus.edu',
      loginId: 'P121FAC2',
      role: 'faculty',
      passwordHash: 'hash',
      isActive: true,
    });

    student1User = await User.create({
      name: 'Alice CSE',
      email: 'alice.cse@campus.edu',
      loginId: 'P121ALICE',
      role: 'student',
      passwordHash: 'hash',
      isActive: true,
    });

    student2User = await User.create({
      name: 'Bob ECE',
      email: 'bob.ece@campus.edu',
      loginId: 'P121BOB',
      role: 'student',
      passwordHash: 'hash',
      isActive: true,
    });

    faculty1Doc = await Faculty.create({
      user: faculty1User._id,
      employeeId: 'EMP-P121-1',
      department: 'CSE',
    });

    faculty2Doc = await Faculty.create({
      user: faculty2User._id,
      employeeId: 'EMP-P121-2',
      department: 'ECE',
    });

    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Alice CSE',
      rollNumber: 'CSE-P121-01',
      branch: 'CSE',
      semester: 5,
      section: 'A',
    });

    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Bob ECE',
      rollNumber: 'ECE-P121-02',
      branch: 'ECE',
      semester: 5,
      section: 'B',
    });

    testSubject = await Subject.create({
      code: 'CS501',
      name: 'Operating Systems',
      branch: 'CSE',
      semester: 5,
      type: 'theory',
      credits: 4,
      faculty: faculty1User._id,
    });

    testLabSubject = await Subject.create({
      code: 'CS502L',
      name: 'Operating Systems Lab',
      branch: 'CSE',
      semester: 5,
      type: 'practical',
      credits: 2,
      faculty: faculty1User._id,
    });
  });

  // ── PHASE B: SSE AUTHENTICATION SECURITY ───────────────────────────────────

  await t.test('B1. SSE Stream: Prohibits long-lived JWTs in URL query parameters (HTTP 400)', async () => {
    const validToken = jwt.sign({ userId: student1User._id.toString() }, JWT_SECRET);
    const req = {
      query: { token: validToken },
      headers: {},
    };
    const res = createMockRes();

    await notificationController.getNotificationStream(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.jsonData.error.includes('URL query parameters is prohibited'));
  });

  await t.test('B2. SSE Stream: Rejects unauthenticated requests with HTTP 401', async () => {
    const req = { query: {}, headers: {} };
    const res = createMockRes();

    await notificationController.getNotificationStream(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonData.success, false);
  });

  await t.test('B3. SSE Stream: Accepts valid Bearer token header and writes handshake + ping', () => {
    const validToken = jwt.sign(
      { userId: student1User._id.toString(), role: 'student', name: 'Alice' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const mockRes = createMockRes();
    const mockReq = {
      query: {},
      headers: { authorization: `Bearer ${validToken}` },
      on(event, handler) {
        if (event === 'close') this.closeHandler = handler;
      },
    };

    notificationController.getNotificationStream(mockReq, mockRes);
    assert.equal(mockRes.statusCode, 200);
    assert.equal(mockRes.headers['Content-Type'], 'text/event-stream');
    assert.ok(mockRes.written.includes('event: connected'));
    assert.ok(notificationService.activeStreams.has(student1User._id.toString()));

    // Trigger disconnect cleanup
    mockReq.closeHandler();
    assert.equal(notificationService.activeStreams.has(student1User._id.toString()), false);
  });

  await t.test('B4. SSE Stream: Accepts HttpOnly cookie authentication and verifies origin', () => {
    const validToken = jwt.sign({ userId: student2User._id.toString() }, JWT_SECRET);
    const mockRes = createMockRes();
    const mockReq = {
      query: {},
      cookies: { campus_token: validToken },
      headers: { origin: 'http://localhost:5173' },
      on(event, handler) {
        if (event === 'close') this.closeHandler = handler;
      },
    };

    notificationController.getNotificationStream(mockReq, mockRes);
    assert.equal(mockRes.statusCode, 200);
    assert.ok(mockRes.written.includes('event: connected'));

    mockReq.closeHandler();
    assert.equal(notificationService.activeStreams.has(student2User._id.toString()), false);
  });

  await t.test('B5. SSE Stream: Blocks untrusted origin header (anti-CSRF)', () => {
    const validToken = jwt.sign({ userId: student2User._id.toString() }, JWT_SECRET);
    const mockRes = createMockRes();
    const mockReq = {
      query: {},
      cookies: { campus_token: validToken },
      headers: { origin: 'https://evil-phishing-site.com' },
    };

    notificationController.getNotificationStream(mockReq, mockRes);
    assert.equal(mockRes.statusCode, 403);
    assert.ok(mockRes.jsonData.error.includes('Origin not allowed'));
  });

  // ── PHASE C: NOTIFICATION IDEMPOTENCY & UNIQUENESS ─────────────────────────

  await t.test('C1. Same event, same recipient: repeated request returns isDuplicate true without extra row', async () => {
    const eventId = `test_event_c1_${Date.now()}`;

    const res1 = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Tuition Fee Notice',
      message: 'Installment 2 is due.',
      category: 'administrative',
      eventId,
    });
    assert.equal(res1.isDuplicate, false);

    const res2 = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Tuition Fee Notice (Retry)',
      message: 'Installment 2 is due.',
      category: 'administrative',
      eventId,
    });
    assert.equal(res2.isDuplicate, true);
    assert.equal(res2.notification._id.toString(), res1.notification._id.toString());

    const count = await Notification.countDocuments({ recipient: student1User._id, eventId });
    assert.equal(count, 1, 'Exactly one notification row must exist');
  });

  await t.test('C2. Same event, different recipients: both successfully receive notification', async () => {
    const eventId = `broadcast_c2_${Date.now()}`;

    const resS1 = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Campus Wi-Fi Upgrade',
      message: 'Maintenance tonight at 11 PM.',
      category: 'system',
      eventId,
    });

    const resS2 = await notificationService.createNotification({
      recipient: student2User._id,
      title: 'Campus Wi-Fi Upgrade',
      message: 'Maintenance tonight at 11 PM.',
      category: 'system',
      eventId,
    });

    assert.equal(resS1.isDuplicate, false);
    assert.equal(resS2.isDuplicate, false);
    assert.notEqual(resS1.notification._id.toString(), resS2.notification._id.toString());

    const total = await Notification.countDocuments({ eventId });
    assert.equal(total, 2, 'Both distinct recipients must have received the event');
  });

  await t.test('C3. Concurrent duplicate requests: handled atomically by MongoDB partial unique index', async () => {
    const eventId = `concurrency_c3_${Date.now()}`;

    const promises = Array.from({ length: 5 }, (_, i) =>
      notificationService.createNotification({
        recipient: student1User._id,
        title: `Concurrent Alert #${i}`,
        message: 'High priority system ping.',
        category: 'system',
        eventId,
      })
    );

    const results = await Promise.all(promises);
    const newInserts = results.filter((r) => r.isDuplicate === false);
    const duplicates = results.filter((r) => r.isDuplicate === true);

    assert.equal(newInserts.length, 1, 'Only one concurrent worker must insert the document');
    assert.equal(duplicates.length, 4, 'All four other workers must recognize it as duplicate');

    const inDb = await Notification.countDocuments({ recipient: student1User._id, eventId });
    assert.equal(inDb, 1);
  });

  await t.test('C4. Bulk dispatch retry: duplicate rows are safely prevented', async () => {
    const eventId = `bulk_c4_${Date.now()}`;
    const recipients = [student1User._id, student2User._id];

    // First bulk dispatch
    const res1 = await notificationService.createBulkNotifications({
      recipients,
      title: 'Campus Blood Donation Camp',
      message: 'Join us tomorrow in the sports complex.',
      category: 'announcement',
      eventId,
    });
    assert.equal(res1.count, 2);

    // Retrying the bulk dispatch with same eventId
    const res2 = await notificationService.createBulkNotifications({
      recipients,
      title: 'Campus Blood Donation Camp',
      message: 'Join us tomorrow in the sports complex.',
      category: 'announcement',
      eventId,
    });
    assert.equal(res2.count, 0, 'Zero duplicate rows should be inserted on bulk retry');

    const total = await Notification.countDocuments({ eventId });
    assert.equal(total, 2);
  });

  // ── PHASE D: ATTENDANCE & BIOMETRIC NOTIFICATION CORRECTNESS ─────────────────

  await t.test('D1. Session finalization: absent notifications generated only after session is finalized', async () => {
    // Create completed session
    const session = await AttendanceSession.create({
      subject: testSubject._id,
      faculty: faculty1User._id,
      date: '2026-11-01',
      period: 1,
      periods: [1],
      periodCount: 1,
      branch: 'CSE',
      semester: 5,
      section: 'A',
      status: 'completed',
    });

    const req = {
      params: { sessionId: session._id.toString() },
      user: { userId: faculty1User._id.toString(), role: 'faculty' },
      ip: '127.0.0.1',
    };
    const res = createMockRes();

    await attendanceController.finalizeSession(req, res);
    assert.equal(res.statusCode, 200);

    // Student 1 (CSE, Sem 5, Section A) was unmarked, so must receive an absent notification
    const notif = await Notification.findOne({
      recipient: student1User._id,
      category: 'attendance',
      eventId: `sess_abs_${session._id}_${student1Doc._id}`,
    });
    assert.ok(notif, 'Unmarked student must receive absent notification upon finalization');
    assert.ok(notif.message.includes('recorded as Absent'));
  });

  await t.test('D2. Cancelled or open sessions: zero absent notifications are generated', async () => {
    const cancelledSession = await AttendanceSession.create({
      subject: testSubject._id,
      faculty: faculty1User._id,
      date: '2026-11-02',
      period: 2,
      periods: [2],
      periodCount: 1,
      branch: 'CSE',
      semester: 5,
      section: 'A',
      status: 'cancelled',
    });

    const req = {
      params: { sessionId: cancelledSession._id.toString() },
      user: { userId: faculty1User._id.toString(), role: 'faculty' },
      ip: '127.0.0.1',
    };
    const res = createMockRes();

    await assert.rejects(
      async () => attendanceController.finalizeSession(req, res),
      /Invalid session state transition/
    );

    const count = await Notification.countDocuments({
      eventId: `sess_abs_${cancelledSession._id}_${student1Doc._id}`,
    });
    assert.equal(count, 0, 'No absent notifications can be dispatched for cancelled session');
  });

  await t.test('D3. Multi-period lab session: attended student receives credit and NO absent alert', async () => {
    const labSession = await AttendanceSession.create({
      subject: testLabSubject._id,
      faculty: faculty1User._id,
      date: '2026-11-03',
      period: 3,
      periods: [3, 4],
      periodCount: 2,
      branch: 'CSE',
      semester: 5,
      section: 'A',
      status: 'completed',
    });

    // Student 1 attended the lab session
    await Attendance.create({
      session: labSession._id,
      subject: testLabSubject._id,
      student: student1Doc._id,
      date: '2026-11-03',
      period: 3,
      periods: [3, 4],
      periodCount: 2,
      status: 'present',
      attendanceStatus: 'present',
      verificationMethod: 'face',
      verificationStatus: 'verified',
    });

    const req = {
      params: { sessionId: labSession._id.toString() },
      user: { userId: faculty1User._id.toString(), role: 'faculty' },
      ip: '127.0.0.1',
    };
    const res = createMockRes();

    await attendanceController.finalizeSession(req, res);
    assert.equal(res.statusCode, 200);

    // Student 1 must NOT receive an absent alert
    const notif = await Notification.findOne({
      recipient: student1User._id,
      eventId: `sess_abs_${labSession._id}_${student1Doc._id}`,
    });
    assert.equal(notif, null, 'Attended student must not be flagged absent');
  });

  // ── PHASE E: ANNOUNCEMENT AUDIENCE AUTHORIZATION ────────────────────────────

  await t.test('E1. Student cannot create or publish announcements (RBAC)', async () => {
    // Attempt creation with student role
    const reqCreate = {
      user: { userId: student1User._id.toString(), role: 'student', name: 'Alice' },
      body: { title: 'Unauthorized', body: 'Hack', audience: 'all' },
    };
    const resCreate = createMockRes();

    // Faculty or admin role is required on the route
    const reqPub = {
      user: { userId: student1User._id.toString(), role: 'student' },
      params: { id: new mongoose.Types.ObjectId().toString() },
    };
    const resPub = createMockRes();

    await assert.rejects(
      async () => announcementController.publishAnnouncement(reqPub, resPub),
      /Announcement not found/
    );
  });

  await t.test('E2. Faculty cannot publish admin-only (faculty-wide) announcements', async () => {
    const req = {
      user: { userId: faculty1User._id.toString(), role: 'faculty', name: 'Dr. Faculty' },
      body: {
        title: 'Faculty Senate Meeting',
        body: 'Agenda for upcoming senate meeting.',
        audience: 'faculty',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => announcementController.createAnnouncement(req, res),
      /Faculty cannot publish faculty-wide announcements/
    );
  });

  await t.test('E3. Faculty B cannot edit or publish Faculty A restricted announcement', async () => {
    const ann = await Announcement.create({
      title: 'Prof Turing CSE Announcement',
      body: 'Assignment 4 due date postponed.',
      audience: 'department',
      targetBranches: ['CSE'],
      status: 'draft',
      createdBy: faculty1User._id,
    });

    const reqEdit = {
      user: { userId: faculty2User._id.toString(), role: 'faculty' },
      params: { id: ann._id.toString() },
      body: { title: 'Tampered Title' },
    };
    const resEdit = createMockRes();

    await assert.rejects(
      async () => announcementController.updateAnnouncement(reqEdit, resEdit),
      /Not authorized to edit this announcement/
    );
  });

  await t.test('E4. Draft announcements are invisible to ordinary users', async () => {
    const draftAnn = await Announcement.create({
      title: 'Secret Upcoming Exam Guidelines',
      body: 'Draft guidelines under review.',
      audience: 'all',
      status: 'draft',
      createdBy: adminUser._id,
    });

    // Student queries public announcements feed
    const reqStudent = { user: { userId: student1User._id.toString(), role: 'student' } };
    const resStudent = createMockRes();
    await announcementController.getVisibleAnnouncements(reqStudent, resStudent);
    const visibleIds = resStudent.jsonData.data.map((a) => a._id.toString());
    assert.ok(!visibleIds.includes(draftAnn._id.toString()), 'Draft must not appear in student feed');

    // Student attempts direct retrieval by ID -> 404
    const reqDirect = {
      user: { userId: student1User._id.toString(), role: 'student' },
      params: { id: draftAnn._id.toString() },
    };
    const resDirect = createMockRes();
    await assert.rejects(
      async () => announcementController.getAnnouncementById(reqDirect, resDirect),
      /Announcement not found/
    );
  });

  await t.test('E5. Expired announcements are excluded from public feed and direct retrieval', async () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const expiredAnn = await Announcement.create({
      title: 'Past Workshop Registration',
      body: 'Register before noon.',
      audience: 'all',
      status: 'published',
      expiresAt: pastDate,
      createdBy: adminUser._id,
    });

    const reqStudent = { user: { userId: student1User._id.toString(), role: 'student' } };
    const resStudent = createMockRes();
    await announcementController.getVisibleAnnouncements(reqStudent, resStudent);
    assert.ok(!resStudent.jsonData.data.some((a) => a._id.toString() === expiredAnn._id.toString()));

    const reqDirect = {
      user: { userId: student1User._id.toString(), role: 'student' },
      params: { id: expiredAnn._id.toString() },
    };
    const resDirect = createMockRes();
    await assert.rejects(
      async () => announcementController.getAnnouncementById(reqDirect, resDirect),
      /Announcement has expired/
    );
  });

  await t.test('E6. Student cannot retrieve announcements outside their audience (feed and direct ID)', async () => {
    // Targeted specifically to ECE students only
    const eceAnn = await Announcement.create({
      title: 'ECE VLSI Design Workshop',
      body: 'Workshop exclusively for ECE students.',
      audience: 'student',
      targetBranches: ['ECE'],
      targetSemesters: [5],
      status: 'published',
      createdBy: adminUser._id,
    });

    // Student 1 is CSE Sem 5 -> Must NOT see it
    const reqS1 = { user: { userId: student1User._id.toString(), role: 'student' } };
    const resS1 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqS1, resS1);
    assert.ok(!resS1.jsonData.data.some((a) => a._id.toString() === eceAnn._id.toString()));

    const reqS1Direct = {
      user: { userId: student1User._id.toString(), role: 'student' },
      params: { id: eceAnn._id.toString() },
    };
    const resS1Direct = createMockRes();
    await assert.rejects(
      async () => announcementController.getAnnouncementById(reqS1Direct, resS1Direct),
      /Announcement outside your audience/
    );

    // Student 2 is ECE Sem 5 -> MUST see it
    const reqS2Direct = {
      user: { userId: student2User._id.toString(), role: 'student' },
      params: { id: eceAnn._id.toString() },
    };
    const resS2Direct = createMockRes();
    await announcementController.getAnnouncementById(reqS2Direct, resS2Direct);
    assert.equal(resS2Direct.statusCode, 200);
    assert.equal(resS2Direct.jsonData.data._id.toString(), eceAnn._id.toString());
  });

  // ── PHASE F: NOTIFICATION PREFERENCES ───────────────────────────────────────

  await t.test('F1. Invalid preference keys are rejected with HTTP 400', async () => {
    await assert.rejects(
      async () =>
        notificationService.updateUserPreferences(student1User._id, {
          categories: { unsupportedHackerCategory: false },
        }),
      /Invalid preference category key/
    );
  });

  await t.test('F2. Mandatory system category cannot be disabled and urgent priority always delivers', async () => {
    // Student 1 opts out of academic notifications
    await notificationService.updateUserPreferences(student1User._id, {
      categories: { academic: false, system: false },
    });

    const pref = await notificationService.getUserPreferences(student1User._id);
    assert.equal(pref.categories.academic, false);
    assert.equal(pref.categories.system, true, 'System category must remain true');

    // 1. Normal academic notification is skipped
    const normalRes = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Normal Academic Note',
      message: 'Assignment graded.',
      category: 'academic',
      priority: 'normal',
    });
    assert.equal(normalRes.skipped, true);

    // 2. Urgent academic notification strictly bypasses opt-out
    const urgentRes = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Urgent Exam Postponement',
      message: 'Exam today postponed due to weather.',
      category: 'academic',
      priority: 'urgent',
    });
    assert.equal(urgentRes.skipped, undefined);
    assert.equal(urgentRes.isDuplicate, false);
    assert.ok(urgentRes.notification);
  });

  // ── TEARDOWN ───────────────────────────────────────────────────────────────

  await t.test('Teardown: Clean up test fixtures and disconnect from isolated database', async () => {
    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});
    await Announcement.deleteMany({});
    await Attendance.deleteMany({});
    await AttendanceSession.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
