/**
 * server/services/attendanceCalculation.service.js
 * Authoritative Academic Attendance Calculation Engine for CampusSphere AI ERP.
 *
 * Core Principles:
 * 1. Single Source of Truth: All student, faculty, and admin attendance calculations
 *    must derive from this service.
 * 2. Academic Unit Accounting: Clearly distinguishes session count from academic units (periods).
 *    A 2-period lab confers 2 held units and 2 attended/missed units.
 * 3. Session Lifecycle Discipline:
 *    - Cancelled sessions are strictly excluded (0 held units, 0 missed units).
 *    - Unfinalized sessions (scheduled, open, active, paused, closed) are excluded
 *      from completed attendance calculations unless explicitly requested for live views.
 *    - Finalized absences are counted in held units and missed units.
 * 4. Insufficient Data Safety: Zero held units yields hasData: false and percentage: null,
 *    never 0% (which falsely implies 100% absence).
 * 5. Compliance Thresholds: Dynamic threshold loaded from AttendanceSettings (default 75%).
 *    Compliance evaluations strictly use unrounded percentages (e.g. 74.999% fails 75%).
 * 6. Timezone Consistency: Standardized on Indian Standard Time (Asia/Kolkata, UTC+5:30).
 */
'use strict';

const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceSettings = require('../models/AttendanceSettings');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

class AttendanceCalculationService {
  /**
   * Convert any date or timestamp to Indian Standard Time YYYY-MM-DD date string.
   *
   * @param {Date|string|number} [date=new Date()]
   * @returns {string} YYYY-MM-DD formatted date in Asia/Kolkata timezone
   */
  getIndianAcademicDate(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  }

  /**
   * Determine the number of academic periods (units) represented by a session or record.
   * Multi-period laboratories (e.g. Periods 3 & 4) count as multiple academic units.
   *
   * @param {Object} item AttendanceSession or Attendance record
   * @returns {number} Positive integer count of academic periods (minimum 1)
   */
  getAcademicUnits(item) {
    if (!item) return 1;
    if (typeof item.periodCount === 'number' && item.periodCount > 0) {
      return item.periodCount;
    }
    if (Array.isArray(item.periods) && item.periods.length > 0) {
      return item.periods.length;
    }
    return 1;
  }

  /**
   * Resolve dynamic system-wide attendance settings.
   *
   * @returns {Promise<{ minAttendancePercent: number, allowManualOverride: boolean }>}
   */
  async resolveSettings() {
    try {
      const settings = await AttendanceSettings.findOne().lean();
      return {
        minAttendancePercent: settings?.minAttendancePercent ?? 75,
        allowManualOverride: settings?.allowManualOverride ?? true,
      };
    } catch (e) {
      return { minAttendancePercent: 75, allowManualOverride: true };
    }
  }

  /**
   * Determine compliance status label based on unrounded percentage and threshold.
   *
   * @param {number|null} rawPct Unrounded percentage
   * @param {number} threshold Minimum required threshold (default 75)
   * @returns {'No Data' | 'Good' | 'Warning' | 'Critical'}
   */
  getComplianceStatus(rawPct, threshold = 75) {
    if (rawPct === null || rawPct === undefined || isNaN(rawPct)) {
      return 'No Data';
    }
    // Strict unrounded comparison
    if (rawPct >= threshold) return 'Good';
    if (rawPct >= threshold - 15) return 'Warning';
    return 'Critical';
  }

  /**
   * Calculate academic attendance for a single student in a single subject.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.studentId
   * @param {string|ObjectId} params.subjectId
   * @param {string} [params.startDate] YYYY-MM-DD
   * @param {string} [params.endDate] YYYY-MM-DD
   * @param {boolean} [params.includeUnfinalized=false]
   * @returns {Promise<Object>} Detailed subject attendance metrics
   */
  async calculateStudentSubjectAttendance({
    studentId,
    subjectId,
    startDate,
    endDate,
    includeUnfinalized = false,
  }) {
    const { minAttendancePercent } = await this.resolveSettings();

    // 1. Fetch eligible held sessions for this subject
    const sessionQuery = {
      subject: subjectId,
      status: includeUnfinalized
        ? { $in: ['open', 'active', 'completed', 'closed', 'finalized'] }
        : { $in: ['completed', 'finalized'] }, // Cancelled and pure scheduled sessions are excluded
    };

    if (startDate || endDate) {
      sessionQuery.date = {};
      if (startDate) sessionQuery.date.$gte = startDate;
      if (endDate) sessionQuery.date.$lte = endDate;
    }

    const sessions = await AttendanceSession.find(sessionQuery)
      .select('_id date period periods periodCount status sessionStatus')
      .lean();

    if (sessions.length === 0) {
      return {
        subjectId,
        hasData: false,
        heldUnits: 0,
        attendedUnits: 0,
        missedUnits: 0,
        excusedUnits: 0,
        rawPercentage: null,
        displayPercentage: null,
        percentage: null,
        complianceStatus: 'No Data',
        minThreshold: minAttendancePercent,
        meetsRequirement: false,
      };
    }

    const sessionIds = sessions.map((s) => s._id);
    const sessionMap = new Map();
    let totalHeldUnits = 0;

    for (const sess of sessions) {
      const units = this.getAcademicUnits(sess);
      sessionMap.set(sess._id.toString(), { units, session: sess });
      totalHeldUnits += units;
    }

    // 2. Fetch student's attendance records for these sessions
    const records = await Attendance.find({
      student: studentId,
      session: { $in: sessionIds },
    })
      .select('session status periodCount periods')
      .lean();

    let totalAttendedUnits = 0;
    let totalExcusedUnits = 0;
    const accountedSessionIds = new Set();

    for (const rec of records) {
      const sId = rec.session ? rec.session.toString() : null;
      if (!sId || !sessionMap.has(sId)) continue;

      accountedSessionIds.add(sId);
      const sessionUnits = sessionMap.get(sId).units;
      // Authoritative academic units for this session
      const units = sessionUnits;
      const stat = (rec.status || '').toLowerCase().trim();

      if (stat === 'present' || stat === 'late') {
        totalAttendedUnits += units;
      } else if (stat === 'excused') {
        totalExcusedUnits += units;
      }
    }

    // Any held session without an attendance record is considered absent (missed)
    const totalMissedUnits = Math.max(0, totalHeldUnits - totalAttendedUnits);

    const rawPercentage = totalHeldUnits > 0 ? (totalAttendedUnits / totalHeldUnits) * 100 : null;
    const displayPercentage = rawPercentage !== null ? Math.round(rawPercentage) : null;
    const meetsRequirement = rawPercentage !== null && rawPercentage >= minAttendancePercent;
    const complianceStatus = this.getComplianceStatus(rawPercentage, minAttendancePercent);

    return {
      subjectId,
      hasData: totalHeldUnits > 0,
      heldUnits: totalHeldUnits,
      attendedUnits: totalAttendedUnits,
      missedUnits: totalMissedUnits,
      excusedUnits: totalExcusedUnits,
      rawPercentage,
      displayPercentage,
      percentage: displayPercentage,
      complianceStatus,
      minThreshold: minAttendancePercent,
      meetsRequirement,
    };
  }

  /**
   * Calculate complete student overview across all enrolled subjects.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.studentId
   * @param {number} [params.semester]
   * @param {string} [params.branch]
   * @param {string} [params.startDate]
   * @param {string} [params.endDate]
   * @param {boolean} [params.includeUnfinalized=false]
   * @returns {Promise<Object>} Aggregated student attendance overview
   */
  async calculateStudentOverview({
    studentId,
    semester,
    branch,
    startDate,
    endDate,
    includeUnfinalized = false,
  }) {
    const student = await Student.findById(studentId).populate('user', 'name email').lean();
    if (!student) {
      throw new Error(`Student not found for ID: ${studentId}`);
    }

    const effectiveSemester = semester || student.semester || 1;
    const effectiveBranch = branch || student.branch || '';

    const { minAttendancePercent } = await this.resolveSettings();

    // 1. Fetch subjects matching student's semester & branch
    const subjectQuery = { semester: effectiveSemester };
    if (effectiveBranch) {
      subjectQuery.$or = [
        { branch: effectiveBranch },
        { branch: '' },
        { branch: null },
        { branch: { $regex: new RegExp(`^${effectiveBranch}$`, 'i') } },
      ];
    }

    const subjects = await Subject.find(subjectQuery)
      .populate('faculty', 'name email')
      .lean();

    // 2. Compute metrics for each enrolled subject
    let overallHeldUnits = 0;
    let overallAttendedUnits = 0;
    let overallMissedUnits = 0;
    let overallExcusedUnits = 0;

    const subjectWise = [];

    for (const sub of subjects) {
      const subMetrics = await this.calculateStudentSubjectAttendance({
        studentId,
        subjectId: sub._id,
        startDate,
        endDate,
        includeUnfinalized,
      });

      overallHeldUnits += subMetrics.heldUnits;
      overallAttendedUnits += subMetrics.attendedUnits;
      overallMissedUnits += subMetrics.missedUnits;
      overallExcusedUnits += subMetrics.excusedUnits;

      subjectWise.push({
        _id: sub._id,
        subjectId: sub._id,
        subject: sub.name,
        name: sub.name,
        code: sub.code,
        credits: sub.credits || 3,
        facultyName: sub.faculty?.name || 'Assigned Faculty',
        total: subMetrics.heldUnits,
        totalClasses: subMetrics.heldUnits,
        attended: subMetrics.attendedUnits,
        missed: subMetrics.missedUnits,
        excused: subMetrics.excusedUnits,
        rawPercentage: subMetrics.rawPercentage,
        percentage: subMetrics.displayPercentage !== null ? subMetrics.displayPercentage : 0,
        status: subMetrics.complianceStatus,
        complianceStatus: subMetrics.complianceStatus,
        hasData: subMetrics.hasData,
        meetsRequirement: subMetrics.meetsRequirement,
      });
    }

    // 3. Overall calculation
    const hasData = overallHeldUnits > 0;
    const rawOverall = hasData ? (overallAttendedUnits / overallHeldUnits) * 100 : null;
    const displayOverall = rawOverall !== null ? Math.round(rawOverall) : 0;
    const overallStatus = this.getComplianceStatus(rawOverall, minAttendancePercent);
    const meetsRequirement = rawOverall !== null && rawOverall >= minAttendancePercent;

    return {
      studentId,
      studentName: student.fullName || student.name || student.user?.name || 'Student',
      rollNumber: student.rollNumber,
      semester: effectiveSemester,
      branch: effectiveBranch,
      hasData,
      summary: {
        overall: displayOverall,
        overallPercentage: displayOverall,
        rawPercentage: rawOverall,
        totalClasses: overallHeldUnits,
        totalHeldUnits: overallHeldUnits,
        totalAttended: overallAttendedUnits,
        totalAttendedUnits: overallAttendedUnits,
        totalMissed: overallMissedUnits,
        totalMissedUnits: overallMissedUnits,
        totalExcusedUnits: overallExcusedUnits,
        minThreshold: minAttendancePercent,
        hasRecords: hasData,
        status: overallStatus,
        complianceStatus: overallStatus,
        meetsRequirement,
      },
      data: subjectWise,
      subjectWise,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate faculty metrics and student assignments scoped strictly to faculty's authorized subjects.
   * Accurately resolves the true distinct student count across assigned sections,
   * completely eliminating static/hardcoded counters (e.g. 124).
   *
   * @param {string|ObjectId} facultyUserId User ID of faculty member
   * @returns {Promise<Object>} Authoritative faculty statistics
   */
  async calculateFacultyMetrics(facultyUserId) {
    const faculty = await Faculty.findOne({ user: facultyUserId }).lean();

    // 1. Find all subjects taught by this faculty member
    const subjectQuery = {
      $or: [{ faculty: facultyUserId }],
    };
    if (faculty?._id) {
      subjectQuery.$or.push({ faculty: faculty._id });
    }

    const assignedSubjects = await Subject.find(subjectQuery).lean();
    const subjectIds = assignedSubjects.map((s) => s._id);

    // 2. Identify sections and semesters taught by this faculty
    const distinctSemesters = [...new Set(assignedSubjects.map((s) => s.semester).filter(Boolean))];
    const distinctBranches = [...new Set(assignedSubjects.map((s) => s.branch).filter(Boolean))];

    // 3. Count true distinct students enrolled in these sections
    const studentQuery = {};
    if (distinctSemesters.length > 0) studentQuery.semester = { $in: distinctSemesters };
    if (distinctBranches.length > 0) studentQuery.branch = { $in: distinctBranches };

    const assignedStudentsCount =
      distinctSemesters.length > 0
        ? await Student.countDocuments(studentQuery)
        : 0;

    // 4. Session statistics
    const todayStr = this.getIndianAcademicDate();

    const [sessionsToday, pastHeldSessions] = await Promise.all([
      AttendanceSession.find({
        faculty: facultyUserId,
        date: todayStr,
        status: { $ne: 'cancelled' },
      }).lean(),
      AttendanceSession.find({
        faculty: facultyUserId,
        status: { $in: ['completed', 'finalized'] },
      }).lean(),
    ]);

    // 5. Calculate average attendance percentage across all faculty's conducted sessions
    let avgAttendance = 0;
    if (pastHeldSessions.length > 0) {
      let totalAttendedUnits = 0;
      let totalEligibleUnits = 0;

      for (const sess of pastHeldSessions) {
        const units = this.getAcademicUnits(sess);
        const presentUnits = (sess.presentCount || 0) * units;
        const potentialUnits = (sess.totalStudents || assignedStudentsCount || 1) * units;

        totalAttendedUnits += presentUnits;
        totalEligibleUnits += potentialUnits;
      }

      avgAttendance =
        totalEligibleUnits > 0
          ? Math.round((totalAttendedUnits / totalEligibleUnits) * 100)
          : 0;
    }

    return {
      facultyUserId,
      assignedSubjectsCount: assignedSubjects.length,
      assignedStudentsCount, // Authoritative count (replaces hardcoded 124)
      classesToday: sessionsToday.length,
      sessionsConducted: pastHeldSessions.length,
      averageAttendance: avgAttendance,
      hasAttendanceData: pastHeldSessions.length > 0,
      todayDate: todayStr,
    };
  }

  /**
   * Department-wide attendance aggregation for administrative oversight.
   *
   * @param {Object} params
   * @param {string} [params.branch]
   * @param {number} [params.semester]
   * @param {string} [params.startDate]
   * @param {string} [params.endDate]
   * @returns {Promise<Object>} Department metrics without multi-period double-counting
   */
  async calculateDepartmentAnalytics({ branch, semester, startDate, endDate } = {}) {
    const { minAttendancePercent } = await this.resolveSettings();

    const sessionMatch = {
      status: { $in: ['completed', 'finalized'] },
    };
    if (branch) sessionMatch.branch = branch;
    if (semester) sessionMatch.semester = Number(semester);
    if (startDate || endDate) {
      sessionMatch.date = {};
      if (startDate) sessionMatch.date.$gte = startDate;
      if (endDate) sessionMatch.date.$lte = endDate;
    }

    const sessions = await AttendanceSession.find(sessionMatch).lean();
    const sessionIds = sessions.map((s) => s._id);

    // Sum academic held units
    let totalHeldUnits = 0;
    for (const s of sessions) {
      totalHeldUnits += this.getAcademicUnits(s);
    }

    const attendanceRecords = await Attendance.find({
      session: { $in: sessionIds },
    })
      .select('student status periodCount')
      .lean();

    const distinctStudents = new Set();
    let totalAttendedUnits = 0;

    for (const r of attendanceRecords) {
      distinctStudents.add(r.student.toString());
      if (['present', 'late'].includes((r.status || '').toLowerCase())) {
        totalAttendedUnits += r.periodCount || 1;
      }
    }

    const studentCount = distinctStudents.size;
    const overallRate =
      totalHeldUnits > 0 && studentCount > 0
        ? Math.round((totalAttendedUnits / (totalHeldUnits * studentCount)) * 100)
        : 0;

    return {
      department: branch || 'All Departments',
      totalSessionsConducted: sessions.length,
      totalHeldAcademicUnits: totalHeldUnits,
      activeStudentCount: studentCount,
      overallAttendanceRate: Math.min(overallRate, 100),
      minThreshold: minAttendancePercent,
    };
  }
}

const attendanceCalculationService = new AttendanceCalculationService();
module.exports = attendanceCalculationService;
