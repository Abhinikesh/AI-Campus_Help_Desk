/**
 * server/tests/attendance_analytics_and_reporting.test.js
 * Comprehensive Test Suite for Part 10/24:
 * Smart Attendance Analytics, Reporting, Administrative Monitoring & Data Visualization
 *
 * Verifies:
 * 1. Student Attendance Analytics & Trends (Weekly & Monthly in Asia/Kolkata timezone)
 * 2. Faculty Attendance Analytics & Scoped Reports (Replacing legacy Python AI)
 * 3. Admin Institutional Overview & Department Aggregations
 * 4. Academic Risk Monitoring & Exact Deficit Calculations
 * 5. Practical Reports (All 8 Required Types)
 * 6. Export Functionality & Spreadsheet Formula Injection Protection
 * 7. Manual Attendance Adjustment Audit Logging & Visibility
 * 8. Role-Based Access Control on Analytics Endpoints
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
const attendanceExportService = require('../services/attendanceExport.service');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');

test('Part 10 Smart Attendance Analytics & Reporting Suite', async (t) => {
  verifyTestDatabaseIsolation(TEST_DB_URI);
  await mongoose.connect(TEST_DB_URI);

  // Fixtures
  let studentUser1, studentUser2, student1, student2;
  let facultyUser1, facultyUser2, faculty1, faculty2;
  let adminUser;
  let subjectLecture, subjectLab, otherSubject;
  let sessionLecture1, sessionLecture2, sessionLab1, sessionCancelled, sessionOpen;

  await t.test('Setup Part 10 Analytics Test Fixtures in Isolated DB', async () => {
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
      allowManualOverride: true,
      defaultSessionDurationMinutes: 60,
    });

    // 1. Admin User
    adminUser = await User.create({
      loginId: 'ADMIN_P10',
      name: 'Dr. Dean Academic',
      email: `admin.p10.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'admin',
      status: 'active',
    });

    // 2. Faculty 1 (Authorized for CSE-401 & CSE-402)
    facultyUser1 = await User.create({
      loginId: 'FAC_P10_01',
      name: 'Prof. Vikram Sen',
      email: `vikram.p10.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'faculty',
      status: 'active',
    });
    faculty1 = await Faculty.create({
      user: facultyUser1._id,
      name: 'Prof. Vikram Sen',
      employeeId: 'EMP_P10_01',
      department: 'CSE',
    });

    // 3. Faculty 2 (Authorized for ECE-401)
    facultyUser2 = await User.create({
      loginId: 'FAC_P10_02',
      name: 'Prof. Ananya Roy',
      email: `ananya.p10.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'faculty',
      status: 'active',
    });
    faculty2 = await Faculty.create({
      user: facultyUser2._id,
      name: 'Prof. Ananya Roy',
      employeeId: 'EMP_P10_02',
      department: 'ECE',
    });

    // 4. Students
    // Student 1 (Good Attendance)
    studentUser1 = await User.create({
      loginId: 'STU_P10_01',
      name: 'Aarav Gupta',
      email: `aarav.p10.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'student',
      status: 'active',
    });
    student1 = await Student.create({
      user: studentUser1._id,
      fullName: 'Aarav Gupta',
      rollNumber: '2026CSE001',
      branch: 'CSE',
      semester: 4,
      section: 'A',
    });

    // Student 2 (Low Attendance — Deficit scenario)
    studentUser2 = await User.create({
      loginId: 'STU_P10_02',
      name: 'Bhavna Verma',
      email: `bhavna.p10.${Date.now()}@college.edu`,
      passwordHash: 'hashed_pw',
      role: 'student',
      status: 'active',
    });
    student2 = await Student.create({
      user: studentUser2._id,
      fullName: 'Bhavna Verma',
      rollNumber: '2026CSE002',
      branch: 'CSE',
      semester: 4,
      section: 'A',
    });

    // 5. Subjects
    subjectLecture = await Subject.create({
      code: 'CS401',
      name: 'Database Management Systems',
      credits: 4,
      branch: 'CSE',
      semester: 4,
      faculty: facultyUser1._id,
    });

    subjectLab = await Subject.create({
      code: 'CS402',
      name: 'DBMS Laboratory',
      credits: 2,
      branch: 'CSE',
      semester: 4,
      faculty: facultyUser1._id,
    });

    otherSubject = await Subject.create({
      code: 'EC401',
      name: 'Signals & Systems',
      credits: 4,
      branch: 'ECE',
      semester: 4,
      faculty: facultyUser2._id,
    });

    // 6. Attendance Sessions
    // Session 1: Finalized Lecture (1 unit) on 2026-04-06
    sessionLecture1 = await AttendanceSession.create({
      subject: subjectLecture._id,
      faculty: facultyUser1._id,
      date: '2026-04-06',
      period: 1,
      periodCount: 1,
      periods: [1],
      branch: 'CSE',
      semester: 4,
      section: 'A',
      sessionType: 'regular',
      status: 'finalized',
      presentCount: 2,
      totalStudents: 2,
    });

    // Session 2: Finalized Lecture (1 unit) on 2026-04-13
    sessionLecture2 = await AttendanceSession.create({
      subject: subjectLecture._id,
      faculty: facultyUser1._id,
      date: '2026-04-13',
      period: 2,
      periodCount: 1,
      periods: [2],
      branch: 'CSE',
      semester: 4,
      section: 'A',
      sessionType: 'regular',
      status: 'finalized',
      presentCount: 1,
      totalStudents: 2,
    });

    // Session 3: Finalized Lab (2 units: Periods 3, 4) on 2026-04-20
    sessionLab1 = await AttendanceSession.create({
      subject: subjectLab._id,
      faculty: facultyUser1._id,
      date: '2026-04-20',
      period: 3,
      periodCount: 2,
      periods: [3, 4],
      branch: 'CSE',
      semester: 4,
      section: 'A',
      sessionType: 'lab',
      status: 'finalized',
      presentCount: 1,
      totalStudents: 2,
    });

    // Session 4: Cancelled session (must be strictly excluded)
    sessionCancelled = await AttendanceSession.create({
      subject: subjectLecture._id,
      faculty: facultyUser1._id,
      date: '2026-04-27',
      period: 1,
      branch: 'CSE',
      semester: 4,
      section: 'A',
      sessionType: 'regular',
      status: 'cancelled',
    });

    // Session 5: Open/live session (must be excluded from finalized calculations)
    sessionOpen = await AttendanceSession.create({
      subject: subjectLecture._id,
      faculty: facultyUser1._id,
      date: '2026-04-28',
      period: 1,
      branch: 'CSE',
      semester: 4,
      section: 'A',
      sessionType: 'regular',
      status: 'open',
    });

    // 7. Attendance Records
    // Student 1: Attended Lecture 1, Lecture 2, and Lab 1
    // Total Units Held = 1 + 1 + 2 = 4 units. Attended = 1 + 1 + 2 = 4 units (100%)
    await Attendance.create({
      subject: subjectLecture._id,
      student: student1._id,
      session: sessionLecture1._id,
      date: '2026-04-06',
      period: 1,
      status: 'present',
    });
    await Attendance.create({
      subject: subjectLecture._id,
      student: student1._id,
      session: sessionLecture2._id,
      date: '2026-04-13',
      period: 2,
      status: 'present',
    });
    await Attendance.create({
      subject: subjectLab._id,
      student: student1._id,
      session: sessionLab1._id,
      date: '2026-04-20',
      period: 3,
      periodCount: 2,
      periods: [3, 4],
      status: 'present',
    });

    // Student 2: Attended Lecture 1 only (1 unit), Absent in Lecture 2 (1 unit) & Lab 1 (2 units)
    // Total Units Held = 4 units. Attended = 1 unit. Missed = 3 units.
    // Percentage = (1 / 4) * 100 = 25% (Below 75%)
    await Attendance.create({
      subject: subjectLecture._id,
      student: student2._id,
      session: sessionLecture1._id,
      date: '2026-04-06',
      period: 1,
      status: 'present',
    });
    await Attendance.create({
      subject: subjectLecture._id,
      student: student2._id,
      session: sessionLecture2._id,
      date: '2026-04-13',
      period: 2,
      status: 'absent',
    });
    await Attendance.create({
      subject: subjectLab._id,
      student: student2._id,
      session: sessionLab1._id,
      date: '2026-04-20',
      period: 3,
      periodCount: 2,
      periods: [3, 4],
      status: 'absent',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Authoritative Attendance Calculation Invariants
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('1. Multi-period laboratory sessions confer multiple academic units', async () => {
    const lectureUnits = attendanceCalculationService.getAcademicUnits(sessionLecture1);
    const labUnits = attendanceCalculationService.getAcademicUnits(sessionLab1);

    assert.equal(lectureUnits, 1, 'Single-period lecture must confer 1 academic unit');
    assert.equal(labUnits, 2, '2-period laboratory must confer 2 academic units');
  });

  await t.test('2. Cancelled and unfinalized sessions are strictly excluded from finalized denominator', async () => {
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: student1._id,
      subjectId: subjectLecture._id,
    });

    // 2 lectures held & finalized. Cancelled and open sessions excluded.
    assert.equal(res.heldUnits, 2, 'Must include exactly the 2 finalized lecture sessions');
    assert.equal(res.attendedUnits, 2);
    assert.equal(res.missedUnits, 0);
    assert.equal(res.percentage, 100);
  });

  await t.test('3. Exact Deficit Calculation matches academic standard formula', async () => {
    // Formula: ceil((minThreshold * heldUnits - 100 * attendedUnits) / 100)
    // Student 2 has 4 held units, 1 attended unit. Threshold is 75%.
    // (75 * 4 - 100 * 1) / 100 = (300 - 100) / 100 = 2 units deficit.
    const deficit = attendanceCalculationService.calculateDeficit(4, 1, 75);
    assert.equal(deficit, 2, 'Student with 1/4 (25%) requires 2 additional units to reach 75%');

    // Student 1 has 4 held units, 4 attended units. Deficit must be 0.
    const deficitCompliant = attendanceCalculationService.calculateDeficit(4, 4, 75);
    assert.equal(deficitCompliant, 0);

    // If heldUnits is 0, deficit is safely 0
    assert.equal(attendanceCalculationService.calculateDeficit(0, 0, 75), 0);
  });

  await t.test('4. Zero eligible units safely returns hasData: false without false 0% penalty', async () => {
    const res = await attendanceCalculationService.calculateStudentSubjectAttendance({
      studentId: student1._id,
      subjectId: otherSubject._id,
    });

    assert.equal(res.hasData, false);
    assert.equal(res.heldUnits, 0);
    assert.equal(res.percentage, null);
    assert.equal(res.complianceStatus, 'No Data');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Student Attendance Analytics & Trends
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('5. Student overview aggregates across multiple subjects with lab weights', async () => {
    const overview = await attendanceCalculationService.calculateStudentOverview({
      studentId: student1._id,
      semester: 4,
      branch: 'CSE',
    });

    assert.equal(overview.studentId.toString(), student1._id.toString());
    assert.equal(overview.hasData, true);
    assert.equal(overview.summary.totalHeldUnits, 4); // 2 in lecture + 2 in lab
    assert.equal(overview.summary.totalAttendedUnits, 4);
    assert.equal(overview.summary.totalMissedUnits, 0);
    assert.equal(overview.summary.overallPercentage, 100);
    assert.equal(overview.summary.complianceStatus, 'Good');
  });

  await t.test('6. Student weekly attendance trends group finalized sessions in Asia/Kolkata timezone', async () => {
    const trends = await attendanceCalculationService.calculateStudentAttendanceTrends({
      studentId: student1._id,
      semester: 4,
      branch: 'CSE',
      interval: 'weekly',
    });

    assert.equal(trends.hasData, true);
    assert.ok(Array.isArray(trends.trends));
    assert.ok(trends.trends.length >= 3, 'Must have at least 3 distinct weekly intervals');

    // First week (Lecture 1 on 2026-04-06)
    const week1 = trends.trends.find((t) => t.key.includes('2026-04-06'));
    assert.ok(week1);
    assert.equal(week1.heldUnits, 1);
    assert.equal(week1.attendedUnits, 1);
    assert.equal(week1.percentage, 100);

    // Third week (Lab on 2026-04-20)
    const week3 = trends.trends.find((t) => t.key.includes('2026-04-20'));
    assert.ok(week3);
    assert.equal(week3.heldUnits, 2, 'Lab week must reflect 2 academic held units');
    assert.equal(week3.attendedUnits, 2);
  });

  await t.test('7. Student monthly attendance trends aggregate correctly', async () => {
    const trends = await attendanceCalculationService.calculateStudentAttendanceTrends({
      studentId: student2._id,
      semester: 4,
      branch: 'CSE',
      interval: 'monthly',
    });

    assert.equal(trends.hasData, true);
    const april = trends.trends.find((t) => t.key === '2026-04');
    assert.ok(april);
    assert.equal(april.heldUnits, 4);
    assert.equal(april.attendedUnits, 1);
    assert.equal(april.percentage, 25);
    assert.equal(april.complianceStatus, 'Critical');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Faculty Attendance Analytics & Scoped Reports
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('8. Faculty detailed report computes metrics strictly for authorized teaching assignments', async () => {
    const report = await attendanceCalculationService.calculateFacultyDetailedReport({
      facultyUserId: facultyUser1._id,
      semester: 4,
    });

    assert.equal(report.assignedStudentsCount, 2); // student1 and student2
    assert.equal(report.sessionsConducted, 3); // 2 lectures + 1 lab
    assert.ok(report.subjectStats.length >= 2);
    assert.ok(report.lowAttendanceList.length >= 1, 'Student 2 must appear in low attendance list');

    const lowStudent = report.lowAttendanceList.find((s) => s.rollNumber === '2026CSE002');
    assert.ok(lowStudent);
    assert.equal(lowStudent.percentage, 25);
    assert.equal(lowStudent.deficitUnits, 2);
  });

  await t.test('9. Faculty unauthorized subject query is strictly rejected', async () => {
    await assert.rejects(
      async () => {
        await attendanceCalculationService.calculateFacultyDetailedReport({
          facultyUserId: facultyUser1._id,
          subjectId: otherSubject._id, // Belongs to Faculty 2
        });
      },
      /Unauthorized/i
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Admin Analytics & Academic Risk Monitoring
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('10. Admin institution overview aggregates across all departments and sessions', async () => {
    const overview = await attendanceCalculationService.calculateAdminInstitutionOverview();

    assert.equal(overview.totalActiveStudents, 2);
    assert.equal(overview.totalSubjects, 3);
    assert.equal(overview.finalizedSessions, 3);
    assert.ok(overview.totalHeldAcademicUnits >= 4);
    assert.equal(overview.studentsBelowThresholdCount, 1); // Student 2
  });

  await t.test('11. Academic Risk Register identifies students below threshold with exact deficit', async () => {
    const riskRegister = await attendanceCalculationService.calculateLowAttendanceRegister({
      threshold: 75,
    });

    assert.equal(riskRegister.length, 1);
    assert.equal(riskRegister[0].rollNumber, '2026CSE002');
    assert.equal(riskRegister[0].percentage, 25);
    assert.equal(riskRegister[0].deficitUnits, 2);
    assert.equal(riskRegister[0].complianceStatus, 'Critical');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: Manual Attendance Adjustment Transparency & Recalculation
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('12. Manual attendance correction creates immutable audit log and immediately recalculates', async () => {
    // Correct Student 2's Lecture 2 attendance from 'absent' to 'present'
    const record = await Attendance.findOne({
      student: student2._id,
      session: sessionLecture2._id,
    });

    const previousStatus = record.status;
    record.status = 'present';
    record.isManualOverride = true;
    record.correctedBy = facultyUser1._id;
    record.correctionReason = 'Medical certificate verified by department head';
    await record.save();

    // Log in AttendanceAuditLog
    await AttendanceAuditLog.record({
      actorId: facultyUser1._id,
      actorRole: 'faculty',
      action: 'manual_correction',
      attendanceId: record._id,
      sessionId: sessionLecture2._id,
      affectedStudentId: student2._id,
      previousValue: { status: previousStatus },
      newValue: { status: 'present' },
      reason: 'Medical certificate verified by department head',
    });

    // Verify recalculation: Student 2 now has 2 attended out of 4 (50%)
    const updatedOverview = await attendanceCalculationService.calculateStudentOverview({
      studentId: student2._id,
      semester: 4,
      branch: 'CSE',
    });

    assert.equal(updatedOverview.summary.totalAttendedUnits, 2);
    assert.equal(updatedOverview.summary.overallPercentage, 50);

    // Deficit reduces from 2 to 1: (75 * 4 - 100 * 2) / 100 = (300 - 200) / 100 = 1 unit
    const newDeficit = attendanceCalculationService.calculateDeficit(4, 2, 75);
    assert.equal(newDeficit, 1);

    // Verify audit log query
    const auditData = await attendanceCalculationService.getManualAdjustmentLogs({
      studentId: student2._id,
    });
    assert.equal(auditData.logs.length, 1);
    assert.equal(auditData.logs[0].previousStatus, 'absent');
    assert.equal(auditData.logs[0].updatedStatus, 'present');
    assert.equal(auditData.logs[0].reason, 'Medical certificate verified by department head');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 6: 8 Practical Report Types Generation
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('13. Report Type 1: Student Attendance Report generates expected structure', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'student_report',
      userRole: 'student',
      userId: studentUser1._id,
    });

    assert.equal(report.reportType, 'student_report');
    assert.ok(report.title.includes('Aarav Gupta'));
    assert.ok(report.rows.length >= 2);
    assert.ok(report.summary['Overall Attendance']);
  });

  await t.test('14. Report Type 2: Subject-Wise Attendance Report generates enrolled student roster', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'subject_wise_report',
      userRole: 'faculty',
      userId: facultyUser1._id,
      filters: { subjectId: subjectLecture._id },
    });

    assert.equal(report.reportType, 'subject_wise_report');
    assert.equal(report.rows.length, 2); // Aarav and Bhavna
  });

  await t.test('15. Report Type 3: Faculty Attendance Report generates faculty workload breakdown', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'faculty_report',
      userRole: 'faculty',
      userId: facultyUser1._id,
    });

    assert.equal(report.reportType, 'faculty_report');
    assert.ok(report.summary['Sessions Conducted'] >= 3);
  });

  await t.test('16. Report Type 4: Department Attendance Report generates campus-wide breakdown', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'department_report',
      userRole: 'admin',
      userId: adminUser._id,
    });

    assert.equal(report.reportType, 'department_report');
    assert.ok(report.rows.length >= 1);
  });

  await t.test('17. Report Type 5: Semester/Section Report generates cohort breakdown', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'semester_section_report',
      userRole: 'admin',
      userId: adminUser._id,
      filters: { branch: 'CSE', semester: 4, section: 'A' },
    });

    assert.equal(report.reportType, 'semester_section_report');
    assert.equal(report.rows.length, 2);
  });

  await t.test('18. Report Type 6: Low Attendance Report generates deficit warning register', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'low_attendance_report',
      userRole: 'admin',
      userId: adminUser._id,
      filters: { threshold: 75 },
    });

    assert.equal(report.reportType, 'low_attendance_report');
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].rollNumber, '2026CSE002');
    assert.equal(report.rows[0].deficitUnits, 1);
  });

  await t.test('19. Report Type 7: Session-Wise Report generates session ledger', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'session_wise_report',
      userRole: 'faculty',
      userId: facultyUser1._id,
      filters: { sessionId: sessionLecture1._id },
    });

    assert.equal(report.reportType, 'session_wise_report');
    assert.equal(report.rows.length, 2);
  });

  await t.test('20. Report Type 8: Manual Adjustment Audit Report generates override log', async () => {
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'manual_adjustment_report',
      userRole: 'admin',
      userId: adminUser._id,
    });

    assert.equal(report.reportType, 'manual_adjustment_report');
    assert.ok(report.rows.length >= 1);
    assert.equal(report.rows[0].previousStatus, 'absent');
    assert.equal(report.rows[0].updatedStatus, 'present');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 7: Export Sanitization & Formula Injection Protection
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('21. Export Service escapes formula injection characters (=, +, -, @, \\t, \\r)', async () => {
    assert.equal(attendanceExportService.sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(attendanceExportService.sanitizeCsvCell('+cmd|"/C calc"!A0'), `"'+cmd|""/C calc""!A0"`);
    assert.equal(attendanceExportService.sanitizeCsvCell('-100'), "'-100");
    assert.equal(attendanceExportService.sanitizeCsvCell('@IMPORTXML(...)'), "'@IMPORTXML(...)");
    assert.equal(attendanceExportService.sanitizeCsvCell('Normal Text'), 'Normal Text');
    assert.equal(attendanceExportService.sanitizeCsvCell('Text, with, comma'), '"Text, with, comma"');
  });

  await t.test('22. Export Service generates valid RFC-4180 CSV matching report data', async () => {
    const mockReport = {
      title: 'Test Verification Report',
      generatedAt: '01 Nov 2026, 14:00:00 IST',
      appliedFilters: { branch: 'CSE', semester: 4 },
      summary: { 'Total Students': 2, 'Average': '88%' },
      columns: [
        { key: 'rollNumber', label: 'Roll No' },
        { key: 'name', label: 'Student Name' },
        { key: 'pct', label: 'Percentage' },
      ],
      rows: [
        { rollNumber: '2026CSE001', name: 'Aarav Gupta', pct: '100%' },
        { rollNumber: '2026CSE002', name: 'Bhavna Verma', pct: '50%' },
      ],
    };

    const csv = attendanceExportService.generateCsv(mockReport);
    assert.ok(csv.includes('CampusSphere AI — Test Verification Report'));
    assert.ok(csv.includes('Roll No,Student Name,Percentage'));
    assert.ok(csv.includes('2026CSE001,Aarav Gupta,100%'));
    assert.ok(csv.includes('2026CSE002,Bhavna Verma,50%'));
  });

  await t.test('23. Export Service safely handles empty report rows', async () => {
    const emptyReport = {
      title: 'Empty Verification Report',
      generatedAt: '01 Nov 2026, 14:00:00 IST',
      columns: [{ key: 'id', label: 'ID' }],
      rows: [],
    };

    const csv = attendanceExportService.generateCsv(emptyReport);
    assert.ok(csv.includes('No attendance records found matching the specified criteria.'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 8: Role-Based Authorization Security Checks
  // ───────────────────────────────────────────────────────────────────────────

  await t.test('24. Student cannot generate departmental or admin reports', async () => {
    await assert.rejects(
      async () => {
        await attendanceCalculationService.generateAttendanceReport({
          reportType: 'department_report',
          userRole: 'student',
          userId: studentUser1._id,
        });
      },
      /Only administrators may generate Department Attendance Reports|Unauthorized/i
    );
  });

  await t.test('25. Student cannot access other students reports', async () => {
    // When role is student, studentId filter is overridden by their own authenticated student profile
    const report = await attendanceCalculationService.generateAttendanceReport({
      reportType: 'student_report',
      userRole: 'student',
      userId: studentUser1._id,
      filters: { studentId: student2._id }, // Student 1 attempts to spoof Student 2's ID
    });

    assert.ok(report.title.includes('Aarav Gupta'), 'Must bind strictly to authenticated student Aarav');
    assert.ok(!report.title.includes('Bhavna Verma'));
  });

  await mongoose.disconnect();
});
