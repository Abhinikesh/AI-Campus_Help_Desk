/**
 * server/tests/phase3_1_2_offline_compatibility.test.js
 * Comprehensive Isolated Regression Test Suite for Phase 3.1.2:
 * Offline Student Compatibility & Regression Verification.
 *
 * SAFETY MANDATE:
 * - Runs exclusively against an ephemeral MongoMemoryServer.
 * - Asserts test connection is isolated and database name is NOT 'campus-erp'.
 * - Never connects to development, production, or default port 27018.
 * - ZERO live database mutation.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Student = require('../models/Student');
const CampusEvent = require('../models/CampusEvent');
const EventCertificate = require('../models/EventCertificate');
const EventAttendance = require('../models/EventAttendance');
const PlacementProfile = require('../models/PlacementProfile');
const Mark = require('../models/Mark');

const placementController = require('../controllers/placement.controller');
const eventController = require('../controllers/event.controller');

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

test('Phase 3.1.2: Offline Student Compatibility & Regression Suite', async (t) => {
  let mongod;
  let testUri;

  let adminUser, studentUserA, studentUserB;
  let linkedStudentDocA, unlinkedStudentDoc, linkedStudentDocB;
  let testEventDoc;

  await t.test('Setup: Spin up isolated MongoMemoryServer and seed fixtures', async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'campus-erp-test-phase3-1-2-isolated',
      },
    });

    testUri = mongod.getUri();
    assert.ok(testUri, 'MongoMemoryServer URI must be valid');
    assert.ok(!testUri.includes('27018'), 'Must not use live port 27018');

    await mongoose.connect(testUri);
    const dbName = mongoose.connection.db.databaseName;
    assert.notEqual(dbName, 'campus-erp', 'CRITICAL: Must not connect to campus-erp');

    // Create Admin User
    adminUser = await User.create({
      name: 'Admin Officer',
      email: 'admin.officer@campussphere.edu',
      loginId: 'ADM-OFFICER-01',
      passwordHash: 'dummyHash',
      role: 'admin',
    });

    // Create Student User A
    studentUserA = await User.create({
      name: 'Student User A',
      email: 'student.a@campussphere.edu',
      loginId: 'STU-USER-A',
      passwordHash: 'dummyHash',
      role: 'student',
    });

    // Create Student User B
    studentUserB = await User.create({
      name: 'Student User B',
      email: 'student.b@campussphere.edu',
      loginId: 'STU-USER-B',
      passwordHash: 'dummyHash',
      role: 'student',
    });

    // Linked Student A (has portal user)
    linkedStudentDocA = await Student.create({
      user: studentUserA._id,
      rollNumber: '1/24/SET/BCS/101',
      fullName: 'Student Linked A',
      email: 'student.a@campussphere.edu',
      branch: 'CSE',
      status: 'active',
      accountStatus: 'active_user',
    });

    // Linked Student B (has portal user)
    linkedStudentDocB = await Student.create({
      user: studentUserB._id,
      rollNumber: '1/24/SET/BCS/102',
      fullName: 'Student Linked B',
      email: 'student.b@campussphere.edu',
      branch: 'CSE',
      status: 'active',
      accountStatus: 'active_user',
    });

    // Offline / Unlinked Student (user: null)
    unlinkedStudentDoc = await Student.create({
      user: null,
      rollNumber: '1/24/SET/BCS/201',
      fullName: 'Offline Student NoUser',
      email: null,
      branch: 'CSE',
      status: 'active',
      accountStatus: 'enrolled_offline',
    });

    // Create Placement Profile for linked student
    await PlacementProfile.create({
      student: linkedStudentDocA._id,
      user: studentUserA._id,
      technicalSkills: ['React', 'Node.js'],
    });

    // Create Campus Event
    testEventDoc = await CampusEvent.create({
      title: 'Annual Tech Hackathon 2026',
      eventCode: 'TECH-HACK-2026',
      description: '48-hour continuous coding hackathon.',
      category: 'technical',
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-11-21'),
      registrationOpeningDate: new Date('2026-11-01'),
      registrationClosingDate: new Date('2026-11-19'),
      status: 'approved',
      organizer: adminUser._id,
      capacity: 100,
      location: 'Main Auditorium',
    });

    const EventRegistration = require('../models/EventRegistration');

    // Create Event Registrations
    const regLinked = await EventRegistration.create({
      event: testEventDoc._id,
      student: linkedStudentDocA._id,
      user: studentUserA._id,
      registrationNumber: 'REG-LINKED-01',
      status: 'confirmed',
    });

    const regUnlinked = await EventRegistration.create({
      event: testEventDoc._id,
      student: unlinkedStudentDoc._id,
      user: adminUser._id,
      registrationNumber: 'REG-UNLINKED-01',
      status: 'confirmed',
    });

    // Create verified attendance records for certification eligibility
    await EventAttendance.create({
      event: testEventDoc._id,
      student: linkedStudentDocA._id,
      registration: regLinked._id,
      status: 'present',
      markedBy: adminUser._id,
    });

    await EventAttendance.create({
      event: testEventDoc._id,
      student: unlinkedStudentDoc._id,
      registration: regUnlinked._id,
      status: 'present',
      markedBy: adminUser._id,
    });

    console.log('✅ [Phase 3.1.2 Test] Setup completed safely in memory.');
  });

  // -------------------------------------------------------------
  // PART A: PLACEMENT CONTROLLER NULL-SAFETY
  // -------------------------------------------------------------

  await t.test('1. Admin can access placement profile of unlinked offline student (user: null)', async () => {
    const req = {
      user: adminUser,
      params: { id: unlinkedStudentDoc._id.toString() },
    };
    const res = createMockRes();
    let caughtErr = null;

    await placementController.getStudentProfileById(req, res, (err) => {
      caughtErr = err;
    });

    assert.equal(caughtErr, null, 'Admin access should not throw any error');
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.student.rollNumber, '1/24/SET/BCS/201');
    assert.equal(res.jsonData.data.student.user, null);
    assert.equal(res.jsonData.data.profile, null, 'Offline student has no placement profile initially');
  });

  await t.test('2. Student requesting unlinked student profile throws 403 Forbidden instead of 500 TypeError', async () => {
    const req = {
      user: studentUserA,
      params: { id: unlinkedStudentDoc._id.toString() },
    };
    const res = createMockRes();
    let caughtErr = null;

    await placementController.getStudentProfileById(req, res, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr, 'Should throw an authorization error');
    assert.equal(caughtErr.statusCode, 403);
    assert.match(caughtErr.message, /Cross-profile access is strictly prohibited/);
  });

  await t.test('3. Student requesting their own placement profile succeeds with 200', async () => {
    const req = {
      user: studentUserA,
      params: { id: linkedStudentDocA._id.toString() },
    };
    const res = createMockRes();
    let caughtErr = null;

    await placementController.getStudentProfileById(req, res, (err) => {
      caughtErr = err;
    });

    assert.equal(caughtErr, null);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.student.rollNumber, '1/24/SET/BCS/101');
    assert.deepEqual(res.jsonData.data.profile.technicalSkills, ['React', 'Node.js']);
  });

  await t.test('4. Student requesting another student profile is strictly blocked with 403 Forbidden', async () => {
    const req = {
      user: studentUserA,
      params: { id: linkedStudentDocB._id.toString() }, // Requesting Student B's profile
    };
    const res = createMockRes();
    let caughtErr = null;

    await placementController.getStudentProfileById(req, res, (err) => {
      caughtErr = err;
    });

    assert.ok(caughtErr);
    assert.equal(caughtErr.statusCode, 403);
    assert.match(caughtErr.message, /Cross-profile access is strictly prohibited/);
  });

  // -------------------------------------------------------------
  // PART B: EVENT CERTIFICATE OWNERSHIP
  // -------------------------------------------------------------

  let unlinkedCertNumber;
  let linkedCertNumber;

  await t.test('5. Issuing certificate to offline student (user: null) sets certificate.user to null (NEVER admin)', async () => {
    const req = {
      user: adminUser,
      params: { id: testEventDoc._id.toString() },
      body: {
        studentId: unlinkedStudentDoc._id.toString(),
        certificateType: 'participation',
      },
    };
    const res = createMockRes();

    await eventController.issueCertificate(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.ok(res.jsonData.data.certificateNumber);

    unlinkedCertNumber = res.jsonData.data.certificateNumber;

    // Verify persisted certificate in MongoDB
    const savedCert = await EventCertificate.findOne({ certificateNumber: unlinkedCertNumber });
    assert.ok(savedCert);
    assert.equal(savedCert.student.toString(), unlinkedStudentDoc._id.toString());
    assert.equal(savedCert.user, null, 'CRITICAL: Certificate user must be null, NOT the admin user ID');
    assert.notEqual(String(savedCert.user), String(adminUser._id), 'Certificate user MUST NOT equal admin user ID');
  });

  await t.test('6. Issuing certificate to linked student sets certificate.user to student user ID', async () => {
    const req = {
      user: adminUser,
      params: { id: testEventDoc._id.toString() },
      body: {
        studentId: linkedStudentDocA._id.toString(),
        certificateType: 'participation',
      },
    };
    const res = createMockRes();

    await eventController.issueCertificate(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);

    linkedCertNumber = res.jsonData.data.certificateNumber;

    // Verify persisted certificate in MongoDB
    const savedCert = await EventCertificate.findOne({ certificateNumber: linkedCertNumber });
    assert.ok(savedCert);
    assert.equal(savedCert.student.toString(), linkedStudentDocA._id.toString());
    assert.equal(savedCert.user.toString(), studentUserA._id.toString(), 'Must equal linked student user ID');
  });

  await t.test('7. Authenticated student only retrieves their own certificates (Zero leakage of offline certs)', async () => {
    const reqA = { user: studentUserA };
    const resA = createMockRes();
    await eventController.getMyCertificates(reqA, resA);

    assert.equal(resA.jsonData.success, true);
    assert.equal(resA.jsonData.data.length, 1);
    assert.equal(resA.jsonData.data[0].certificateNumber, linkedCertNumber);

    // Student B should have 0 certificates
    const reqB = { user: studentUserB };
    const resB = createMockRes();
    await eventController.getMyCertificates(reqB, resB);

    assert.equal(resB.jsonData.success, true);
    assert.equal(resB.jsonData.data.length, 0, 'Student B must not see any certificates');
  });

  await t.test('8. Public verification works for both linked and offline student certificates', async () => {
    // Verify offline student certificate
    const reqOffline = { params: { identifier: unlinkedCertNumber } };
    const resOffline = createMockRes();
    await eventController.verifyCertificate(reqOffline, resOffline);

    assert.equal(resOffline.statusCode, 200);
    assert.equal(resOffline.jsonData.valid, true);
    assert.equal(resOffline.jsonData.certificate.participantName, 'Offline Student NoUser');

    // Verify linked student certificate
    const reqLinked = { params: { identifier: linkedCertNumber } };
    const resLinked = createMockRes();
    await eventController.verifyCertificate(reqLinked, resLinked);

    assert.equal(resLinked.statusCode, 200);
    assert.equal(resLinked.jsonData.valid, true);
    assert.equal(resLinked.jsonData.certificate.participantName, 'Student Linked A');
  });

  await t.test('9. EventCertificate schema enforces autoIndex: false and autoCreate: false', () => {
    assert.equal(EventCertificate.schema.options.autoIndex, false);
    assert.equal(EventCertificate.schema.options.autoCreate, false);
  });

  await t.test('Teardown: Disconnect and terminate isolated MongoMemoryServer', async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('✅ [Phase 3.1.2 Test] Disconnected and destroyed isolated MongoMemoryServer.');
  });
});
