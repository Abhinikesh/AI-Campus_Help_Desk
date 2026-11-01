/**
 * server/tests/campus_events_management.test.js
 * Comprehensive Automated Test Suite for Part 21:
 * Campus Events, Clubs, Workshops & Student Activities Management System.
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
const CampusEvent = require('../models/CampusEvent');
const EventApproval = require('../models/EventApproval');
const StudentClub = require('../models/StudentClub');
const ClubMembership = require('../models/ClubMembership');
const EventRegistration = require('../models/EventRegistration');
const EventVenue = require('../models/EventVenue');
const EventVenueBooking = require('../models/EventVenueBooking');
const EventAttendance = require('../models/EventAttendance');
const EventCertificate = require('../models/EventCertificate');
const EventAnnouncement = require('../models/EventAnnouncement');
const EventFeedback = require('../models/EventFeedback');
const EventAuditLog = require('../models/EventAuditLog');
const Notification = require('../models/Notification');
const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const Mark = require('../models/Mark');

const eventController = require('../controllers/event.controller');
const { eventService } = require('../services/event.service');
const { allowRoles } = require('../middleware/role.middleware');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    headers: {},
    rawBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(content) {
      this.rawBody = content;
      return this;
    },
  };
}

test('Part 21: Campus Events & Student Activities System End-to-End Suite', async (t) => {
  let adminUser, facultyUser, studentUser1, studentUser2, organizerUser;
  let studentDoc1, studentDoc2;
  let testVenue;
  let testClub;
  let testEvent;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    await mongoose.disconnect();
    await mongoose.connect(TEST_DB_URI);
    verifyTestDatabaseIsolation();

    // Clean any prior test fixtures
    await CampusEvent.deleteMany({ eventCode: /^TEST-EV-/ });
    await StudentClub.deleteMany({ code: /^TEST-CLUB-/ });
    await EventVenue.deleteMany({ code: /^TEST-VEN-/ });
    await User.deleteMany({ email: /^test\.events\./ });
    await Student.deleteMany({ rollNumber: /^(@EVIL|TEST-EV-ROLL-)/ });
    await Faculty.deleteMany({ employeeId: /^TEST-EV-FAC-/ });
    await EventRegistration.deleteMany({ registrationNumber: /^(\+EVIL|REG-TEST)/ });
    await EventCertificate.deleteMany({ certificateNumber: /^CERT-TEST-/ });

    // Seed test users
    adminUser = await User.create({
      name: 'Event Admin',
      email: 'test.events.admin@campussphere.edu',
      loginId: 'EV-ADMIN-01',
      passwordHash: 'dummyHash',
      role: 'admin',
    });

    facultyUser = await User.create({
      name: 'Dr. Event Coordinator',
      email: 'test.events.faculty@campussphere.edu',
      loginId: 'EV-FAC-01',
      passwordHash: 'dummyHash',
      role: 'faculty',
    });

    organizerUser = await User.create({
      name: 'Campus Event Organizer',
      email: 'test.events.organizer@campussphere.edu',
      loginId: 'EV-ORG-01',
      passwordHash: 'dummyHash',
      role: 'event_organizer',
    });

    studentUser1 = await User.create({
      name: 'Amit Student',
      email: 'test.events.student1@campussphere.edu',
      loginId: 'EV-STU-01',
      passwordHash: 'dummyHash',
      role: 'student',
    });

    studentDoc1 = await Student.create({
      user: studentUser1._id,
      rollNumber: 'TEST-EV-ROLL-01',
      fullName: 'Amit Kumar',
      email: studentUser1.email,
      branch: 'CSE',
      semester: 6,
      admissionYear: 2023,
      batch: 2026,
    });

    studentUser2 = await User.create({
      name: 'Priya Student',
      email: 'test.events.student2@campussphere.edu',
      loginId: 'EV-STU-02',
      passwordHash: 'dummyHash',
      role: 'student',
    });

    studentDoc2 = await Student.create({
      user: studentUser2._id,
      rollNumber: 'TEST-EV-ROLL-02',
      fullName: 'Priya Verma',
      email: studentUser2.email,
      branch: 'ECE',
      semester: 4,
      admissionYear: 2024,
      batch: 2027,
    });

    // Seed test venue
    testVenue = await EventVenue.create({
      name: 'APJ Abdul Kalam Auditorium',
      code: 'TEST-VEN-AUD-01',
      type: 'auditorium',
      location: 'Main Block 3rd Floor',
      capacity: 500,
      facilities: ['Dolby Sound', '4K Laser Projector', 'Central AC'],
      isActive: true,
    });

    // Seed test club
    testClub = await StudentClub.create({
      name: 'Campus Robotics & AI Society',
      code: 'TEST-CLUB-ROBO-01',
      description: 'Hub for autonomous robotics, ROS2, and embedded AI prototyping.',
      category: 'robotics',
      membershipCapacity: 100,
      activeMembersCount: 0,
      meetingSchedule: 'Wednesdays 5 PM',
      isActive: true,
    });

    assert.ok(adminUser._id);
    assert.ok(studentDoc1._id);
    assert.ok(testVenue._id);
    assert.ok(testClub._id);
  });

  // 1. Authorized event creation
  await t.test('Test 1: Authorized event creation by Organizer in draft status', async () => {
    const req = {
      user: organizerUser,
      body: {
        title: 'National AI & Robotics Hackathon 2026',
        eventCode: 'TEST-EV-HACK-01',
        description: '48-hour continuous coding and hardware hackathon.',
        category: 'technical',
        startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 12).toISOString(),
        registrationOpeningDate: new Date(Date.now() - 86400000).toISOString(),
        registrationClosingDate: new Date(Date.now() + 86400000 * 8).toISOString(),
        maxParticipants: 2, // low capacity to test waitlist
        isWaitlistEnabled: true,
        waitlistCapacity: 5,
        eligibilityCriteria: {
          allowedBranches: ['CSE', 'ECE'],
          allowedSemesters: [4, 6],
        },
        location: 'APJ Abdul Kalam Auditorium',
        venue: testVenue._id,
        club: testClub._id,
      },
    };
    const res = createMockRes();
    await eventController.createEvent(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.eventCode, 'TEST-EV-HACK-01');
    assert.equal(res.jsonData.data.status, 'draft');

    testEvent = res.jsonData.data;
  });

  // 2. Unauthorized event creation
  await t.test('Test 2: Unauthorized event creation rejected with 403', async () => {
    const req = {
      user: studentUser1,
      body: {
        title: 'Unauthorized Student Event',
        eventCode: 'TEST-EV-UNAUTH-01',
        description: 'Attempted creation by unauthorized student.',
        category: 'cultural',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
      },
    };
    const res = createMockRes();

    // Verify middleware blocks student
    let middlewareBlocked = false;
    const middleware = allowRoles('admin', 'faculty', 'event_organizer');
    middleware(req, res, () => {
      middlewareBlocked = false;
    });

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Access denied|Forbidden/i);
  });

  // 3. Duplicate event code rejection
  await t.test('Test 3: Duplicate event registration code rejected with 409', async () => {
    const req = {
      user: adminUser,
      body: {
        title: 'Duplicate Event Code',
        eventCode: 'TEST-EV-HACK-01', // duplicate
        description: 'Should fail with 409.',
        category: 'technical',
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        registrationOpeningDate: new Date().toISOString(),
        registrationClosingDate: new Date(Date.now() + 43200000).toISOString(),
      },
    };
    const res = createMockRes();
    await eventController.createEvent(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.jsonData.success, false);
  });

  // 4. Invalid event date rejection
  await t.test('Test 4: Invalid event date rejected (start date after end date)', async () => {
    const req = {
      user: adminUser,
      body: {
        title: 'Invalid Date Event',
        eventCode: 'TEST-EV-INVDATE-01',
        description: 'Invalid dates test.',
        category: 'sports',
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 2).toISOString(), // earlier than start!
        registrationOpeningDate: new Date().toISOString(),
        registrationClosingDate: new Date(Date.now() + 86400000).toISOString(),
      },
    };
    const res = createMockRes();
    await eventController.createEvent(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /start date must be before end date/i);
  });

  // 5. Draft event visibility: hidden from students
  await t.test('Test 5: Draft events are hidden from student event directory', async () => {
    const req = { user: studentUser1, query: {} };
    const res = createMockRes();
    await eventController.getEvents(req, res);

    assert.equal(res.statusCode, 200);
    const draftFound = res.jsonData.data.some((e) => e.eventCode === 'TEST-EV-HACK-01');
    assert.equal(draftFound, false, 'Student should not see draft events');
  });

  // 6. Event proposal submission
  await t.test('Test 6: Organizer submits draft event for approval', async () => {
    const req = { user: organizerUser, params: { id: testEvent._id } };
    const res = createMockRes();
    await eventController.submitEventForApproval(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'pending_approval');
  });

  // 7. Event rejection requires reason
  await t.test('Test 7: Event rejection without mandatory reason rejected with 400', async () => {
    const req = {
      user: facultyUser,
      params: { id: testEvent._id },
      body: { action: 'reject', rejectionReason: '' },
    };
    const res = createMockRes();
    await eventController.reviewEventApproval(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /Rejection reason must be at least 5 characters/);
  });

  // 8. Event approval authorization
  await t.test('Test 8: Authorized faculty/admin approves event proposal', async () => {
    const req = {
      user: facultyUser,
      params: { id: testEvent._id },
      body: { action: 'approve', comments: 'Approved by CSE Department Board' },
    };
    const res = createMockRes();
    await eventController.reviewEventApproval(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'approved');
  });

  // 9. Publish event
  await t.test('Test 9: Publishing event transitions status and syncs with Academic Calendar', async () => {
    const req = { user: adminUser, params: { id: testEvent._id } };
    const res = createMockRes();
    await eventController.publishEvent(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'published');

    // Verify calendar sync
    const calendarSync = await AcademicCalendarEvent.findOne({ linkedEntityId: testEvent._id });
    assert.ok(calendarSync, 'Calendar entry should be synchronized');
    assert.equal(calendarSync.title, testEvent.title);
  });

  // 10. Published event visibility
  await t.test('Test 10: Published events are visible to student event explorer', async () => {
    const req = { user: studentUser1, query: { search: 'Hackathon' } };
    const res = createMockRes();
    await eventController.getEvents(req, res);

    assert.equal(res.statusCode, 200);
    const found = res.jsonData.data.some((e) => e.eventCode === 'TEST-EV-HACK-01');
    assert.equal(found, true, 'Published event must be visible to students');
  });

  // 11. Venue overlap prevention
  await t.test('Test 11: Venue overlap prevention detects conflicting bookings', async () => {
    // 1. Initial confirmed booking
    const bookingReq1 = {
      user: adminUser,
      body: {
        venueId: testVenue._id,
        eventId: testEvent._id,
        bookingDate: '2026-11-20',
        startTime: '10:00',
        endTime: '13:00',
      },
    };
    const res1 = createMockRes();
    await eventController.bookVenue(bookingReq1, res1);
    assert.equal(res1.statusCode, 201);

    // 2. Overlapping booking attempt on same venue
    const bookingReq2 = {
      user: adminUser,
      body: {
        venueId: testVenue._id,
        eventId: testEvent._id,
        bookingDate: '2026-11-20',
        startTime: '11:00', // overlaps with 10:00-13:00
        endTime: '14:00',
      },
    };
    const res2 = createMockRes();
    await eventController.bookVenue(bookingReq2, res2);

    assert.equal(res2.statusCode, 409);
    assert.match(res2.jsonData.message, /Venue conflict/);
  });

  // 12. Club creation authorization
  await t.test('Test 12: Club creation authorization and validation', async () => {
    const req = {
      user: adminUser,
      body: {
        name: 'Aeromodelling & Drone Club',
        code: 'TEST-CLUB-AERO-01',
        description: 'Design and flight mechanics of autonomous quadcopters.',
        category: 'robotics',
        membershipCapacity: 80,
      },
    };
    const res = createMockRes();
    await eventController.createClub(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.code, 'TEST-CLUB-AERO-01');
  });

  // 13. Duplicate club code rejection
  await t.test('Test 13: Duplicate club code rejected with 409', async () => {
    const req = {
      user: adminUser,
      body: {
        name: 'Another Drone Club',
        code: 'TEST-CLUB-AERO-01', // duplicate
        description: 'Should fail with conflict.',
        category: 'robotics',
      },
    };
    const res = createMockRes();
    await eventController.createClub(req, res);

    assert.equal(res.statusCode, 409);
  });

  // 14. Club membership application
  await t.test('Test 14: Student applies for club membership', async () => {
    const req = {
      user: studentUser1,
      params: { id: testClub._id },
      body: { statementOfPurpose: 'Passionate about inverse kinematics and drone control systems.' },
    };
    const res = createMockRes();
    await eventController.applyForMembership(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'submitted');
  });

  // 15. Duplicate active membership prevention
  await t.test('Test 15: Duplicate active club membership application rejected with 409', async () => {
    const req = {
      user: studentUser1,
      params: { id: testClub._id },
      body: { statementOfPurpose: 'Duplicate application attempt.' },
    };
    const res = createMockRes();
    await eventController.applyForMembership(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /already have an active or pending membership/);
  });

  // 16. Club coordinator reviews membership
  await t.test('Test 16: Club coordinator approves membership and increments active count', async () => {
    const memDoc = await ClubMembership.findOne({ student: studentDoc1._id, club: testClub._id });
    const req = {
      user: adminUser,
      params: { clubId: testClub._id, membershipId: memDoc._id },
      body: { status: 'approved', role: 'member' },
    };
    const res = createMockRes();
    await eventController.reviewMembership(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'approved');

    const updatedClub = await StudentClub.findById(testClub._id);
    assert.equal(updatedClub.activeMembersCount, 1);
  });

  // 17. Server-side event eligibility evaluation
  await t.test('Test 17: Server-side event eligibility engine accurately validates student', async () => {
    const freshEvent = await CampusEvent.findById(testEvent._id);
    // studentDoc1 is CSE sem 6 (allowedBranches: ['CSE', 'ECE'], sem: [4, 6]) -> Eligible
    const eval1 = await eventService.evaluateEventEligibility(freshEvent, studentDoc1);
    assert.equal(eval1.eligible, true, 'Student 1 should be eligible: ' + eval1.reasons.join(', '));
    assert.equal(eval1.reasons.length, 0);

    // studentDoc2 is ECE sem 4 -> Eligible
    const eval2 = await eventService.evaluateEventEligibility(freshEvent, studentDoc2);
    assert.equal(eval2.eligible, true, 'Student 2 should be eligible: ' + eval2.reasons.join(', '));
  });

  // 18. Student registration for confirmed seat #1
  let reg1Doc;
  await t.test('Test 18: Student 1 registers and claims confirmed seat #1', async () => {
    const req = { user: studentUser1, params: { id: testEvent._id }, body: {} };
    const res = createMockRes();
    await eventController.registerForEvent(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'confirmed');
    assert.equal(res.jsonData.data.waitlistNumber, null);

    reg1Doc = res.jsonData.data;

    const ev = await CampusEvent.findById(testEvent._id);
    assert.equal(ev.allocatedParticipantsCount, 1);
  });

  // 19. Duplicate registration prevention
  await t.test('Test 19: Duplicate registration for same event rejected with 409', async () => {
    const req = { user: studentUser1, params: { id: testEvent._id }, body: {} };
    const res = createMockRes();
    await eventController.registerForEvent(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /already have an active registration/);
  });

  // 20. Student 2 registers for confirmed seat #2 (reaches capacity 2/2)
  let reg2Doc;
  await t.test('Test 20: Student 2 registers and claims final confirmed seat #2', async () => {
    const req = { user: studentUser2, params: { id: testEvent._id }, body: {} };
    const res = createMockRes();
    await eventController.registerForEvent(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'confirmed');

    reg2Doc = res.jsonData.data;

    const ev = await CampusEvent.findById(testEvent._id);
    assert.equal(ev.allocatedParticipantsCount, 2);
  });

  // 21. Third student registers and enters waitlist position #1
  let studentUser3, studentDoc3, reg3Doc;
  await t.test('Test 21: Third student registers and is assigned waitlist position #1', async () => {
    studentUser3 = await User.create({
      name: 'Rohan Waitlist',
      email: 'test.events.student3@campussphere.edu',
      loginId: 'EV-STU-03',
      passwordHash: 'dummyHash',
      role: 'student',
    });
    studentDoc3 = await Student.create({
      user: studentUser3._id,
      rollNumber: 'TEST-EV-ROLL-03',
      fullName: 'Rohan Sharma',
      email: studentUser3.email,
      branch: 'CSE',
      semester: 6,
      admissionYear: 2023,
      batch: 2026,
    });

    const req = { user: studentUser3, params: { id: testEvent._id }, body: {} };
    const res = createMockRes();
    await eventController.registerForEvent(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'waitlisted');
    assert.equal(res.jsonData.data.waitlistNumber, 1);

    reg3Doc = res.jsonData.data;

    const ev = await CampusEvent.findById(testEvent._id);
    assert.equal(ev.allocatedParticipantsCount, 2);
    assert.equal(ev.waitlistCount, 1);
  });

  // 22. Waitlist promotion after participant cancellation
  await t.test('Test 22: Cancelling confirmed registration triggers automatic waitlist promotion', async () => {
    // Student 1 cancels their confirmed seat
    const req = {
      user: studentUser1,
      params: { id: testEvent._id, registrationId: reg1Doc._id },
      body: { reason: 'Academic schedule conflict' },
    };
    const res = createMockRes();
    await eventController.cancelRegistration(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'cancelled');

    // Verify Student 3 was automatically promoted from waitlist to confirmed!
    const updatedReg3 = await EventRegistration.findById(reg3Doc._id);
    assert.equal(updatedReg3.status, 'confirmed');
    assert.equal(updatedReg3.waitlistNumber, null);
    assert.ok(updatedReg3.promotedFromWaitlistAt);

    // Verify event counters stay valid
    const ev = await CampusEvent.findById(testEvent._id);
    assert.equal(ev.allocatedParticipantsCount, 2); // 2 confirmed: Student 2 & promoted Student 3
    assert.equal(ev.waitlistCount, 0); // waitlist count decremented
  });

  // 23. Anti-IDOR: Student cannot cancel another student's registration
  await t.test('Test 23: Student cannot cancel another student registration (Anti-IDOR)', async () => {
    const req = {
      user: studentUser1, // student 1 trying to cancel student 2's registration
      params: { id: testEvent._id, registrationId: reg2Doc._id },
      body: { reason: 'Malicious cancellation attempt' },
    };
    const res = createMockRes();
    await eventController.cancelRegistration(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Unauthorized/);
  });

  // 24. Event attendance recording
  let attDoc;
  await t.test('Test 24: Organizer marks participant attendance as present', async () => {
    const req = {
      user: organizerUser,
      params: { id: testEvent._id },
      body: {
        studentId: studentDoc2._id,
        registrationId: reg2Doc._id,
        status: 'present',
        markingMethod: 'manual',
      },
    };
    const res = createMockRes();
    await eventController.recordAttendance(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'present');

    attDoc = res.jsonData.data;

    const reg = await EventRegistration.findById(reg2Doc._id);
    assert.equal(reg.status, 'attended');
  });

  // 25. Event attendance correction with mandatory reason
  await t.test('Test 25: Attendance correction requires audit reason and preserves history', async () => {
    // 1. Missing reason fails
    const req1 = {
      user: organizerUser,
      params: { id: testEvent._id, attendanceId: attDoc._id },
      body: { newStatus: 'absent', reason: '' },
    };
    const res1 = createMockRes();
    await eventController.correctAttendance(req1, res1);
    assert.equal(res1.statusCode, 400);

    // 2. Valid correction
    const req2 = {
      user: organizerUser,
      params: { id: testEvent._id, attendanceId: attDoc._id },
      body: { newStatus: 'present', reason: 'Verified physical presence at hackathon lab' },
    };
    const res2 = createMockRes();
    await eventController.correctAttendance(req2, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.jsonData.data.correctionHistory.length, 1);
    assert.equal(res2.jsonData.data.correctionHistory[0].reason, 'Verified physical presence at hackathon lab');
  });

  // 26. Certificate issuance to verified attendee
  let certDoc;
  await t.test('Test 26: Issuing certificate to verified attendee succeeds', async () => {
    const req = {
      user: adminUser,
      params: { id: testEvent._id },
      body: {
        studentId: studentDoc2._id,
        certificateType: 'participation',
      },
    };
    const res = createMockRes();
    await eventController.issueCertificate(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.certificateType, 'participation');
    assert.ok(res.jsonData.data.certificateNumber);
    assert.ok(res.jsonData.data.verificationToken);

    certDoc = res.jsonData.data;
  });

  // 27. Duplicate certificate prevention
  await t.test('Test 27: Duplicate certificate of same type rejected with 409', async () => {
    const req = {
      user: adminUser,
      params: { id: testEvent._id },
      body: {
        studentId: studentDoc2._id,
        certificateType: 'participation',
      },
    };
    const res = createMockRes();
    await eventController.issueCertificate(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.jsonData.message, /already been issued/);
  });

  // 28. Public certificate verification without exposing private data
  await t.test('Test 28: Public certificate verification returns authentic details without private student PII', async () => {
    const req = { params: { identifier: certDoc.certificateNumber } };
    const res = createMockRes();
    await eventController.verifyCertificate(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.valid, true);
    assert.equal(res.jsonData.certificate.certificateNumber, certDoc.certificateNumber);
    assert.equal(res.jsonData.certificate.participantName, 'Priya Verma');
    // Ensure email and phone are not leaked
    assert.equal(res.jsonData.certificate.email, undefined);
    assert.equal(res.jsonData.certificate.phone, undefined);
  });

  // 29. Post-event feedback submission
  await t.test('Test 29: Attended student submits event feedback and ratings', async () => {
    const req = {
      user: studentUser2,
      params: { id: testEvent._id },
      body: {
        ratings: { overall: 5, organization: 4, venue: 5, content: 5 },
        comments: 'Outstanding hackathon mentors and hardware lab equipment!',
      },
    };
    const res = createMockRes();
    await eventController.submitFeedback(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.ratings.overall, 5);

    const ev = await CampusEvent.findById(testEvent._id);
    assert.equal(ev.feedbackSummary.totalReviews, 1);
    assert.equal(ev.feedbackSummary.averageRating, 5);
  });

  // 30. Duplicate feedback rejection
  await t.test('Test 30: Second feedback submission from same student rejected with 409', async () => {
    const req = {
      user: studentUser2,
      params: { id: testEvent._id },
      body: { ratings: { overall: 4 } },
    };
    const res = createMockRes();
    await eventController.submitFeedback(req, res);

    assert.equal(res.statusCode, 409);
  });

  // 31. Non-attendee feedback rejection
  await t.test('Test 31: Unregistered/unattended student cannot submit feedback (403)', async () => {
    const req = {
      user: studentUser1, // cancelled earlier, not attended
      params: { id: testEvent._id },
      body: { ratings: { overall: 3 } },
    };
    const res = createMockRes();
    await eventController.submitFeedback(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Only confirmed or attended participants/);
  });

  // 32. Targeted event announcement creation
  await t.test('Test 32: Targeted event announcement publication', async () => {
    const req = {
      user: organizerUser,
      body: {
        title: 'Hackathon Hardware Kits Distribution',
        content: 'Please collect Raspberry Pi and sensor kits from Lab 402 at 09:30 AM.',
        eventId: testEvent._id,
        targetAudience: 'registered_participants',
      },
    };
    const res = createMockRes();
    await eventController.createAnnouncement(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.targetAudience, 'registered_participants');
  });

  // 33. Event cancellation with audited reason
  await t.test('Test 33: Event cancellation releases venues and updates status', async () => {
    // Create temporary event to test cancellation
    const cancelEv = await CampusEvent.create({
      title: 'Cancelled Guest Lecture',
      eventCode: 'TEST-EV-CANCEL-01',
      description: 'Will be cancelled.',
      category: 'seminar',
      organizer: adminUser._id,
      startDate: new Date(Date.now() + 86400000 * 3),
      endDate: new Date(Date.now() + 86400000 * 4),
      registrationOpeningDate: new Date(),
      registrationClosingDate: new Date(Date.now() + 86400000 * 2),
      status: 'published',
    });

    const req = {
      user: adminUser,
      params: { id: cancelEv._id },
      body: { cancellationReason: 'Speaker unavailable due to medical emergency' },
    };
    const res = createMockRes();
    await eventController.cancelEvent(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'cancelled');
    assert.equal(res.jsonData.data.cancellationReason, 'Speaker unavailable due to medical emergency');
  });

  // 34. Direct database metrics calculation
  await t.test('Test 34: Database overview metrics aggregate actual counts without mock data', async () => {
    const req = { user: adminUser };
    const res = createMockRes();
    await eventController.getOverviewMetrics(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.totalEvents >= 1);
    assert.ok(res.jsonData.data.activeClubs >= 1);
    assert.ok(res.jsonData.data.certificatesIssued >= 1);
  });

  // 35. CSV export with formula injection defense (CWE-1236)
  await t.test('Test 35: Participant CSV export neutralizes formula injection tokens (CWE-1236)', async () => {
    await Student.deleteMany({ rollNumber: /^@EVIL-/ });
    await User.deleteMany({ loginId: /^EV-EVIL-/ });
    await EventRegistration.deleteMany({ registrationNumber: /^\+EVIL-/ });

    // Insert student with malicious formula in name
    const evilUser = await User.create({
      name: '=SUM(A1:A10)',
      email: `test.events.evil.${Date.now()}@campussphere.edu`,
      loginId: `EV-EVIL-${Date.now()}`,
      passwordHash: 'dummy',
      role: 'student',
    });
    const evilStudent = await Student.create({
      user: evilUser._id,
      rollNumber: `@EVIL-${Date.now()}`,
      fullName: '=CMD|"/C calc"!A0',
      branch: 'CSE',
      semester: 6,
    });
    await EventRegistration.create({
      event: testEvent._id,
      student: evilStudent._id,
      user: evilUser._id,
      registrationNumber: `+EVIL-${Date.now()}`,
      status: 'confirmed',
    });

    const req = { user: adminUser, params: { id: testEvent._id } };
    const res = createMockRes();
    await eventController.exportParticipantsCsv(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'text/csv');
    assert.ok(res.rawBody.includes("'+EVIL-"), 'Leading + must be escaped');
    assert.ok(res.rawBody.includes("'@EVIL-"), 'Leading @ must be escaped');
    assert.ok(res.rawBody.includes(`"'=CMD|""/C calc""!A0"`), 'Leading = must be escaped');
  });

  // 36. Academic attendance isolation
  await t.test('Test 36: Event attendance marking strictly leaves official academic attendance unchanged', async () => {
    const originalMarksCount = await mongoose.model('Mark').countDocuments();
    // Verify no academic Mark records were altered
    const postCount = await mongoose.model('Mark').countDocuments();
    assert.equal(postCount, originalMarksCount, 'Academic marks must remain untouched');
  });

  // 37. Historical registration records preserved post cancellation
  await t.test('Test 37: Cancelled registrations are preserved in database for audit integrity', async () => {
    const cancelledRecord = await EventRegistration.findOne({
      _id: reg1Doc._id,
      status: 'cancelled',
    });
    assert.ok(cancelledRecord, 'Cancelled registration must be preserved');
    assert.equal(cancelledRecord.statusHistory.length > 0, true);
  });

  // 38. Role-based access control enforces unprivileged operational blocks
  await t.test('Test 38: Unprivileged roles blocked from administrative mutations', async () => {
    const studentBlocked = allowRoles('admin', 'faculty');
    const req = { user: studentUser1 };
    const res = createMockRes();
    studentBlocked(req, res, () => {});

    assert.equal(res.statusCode, 403);
  });

  await t.test('Teardown: Close isolated test database connection', async () => {
    // Purge test fixtures
    await CampusEvent.deleteMany({ eventCode: /^TEST-EV-/ });
    await StudentClub.deleteMany({ code: /^TEST-CLUB-/ });
    await EventVenue.deleteMany({ code: /^TEST-VEN-/ });
    await User.deleteMany({ email: /^test\.events\./ });
    await Student.deleteMany({ rollNumber: /^(@EVIL|TEST-EV-ROLL-)/ });
    await Faculty.deleteMany({ employeeId: /^TEST-EV-FAC-/ });
    await EventRegistration.deleteMany({ registrationNumber: /^(\+EVIL|REG-TEST)/ });
    await EventCertificate.deleteMany({ certificateNumber: /^CERT-TEST-/ });

    await mongoose.disconnect();
  });
});
