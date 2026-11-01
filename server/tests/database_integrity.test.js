/**
 * server/tests/database_integrity.test.js
 * Comprehensive Database Integrity & Schema Verification Test Suite.
 * Uses an isolated test database (campus-erp-test-isolated) on port 27018.
 * Verifies all 13 Part 4 requirements with zero pollution of dev data.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const FaceEmbedding = require('../models/FaceEmbedding');
const ConsentRecord = require('../models/ConsentRecord');
const AttendanceSettings = require('../models/AttendanceSettings');
const { verifyTestDatabaseIsolation } = require('./helpers/testDatabase');

const ISOLATED_TEST_DB = 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';

test('Part 4 Database Integrity & Schema Verification Suite', async (t) => {
  let testUserStudent, testUserFaculty;
  let testStudentDoc, testFacultyDoc, testSubjectDoc, testTimetableDoc;

  // Setup: Connect to isolated test database and clear collections
  await t.test('Setup: Connect to isolated database and seed fixtures', async () => {
    verifyTestDatabaseIsolation(ISOLATED_TEST_DB);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(ISOLATED_TEST_DB);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    // Clean all collections in test database
    const collections = await mongoose.connection.db.collections();
    for (const coll of collections) {
      await coll.deleteMany({});
    }

    // 1. Create Student User & Profile
    testUserStudent = await User.create({
      name: 'Test Student One',
      email: 'teststudent1@campus.edu',
      loginId: 'TESTSTU001',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student'
    });

    testStudentDoc = await Student.create({
      user: testUserStudent._id,
      rollNumber: 'TESTSTU001',
      fullName: 'Test Student One',
      email: 'teststudent1@campus.edu',
      branch: 'CSE',
      semester: 5,
      section: 'A'
    });

    // 2. Create Faculty User & Profile
    testUserFaculty = await User.create({
      name: 'Prof. Test Faculty',
      email: 'testfaculty@campus.edu',
      loginId: 'TESTFAC001',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'faculty'
    });

    testFacultyDoc = await Faculty.create({
      user: testUserFaculty._id,
      employeeId: 'TESTFAC001',
      department: 'Computer Science & Engineering'
    });

    // 3. Create Subject & Timetable
    testSubjectDoc = await Subject.create({
      code: 'CS501',
      name: 'Design Analysis of Algorithms',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: testUserFaculty._id
    });

    testTimetableDoc = await Timetable.create({
      subject: testSubjectDoc._id,
      dayOfWeek: 1, // Monday
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      room: 'Lab-1'
    });

    assert.ok(testStudentDoc._id);
    assert.ok(testFacultyDoc._id);
    assert.ok(testSubjectDoc._id);

    // Build all indexes explicitly before running duplicate tests
    await Promise.all([
      Attendance.createIndexes(),
      AttendanceSession.createIndexes(),
      FaceEmbedding.createIndexes(),
      Student.createIndexes(),
      User.createIndexes()
    ]);
  });

  // Test 1: Valid attendance session creation (Single Period)
  await t.test('1. Valid single-period attendance session creation', async () => {
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-02',
      period: 1,
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      status: 'open'
    });

    assert.ok(session._id);
    assert.equal(session.period, 1);
    assert.equal(session.periodCount, 1);
    assert.deepEqual(session.periods, [1]);
    assert.equal(session.status, 'open');
  });

  // Test 2: Multi-period combined laboratory block creation
  await t.test('2. Multi-period laboratory block session creation', async () => {
    const labSession = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-02',
      periods: [3, 4],
      startTime: '11:00 AM',
      endTime: '01:00 PM',
      sessionType: 'lab',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      status: 'open'
    });

    assert.ok(labSession._id);
    assert.equal(labSession.periodCount, 2);
    assert.deepEqual(labSession.periods, [3, 4]);
    assert.equal(labSession.period, 3); // backward compatibility defaults to primary period
  });

  // Test 3: Invalid session state transitions are rejected
  await t.test('3. Enforce session state-machine rules (reject invalid transitions)', async () => {
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-03',
      period: 2,
      status: 'open'
    });

    // Transition: open -> active (allowed)
    session.status = 'active';
    await session.save();
    assert.equal(session.status, 'active');

    // Transition: active -> finalized (allowed)
    session.status = 'finalized';
    await session.save();
    assert.equal(session.status, 'finalized');

    // Invalid Transition: finalized -> active (forbidden, finalized is terminal)
    session.status = 'active';
    await assert.rejects(
      async () => {
        await session.save();
      },
      /Invalid session state transition from "finalized" to "active"/
    );
  });

  // Test 4: Valid attendance record creation
  await t.test('4. Valid attendance record creation linked to student and session', async () => {
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-04',
      period: 1,
      status: 'open'
    });

    const record = await Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: session._id,
      date: '2026-11-04',
      period: 1,
      status: 'present',
      verificationMethod: 'face',
      confidence: 0.93
    });

    assert.ok(record._id);
    assert.equal(record.status, 'present');
    assert.equal(record.confidence, 0.93);
    assert.equal(record.isManualOverride, false);
  });

  // Test 5: Multi-period attendance record credit tracking
  await t.test('5. Multi-period attendance credit tracking', async () => {
    const labSession = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-05',
      periods: [5, 6],
      periodCount: 2,
      status: 'open'
    });

    const labRecord = await Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: labSession._id,
      date: '2026-11-05',
      periods: [5, 6],
      status: 'present',
      verificationMethod: 'face'
    });

    assert.equal(labRecord.periodCount, 2);
    assert.deepEqual(labRecord.periods, [5, 6]);
    assert.equal(labRecord.period, 5);
  });

  // Test 6: Duplicate attendance prevention by period-level index
  await t.test('6. Period-level duplicate attendance is rejected by compound unique index', async () => {
    // Record already exists for student on 2026-11-04 period 1 (from Test 4)
    await assert.rejects(
      async () => {
        await Attendance.create({
          subject: testSubjectDoc._id,
          student: testStudentDoc._id,
          date: '2026-11-04',
          period: 1,
          status: 'present'
        });
      },
      /E11000 duplicate key error/
    );
  });

  // Test 7: Duplicate attendance prevention by session-level index
  await t.test('7. Session-level duplicate attendance is rejected by sparse unique index', async () => {
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-06',
      period: 2,
      status: 'open'
    });

    await Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: session._id,
      date: '2026-11-06',
      period: 2,
      status: 'present'
    });

    // Attempt second write for same session and student
    await assert.rejects(
      async () => {
        await Attendance.create({
          subject: testSubjectDoc._id,
          student: testStudentDoc._id,
          session: session._id,
          date: '2026-11-06',
          period: 2,
          status: 'late'
        });
      },
      /E11000 duplicate key error/
    );
  });

  // Test 8: Concurrent duplicate submission simulation
  await t.test('8. Concurrent submissions are safely handled (one succeeds, other rejected)', async () => {
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testUserFaculty._id,
      date: '2026-11-07',
      period: 3,
      status: 'open'
    });

    const write1 = Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: session._id,
      date: '2026-11-07',
      period: 3,
      status: 'present'
    });

    const write2 = Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: session._id,
      date: '2026-11-07',
      period: 3,
      status: 'present'
    });

    const results = await Promise.allSettled([write1, write2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one write must succeed');
    assert.equal(rejected.length, 1, 'Exactly one write must be rejected by unique index');
    assert.ok(rejected[0].reason.message.includes('E11000 duplicate key error'));
  });

  // Test 9: Biometric Profile field security (select: false)
  await t.test('9. FaceEmbedding encryptedData and templateReference are excluded by default', async () => {
    await FaceEmbedding.create({
      student: testStudentDoc._id,
      enrollmentStatus: 'enrolled',
      consentGiven: true,
      encryptedData: 'gAAAAABtest_encrypted_vector_ciphertext',
      templateReference: 'sha256_mock_template_fingerprint',
      samplesCaptured: 1,
      imageQualityScore: 89.5
    });

    // Standard query without explicit select
    const profile = await FaceEmbedding.findOne({ student: testStudentDoc._id });
    assert.ok(profile);
    assert.equal(profile.enrollmentStatus, 'enrolled');
    assert.equal(profile.encryptedData, undefined, 'encryptedData must NOT be returned by default');
    assert.equal(profile.templateReference, undefined, 'templateReference must NOT be returned by default');

    // Trusted query with explicit select
    const privilegedProfile = await FaceEmbedding.findOne({ student: testStudentDoc._id }).select('+encryptedData +templateReference');
    assert.equal(privilegedProfile.encryptedData, 'gAAAAABtest_encrypted_vector_ciphertext');
    assert.equal(privilegedProfile.templateReference, 'sha256_mock_template_fingerprint');
  });

  // Test 10: Consent Record Creation and Revocation
  await t.test('10. Consent Record tracking and revocation', async () => {
    const consent = await ConsentRecord.create({
      student: testStudentDoc._id,
      consentVersion: 'v1.0',
      consentStatus: 'active',
      policyReference: 'CAMPUS-BIO-PRIVACY-v1.0'
    });

    assert.ok(consent._id);
    assert.equal(consent.consentStatus, 'active');

    // Student revokes consent
    consent.consentStatus = 'withdrawn';
    consent.withdrawalTimestamp = new Date();
    await consent.save();

    const updated = await ConsentRecord.findById(consent._id);
    assert.equal(updated.consentStatus, 'withdrawn');
    assert.ok(updated.withdrawalTimestamp instanceof Date);
  });

  // Test 11: Immutable Audit Log Creation
  await t.test('11. AttendanceAuditLog records administrative overrides immutably', async () => {
    const log = await AttendanceAuditLog.record({
      actorId: testUserFaculty._id,
      actorRole: 'faculty',
      action: 'manual_correction',
      affectedStudentId: testStudentDoc._id,
      previousValue: 'absent',
      newValue: 'present',
      reason: 'Verified in person; camera hardware fault'
    });

    assert.ok(log);
    assert.ok(log._id);
    assert.equal(log.action, 'manual_correction');
    assert.equal(log.reason, 'Verified in person; camera hardware fault');
  });

  // Test 12: Database Isolation Guard Verification
  await t.test('12. verifyTestDatabaseIsolation rejects production, development, and non-test database URIs', () => {
    const dangerousUris = [
      'mongodb://localhost:27018/campus-erp',
      'mongodb://localhost:27018/production',
      'mongodb://localhost:27018/prod',
      'mongodb://localhost:27018/development',
      'mongodb://localhost:27018/test',
      'mongodb://localhost:27018/admin',
      'mongodb://localhost:27018/live-college-db'
    ];

    for (const uri of dangerousUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /TEST SAFETY VIOLATION/,
        `Should reject forbidden URI: ${uri}`
      );
    }

    // Valid test URIs must succeed
    assert.equal(verifyTestDatabaseIsolation('mongodb://localhost:27018/campus-erp-test-isolated'), true);
    assert.equal(verifyTestDatabaseIsolation('mongodb://127.0.0.1:27018/ci-test-db'), true);
  });

  // Teardown: Clean up isolated test database
  await t.test('Teardown: Drop isolated test database and disconnect', async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);
  });
});
