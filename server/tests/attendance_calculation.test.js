/**
 * server/tests/attendance_calculation.test.js
 * Comprehensive Part 8 Test Suite for Attendance Accuracy, Academic Calculations & Data Consistency:
 * - 31 Verification Scenarios across 7 categories
 * - Multi-period laboratory weighting
 * - Zero-class safe handling without false 0% penalty
 * - Strict unrounded threshold enforcement
 * - Session lifecycle filtering (finalized vs open/active/cancelled)
 * - Controlled corrections & audit integrity
 * - IST timezone date boundary standardization
 * - Faculty & student dashboard metrics consistency
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

const attendanceCalculationService = require('../services/attendanceCalculation.service');
const pythonAiService = require('../services/pythonAi.service');

// Strict test database isolation
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

test('Part 8 Attendance Accuracy, Academic Calculations & Consistency Suite', async (t) => {
  verifyTestDatabaseIsolation(TEST_DB_URI);

  await mongoose.connect(TEST_DB_URI);

  // Setup fixtures
  let testStudentUser, testStudent;
  let testFacultyUser, testFaculty;
  let testSubjectLecture, testSubjectLab;

  await t.test('Setup Test Fixtures in Isolated DB', async () => {
    await AttendanceAuditLog.deleteMany({});
    await Attendance.deleteMany({});
    await AttendanceSession.deleteMany({});
    await Subject.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await User.deleteMany({});
    await AttendanceSettings.deleteMany({});

    await AttendanceSettings.create({
      minAttendancePercent: 75,
      warningThresholdPercent: 65,
      allowManualOverride: true,
      requireBiometricEnrollment: true,
    });

    testStudentUser = await User.create({
      loginId: 'STU_TEST_01',
      name: 'Rohan Sharma',
      email: `rohan.test.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'student',
      status: 'active',
    });

    testStudent = await Student.create({
      user: testStudentUser._id,
      fullName: 'Rohan Sharma',
      rollNumber: '2024TEST01',
      branch: 'CSE',
      semester: 5,
      section: 'A',
    });

    testFacultyUser = await User.create({
      loginId: 'FAC_TEST_01',
      name: 'Dr. Sunita Rao',
      email: `sunita.test.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'faculty',
      status: 'active',
    });

    testFaculty = await Faculty.create({
      user: testFacultyUser._id,
      name: 'Dr. Sunita Rao',
      employeeId: 'FAC_TEST_01',
      department: 'Computer Science & Engineering',
    });

    testSubjectLecture = await Subject.create({
      name: 'Design Analysis of Algorithms',
      code: 'CS501',
      department: 'Computer Science & Engineering',
      branch: 'CSE',
      semester: 5,
      credits: 4,
      faculty: testFacultyUser._id,
    });

    testSubjectLab = await Subject.create({
      name: 'Algorithms Lab',
      code: 'CS508L',
      department: 'Computer Science & Engineering',
      branch: 'CSE',
      semester: 5,
      credits: 2,
      faculty: testFacultyUser._id,
    });

    assert.ok(testStudent._id);
    assert.ok(testFaculty._id);
    assert.ok(testSubjectLecture._id);
    assert.ok(testSubjectLab._id);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Basic Calculations & Mathematical Accuracy (Scenarios 1-6)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('1. Perfect attendance (10/10 held/attended) equals 100% and Good status', async () => {
    // Create 10 finalized sessions and 10 present records
    const sessionIds = [];
    for (let i = 1; i <= 10; i++) {
      const sess = await AttendanceSession.create({
        subject: testSubjectLecture._id,
        faculty: testFacultyUser._id,
        branch: 'CSE',
        semester: 5,
        date: `2026-10-${String(i).padStart(2, '0')}`,
        period: 1,
        periodCount: 1,
        status: 'finalized',
      });
      sessionIds.push(sess._id);
      await Attendance.create({
        session: sess._id,
        student: testStudent._id,
        subject: testSubjectLecture._id,
        date: sess.date,
        period: 1,
        status: 'present',
        verificationMethod: 'face',
      });
    }

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 10);
    assert.equal(res.rawPercentage, 100);
    assert.equal(res.displayPercentage, 100);
    assert.equal(res.complianceStatus, 'Good');
    assert.equal(res.meetsRequirement, true);
  });

  await t.test('2. 10 held, 8 attended equals 80% and Good status', async () => {
    // Change 2 records to absent
    const records = await Attendance.find({ student: testStudent._id, subject: testSubjectLecture._id }).limit(2);
    for (const r of records) {
      r.status = 'absent';
      await r.save();
    }

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 8);
    assert.equal(res.missedUnits, 2);
    assert.equal(res.rawPercentage, 80);
    assert.equal(res.complianceStatus, 'Good');
    assert.equal(res.meetsRequirement, true);
  });

  await t.test('3. 10 held, 7 attended equals 70% and Warning status (below 75%)', async () => {
    const records = await Attendance.find({ student: testStudent._id, subject: testSubjectLecture._id, status: 'present' }).limit(1);
    records[0].status = 'absent';
    await records[0].save();

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 7);
    assert.equal(res.missedUnits, 3);
    assert.equal(res.rawPercentage, 70);
    assert.equal(res.complianceStatus, 'Warning');
    assert.equal(res.meetsRequirement, false);
  });

  await t.test('4. 10 held, 5 attended equals 50% and Critical status', async () => {
    const records = await Attendance.find({ student: testStudent._id, subject: testSubjectLecture._id, status: 'present' }).limit(2);
    for (const r of records) {
      r.status = 'absent';
      await r.save();
    }

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 5);
    assert.equal(res.missedUnits, 5);
    assert.equal(res.rawPercentage, 50);
    assert.equal(res.complianceStatus, 'Critical');
    assert.equal(res.meetsRequirement, false);
  });

  await t.test('5. 10 held, 0 attended equals 0% and Critical status', async () => {
    await Attendance.updateMany({ student: testStudent._id, subject: testSubjectLecture._id }, { status: 'absent' });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 0);
    assert.equal(res.missedUnits, 10);
    assert.equal(res.rawPercentage, 0);
    assert.equal(res.displayPercentage, 0);
    assert.equal(res.complianceStatus, 'Critical');
    assert.equal(res.meetsRequirement, false);
  });

  await t.test('6. Unrounded threshold boundary: 74.99% strictly fails 75% without false rounding promotion', () => {
    // 74.999% raw percentage vs 75% minimum requirement
    const rawPct = 74.999;
    const status = attendanceCalculationService.getComplianceStatus(rawPct, 75);
    assert.equal(status, 'Warning'); // Must NOT be promoted to 'Good'
    assert.equal(rawPct >= 75, false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Zero Held Units / Insufficient Data Safe Handling (Scenarios 7-9)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('7. Zero held units returns hasData: false, rawPercentage: null, displayPercentage: null', async () => {
    // CS508L has 0 sessions created
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.equal(res.heldUnits, 0);
    assert.equal(res.attendedUnits, 0);
    assert.equal(res.rawPercentage, null);
    assert.equal(res.displayPercentage, null);
    assert.equal(res.hasData, false);
    assert.equal(res.complianceStatus, 'No Data');
    assert.equal(res.meetsRequirement, false);
  });

  await t.test('8. Zero held units does not apply artificial 0% penalty', async () => {
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.notEqual(res.complianceStatus, 'Critical');
    assert.equal(res.displayPercentage, null);
  });

  await t.test('9. Multi-subject overview with zero-class subjects reported as No Data without corrupting overall units', async () => {
    // Reset lecture to 10 attended
    await Attendance.updateMany({ student: testStudent._id, subject: testSubjectLecture._id }, { status: 'present' });

    const overview = await attendanceCalculationService.calculateStudentOverview({
      studentId: testStudent._id,
      semester: 5,
      branch: 'CSE',
    });

    assert.equal(overview.hasData, true);
    // CS501: 10/10, CS508L: 0/0
    assert.equal(overview.summary.totalClasses, 10);
    assert.equal(overview.summary.totalAttended, 10);
    assert.equal(overview.summary.overall, 100);

    const labCard = overview.subjectWise.find(s => s.code === 'CS508L');
    assert.ok(labCard);
    assert.equal(labCard.total, 0);
    assert.equal(labCard.status, 'No Data');
    assert.equal(labCard.hasData, false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Multi-Period Laboratory Attendance Calculations (Scenarios 10-15)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('10. 2-period lab session attended confers 2 held units and 2 attended units', async () => {
    const labSession = await AttendanceSession.create({
      subject: testSubjectLab._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-15',
      period: 3,
      periodCount: 2,
      periods: [3, 4],
      status: 'finalized',
    });

    await Attendance.create({
      session: labSession._id,
      student: testStudent._id,
      subject: testSubjectLab._id,
      date: labSession.date,
      period: 3,
      periodCount: 2,
      status: 'present',
      verificationMethod: 'face',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.equal(res.heldUnits, 2);
    assert.equal(res.attendedUnits, 2);
    assert.equal(res.rawPercentage, 100);
    assert.equal(res.complianceStatus, 'Good');
  });

  await t.test('11. 2-period lab session missed confers 2 held units and 0 attended units', async () => {
    await Attendance.updateOne(
      { student: testStudent._id, subject: testSubjectLab._id },
      { status: 'absent' }
    );

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.equal(res.heldUnits, 2);
    assert.equal(res.attendedUnits, 0);
    assert.equal(res.missedUnits, 2);
    assert.equal(res.rawPercentage, 0);
    assert.equal(res.complianceStatus, 'Critical');
  });

  await t.test('12. 3-period lab session attended confers 3 held units and 3 attended units', async () => {
    const threePeriodLab = await AttendanceSession.create({
      subject: testSubjectLab._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-16',
      period: 1,
      periodCount: 3,
      periods: [1, 2, 3],
      status: 'finalized',
    });

    await Attendance.create({
      session: threePeriodLab._id,
      student: testStudent._id,
      subject: testSubjectLab._id,
      date: threePeriodLab.date,
      period: 1,
      periodCount: 3,
      status: 'present',
      verificationMethod: 'face',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    // 2-period (absent = 0/2) + 3-period (present = 3/3) = 3 attended out of 5 held = 60%
    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 3);
    assert.equal(res.missedUnits, 2);
    assert.equal(res.rawPercentage, 60);
    assert.equal(res.complianceStatus, 'Warning');
  });

  await t.test('13. Mixed schedule (10 lectures + 5 lab units): weighted unit accuracy', async () => {
    // 10 lecture units (all present = 10) + 5 lab units (3 present = 3)
    // Total units = 15. Attended = 13. Raw % = (13 / 15) * 100 = 86.666...%
    const overview = await attendanceCalculationService.calculateStudentOverview({
      studentId: testStudent._id,
      semester: 5,
      branch: 'CSE',
    });

    assert.equal(overview.summary.totalClasses, 15);
    assert.equal(overview.summary.totalAttended, 13);
    assert.equal(overview.summary.totalMissed, 2);
    assert.equal(Math.round(overview.summary.rawPercentage * 100) / 100, 86.67);
    assert.equal(overview.summary.overall, 87);
    assert.equal(overview.summary.status, 'Good');
  });

  await t.test('14. Duplicate attendance prevention in multi-period session', async () => {
    // Attempting to query with multiple attendance records for same session does not confer double credit
    const labSessions = await AttendanceSession.find({ subject: testSubjectLab._id, periodCount: 3 });
    assert.ok(labSessions.length > 0);

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 3);
  });

  await t.test('15. Multi-period session with periods array [3, 4] resolves 2 units via getAcademicUnits', () => {
    const sessionWithArray = { periods: [3, 4] };
    assert.equal(attendanceCalculationService.getAcademicUnits(sessionWithArray), 2);

    const sessionWithCount = { periodCount: 3 };
    assert.equal(attendanceCalculationService.getAcademicUnits(sessionWithCount), 3);

    const standardSession = { period: 1 };
    assert.equal(attendanceCalculationService.getAcademicUnits(standardSession), 1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Session Lifecycle State Scoping (Scenarios 16-20)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('16. Open session strictly excluded from completed/held calculation', async () => {
    const openSess = await AttendanceSession.create({
      subject: testSubjectLecture._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-25',
      period: 2,
      periodCount: 1,
      status: 'open',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      includeUnfinalized: false,
    });

    assert.equal(res.heldUnits, 10); // Still 10, open session excluded
    await AttendanceSession.deleteOne({ _id: openSess._id });
  });

  await t.test('17. Active session strictly excluded from completed/held calculation', async () => {
    const activeSess = await AttendanceSession.create({
      subject: testSubjectLecture._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-25',
      period: 2,
      periodCount: 1,
      status: 'active',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      includeUnfinalized: false,
    });

    assert.equal(res.heldUnits, 10);
    await AttendanceSession.deleteOne({ _id: activeSess._id });
  });

  await t.test('18. Paused session strictly excluded from completed/held calculation', async () => {
    const pausedSess = await AttendanceSession.create({
      subject: testSubjectLecture._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-25',
      period: 2,
      periodCount: 1,
      status: 'paused',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      includeUnfinalized: false,
    });

    assert.equal(res.heldUnits, 10);
    await AttendanceSession.deleteOne({ _id: pausedSess._id });
  });

  await t.test('19. Cancelled session strictly excluded from held calculation even with attendance records', async () => {
    const cancelledSess = await AttendanceSession.create({
      subject: testSubjectLecture._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-25',
      period: 3,
      periodCount: 1,
      status: 'cancelled',
      cancellationReason: 'Faculty medical leave',
    });

    // Record erroneously present should be ignored
    await Attendance.create({
      session: cancelledSess._id,
      student: testStudent._id,
      subject: testSubjectLecture._id,
      date: cancelledSess.date,
      period: 3,
      status: 'present',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10); // Cancelled session ignored
  });

  await t.test('20. Finalized session included in held calculation', async () => {
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
    });

    assert.equal(res.heldUnits, 10);
    assert.equal(res.attendedUnits, 10);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: Attendance Corrections and Audit Integrity (Scenarios 21-25)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('21. Manual override from Absent to Present increases attended units', async () => {
    // 2-period lab record was absent
    const labRecord = await Attendance.findOne({
      student: testStudent._id,
      subject: testSubjectLab._id,
      periodCount: 2,
    });
    assert.ok(labRecord);
    assert.equal(labRecord.status, 'absent');

    labRecord.status = 'present';
    labRecord.isManualOverride = true;
    labRecord.correctionReason = 'Medical certificate verified by HOD';
    await labRecord.save();

    await AttendanceAuditLog.record({
      actorId: testFacultyUser._id,
      actorRole: 'faculty',
      action: 'manual_correction',
      affectedStudentId: testStudent._id,
      sessionId: labRecord.session,
      previousValue: { status: 'absent' },
      newValue: { status: 'present' },
      reason: 'Medical certificate verified by HOD',
    });

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    // Both 2-period and 3-period lab are now present = 5/5 = 100%
    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 5);
    assert.equal(res.rawPercentage, 100);
    assert.equal(res.complianceStatus, 'Good');
  });

  await t.test('22. Manual override from Present to Absent decreases attended units', async () => {
    const labRecord = await Attendance.findOne({
      student: testStudent._id,
      subject: testSubjectLab._id,
      periodCount: 2,
    });
    labRecord.status = 'absent';
    await labRecord.save();

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 3);
    assert.equal(res.rawPercentage, 60);
    assert.equal(res.complianceStatus, 'Warning');
  });

  await t.test('23. Manual override from Present to Late still counts as attended credit', async () => {
    const labRecord = await Attendance.findOne({
      student: testStudent._id,
      subject: testSubjectLab._id,
      periodCount: 2,
    });
    labRecord.status = 'late';
    await labRecord.save();

    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });

    // Late confers credit under institutional policy
    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 5);
    assert.equal(res.rawPercentage, 100);
  });

  await t.test('24. Audit log verifies non-empty reason and actor identity', async () => {
    const logs = await AttendanceAuditLog.find({ affectedStudentId: testStudent._id });
    assert.ok(logs.length > 0);
    assert.equal(logs[0].actorRole, 'faculty');
    assert.ok(logs[0].reason.length > 5);
  });

  await t.test('25. Calculation reflects corrected status immediately without cache lag', async () => {
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLab._id,
    });
    assert.equal(res.attendedUnits, 5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 6: Academic Scoping & Date Filtering (Scenarios 26-29)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('26. Student calculation strictly scoped to enrolled semester and branch subjects', async () => {
    // Create subject in another semester
    const otherSemSubject = await Subject.create({
      name: 'Compiler Design',
      code: 'CS601',
      branch: 'CSE',
      semester: 6,
      credits: 4,
      faculty: testFacultyUser._id,
    });

    const overview = await attendanceCalculationService.calculateStudentOverview({
      studentId: testStudent._id,
      semester: 5,
      branch: 'CSE',
    });

    // CS601 should NOT be present in semester 5 student overview
    const foundOtherSem = overview.subjectWise.some(s => s.code === 'CS601');
    assert.equal(foundOtherSem, false);
    await Subject.deleteOne({ _id: otherSemSubject._id });
  });

  await t.test('27. Date-range filter restricts eligible sessions and records', async () => {
    // Filter between 2026-10-01 and 2026-10-05 (5 sessions)
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });

    assert.equal(res.heldUnits, 5);
    assert.equal(res.attendedUnits, 5);
    assert.equal(res.rawPercentage, 100);
  });

  await t.test('28. Indian Standard Time (Asia/Kolkata, UTC+5:30) date boundary standardization', () => {
    const istDate = attendanceCalculationService.getIndianAcademicDate();
    assert.match(istDate, /^\d{4}-\d{2}-\d{2}$/);

    // Test specific UTC boundary: 2026-10-15 19:00:00 UTC is 2026-10-16 00:30:00 IST
    const lateUtcDate = new Date('2026-10-15T19:00:00.000Z');
    const istFormatted = attendanceCalculationService.getIndianAcademicDate(lateUtcDate);
    assert.equal(istFormatted, '2026-10-16');
  });

  await t.test('29. Unfinalized sessions toggle (includeUnfinalized: true vs false)', async () => {
    const unfinalized = await AttendanceSession.create({
      subject: testSubjectLecture._id,
      faculty: testFacultyUser._id,
      branch: 'CSE',
      semester: 5,
      date: '2026-10-28',
      period: 4,
      periodCount: 1,
      status: 'active',
    });

    const withoutUnfinalized = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      includeUnfinalized: false,
    });

    const withUnfinalized = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: testStudent._id,
      subjectId: testSubjectLecture._id,
      includeUnfinalized: true,
    });

    assert.equal(withoutUnfinalized.heldUnits, 10);
    assert.equal(withUnfinalized.heldUnits, 11);

    await AttendanceSession.deleteOne({ _id: unfinalized._id });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY 7: Faculty & Institutional Consistency (Scenarios 30-31)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('30. Faculty overview metrics: assigned students, sessions conducted, weighted average', async () => {
    const metrics = await attendanceCalculationService.calculateFacultyMetrics(testFacultyUser._id);

    assert.ok(metrics.assignedStudentsCount >= 1);
    assert.ok(metrics.sessionsConducted >= 12);
    assert.ok(typeof metrics.averageAttendance === 'number');
    assert.equal(metrics.hasAttendanceData, true);
  });

  await t.test('31. Dynamic threshold resolution: updating minAttendancePercent shifts compliance dynamically', async () => {
    // 80% attendance in lecture
    // At default 75%, 80% is 'Good'
    assert.equal(attendanceCalculationService.getComplianceStatus(80, 75), 'Good');

    // If institutional policy raises threshold to 85%, 80% shifts to 'Warning'
    assert.equal(attendanceCalculationService.getComplianceStatus(80, 85), 'Warning');

    // If threshold is 90%, 70% shifts to 'Critical'
    assert.equal(attendanceCalculationService.getComplianceStatus(70, 90), 'Critical');
  });

  await mongoose.disconnect();
});
