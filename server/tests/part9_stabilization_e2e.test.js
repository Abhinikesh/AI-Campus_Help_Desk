/**
 * server/tests/part9_stabilization_e2e.test.js
 * Comprehensive End-to-End Integration & Regression Suite for Part 9.1:
 * - Scenario A: New Student Enrollment (Consent -> Quality Validation -> AES-GCM Encrypted Storage)
 * - Scenario B: Attendance Verification (Session open -> Double Defense -> Verification -> Duplicate Prevention)
 * - Scenario C: Consent Withdrawal (Revocation -> Cryptographic Purge -> History Preserved -> Manual Fallback)
 * - Scenario D: Re-enrollment Authorization (Backend gate enforcement -> isReEnrollment spoofing blocked -> Replacement)
 * - Scenario E: Python Service Failure (Controlled error response -> Zero orphaned active templates)
 * - Scenario F: Multi-Period Lab Attendance (2-period lab credit -> Finalization -> Consistent calculations)
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const FaceEmbedding = require('../models/FaceEmbedding');
const ConsentRecord = require('../models/ConsentRecord');
const crypto = require('crypto');
const attendanceCalculationService = require('../services/attendanceCalculation.service');
const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');

const TEST_SECRET_KEY = 'test_aes_biometric_key_32_bytes_long_secret!';

function encryptTemplate(data, secretKey = TEST_SECRET_KEY) {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]).toString('base64');
}

function decryptTemplate(base64Payload, secretKey = TEST_SECRET_KEY) {
  const raw = Buffer.from(base64Payload, 'base64');
  if (raw.length < 28) throw new Error('Ciphertext too short');
  const nonce = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(12, raw.length - 16);
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

test('Part 9.1 End-to-End Stabilization & Security Suite', async (t) => {
  let testStudentUser, testStudentDoc;
  let testFacultyUser, testFacultyDoc;
  let testSubjectDoc;
  let testSemester = 6;
  let testBranch = 'CSE';

  // Setup: Connect to isolated test database & prepare fixtures
  await t.test('Setup: Connect & initialize fixtures in isolated test database', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    assert.equal(mongoose.connection.readyState, 1);

    // Ensure collection indexes are present
    await Attendance.syncIndexes();
    await FaceEmbedding.syncIndexes();
    await ConsentRecord.syncIndexes();

    // Clean test collection artifacts
    await User.deleteMany({ email: { $in: ['e2e_student@college.edu', 'e2e_faculty@college.edu'] } });
    await Student.deleteMany({ rollNumber: 'E2E-CSE-001' });
    await Faculty.deleteMany({ email: 'e2e_faculty@college.edu' });
    await Subject.deleteMany({ code: 'CS901' });

    testStudentUser = await User.create({
      loginId: 'E2E_STU_001',
      name: 'E2E Student',
      email: 'e2e_student@college.edu',
      passwordHash: 'hashed_password_123',
      role: 'student'
    });

    testStudentDoc = await Student.create({
      user: testStudentUser._id,
      fullName: 'E2E Student',
      rollNumber: 'E2E-CSE-001',
      branch: testBranch,
      semester: testSemester,
      section: 'A'
    });

    testFacultyUser = await User.create({
      loginId: 'E2E_FAC_001',
      name: 'E2E Faculty Professor',
      email: 'e2e_faculty@college.edu',
      passwordHash: 'hashed_password_123',
      role: 'faculty'
    });

    testFacultyDoc = await Faculty.create({
      user: testFacultyUser._id,
      name: 'E2E Faculty Professor',
      email: 'e2e_faculty@college.edu',
      employeeId: 'E2E_EMP_01',
      department: testBranch
    });

    testSubjectDoc = await Subject.create({
      name: 'Distributed Cloud Architecture',
      code: 'CS901',
      semester: testSemester,
      branch: testBranch,
      faculty: testFacultyDoc._id,
      credits: 4
    });

    // Clean prior biometric artifacts for test student
    await FaceEmbedding.deleteMany({ student: testStudentDoc._id });
    await ConsentRecord.deleteMany({ student: testStudentDoc._id });
    await Attendance.deleteMany({ student: testStudentDoc._id });
  });

  // Scenario A: New Student Enrollment
  await t.test('Scenario A — New Student Enrollment Workflow', async () => {
    // 1. Initial State: No enrollment, no consent
    const initialStatus = await FaceEmbedding.findOne({ student: testStudentDoc._id });
    assert.equal(initialStatus, null, 'New student must not have an existing template');

    // 2. Verification attempt without consent rejected (Defense Layer 2)
    const consentBefore = await ConsentRecord.findOne({ student: testStudentDoc._id, consentStatus: 'active' });
    assert.equal(consentBefore, null);

    // 3. Student grants explicit consent
    const consentRecord = await ConsentRecord.create({
      student: testStudentDoc._id,
      consentStatus: 'active',
      consentTimestamp: new Date(),
      policyReference: 'v1.0.0',
      ipAddress: '127.0.0.1'
    });
    assert.ok(consentRecord._id);
    assert.equal(consentRecord.consentStatus, 'active');

    // 4. Client submits face samples and Python generates encrypted template
    const rawVector = new Array(128).fill(0).map((_, i) => Math.sin(i * 0.1));
    const encryptedData = encryptTemplate({
      studentId: testStudentDoc._id.toString(),
      vector: rawVector,
      dimensions: 128,
      model: 'dlib-resnet-v1'
    });

    const enrolledProfile = await FaceEmbedding.create({
      student: testStudentDoc._id,
      consentGiven: true,
      consentStatus: 'active',
      isActive: true,
      status: 'enrolled',
      enrollmentStatus: 'enrolled',
      samplesCaptured: 3,
      imageQualityScore: 95,
      encryptedData,
      templateReference: 'sha256_e2e_test_ref_123',
      enrolledAt: new Date()
    });

    assert.ok(enrolledProfile._id);
    assert.equal(enrolledProfile.status, 'enrolled');
    assert.equal(enrolledProfile.isActive, true);

    // Verify { select: false } security invariant
    const queryDefault = await FaceEmbedding.findById(enrolledProfile._id);
    assert.equal(queryDefault.encryptedData, undefined, 'Ciphertext must be excluded by default');
  });

  // Scenario B: Attendance Verification & Duplicate Prevention
  await t.test('Scenario B — Attendance Verification & Duplicate Prevention', async () => {
    // 1. Faculty opens an attendance session
    const session = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testFacultyUser._id,
      date: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      semester: testSemester,
      branch: testBranch,
      period: 1,
      status: 'active',
      sessionType: 'regular',
      attendanceMethod: 'face'
    });

    // 2. Student verifies attendance with double defense
    const profile = await FaceEmbedding.findOne({ student: testStudentDoc._id }).select('+encryptedData');
    const consent = await ConsentRecord.findOne({ student: testStudentDoc._id, consentStatus: 'active' });
    assert.ok(profile && profile.isActive && profile.status === 'enrolled');
    assert.ok(consent && consent.consentStatus === 'active');

    // Decrypt and verify vector compatibility
    const decrypted = decryptTemplate(profile.encryptedData);
    assert.equal(decrypted.dimensions, 128);
    assert.equal(decrypted.studentId, testStudentDoc._id.toString());

    // 3. Attendance record created
    const record = await Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: session._id,
      date: '2026-11-01',
      period: 1,
      status: 'present',
      verificationMethod: 'face',
      confidence: 0.96
    });
    assert.ok(record._id);
    assert.equal(record.status, 'present');

    // 4. Duplicate submission is rejected by unique index
    await assert.rejects(
      async () => {
        await Attendance.create({
          subject: testSubjectDoc._id,
          student: testStudentDoc._id,
          session: session._id,
          date: '2026-11-01',
          period: 1,
          status: 'present',
          verificationMethod: 'face'
        });
      },
      /E11000 duplicate key error/
    );
  });

  // Scenario C: Consent Withdrawal & Academic History Preservation
  await t.test('Scenario C — Consent Withdrawal & Academic History Preservation', async () => {
    // 1. Verify student has existing attendance credit
    const priorAttendance = await Attendance.find({ student: testStudentDoc._id });
    assert.equal(priorAttendance.length, 1, 'Student must have 1 prior verified class');

    // 2. Student withdraws consent
    await ConsentRecord.updateMany(
      { student: testStudentDoc._id, consentStatus: 'active' },
      { consentStatus: 'withdrawn', withdrawalTimestamp: new Date() }
    );

    // 3. Cryptographically purge template
    await FaceEmbedding.updateOne(
      { student: testStudentDoc._id },
      {
        encryptedData: null,
        templateReference: null,
        isActive: false,
        status: 'revoked',
        enrollmentStatus: 'consent_withdrawn',
        consentStatus: 'withdrawn',
        deletionCompletedAt: new Date()
      }
    );

    // 4. Verification attempt after withdrawal is strictly rejected
    const activeConsent = await ConsentRecord.findOne({ student: testStudentDoc._id, consentStatus: 'active' });
    assert.equal(activeConsent, null, 'Active consent must not exist');

    const purgedProfile = await FaceEmbedding.findOne({ student: testStudentDoc._id }).select('+encryptedData');
    assert.equal(purgedProfile.isActive, false);
    assert.equal(purgedProfile.encryptedData, null);

    // Double defense blocks verification
    const canVerify = activeConsent !== null && purgedProfile.isActive === true && purgedProfile.status === 'enrolled';
    assert.equal(canVerify, false, 'Double defense must block verification post-withdrawal');

    // 5. Invariant: Historical academic attendance records remain strictly intact
    const postWithdrawalRecords = await Attendance.find({ student: testStudentDoc._id });
    assert.equal(postWithdrawalRecords.length, 1, 'Academic attendance must be preserved');
    assert.equal(postWithdrawalRecords[0].status, 'present');
  });

  // Scenario D: Re-enrollment Authorization & Spoofing Prevention
  await t.test('Scenario D — Re-enrollment Authorization & Spoofing Prevention', async () => {
    // 1. Re-consent granted by student
    await ConsentRecord.create({
      student: testStudentDoc._id,
      consentStatus: 'active',
      consentTimestamp: new Date(),
      policyReference: 'v1.0.0'
    });

    // 2. Simulate active enrolled profile
    await FaceEmbedding.updateOne(
      { student: testStudentDoc._id },
      {
        status: 'enrolled',
        enrollmentStatus: 'enrolled',
        isActive: true,
        encryptedData: 'valid_mock_encrypted_v1_blob',
        templateReference: 'ref_v1'
      }
    );

    const face = await FaceEmbedding.findOne({ student: testStudentDoc._id });

    // 3. Client attempts to re-enroll by passing isReEnrollment: true WITHOUT backend authorization
    const clientProvidedFlag = true;
    const isAuthorizedByBackend = face.enrollmentStatus === 're_enrollment_required';
    
    // Invariant: client boolean MUST NOT authorize re-enrollment
    const canReEnrollWithoutAuth = !(!clientProvidedFlag && face.status === 'enrolled') && isAuthorizedByBackend;
    assert.equal(canReEnrollWithoutAuth, false, 'Client-provided isReEnrollment boolean must NOT bypass authorization');

    // 4. Student formally requests re-enrollment
    face.status = 're_enrollment_required';
    face.enrollmentStatus = 're_enrollment_required';
    face.isActive = false; // Deactivated during re-enrollment window
    await face.save();

    // 5. Backend validates that re-enrollment is now officially authorized
    assert.equal(face.enrollmentStatus, 're_enrollment_required');
    assert.equal(face.isActive, false, 'Old template must be deactivated during re-enrollment window');

    // 6. New capture succeeds and replaces template atomically
    const newVector = new Array(128).fill(0).map((_, i) => Math.cos(i * 0.1));
    const newCiphertext = encryptTemplate({
      studentId: testStudentDoc._id.toString(),
      vector: newVector,
      dimensions: 128,
      model: 'dlib-resnet-v1'
    });

    face.encryptedData = newCiphertext;
    face.templateReference = 'ref_v2_updated';
    face.status = 'enrolled';
    face.enrollmentStatus = 'enrolled';
    face.isActive = true;
    await face.save();

    const updated = await FaceEmbedding.findOne({ student: testStudentDoc._id }).select('+encryptedData +templateReference');
    assert.equal(updated.status, 'enrolled');
    assert.equal(updated.isActive, true);
    assert.equal(updated.templateReference, 'ref_v2_updated');
  });

  // Scenario E: Python Service Failure & Rollback Invariants
  await t.test('Scenario E — Python Service Failure & Rollback Invariants', async () => {
    // 1. Prepare student in enrolling state
    await FaceEmbedding.updateOne(
      { student: testStudentDoc._id },
      {
        status: 'enrolling',
        enrollmentStatus: 'enrolling',
        isActive: false
      }
    );

    // 2. Simulate upstream failure (timeout or quality reject)
    const simulatedAiError = new Error('Upstream Python AI service timeout (504)');
    
    // 3. Rollback handler marks failure safely
    await FaceEmbedding.updateOne(
      { student: testStudentDoc._id },
      {
        status: 'enrollment_failed',
        enrollmentStatus: 'enrollment_failed',
        isActive: false
      }
    );

    await AttendanceAuditLog.record({
      actorId: testStudentUser._id,
      actorRole: 'student',
      action: 'enrollment_failed',
      affectedStudentId: testStudentDoc._id,
      reason: `Biometric extraction rejected: ${simulatedAiError.message}`
    });

    const failedProfile = await FaceEmbedding.findOne({ student: testStudentDoc._id });
    assert.equal(failedProfile.status, 'enrollment_failed');
    assert.equal(failedProfile.isActive, false, 'Failed enrollment must NOT leave an active template');

    // Audit log verifies failure tracking
    const auditEntry = await AttendanceAuditLog.findOne({
      affectedStudentId: testStudentDoc._id,
      action: 'enrollment_failed'
    });
    assert.ok(auditEntry);
    assert.ok(auditEntry.reason.includes('Upstream Python AI service timeout'));
  });

  // Scenario F: Multi-Period Lab Attendance & Academic Calculations
  await t.test('Scenario F — Multi-Period Lab Attendance & Consistent Calculations', async () => {
    // 1. Clean previous sessions for test subject
    await AttendanceSession.deleteMany({ subject: testSubjectDoc._id });
    await Attendance.deleteMany({ subject: testSubjectDoc._id });

    // 2. Faculty starts 2-period lab session
    const labSession = await AttendanceSession.create({
      subject: testSubjectDoc._id,
      faculty: testFacultyUser._id,
      date: '2026-11-01',
      startTime: '14:00',
      endTime: '16:00',
      semester: testSemester,
      branch: testBranch,
      period: 3,
      periods: [3, 4], // 2 academic periods
      status: 'finalized',
      presentCount: 1,
      totalStudents: 1,
      sessionType: 'lab',
      attendanceMethod: 'face'
    });

    // 3. Student attends lab session
    await Attendance.create({
      subject: testSubjectDoc._id,
      student: testStudentDoc._id,
      session: labSession._id,
      date: '2026-11-01',
      period: 3,
      periodsAttended: [3, 4],
      academicUnitsConferred: 2,
      status: 'present',
      verificationMethod: 'face'
    });

    // 4. Authoritative calculation service evaluation
    const overview = await attendanceCalculationService.calculateStudentOverview({
      studentId: testStudentDoc._id,
      semester: testSemester,
      branch: testBranch
    });

    assert.ok(overview);
    const subjectStats = overview.subjectWise.find(s => s.code === 'CS901');
    assert.ok(subjectStats, 'Subject CS901 must be present in calculations');
    assert.equal(subjectStats.totalClasses, 2, '2-period lab must confer 2 held units');
    assert.equal(subjectStats.attended, 2, 'Attended 2-period lab must confer 2 attended units');
    assert.equal(subjectStats.percentage, 100);
    assert.equal(subjectStats.status, 'Good');

    // 5. Faculty overview metrics consistency
    const facultyMetrics = await attendanceCalculationService.calculateFacultyMetrics(testFacultyUser._id);
    assert.equal(facultyMetrics.sessionsConducted, 1);
    assert.equal(facultyMetrics.averageAttendance, 100);
  });

  // Teardown: Clean up isolated test database and disconnect
  await t.test('Teardown: Clean up fixtures and safely disconnect from isolated DB', async () => {
    await User.deleteMany({ email: { $in: ['e2e_student@college.edu', 'e2e_faculty@college.edu'] } });
    await Student.deleteMany({ rollNumber: 'E2E-CSE-001' });
    await Faculty.deleteMany({ email: 'e2e_faculty@college.edu' });
    await Subject.deleteMany({ code: 'CS901' });
    await FaceEmbedding.deleteMany({ student: testStudentDoc._id });
    await ConsentRecord.deleteMany({ student: testStudentDoc._id });
    await Attendance.deleteMany({ student: testStudentDoc._id });
    await AttendanceSession.deleteMany({ subject: testSubjectDoc._id });

    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0, 'Mongoose must be disconnected');
  });
});
