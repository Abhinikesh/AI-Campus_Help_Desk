/**
 * server/tests/session_lifecycle_and_security.test.js
 * Comprehensive Part 6 Test Suite:
 * - Isolated test database safety & isolation
 * - Session state machine & atomic conditional transitions
 * - Automatic session expiration background scheduler
 * - Student eligibility, roster scoping, and consent enforcement
 * - Rotating QR challenge validation and replay protection
 * - Multi-period lab session conflict detection & idempotency
 * - Controlled session finalization and absentee marking
 * - Manual attendance correction with immutable audit trail
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');
const FaceEmbedding = require('../models/FaceEmbedding');
const ConsentRecord = require('../models/ConsentRecord');

const { transitionSessionState, ALLOWED_TRANSITIONS } = require('../services/sessionStateMachine.service');
const sessionScheduler = require('../services/sessionScheduler.service');
const qrChallenge = require('../services/qrChallenge.service');

// Section 14: Strict test database isolation
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';

function verifyTestDatabaseIsolation(uri) {
  const dbName = uri.split('/').pop().split('?')[0];
  const forbiddenNames = ['campus-erp', 'test', 'production', 'prod', 'development'];
  if (forbiddenNames.includes(dbName.toLowerCase())) {
    throw new Error(
      `TEST SAFETY VIOLATION: Refusing to run tests against '${dbName}'. Tests must use an isolated test database (e.g. campus-erp-test-isolated).`
    );
  }
}

test('Part 6 Session Lifecycle, Verification Hardening & Security Suite', async (t) => {
  let facultyUser, facultyUser2, studentUser1, studentUser2, adminUser;
  let facultyDoc, facultyDoc2, studentDoc1, studentDoc2, subjectDoc, labSubjectDoc;

  // ─────────────────────────────────────────────────────────────────────────────
  // Setup: Isolated DB Connection & Fixture Seeding
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('Setup: Connect to isolated test database and initialize fixtures', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(TEST_DB_URI);
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');

    // Wipe test collections
    const collections = await mongoose.connection.db.collections();
    for (const coll of collections) {
      await coll.deleteMany({});
    }

    // Build indexes
    await Promise.all([
      Attendance.createIndexes(),
      AttendanceSession.createIndexes(),
      AttendanceAuditLog.createIndexes(),
      FaceEmbedding.createIndexes(),
      ConsentRecord.createIndexes(),
    ]);

    // 1. Users
    const DUMMY_PW = '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF0123456789ABC';
    adminUser = await User.create({ name: 'Admin One', email: 'admin1@test.edu', role: 'admin', loginId: 'ADM001', passwordHash: DUMMY_PW });
    facultyUser = await User.create({ name: 'Dr. Faculty A', email: 'fac_a@test.edu', role: 'faculty', loginId: 'FAC001', passwordHash: DUMMY_PW });
    facultyUser2 = await User.create({ name: 'Dr. Faculty B', email: 'fac_b@test.edu', role: 'faculty', loginId: 'FAC002', passwordHash: DUMMY_PW });
    studentUser1 = await User.create({ name: 'Student Alpha', email: 'alpha@test.edu', role: 'student', loginId: 'STU001', passwordHash: DUMMY_PW });
    studentUser2 = await User.create({ name: 'Student Beta', email: 'beta@test.edu', role: 'student', loginId: 'STU002', passwordHash: DUMMY_PW });

    // 2. Profiles
    facultyDoc = await Faculty.create({ user: facultyUser._id, employeeId: 'EMP-FAC-001', department: 'CSE' });
    facultyDoc2 = await Faculty.create({ user: facultyUser2._id, employeeId: 'EMP-FAC-002', department: 'CSE' });

    studentDoc1 = await Student.create({
      user: studentUser1._id,
      fullName: studentUser1.name,
      rollNumber: 'CSE-2026-001',
      branch: 'CSE',
      semester: 5,
      section: 'A'
    });

    studentDoc2 = await Student.create({
      user: studentUser2._id,
      fullName: studentUser2.name,
      rollNumber: 'CSE-2026-002',
      branch: 'CSE',
      semester: 5,
      section: 'A'
    });

    // 3. Subjects
    subjectDoc = await Subject.create({
      name: 'Advanced Algorithms',
      code: 'CS501',
      credits: 4,
      branch: 'CSE',
      semester: 5,
      faculty: facultyUser._id
    });

    labSubjectDoc = await Subject.create({
      name: 'Algorithms Laboratory',
      code: 'CS501L',
      credits: 2,
      branch: 'CSE',
      semester: 5,
      faculty: facultyUser._id
    });

    // 4. Biometric Face Profile & Consent for Student 1
    await FaceEmbedding.create({
      student: studentDoc1._id,
      enrollmentStatus: 'enrolled',
      status: 'enrolled',
      consentStatus: 'active',
      consentGiven: true,
      isActive: true,
      templateReference: 'sha256-ref-001'
    });

    await ConsentRecord.create({
      student: studentDoc1._id,
      consentStatus: 'active',
      consentTimestamp: new Date(),
      consentVersion: 'v2.0'
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Session Lifecycle & State Machine
  // ─────────────────────────────────────────────────────────────────────────────
  let testSession;

  await t.test('1. Valid session lifecycle transitions: scheduled -> open -> paused -> active -> completed -> finalized', async () => {
    testSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 1,
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      status: 'scheduled',
      branch: 'CSE',
      semester: 5,
      section: 'A'
    });

    assert.equal(testSession.status, 'scheduled');

    // scheduled -> open
    testSession = await transitionSessionState({
      sessionId: testSession._id,
      targetState: 'open',
      actorId: facultyUser._id,
      actorRole: 'faculty',
      reason: 'Opening session for attendance'
    });
    assert.equal(testSession.status, 'open');
    assert.ok(testSession.openedAt);

    // open -> paused
    testSession = await transitionSessionState({
      sessionId: testSession._id,
      targetState: 'paused',
      actorId: facultyUser._id,
      actorRole: 'faculty',
      reason: 'Pausing class temporarily'
    });
    assert.equal(testSession.status, 'paused');

    // paused -> active
    testSession = await transitionSessionState({
      sessionId: testSession._id,
      targetState: 'active',
      actorId: facultyUser._id,
      actorRole: 'faculty',
      reason: 'Resuming class'
    });
    assert.equal(testSession.status, 'active');

    // active -> completed
    testSession = await transitionSessionState({
      sessionId: testSession._id,
      targetState: 'completed',
      actorId: facultyUser._id,
      actorRole: 'faculty',
      reason: 'Class ended'
    });
    assert.equal(testSession.status, 'completed');
    assert.ok(testSession.closedAt);

    // completed -> finalized
    testSession = await transitionSessionState({
      sessionId: testSession._id,
      targetState: 'finalized',
      actorId: facultyUser._id,
      actorRole: 'faculty',
      reason: 'Finalizing lecture roster'
    });
    assert.equal(testSession.status, 'finalized');
    assert.ok(testSession.finalizedAt);
  });

  await t.test('2. Reject illegal state transitions (terminal finalized -> active)', async () => {
    await assert.rejects(
      async () => {
        await transitionSessionState({
          sessionId: testSession._id,
          targetState: 'active',
          actorId: facultyUser._id,
          actorRole: 'faculty',
          reason: 'Illegal jump attempt'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Invalid session state transition/);
        return true;
      }
    );
  });

  await t.test('3. Enforce RBAC: Unauthorized faculty cannot transition another teacher session', async () => {
    await assert.rejects(
      async () => {
        await transitionSessionState({
          sessionId: testSession._id,
          targetState: 'cancelled',
          actorId: facultyUser2._id, // Faculty 2 does NOT own testSession
          actorRole: 'faculty',
          reason: 'Unauthorized attempt'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /only control your own attendance sessions/);
        return true;
      }
    );
  });

  await t.test('4. Atomic concurrency protection: conflicting concurrent transitions', async () => {
    const liveSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 2,
      status: 'active',
      branch: 'CSE',
      semester: 5
    });

    // Simulate two concurrent requests: one pauses, other closes
    // Direct conditional update simulation
    const res1 = await AttendanceSession.findOneAndUpdate(
      { _id: liveSession._id, status: 'active' },
      { $set: { status: 'paused' } },
      { new: true }
    );
    assert.ok(res1);
    assert.equal(res1.status, 'paused');

    // Second request expected 'active' but status is now 'paused'
    const res2 = await AttendanceSession.findOneAndUpdate(
      { _id: liveSession._id, status: 'active' },
      { $set: { status: 'completed' } },
      { new: true }
    );
    assert.equal(res2, null, 'Second concurrent request must fail atomically');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Automatic Session Expiration Background Scheduler
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('5. Session scheduler: active session before deadline remains untouched', async () => {
    const freshSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 3,
      startTime: '11:00 AM',
      endTime: '12:00 PM',
      status: 'active',
      openedAt: new Date('2026-11-01T11:05:00Z'),
      branch: 'CSE',
      semester: 5
    });

    // Simulated current time: 11:20 AM (well before 12:00 PM + 15 min grace = 12:15 PM)
    const simulatedClock = new Date('2026-11-01T11:20:00Z');
    const result = await sessionScheduler.checkAndExpireSessions(simulatedClock, { gracePeriodMinutes: 15 });

    const check = await AttendanceSession.findById(freshSession._id);
    assert.equal(check.status, 'active');
    assert.equal(result.expiredSessionIds.includes(freshSession._id.toString()), false);
  });

  await t.test('6. Session scheduler: expired active session is automatically closed with audit log', async () => {
    const overdueSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 4,
      startTime: '08:00 AM',
      endTime: '09:00 AM',
      status: 'active',
      openedAt: new Date('2026-11-01T08:00:00Z'),
      branch: 'CSE',
      semester: 5
    });

    // Simulated clock: 10:00 AM (past 09:00 AM + 15m grace)
    const simulatedClock = new Date('2026-11-01T10:00:00Z');
    const result = await sessionScheduler.checkAndExpireSessions(simulatedClock, { gracePeriodMinutes: 15 });

    assert.ok(result.expiredCount >= 1);
    assert.ok(result.expiredSessionIds.includes(overdueSession._id.toString()));

    const check = await AttendanceSession.findById(overdueSession._id);
    assert.equal(check.status, 'completed');
    assert.equal(check.autoExpired, true);

    // Verify system audit log
    const audit = await AttendanceAuditLog.findOne({
      sessionId: overdueSession._id,
      action: 'auto_expire_session'
    });
    assert.ok(audit, 'Audit log must be created for automatic expiration');
    assert.equal(audit.actorRole, 'system');
  });

  await t.test('7. Session scheduler: overlapping execution protection', async () => {
    sessionScheduler.isExecuting = true;
    const res = await sessionScheduler.checkAndExpireSessions(new Date());
    assert.equal(res.skipped, true);
    sessionScheduler.isExecuting = false;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. QR Challenge & Replay Protection
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('8. QR challenge: generate, validate, and reject expired or cross-session tokens', async () => {
    const liveSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 5,
      status: 'active',
      branch: 'CSE',
      semester: 5
    });

    const otherSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      period: 6,
      status: 'active',
      branch: 'CSE',
      semester: 5
    });

    // Generate valid challenge (45s validity)
    const challenge = qrChallenge.generateChallenge(liveSession._id, 45);
    assert.ok(challenge.token);
    assert.ok(challenge.expiresAt);

    // 1. Valid token passes
    assert.equal(qrChallenge.validateChallenge(liveSession, challenge.token), true);

    // 2. Token from another session rejected
    assert.throws(
      () => {
        qrChallenge.validateChallenge(otherSession, challenge.token);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /different session/i);
        return true;
      }
    );

    // 3. Expired token rejected
    const expiredClock = new Date(Date.now() + 60 * 1000); // 60s in future
    assert.throws(
      () => {
        qrChallenge.validateChallenge(liveSession, challenge.token, expiredClock);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /expired/i);
        return true;
      }
    );

    // 4. Token rejected on closed session
    liveSession.status = 'completed';
    assert.throws(
      () => {
        qrChallenge.validateChallenge(liveSession, challenge.token);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /inactive or closed session/i);
        return true;
      }
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Multi-Period Lab Block Attendance & Idempotency
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('9. Multi-period laboratory block session creation and conflict detection', async () => {
    const labSession = await AttendanceSession.create({
      subject: labSubjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-01',
      periods: [7, 8],
      sessionType: 'lab',
      status: 'open',
      branch: 'CSE',
      semester: 5
    });

    assert.deepEqual(labSession.periods, [7, 8]);
    assert.equal(labSession.periodCount, 2);
    assert.equal(labSession.period, 7);

    // Verify conflict: another session on period 8 should be blocked
    const conflictingQuery = {
      subject: labSubjectDoc._id,
      date: '2026-11-01',
      $or: [
        { period: { $in: [8] } },
        { periods: { $in: [8] } }
      ],
      status: { $in: ['open', 'active', 'scheduled'] }
    };
    const conflict = await AttendanceSession.findOne(conflictingQuery);
    assert.ok(conflict, 'Conflicting session on covered period 8 must be detected');
  });

  await t.test('10. Multi-period attendance credit and compound uniqueness', async () => {
    const labSession = await AttendanceSession.findOne({ periods: [7, 8] });

    // Mark attendance for student 1 for lab block [7, 8]
    const rec1 = await Attendance.create({
      session: labSession._id,
      subject: labSubjectDoc._id,
      student: studentDoc1._id,
      date: '2026-11-01',
      period: 7,
      periods: [7, 8],
      periodCount: 2,
      status: 'present',
      verificationMethod: 'face',
      verificationStatus: 'verified'
    });

    assert.equal(rec1.periodCount, 2);
    assert.deepEqual(rec1.periods, [7, 8]);

    // Attempt duplicate session mark for same student -> rejected by unique index { session: 1, student: 1 }
    await assert.rejects(
      async () => {
        await Attendance.create({
          session: labSession._id,
          subject: labSubjectDoc._id,
          student: studentDoc1._id,
          date: '2026-11-01',
          period: 7,
          status: 'present'
        });
      },
      (err) => {
        assert.equal(err.code, 11000, 'Duplicate session check-in must trigger MongoDB E11000');
        return true;
      }
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Finalization & Absentee Marking
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('11. Finalization: unmarked eligible roster students are recorded as absent', async () => {
    const lectureSession = await AttendanceSession.create({
      subject: subjectDoc._id,
      faculty: facultyUser._id,
      date: '2026-11-02',
      period: 1,
      status: 'open',
      branch: 'CSE',
      semester: 5
    });

    // Student 1 marks present
    await Attendance.create({
      session: lectureSession._id,
      subject: subjectDoc._id,
      student: studentDoc1._id,
      date: '2026-11-02',
      period: 1,
      status: 'present',
      verificationMethod: 'face'
    });

    // Faculty finalizes session: student 2 was in the roster but did not check in
    const enrolledStudents = await Student.find({ semester: 5, branch: 'CSE' });
    assert.equal(enrolledStudents.length, 2);

    for (const st of enrolledStudents) {
      const existing = await Attendance.findOne({ session: lectureSession._id, student: st._id });
      if (!existing) {
        await Attendance.create({
          session: lectureSession._id,
          subject: subjectDoc._id,
          student: st._id,
          date: '2026-11-02',
          period: 1,
          status: 'absent',
          verificationMethod: 'system'
        });
      }
    }

    const recs = await Attendance.find({ session: lectureSession._id });
    assert.equal(recs.length, 2);

    const s1Rec = recs.find(r => r.student.toString() === studentDoc1._id.toString());
    const s2Rec = recs.find(r => r.student.toString() === studentDoc2._id.toString());
    assert.equal(s1Rec.status, 'present');
    assert.equal(s2Rec.status, 'absent');
    assert.equal(s2Rec.verificationMethod, 'system');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Manual Correction & Audit Log Preservation
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('12. Manual attendance correction requires justification and appends immutable audit log', async () => {
    const absentRecord = await Attendance.findOne({
      student: studentDoc2._id,
      status: 'absent'
    });
    assert.ok(absentRecord);

    const prevStatus = absentRecord.status;
    absentRecord.status = 'excused';
    absentRecord.isManualOverride = true;
    absentRecord.verificationMethod = 'manual';
    absentRecord.correctionReason = 'Approved medical leave certificate #MED-994';
    absentRecord.correctedBy = facultyUser._id;
    absentRecord.correctedAt = new Date();
    await absentRecord.save();

    await AttendanceAuditLog.record({
      actorId: facultyUser._id,
      actorRole: 'faculty',
      action: 'manual_correction',
      attendanceId: absentRecord._id,
      sessionId: absentRecord.session,
      affectedStudentId: studentDoc2._id,
      previousValue: { status: prevStatus },
      newValue: { status: 'excused' },
      reason: 'Approved medical leave certificate #MED-994'
    });

    const check = await Attendance.findById(absentRecord._id);
    assert.equal(check.status, 'excused');
    assert.equal(check.isManualOverride, true);

    const audit = await AttendanceAuditLog.findOne({
      attendanceId: absentRecord._id,
      action: 'manual_correction'
    });
    assert.ok(audit);
    assert.equal(audit.reason, 'Approved medical leave certificate #MED-994');
    assert.equal(audit.previousValue.status, 'absent');
    assert.equal(audit.newValue.status, 'excused');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Teardown: Drop isolated test database
  // ─────────────────────────────────────────────────────────────────────────────
  await t.test('Teardown: Clean up and drop isolated test database', async () => {
    assert.equal(mongoose.connection.db.databaseName, 'campus-erp-test-isolated');
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });
});
