/**
 * server/tests/notification_and_announcements.test.js
 * Comprehensive Automated Test Suite for Part 12:
 * Centralized Notification Engine, Campus Announcements & Real-Time Communication.
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
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const Announcement = require('../models/Announcement');
const notificationService = require('../services/notification.service');
const notificationController = require('../controllers/notification.controller');
const announcementController = require('../controllers/announcement.controller');

// Mock Express response helper
function createMockRes() {
  const res = {
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
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    write(chunk) {
      this.written = (this.written || '') + chunk;
      return true;
    },
  };
  return res;
}

test('Part 12 Centralized Notification & Announcement Test Suite', async (t) => {
  verifyTestDatabaseIsolation(TEST_DB_URI);

  let adminUser, facultyUser, student1User, student2User;
  let student1Doc, student2Doc, facultyDoc, testSubject;

  await t.test('Setup: Connect & seed test fixtures in isolated database', async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    // Clean test collections
    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});
    await Announcement.deleteMany({});
    await Attendance.deleteMany({});
    await AttendanceSession.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});

    // Create users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'p12admin@campus.edu',
      loginId: 'P12ADMIN',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });

    facultyUser = await User.create({
      name: 'Dr. Alan Turing',
      email: 'p12faculty@campus.edu',
      loginId: 'P12FAC',
      role: 'faculty',
      passwordHash: 'hash',
      isActive: true,
    });

    student1User = await User.create({
      name: 'Alice Student',
      email: 'p12alice@campus.edu',
      loginId: 'P12STU1',
      role: 'student',
      passwordHash: 'hash',
      isActive: true,
    });

    student2User = await User.create({
      name: 'Bob Student',
      email: 'p12bob@campus.edu',
      loginId: 'P12STU2',
      role: 'student',
      passwordHash: 'hash',
      isActive: true,
    });

    facultyDoc = await Faculty.create({
      user: facultyUser._id,
      employeeId: 'P12FAC',
      department: 'CSE',
      designation: 'Professor',
    });

    student1Doc = await Student.create({
      user: student1User._id,
      rollNumber: 'P12STU1',
      fullName: 'Alice Student',
      branch: 'CSE',
      semester: 6,
      section: 'A',
    });

    student2Doc = await Student.create({
      user: student2User._id,
      rollNumber: 'P12STU2',
      fullName: 'Bob Student',
      branch: 'ECE',
      semester: 4,
      section: 'B',
    });

    testSubject = await Subject.create({
      name: 'Distributed Systems',
      code: 'CS602',
      department: 'CSE',
      branch: 'CSE',
      semester: 6,
      credits: 4,
      faculty: facultyDoc._id,
    });
  });

  // ── 1. Notification Model & Invariants ───────────────────────────────────────
  await t.test('1. Notification model enforces required fields and valid enums', async () => {
    // Missing title -> reject
    await assert.rejects(
      Notification.create({ recipient: student1User._id, message: 'Only msg' }),
      /Notification title is required/
    );

    // Missing recipient -> reject
    await assert.rejects(
      Notification.create({ title: 'Test', message: 'No recipient' }),
      /Recipient user is required/
    );

    // Valid creation
    const notif = await Notification.create({
      recipient: student1User._id,
      title: 'Lab Schedule Released',
      message: 'Your OS lab has been scheduled for Friday.',
      category: 'academic',
      priority: 'high',
      targetRoute: '/student/attendance',
    });

    assert.ok(notif._id);
    assert.equal(notif.isRead, false);
    assert.equal(notif.readAt, null);
    assert.equal(notif.category, 'academic');
    assert.equal(notif.priority, 'high');
  });

  // ── 2. Notification Service Engine & Idempotency ────────────────────────────
  await t.test('2. Notification service prevents duplicate delivery via eventId', async () => {
    const eventId = `test_event_${Date.now()}`;

    const res1 = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Attendance Warning',
      message: 'Your attendance in CS602 is 72%.',
      category: 'attendance',
      priority: 'high',
      eventId,
    });

    assert.equal(res1.isDuplicate, false);
    assert.ok(res1.notification._id);

    // Second call with same eventId must return isDuplicate: true without inserting another document
    const res2 = await notificationService.createNotification({
      recipient: student1User._id,
      title: 'Attendance Warning',
      message: 'Your attendance in CS602 is 72%.',
      category: 'attendance',
      priority: 'high',
      eventId,
    });

    assert.equal(res2.isDuplicate, true);
    assert.equal(res2.notification._id.toString(), res1.notification._id.toString());

    // Total in database should remain 1 for this eventId
    const count = await Notification.countDocuments({ recipient: student1User._id, eventId });
    assert.equal(count, 1);
  });

  await t.test('3. Bulk notification creation dispatches to all targeted recipients', async () => {
    const recipients = [student1User._id, student2User._id];
    const bulkRes = await notificationService.createBulkNotifications({
      recipients,
      title: 'Campus Hackathon Announcement',
      message: 'Registration is now open for Annual CampusSphere Hackathon.',
      category: 'announcement',
      priority: 'normal',
      eventIdPrefix: `hackathon_${Date.now()}`,
    });

    assert.equal(bulkRes.count, 2);
    assert.equal(bulkRes.recipientCount, 2);

    const s1Notifs = await Notification.find({ recipient: student1User._id, category: 'announcement' });
    const s2Notifs = await Notification.find({ recipient: student2User._id, category: 'announcement' });
    assert.equal(s1Notifs.length, 1);
    assert.equal(s2Notifs.length, 1);
  });

  // ── 3. Notification Preferences & Opt-Out Invariants ────────────────────────
  await t.test('4. Notification service respects category opt-out preferences', async () => {
    // Student 2 opts out of assignment notifications
    await notificationService.updateUserPreferences(student2User._id, {
      categories: { assignment: false },
    });

    const pref = await notificationService.getUserPreferences(student2User._id);
    assert.equal(pref.categories.assignment, false);

    // Normal priority assignment notification should be skipped
    const skippedRes = await notificationService.createNotification({
      recipient: student2User._id,
      title: 'Assignment 3 Uploaded',
      message: 'Submit by Monday.',
      category: 'assignment',
      priority: 'normal',
    });

    assert.equal(skippedRes.skipped, true);
    assert.equal(skippedRes.reason, 'preference_disabled');

    // Urgent priority overrides preference opt-out
    const urgentRes = await notificationService.createNotification({
      recipient: student2User._id,
      title: 'Urgent: Assignment Deadline Extended',
      message: 'Server issues; deadline extended 24h.',
      category: 'assignment',
      priority: 'urgent',
    });

    assert.equal(urgentRes.isDuplicate, false);
    assert.ok(urgentRes.notification);

    // System notifications can never be disabled
    await notificationService.updateUserPreferences(student2User._id, {
      categories: { system: false },
    });
    const updatedPref = await notificationService.getUserPreferences(student2User._id);
    assert.equal(updatedPref.categories.system, true, 'System category must remain mandatory');
  });

  // ── 4. Controller Handlers & Read/Unread State ───────────────────────────────
  await t.test('5. User cannot access or mutate another users notifications', async () => {
    // Create private notification for Student 1
    const pvtNotif = await Notification.create({
      recipient: student1User._id,
      title: 'Private Grievance Response',
      message: 'Your complaint has been reviewed.',
      category: 'administrative',
    });

    // Student 2 queries their own notifications via controller
    const reqS2 = { user: { userId: student2User._id.toString(), role: 'student' }, query: {} };
    const resS2 = createMockRes();
    await notificationController.getNotifications(reqS2, resS2);

    assert.equal(resS2.statusCode, 200);
    const ids = resS2.jsonData.data.map((n) => n._id.toString());
    assert.ok(!ids.includes(pvtNotif._id.toString()), 'Student 2 must not see Student 1 notification');

    // Student 2 attempts to mark Student 1 notification as read -> rejected
    const reqPatch = { user: { userId: student2User._id.toString(), role: 'student' }, params: { id: pvtNotif._id.toString() } };
    const resPatch = createMockRes();
    await assert.rejects(
      async () => notificationController.markAsRead(reqPatch, resPatch),
      /Notification not found or access denied/
    );

    // Student 2 attempts to delete Student 1 notification -> rejected
    const reqDel = { user: { userId: student2User._id.toString(), role: 'student' }, params: { id: pvtNotif._id.toString() } };
    const resDel = createMockRes();
    await assert.rejects(
      async () => notificationController.deleteNotification(reqDel, resDel),
      /Notification not found or access denied/
    );
  });

  await t.test('6. Mark as read, unread, and mark all as read update unread count accurately', async () => {
    // Clear notifications for Student 1 and create 3 unread
    await Notification.deleteMany({ recipient: student1User._id });

    const n1 = await Notification.create({ recipient: student1User._id, title: 'N1', message: 'M1', category: 'academic' });
    const n2 = await Notification.create({ recipient: student1User._id, title: 'N2', message: 'M2', category: 'attendance' });
    const n3 = await Notification.create({ recipient: student1User._id, title: 'N3', message: 'M3', category: 'announcement' });

    // Initial unread count should be 3
    let unreadCount = await notificationService.getUnreadCount(student1User._id);
    assert.equal(unreadCount, 3);

    // Mark N1 as read via service
    await notificationService.markAsRead(student1User._id, n1._id);
    unreadCount = await notificationService.getUnreadCount(student1User._id);
    assert.equal(unreadCount, 2);

    // Mark N1 back to unread
    await notificationService.markAsUnread(student1User._id, n1._id);
    unreadCount = await notificationService.getUnreadCount(student1User._id);
    assert.equal(unreadCount, 3);

    // Mark all as read via controller
    const reqAll = { user: { userId: student1User._id.toString(), role: 'student' }, body: {} };
    const resAll = createMockRes();
    await notificationController.markAllAsRead(reqAll, resAll);
    assert.equal(resAll.statusCode, 200);

    unreadCount = await notificationService.getUnreadCount(student1User._id);
    assert.equal(unreadCount, 0);
  });

  // ── 5. Announcements & Audience Scoping ──────────────────────────────────────
  await t.test('7. Admin can create, publish, and archive announcements', async () => {
    // 1. Create Draft
    const reqCreate = {
      user: { userId: adminUser._id.toString(), name: 'Admin', role: 'admin' },
      body: {
        title: 'Midterm Examination Schedule 2026',
        body: 'Exams begin from May 15. Please check hall allocations.',
        category: 'academic',
        priority: 'high',
        audience: 'all',
        status: 'draft',
      },
    };
    const resCreate = createMockRes();
    await announcementController.createAnnouncement(reqCreate, resCreate);
    assert.equal(resCreate.statusCode, 201);
    const annId = resCreate.jsonData.data._id;
    assert.equal(resCreate.jsonData.data.status, 'draft');

    // Draft should NOT be visible in student public feed
    const reqList1 = { user: { userId: student1User._id.toString(), role: 'student' } };
    const resList1 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqList1, resList1);
    const ids1 = resList1.jsonData.data.map((a) => a._id.toString());
    assert.ok(!ids1.includes(annId.toString()));

    // 2. Publish Draft
    const reqPub = { user: { userId: adminUser._id.toString(), role: 'admin' }, params: { id: annId.toString() } };
    const resPub = createMockRes();
    await announcementController.publishAnnouncement(reqPub, resPub);
    assert.equal(resPub.statusCode, 200);

    // Published announcement should now appear in student feed
    const resList2 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqList1, resList2);
    assert.ok(resList2.jsonData.data.some((a) => a._id.toString() === annId.toString()));

    // 3. Archive Announcement
    const reqArch = { user: { userId: adminUser._id.toString(), role: 'admin' }, params: { id: annId.toString() } };
    const resArch = createMockRes();
    await announcementController.archiveAnnouncement(reqArch, resArch);
    assert.equal(resArch.statusCode, 200);

    // Archived announcement should no longer appear in active feed
    const resList3 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqList1, resList3);
    assert.ok(!resList3.jsonData.data.some((a) => a._id.toString() === annId.toString()));
  });

  await t.test('8. Audience targeting restricts visibility by branch and semester', async () => {
    // Announcement for CSE only (Student 1 is CSE, Student 2 is ECE)
    const cseAnn = await Announcement.create({
      title: 'CSE Department Seminar',
      body: 'AI & Robotics seminar in Seminar Hall 1.',
      category: 'academic',
      audience: 'department',
      targetBranches: ['CSE'],
      status: 'published',
      createdBy: adminUser._id,
      publishedAt: new Date(),
    });

    // Student 1 (CSE) MUST see it
    const reqS1 = { user: { userId: student1User._id.toString(), role: 'student' } };
    const resS1 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqS1, resS1);
    assert.ok(resS1.jsonData.data.some((a) => a._id.toString() === cseAnn._id.toString()));

    // Student 2 (ECE) MUST NOT see it
    const reqS2 = { user: { userId: student2User._id.toString(), role: 'student' } };
    const resS2 = createMockRes();
    await announcementController.getVisibleAnnouncements(reqS2, resS2);
    assert.ok(!resS2.jsonData.data.some((a) => a._id.toString() === cseAnn._id.toString()));
  });

  // ── 6. Integrated ERP Event Notifications ───────────────────────────────────
  await t.test('9. Publishing an announcement automatically notifies target audience', async () => {
    // Clear notifications for students
    await Notification.deleteMany({ category: 'announcement' });

    // Publish announcement targeted to all via controller
    const reqAnn = {
      user: { userId: adminUser._id.toString(), name: 'Admin', role: 'admin' },
      body: {
        title: 'Library Holiday Notice',
        body: 'The central library will be closed on Monday for inventory audit.',
        category: 'administrative',
        audience: 'all',
        status: 'published',
      },
    };
    const resAnn = createMockRes();
    await announcementController.createAnnouncement(reqAnn, resAnn);
    assert.equal(resAnn.statusCode, 201);

    // Both Student 1 and Student 2 should have received an announcement notification
    const s1Notif = await Notification.findOne({
      recipient: student1User._id,
      category: 'announcement',
      title: /Library Holiday Notice/,
    });
    const s2Notif = await Notification.findOne({
      recipient: student2User._id,
      category: 'announcement',
      title: /Library Holiday Notice/,
    });

    assert.ok(s1Notif, 'Student 1 must receive broadcast notification');
    assert.ok(s2Notif, 'Student 2 must receive broadcast notification');
  });

  // ── 7. Real-Time SSE Handshake & Connection Registration ────────────────────
  await t.test('10. SSE connection handshake writes connected event and cleans up on close', () => {
    const mockRes = createMockRes();
    const mockReq = {
      headers: {},
      query: { token: 'mock' },
      on(event, handler) {
        if (event === 'close') this.closeHandler = handler;
      },
    };

    notificationService.registerStream(student1User._id, mockRes, mockReq);
    assert.ok(mockRes.written.includes('event: connected'));

    // Verify stream was added
    assert.equal(notificationService.activeStreams.has(student1User._id.toString()), true);

    // Trigger disconnect
    mockReq.closeHandler();
    assert.equal(notificationService.activeStreams.has(student1User._id.toString()), false);
  });

  // ── Teardown ────────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect from isolated database', async () => {
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
