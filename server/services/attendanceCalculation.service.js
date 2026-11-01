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
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const User = require('../models/User');

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
   * Convert any date or timestamp to Indian Standard Time formatted string.
   *
   * @param {Date|string|number} [date=new Date()]
   * @returns {string} Formatted date/time string in Asia/Kolkata timezone
   */
  getIndianTimestamp(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toISOString();

    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${formatter.format(d)} IST`;
  }

  /**
   * Calculate academic attendance deficit relative to the minimum threshold.
   * Deficit Units = max(0, ceil((minThreshold * heldUnits - 100 * attendedUnits) / 100))
   *
   * @param {number} heldUnits Total held academic units
   * @param {number} attendedUnits Total attended academic units
   * @param {number} [minThreshold=75] Minimum percentage required
   * @returns {number} Non-negative integer count of units required to recover compliance
   */
  calculateDeficit(heldUnits, attendedUnits, minThreshold = 75) {
    if (!heldUnits || heldUnits <= 0) return 0;
    const deficit = Math.ceil((minThreshold * heldUnits - 100 * (attendedUnits || 0)) / 100);
    return Math.max(0, deficit);
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

  /**
   * Calculate student attendance trends over time (weekly or monthly) using real finalized sessions.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.studentId
   * @param {number} [params.semester]
   * @param {string} [params.branch]
   * @param {'weekly' | 'monthly'} [params.interval='weekly']
   * @returns {Promise<Object>} Formatted trend array in Asia/Kolkata timezone
   */
  async calculateStudentAttendanceTrends({ studentId, semester, branch, interval = 'weekly' }) {
    const student = await Student.findById(studentId).lean();
    if (!student) throw new Error(`Student not found: ${studentId}`);

    const effectiveSemester = semester || student.semester || 1;
    const effectiveBranch = branch || student.branch || '';
    const { minAttendancePercent } = await this.resolveSettings();

    // 1. Fetch all subjects for this semester and branch
    const subjectQuery = { semester: effectiveSemester };
    if (effectiveBranch) {
      subjectQuery.$or = [
        { branch: effectiveBranch },
        { branch: '' },
        { branch: null },
        { branch: { $regex: new RegExp(`^${effectiveBranch}$`, 'i') } },
      ];
    }
    const subjects = await Subject.find(subjectQuery).select('_id name code').lean();
    const subjectIds = subjects.map((s) => s._id);

    // 2. Fetch all completed or finalized sessions for these subjects
    const sessions = await AttendanceSession.find({
      subject: { $in: subjectIds },
      status: { $in: ['completed', 'finalized'] },
    })
      .select('_id date period periods periodCount status')
      .sort({ date: 1 })
      .lean();

    if (sessions.length === 0) {
      return {
        studentId,
        interval,
        minThreshold: minAttendancePercent,
        hasData: false,
        trends: [],
      };
    }

    const sessionIds = sessions.map((s) => s._id);
    const sessionUnitsMap = new Map();
    for (const sess of sessions) {
      sessionUnitsMap.set(sess._id.toString(), {
        units: this.getAcademicUnits(sess),
        date: sess.date,
      });
    }

    // 3. Fetch student attendance records for these sessions
    const records = await Attendance.find({
      student: studentId,
      session: { $in: sessionIds },
    })
      .select('session status periodCount')
      .lean();

    const recordMap = new Map();
    for (const rec of records) {
      if (rec.session) {
        recordMap.set(rec.session.toString(), (rec.status || '').toLowerCase().trim());
      }
    }

    // 4. Group by interval (weekly or monthly)
    const groups = new Map();

    for (const sess of sessions) {
      const sId = sess._id.toString();
      const dateStr = sess.date; // YYYY-MM-DD
      let groupKey;
      let groupLabel;

      if (interval === 'monthly') {
        groupKey = dateStr.slice(0, 7); // e.g. "2026-04"
        const [y, m] = groupKey.split('-');
        const monthDate = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
        groupLabel = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
          year: 'numeric',
        }).format(monthDate);
      } else {
        // Weekly grouping: align to Monday of the week
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ...
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(dt.getTime() + diffToMonday * 86400000);
        groupKey = monday.toISOString().split('T')[0];
        const mondayFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
        }).format(monday);
        groupLabel = `Wk of ${mondayFormatted}`;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          heldUnits: 0,
          attendedUnits: 0,
          sessionCount: 0,
        });
      }

      const g = groups.get(groupKey);
      const units = this.getAcademicUnits(sess);
      g.heldUnits += units;
      g.sessionCount += 1;

      const stat = recordMap.get(sId);
      if (stat === 'present' || stat === 'late') {
        g.attendedUnits += units;
      }
    }

    // 5. Convert to sorted trend array
    const sortedKeys = Array.from(groups.keys()).sort();
    const trends = sortedKeys.map((k) => {
      const g = groups.get(k);
      const hasUnits = g.heldUnits > 0;
      const rawPct = hasUnits ? (g.attendedUnits / g.heldUnits) * 100 : null;
      const displayPct = rawPct !== null ? Math.round(rawPct) : null;
      const missedUnits = Math.max(0, g.heldUnits - g.attendedUnits);

      return {
        key: g.key,
        label: g.label,
        heldUnits: g.heldUnits,
        attendedUnits: g.attendedUnits,
        missedUnits,
        sessionCount: g.sessionCount,
        rawPercentage: rawPct,
        percentage: displayPct,
        hasData: hasUnits,
        complianceStatus: this.getComplianceStatus(rawPct, minAttendancePercent),
      };
    });

    return {
      studentId,
      interval,
      minThreshold: minAttendancePercent,
      hasData: trends.some((t) => t.hasData),
      trends,
    };
  }

  /**
   * Authoritative replacement for legacy Python AI faculty reports.
   * Scoped strictly to the faculty member's authorized teaching assignments.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.facultyUserId
   * @param {string|ObjectId} [params.subjectId]
   * @param {number} [params.semester]
   * @param {string} [params.section]
   * @param {string} [params.startDate]
   * @param {string} [params.endDate]
   * @returns {Promise<Object>} Authoritative faculty report payload
   */
  async calculateFacultyDetailedReport({
    facultyUserId,
    subjectId,
    semester,
    section,
    startDate,
    endDate,
  }) {
    const { minAttendancePercent } = await this.resolveSettings();
    const faculty = await Faculty.findOne({ user: facultyUserId }).lean();

    // 1. Find all subjects authorized for this faculty member
    const subjectQuery = {
      $or: [{ faculty: facultyUserId }],
    };
    if (faculty?._id) {
      subjectQuery.$or.push({ faculty: faculty._id });
    }
    const authorizedSubjects = await Subject.find(subjectQuery).lean();
    const authorizedSubjectIds = authorizedSubjects.map((s) => s._id.toString());

    // If a specific subject is requested, enforce authorization
    if (subjectId && !authorizedSubjectIds.includes(subjectId.toString())) {
      throw new Error('Unauthorized: You can only query reports for your authorized teaching assignments');
    }

    const targetSubjectIds = subjectId
      ? [subjectId]
      : authorizedSubjects.map((s) => s._id);

    // 2. Identify distinct semesters and branches
    const targetSubjects = subjectId
      ? authorizedSubjects.filter((s) => s._id.toString() === subjectId.toString())
      : authorizedSubjects;

    const distinctSemesters = semester
      ? [Number(semester)]
      : [...new Set(targetSubjects.map((s) => s.semester).filter(Boolean))];
    const distinctBranches = [...new Set(targetSubjects.map((s) => s.branch).filter(Boolean))];

    // Count distinct students enrolled
    const studentQuery = {};
    if (distinctSemesters.length > 0) studentQuery.semester = { $in: distinctSemesters };
    if (distinctBranches.length > 0) studentQuery.branch = { $in: distinctBranches };
    if (section) studentQuery.section = section;

    const assignedStudents = await Student.find(studentQuery).populate('user', 'name email').lean();
    const assignedStudentsCount = assignedStudents.length;

    // 3. Query conducted (finalized/completed) sessions
    const sessionQuery = {
      faculty: facultyUserId,
      status: { $in: ['completed', 'finalized'] },
      subject: { $in: targetSubjectIds },
    };
    if (semester) sessionQuery.semester = Number(semester);
    if (section) sessionQuery.section = section;
    if (startDate || endDate) {
      sessionQuery.date = {};
      if (startDate) sessionQuery.date.$gte = startDate;
      if (endDate) sessionQuery.date.$lte = endDate;
    }

    const sessions = await AttendanceSession.find(sessionQuery)
      .populate('subject', 'name code')
      .sort({ date: -1, period: -1 })
      .lean();

    const scheduledCount = await AttendanceSession.countDocuments({
      faculty: facultyUserId,
      subject: { $in: targetSubjectIds },
      status: { $ne: 'cancelled' },
    });

    const sessionIds = sessions.map((s) => s._id);
    const sessionMap = new Map();
    let totalHeldUnits = 0;

    for (const sess of sessions) {
      const units = this.getAcademicUnits(sess);
      sessionMap.set(sess._id.toString(), { units, session: sess });
      totalHeldUnits += units;
    }

    // 4. Query attendance records
    const records = await Attendance.find({ session: { $in: sessionIds } }).lean();

    // Map records by student
    const studentAttendanceMap = new Map();
    for (const st of assignedStudents) {
      studentAttendanceMap.set(st._id.toString(), {
        student: st,
        attendedUnits: 0,
        accountedSessions: new Set(),
      });
    }

    for (const rec of records) {
      const stId = rec.student?.toString();
      const sId = rec.session?.toString();
      if (!stId || !sId || !sessionMap.has(sId)) continue;

      if (!studentAttendanceMap.has(stId)) {
        studentAttendanceMap.set(stId, {
          student: null,
          attendedUnits: 0,
          accountedSessions: new Set(),
        });
      }

      const entry = studentAttendanceMap.get(stId);
      if (!entry.accountedSessions.has(sId)) {
        entry.accountedSessions.add(sId);
        const stat = (rec.status || '').toLowerCase().trim();
        if (stat === 'present' || stat === 'late') {
          entry.attendedUnits += sessionMap.get(sId).units;
        }
      }
    }

    // 5. Build Subject-Wise Stats
    const subjectStats = [];
    for (const sub of targetSubjects) {
      const subSessions = sessions.filter(
        (s) => s.subject?._id?.toString() === sub._id.toString() || s.subject?.toString() === sub._id.toString()
      );
      const subSessionIds = new Set(subSessions.map((s) => s._id.toString()));
      let subHeldUnits = 0;
      for (const s of subSessions) subHeldUnits += this.getAcademicUnits(s);

      const subRecords = records.filter((r) => subSessionIds.has(r.session?.toString()));
      let subAttendedUnits = 0;
      for (const r of subRecords) {
        if (['present', 'late'].includes((r.status || '').toLowerCase().trim())) {
          const sessObj = sessionMap.get(r.session?.toString());
          subAttendedUnits += sessObj ? sessObj.units : 1;
        }
      }

      const totalPossible = subHeldUnits * Math.max(assignedStudentsCount, 1);
      const rawSubPct = totalPossible > 0 ? (subAttendedUnits / totalPossible) * 100 : 0;
      const subPct = Math.round(rawSubPct);

      subjectStats.push({
        subjectId: sub._id,
        name: sub.name,
        code: sub.code,
        semester: sub.semester,
        branch: sub.branch,
        totalClasses: subSessions.length,
        totalHeldUnits: subHeldUnits,
        totalRecords: subRecords.length,
        presentRecords: subRecords.filter((r) =>
          ['present', 'late'].includes((r.status || '').toLowerCase().trim())
        ).length,
        percentage: subPct,
        complianceStatus: this.getComplianceStatus(rawSubPct, minAttendancePercent),
      });
    }

    // 6. Build Low Attendance List with Deficit Units
    const lowAttendanceList = [];
    for (const [stId, entry] of studentAttendanceMap.entries()) {
      if (totalHeldUnits === 0) continue;
      const rawPct = (entry.attendedUnits / totalHeldUnits) * 100;
      const displayPct = Math.round(rawPct);
      const missedUnits = Math.max(0, totalHeldUnits - entry.attendedUnits);

      if (rawPct < minAttendancePercent) {
        const deficitUnits = this.calculateDeficit(totalHeldUnits, entry.attendedUnits, minAttendancePercent);
        const stObj = entry.student;
        lowAttendanceList.push({
          _id: stId,
          studentId: stId,
          name: stObj?.fullName || stObj?.name || 'Student',
          rollNumber: stObj?.rollNumber || 'N/A',
          branch: stObj?.branch || '',
          semester: stObj?.semester || '',
          section: stObj?.section || '',
          totalClasses: sessions.length,
          totalHeldUnits,
          attended: entry.attendedUnits,
          missed: missedUnits,
          percentage: displayPct,
          rawPercentage: rawPct,
          minThreshold: minAttendancePercent,
          deficitUnits,
          status: this.getComplianceStatus(rawPct, minAttendancePercent),
        });
      }
    }
    lowAttendanceList.sort((a, b) => a.rawPercentage - b.rawPercentage);

    // 7. Build Monthly Trends
    const monthlyMap = new Map();
    for (const sess of sessions) {
      const monthKey = sess.date.slice(0, 7);
      if (!monthlyMap.has(monthKey)) {
        const [y, m] = monthKey.split('-');
        const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
        const monthLabel = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
        }).format(d);
        monthlyMap.set(monthKey, { month: monthLabel, monthKey, heldUnits: 0, attendedUnits: 0 });
      }
      const mObj = monthlyMap.get(monthKey);
      const units = this.getAcademicUnits(sess);
      mObj.heldUnits += units * Math.max(assignedStudentsCount, 1);
    }

    for (const rec of records) {
      const sId = rec.session?.toString();
      const sessObj = sessionMap.get(sId);
      if (!sessObj) continue;
      const monthKey = sessObj.session.date.slice(0, 7);
      const mObj = monthlyMap.get(monthKey);
      if (mObj && ['present', 'late'].includes((rec.status || '').toLowerCase().trim())) {
        mObj.attendedUnits += sessObj.units;
      }
    }

    const monthlyTrends = Array.from(monthlyMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => ({
        month: m.month,
        monthKey: m.monthKey,
        percentage: m.heldUnits > 0 ? Math.round((m.attendedUnits / m.heldUnits) * 100) : 0,
      }));

    // 8. Session-Wise Breakdown
    const sessionStats = sessions.map((s) => {
      const units = this.getAcademicUnits(s);
      const presentCount = s.presentCount || 0;
      const totalStudents = s.totalStudents || assignedStudentsCount || 1;
      const pct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
      return {
        _id: s._id,
        date: s.date,
        subject: s.subject?.name || 'Subject',
        code: s.subject?.code || '',
        period: s.period,
        periodCount: units,
        presentCount,
        totalStudents,
        percentage: pct,
        status: s.status,
      };
    });

    // 9. Manual Adjustments Audit
    const manualAdjustments = await AttendanceAuditLog.find({
      action: 'manual_correction',
      sessionId: { $in: sessionIds },
    })
      .populate('actorId', 'name email role')
      .populate('affectedStudentId', 'fullName rollNumber')
      .populate('sessionId', 'date period')
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Overall Average
    const totalPossibleCampus = totalHeldUnits * Math.max(assignedStudentsCount, 1);
    let totalActuallyAttended = 0;
    for (const r of records) {
      if (['present', 'late'].includes((r.status || '').toLowerCase().trim())) {
        const sessObj = sessionMap.get(r.session?.toString());
        totalActuallyAttended += sessObj ? sessObj.units : 1;
      }
    }
    const classAverage = totalPossibleCampus > 0
      ? Math.round((totalActuallyAttended / totalPossibleCampus) * 100)
      : 0;

    return {
      facultyUserId,
      assignedStudentsCount,
      classesScheduled: scheduledCount,
      sessionsConducted: sessions.length,
      averageAttendance: classAverage,
      classAverage, // for frontend compatibility
      subjectStats,
      sessionStats,
      lowAttendanceList,
      monthlyTrends,
      manualAdjustments: manualAdjustments.map((a) => ({
        _id: a._id,
        timestamp: this.getIndianTimestamp(a.timestamp),
        studentName: a.affectedStudentId?.fullName || 'Student',
        rollNumber: a.affectedStudentId?.rollNumber || 'N/A',
        previousStatus: a.previousValue?.status || 'N/A',
        updatedStatus: a.newValue?.status || 'N/A',
        actorName: a.actorId?.name || 'Authorized Faculty',
        reason: a.reason || 'Manual attendance correction',
      })),
    };
  }

  /**
   * Institution-wide attendance overview across all departments, subjects, and sessions.
   *
   * @returns {Promise<Object>} Institutional oversight metrics
   */
  async calculateAdminInstitutionOverview() {
    const { minAttendancePercent } = await this.resolveSettings();

    const [
      totalStudents,
      totalSubjects,
      finalizedSessionsCount,
      allSessions,
      allRecords,
      allDistinctBranches,
    ] = await Promise.all([
      Student.countDocuments(),
      Subject.countDocuments(),
      AttendanceSession.countDocuments({ status: { $in: ['completed', 'finalized'] } }),
      AttendanceSession.find({ status: { $in: ['completed', 'finalized'] } })
        .select('_id date period periodCount periods branch semester status')
        .lean(),
      Attendance.find({ status: { $in: ['present', 'late'] } })
        .select('session status periodCount student')
        .lean(),
      Student.distinct('branch'),
    ]);

    // Active branches
    const branches = (allDistinctBranches || []).filter(Boolean);

    // Sum academic units
    let totalHeldAcademicUnits = 0;
    const sessionMap = new Map();
    for (const sess of allSessions) {
      const units = this.getAcademicUnits(sess);
      sessionMap.set(sess._id.toString(), { units, branch: sess.branch });
      totalHeldAcademicUnits += units;
    }

    let totalAttendedUnits = 0;
    for (const rec of allRecords) {
      const sId = rec.session?.toString();
      const sessObj = sessionMap.get(sId);
      totalAttendedUnits += sessObj ? sessObj.units : (rec.periodCount || 1);
    }

    const totalEligible = totalHeldAcademicUnits * Math.max(totalStudents, 1);
    const overallPercentage = totalEligible > 0
      ? Math.round((totalAttendedUnits / totalEligible) * 100)
      : 0;

    // Department Breakdown
    const departmentStats = [];
    for (const dept of branches) {
      const deptData = await this.calculateDepartmentAnalytics({ branch: dept });
      departmentStats.push(deptData);
    }

    // Low Attendance Count across campus
    const lowRegister = await this.calculateLowAttendanceRegister({ threshold: minAttendancePercent });

    return {
      totalActiveStudents: totalStudents,
      totalDepartments: branches.length,
      departments: branches,
      totalSubjects,
      finalizedSessions: finalizedSessionsCount,
      totalHeldAcademicUnits,
      overallAttendancePercentage: overallPercentage,
      minAttendanceThreshold: minAttendancePercent,
      studentsBelowThresholdCount: lowRegister.length,
      departmentStats,
    };
  }

  /**
   * Academic Risk Register: Identifies students whose unrounded attendance falls below threshold.
   * Computes exact recovery deficit:
   * Deficit Units = max(0, ceil((minThreshold * heldUnits - 100 * attendedUnits) / 100))
   *
   * @param {Object} [params]
   * @param {string} [params.branch]
   * @param {number} [params.semester]
   * @param {number} [params.threshold]
   * @returns {Promise<Array<Object>>} Sorted list of students at academic risk
   */
  async calculateLowAttendanceRegister({ branch, semester, threshold } = {}) {
    const { minAttendancePercent } = await this.resolveSettings();
    const effectiveThreshold = typeof threshold === 'number' && !isNaN(threshold) ? threshold : minAttendancePercent;

    const studentQuery = {};
    if (branch) studentQuery.branch = branch;
    if (semester) studentQuery.semester = Number(semester);

    const students = await Student.find(studentQuery).populate('user', 'name email').lean();
    const riskRegister = [];

    for (const st of students) {
      try {
        const overview = await this.calculateStudentOverview({
          studentId: st._id,
          semester: st.semester,
          branch: st.branch,
        });

        // Only evaluate compliance if classes were actually held (hasRecords === true)
        if (overview.summary.hasRecords && overview.summary.rawPercentage !== null) {
          if (overview.summary.rawPercentage < effectiveThreshold) {
            const held = overview.summary.totalHeldUnits;
            const attended = overview.summary.totalAttendedUnits;
            const missed = overview.summary.totalMissedUnits;
            const deficitUnits = this.calculateDeficit(held, attended, effectiveThreshold);

            riskRegister.push({
              studentId: st._id,
              rollNumber: st.rollNumber,
              name: st.fullName || st.name || st.user?.name || 'Student',
              department: st.branch || 'General',
              branch: st.branch || 'General',
              semester: st.semester || 1,
              section: st.section || 'A',
              heldAcademicUnits: held,
              attendedAcademicUnits: attended,
              missedAcademicUnits: missed,
              percentage: overview.summary.overallPercentage,
              rawPercentage: overview.summary.rawPercentage,
              threshold: effectiveThreshold,
              deficitUnits,
              complianceStatus: overview.summary.complianceStatus,
            });
          }
        }
      } catch (err) {
        continue;
      }
    }

    // Sort by raw percentage ascending (most critical risk first)
    riskRegister.sort((a, b) => a.rawPercentage - b.rawPercentage);
    return riskRegister;
  }

  /**
   * Manual Attendance Adjustment Transparency Log.
   *
   * @param {Object} params
   * @param {string|ObjectId} [params.facultyUserId]
   * @param {string|ObjectId} [params.studentId]
   * @param {string|ObjectId} [params.sessionId]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<Object>} Paginated audit logs
   */
  async getManualAdjustmentLogs({ facultyUserId, studentId, sessionId, page = 1, limit = 50 } = {}) {
    const filter = { action: 'manual_correction' };

    if (sessionId) filter.sessionId = sessionId;
    if (studentId) filter.affectedStudentId = studentId;

    if (facultyUserId) {
      const sessions = await AttendanceSession.find({ faculty: facultyUserId }).select('_id').lean();
      const sIds = sessions.map((s) => s._id);
      filter.sessionId = { $in: sIds };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await AttendanceAuditLog.countDocuments(filter);

    const logs = await AttendanceAuditLog.find(filter)
      .populate('actorId', 'name email role')
      .populate('affectedStudentId', 'fullName rollNumber branch semester')
      .populate({
        path: 'sessionId',
        select: 'date period subject branch semester',
        populate: { path: 'subject', select: 'name code' },
      })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formattedLogs = logs.map((log) => ({
      _id: log._id,
      timestamp: this.getIndianTimestamp(log.timestamp),
      isoTimestamp: log.timestamp,
      studentId: log.affectedStudentId?._id,
      studentName: log.affectedStudentId?.fullName || 'Student',
      rollNumber: log.affectedStudentId?.rollNumber || 'N/A',
      department: log.affectedStudentId?.branch || '',
      semester: log.affectedStudentId?.semester || '',
      subjectName: log.sessionId?.subject?.name || 'Class Subject',
      subjectCode: log.sessionId?.subject?.code || '',
      sessionDate: log.sessionId?.date || 'N/A',
      sessionPeriod: log.sessionId?.period || 1,
      previousStatus: log.previousValue?.status || 'N/A',
      updatedStatus: log.newValue?.status || 'N/A',
      actorId: log.actorId?._id,
      actorName: log.actorId?.name || 'Authorized Faculty/Admin',
      actorRole: log.actorRole,
      reason: log.reason || 'Manual attendance correction',
    }));

    return {
      logs: formattedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  }

  /**
   * Unified Practical Attendance Report Generator (8 Practical Report Types).
   *
   * @param {Object} params
   * @param {string} params.reportType One of 8 supported report types
   * @param {'student' | 'faculty' | 'admin'} params.userRole Current user role
   * @param {string|ObjectId} params.userId Current user ID
   * @param {Object} [params.filters] Report query parameters
   * @returns {Promise<Object>} Formatted report object with metadata, columns, and rows
   */
  async generateAttendanceReport({ reportType, userRole, userId, filters = {} }) {
    const { minAttendancePercent } = await this.resolveSettings();
    const generatedAt = this.getIndianTimestamp();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. STUDENT ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'student_report') {
      let targetStudentId = filters.studentId;
      if (userRole === 'student') {
        const studentProfile = await Student.findOne({ user: userId }).lean();
        if (!studentProfile) throw new Error('Student profile not found');
        targetStudentId = studentProfile._id;
      } else if (!targetStudentId) {
        throw new Error('studentId is required to generate student report');
      }

      const overview = await this.calculateStudentOverview({
        studentId: targetStudentId,
        semester: filters.semester,
        branch: filters.branch,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const columns = [
        { key: 'subject', label: 'Subject Name' },
        { key: 'code', label: 'Code' },
        { key: 'faculty', label: 'Assigned Faculty' },
        { key: 'heldUnits', label: 'Classes Held' },
        { key: 'attendedUnits', label: 'Classes Attended' },
        { key: 'missedUnits', label: 'Classes Missed' },
        { key: 'percentage', label: 'Percentage' },
        { key: 'requirement', label: 'Requirement' },
        { key: 'status', label: 'Status' },
      ];

      const rows = overview.subjectWise.map((sub) => ({
        subject: sub.name,
        code: sub.code,
        faculty: sub.facultyName,
        heldUnits: sub.totalClasses,
        attendedUnits: sub.attended,
        missedUnits: sub.missed,
        percentage: sub.hasData ? `${sub.percentage}%` : '—',
        requirement: `${minAttendancePercent}%`,
        status: sub.status,
      }));

      return {
        reportType,
        title: `Student Attendance Report — ${overview.studentName} (${overview.rollNumber})`,
        generatedAt,
        appliedFilters: {
          studentName: overview.studentName,
          rollNumber: overview.rollNumber,
          branch: overview.branch,
          semester: overview.semester,
          ...filters,
        },
        summary: {
          'Student Name': overview.studentName,
          'Roll Number': overview.rollNumber,
          'Overall Attendance': overview.hasData ? `${overview.summary.overallPercentage}%` : 'No Data',
          'Total Academic Units Held': overview.summary.totalHeldUnits,
          'Total Units Attended': overview.summary.totalAttendedUnits,
          'Total Units Missed': overview.summary.totalMissedUnits,
          'Compliance Status': overview.summary.complianceStatus,
          'Requirement': `${minAttendancePercent}%`,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. SUBJECT-WISE ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'subject_wise_report') {
      if (userRole === 'student') throw new Error('Students are not authorized to view class-wide reports');

      const { subjectId } = filters;
      if (!subjectId) throw new Error('subjectId is required for Subject-Wise Report');

      const subject = await Subject.findById(subjectId).populate('faculty', 'name email').lean();
      if (!subject) throw new Error('Subject not found');

      // Authorization for faculty: must teach this subject
      if (userRole === 'faculty') {
        const facIdStr = subject.faculty?._id?.toString() || subject.faculty?.toString();
        if (facIdStr !== userId.toString()) {
          const facultyRec = await Faculty.findOne({ user: userId }).lean();
          if (facIdStr !== facultyRec?._id?.toString()) {
            throw new Error('Unauthorized: You do not teach this subject');
          }
        }
      }

      const sessions = await AttendanceSession.find({
        subject: subjectId,
        status: { $in: ['completed', 'finalized'] },
      }).lean();

      let subjectHeldUnits = 0;
      const sessionMap = new Map();
      for (const s of sessions) {
        const u = this.getAcademicUnits(s);
        subjectHeldUnits += u;
        sessionMap.set(s._id.toString(), u);
      }

      // Enrolled students in this subject's branch/semester
      const studentQuery = { semester: subject.semester };
      if (subject.branch) studentQuery.branch = subject.branch;
      const students = await Student.find(studentQuery).sort({ rollNumber: 1 }).lean();

      const sessionIds = sessions.map((s) => s._id);
      const records = await Attendance.find({
        session: { $in: sessionIds },
      }).lean();

      const columns = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'studentName', label: 'Student Name' },
        { key: 'branch', label: 'Branch' },
        { key: 'semester', label: 'Semester' },
        { key: 'heldUnits', label: 'Classes Held' },
        { key: 'attendedUnits', label: 'Attended' },
        { key: 'missedUnits', label: 'Missed' },
        { key: 'percentage', label: 'Percentage' },
        { key: 'requirement', label: 'Requirement' },
        { key: 'status', label: 'Status' },
      ];

      const rows = students.map((st) => {
        const stRecs = records.filter((r) => r.student?.toString() === st._id.toString());
        let attended = 0;
        const countedSess = new Set();
        for (const r of stRecs) {
          const sId = r.session?.toString();
          if (sId && !countedSess.has(sId) && sessionMap.has(sId)) {
            countedSess.add(sId);
            if (['present', 'late'].includes((r.status || '').toLowerCase().trim())) {
              attended += sessionMap.get(sId);
            }
          }
        }

        const missed = Math.max(0, subjectHeldUnits - attended);
        const rawPct = subjectHeldUnits > 0 ? (attended / subjectHeldUnits) * 100 : null;
        const displayPct = rawPct !== null ? `${Math.round(rawPct)}%` : '—';
        const compliance = this.getComplianceStatus(rawPct, minAttendancePercent);

        return {
          rollNumber: st.rollNumber,
          studentName: st.fullName || st.name,
          branch: st.branch || '',
          semester: st.semester || '',
          heldUnits: subjectHeldUnits,
          attendedUnits: attended,
          missedUnits: missed,
          percentage: displayPct,
          requirement: `${minAttendancePercent}%`,
          status: compliance,
        };
      });

      return {
        reportType,
        title: `Subject-Wise Attendance Report — ${subject.name} (${subject.code})`,
        generatedAt,
        appliedFilters: { subject: `${subject.name} (${subject.code})`, ...filters },
        summary: {
          'Subject Name': subject.name,
          'Subject Code': subject.code,
          'Faculty': subject.faculty?.name || 'Assigned Faculty',
          'Total Sessions Conducted': sessions.length,
          'Total Academic Units Held': subjectHeldUnits,
          'Total Enrolled Students': students.length,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FACULTY ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'faculty_report') {
      if (userRole === 'student') throw new Error('Unauthorized');
      let targetFacultyUserId = filters.facultyId || userId;
      if (userRole === 'faculty') targetFacultyUserId = userId; // strictly authorized

      const facultyReport = await this.calculateFacultyDetailedReport({
        facultyUserId: targetFacultyUserId,
        subjectId: filters.subjectId,
        semester: filters.semester,
        section: filters.section,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const facultyUser = await User.findById(targetFacultyUserId).lean();

      const columns = [
        { key: 'subject', label: 'Subject Name' },
        { key: 'code', label: 'Code' },
        { key: 'semester', label: 'Semester' },
        { key: 'sessions', label: 'Sessions Conducted' },
        { key: 'heldUnits', label: 'Academic Units' },
        { key: 'percentage', label: 'Average Attendance' },
        { key: 'status', label: 'Status' },
      ];

      const rows = facultyReport.subjectStats.map((sub) => ({
        subject: sub.name,
        code: sub.code,
        semester: `Sem ${sub.semester}`,
        sessions: sub.totalClasses,
        heldUnits: sub.totalHeldUnits,
        percentage: `${sub.percentage}%`,
        status: sub.complianceStatus,
      }));

      return {
        reportType,
        title: `Faculty Attendance Report — ${facultyUser?.name || 'Faculty Member'}`,
        generatedAt,
        appliedFilters: { facultyName: facultyUser?.name, ...filters },
        summary: {
          'Faculty Instructor': facultyUser?.name || 'Faculty',
          'Assigned Students': facultyReport.assignedStudentsCount,
          'Classes Scheduled': facultyReport.classesScheduled,
          'Sessions Conducted': facultyReport.sessionsConducted,
          'Overall Class Average': `${facultyReport.averageAttendance}%`,
          'Students At Risk (<75%)': facultyReport.lowAttendanceList.length,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. DEPARTMENT ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'department_report') {
      if (userRole !== 'admin') throw new Error('Only administrators may generate Department Attendance Reports');

      const branches = filters.branch ? [filters.branch] : await Student.distinct('branch');
      const deptList = (branches || []).filter(Boolean);

      const columns = [
        { key: 'department', label: 'Department Name' },
        { key: 'activeStudents', label: 'Active Students' },
        { key: 'sessions', label: 'Finalized Sessions' },
        { key: 'heldUnits', label: 'Total Units Held' },
        { key: 'attendanceRate', label: 'Overall Attendance' },
        { key: 'threshold', label: 'Requirement' },
        { key: 'status', label: 'Status' },
      ];

      const rows = [];
      for (const b of deptList) {
        const d = await this.calculateDepartmentAnalytics({
          branch: b,
          semester: filters.semester,
          startDate: filters.startDate,
          endDate: filters.endDate,
        });

        rows.push({
          department: d.department,
          activeStudents: d.activeStudentCount,
          sessions: d.totalSessionsConducted,
          heldUnits: d.totalHeldAcademicUnits,
          attendanceRate: `${d.overallAttendanceRate}%`,
          threshold: `${minAttendancePercent}%`,
          status: d.overallAttendanceRate >= minAttendancePercent ? 'Good' : 'Critical',
        });
      }

      return {
        reportType,
        title: 'Department-Wise Campus Attendance Report',
        generatedAt,
        appliedFilters: filters,
        summary: {
          'Total Departments Analyzed': deptList.length,
          'Minimum Required Policy': `${minAttendancePercent}%`,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SEMESTER / SECTION ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'semester_section_report') {
      if (userRole === 'student') throw new Error('Unauthorized');

      const branch = filters.branch || 'CSE';
      const semester = Number(filters.semester) || 4;
      const section = filters.section || 'A';

      const students = await Student.find({ branch, semester, section }).lean();
      const stIds = students.map((s) => s._id);

      const subjects = await Subject.find({ branch, semester }).lean();
      const subjectIds = subjects.map((s) => s._id);

      const sessions = await AttendanceSession.find({
        branch,
        semester,
        section,
        subject: { $in: subjectIds },
        status: { $in: ['completed', 'finalized'] },
      }).lean();

      let sectionHeldUnits = 0;
      for (const s of sessions) sectionHeldUnits += this.getAcademicUnits(s);

      const records = await Attendance.find({
        student: { $in: stIds },
        session: { $in: sessions.map((s) => s._id) },
      }).lean();

      let attendedUnits = 0;
      for (const r of records) {
        if (['present', 'late'].includes((r.status || '').toLowerCase().trim())) {
          attendedUnits += r.periodCount || 1;
        }
      }

      const totalCapacity = sectionHeldUnits * Math.max(students.length, 1);
      const avgRate = totalCapacity > 0 ? Math.round((attendedUnits / totalCapacity) * 100) : 0;

      const columns = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'class', label: 'Class / Section' },
        { key: 'heldUnits', label: 'Units Held' },
        { key: 'attended', label: 'Units Attended' },
        { key: 'missed', label: 'Units Missed' },
        { key: 'percentage', label: 'Percentage' },
        { key: 'deficit', label: 'Deficit Units' },
        { key: 'status', label: 'Status' },
      ];

      const rows = students.map((st) => {
        const stRecs = records.filter((r) => r.student?.toString() === st._id.toString());
        let stAttended = 0;
        for (const r of stRecs) {
          if (['present', 'late'].includes((r.status || '').toLowerCase().trim())) {
            stAttended += r.periodCount || 1;
          }
        }
        const missed = Math.max(0, sectionHeldUnits - stAttended);
        const rawPct = sectionHeldUnits > 0 ? (stAttended / sectionHeldUnits) * 100 : null;
        const deficit = this.calculateDeficit(sectionHeldUnits, stAttended, minAttendancePercent);

        return {
          rollNumber: st.rollNumber,
          name: st.fullName || st.name,
          class: `${branch}-Sem${semester}-${section}`,
          heldUnits: sectionHeldUnits,
          attended: stAttended,
          missed,
          percentage: rawPct !== null ? `${Math.round(rawPct)}%` : '—',
          deficit: rawPct !== null && rawPct < minAttendancePercent ? deficit : 0,
          status: this.getComplianceStatus(rawPct, minAttendancePercent),
        };
      });

      return {
        reportType,
        title: `Class Section Attendance Report — ${branch} Semester ${semester} Section ${section}`,
        generatedAt,
        appliedFilters: { branch, semester, section, ...filters },
        summary: {
          'Cohort': `${branch} Sem ${semester} - Sec ${section}`,
          'Enrolled Students': students.length,
          'Sessions Conducted': sessions.length,
          'Total Academic Units Held': sectionHeldUnits,
          'Section Attendance Average': `${avgRate}%`,
          'Requirement': `${minAttendancePercent}%`,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. LOW-ATTENDANCE STUDENT REPORT (Academic Risk Monitoring)
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'low_attendance_report') {
      if (userRole === 'student') throw new Error('Unauthorized');

      const lowRegister = await this.calculateLowAttendanceRegister({
        branch: filters.branch,
        semester: filters.semester,
        threshold: filters.threshold ? Number(filters.threshold) : minAttendancePercent,
      });

      const columns = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'department', label: 'Department' },
        { key: 'semester', label: 'Semester' },
        { key: 'section', label: 'Section' },
        { key: 'heldAcademicUnits', label: 'Units Held' },
        { key: 'attendedAcademicUnits', label: 'Attended' },
        { key: 'missedAcademicUnits', label: 'Missed' },
        { key: 'percentage', label: 'Percentage' },
        { key: 'threshold', label: 'Threshold' },
        { key: 'deficitUnits', label: 'Deficit Units' },
        { key: 'complianceStatus', label: 'Risk Level' },
      ];

      const rows = lowRegister.map((st) => ({
        rollNumber: st.rollNumber,
        name: st.name,
        department: st.department,
        semester: `Sem ${st.semester}`,
        section: st.section,
        heldAcademicUnits: st.heldAcademicUnits,
        attendedAcademicUnits: st.attendedAcademicUnits,
        missedAcademicUnits: st.missedAcademicUnits,
        percentage: `${st.percentage}%`,
        threshold: `${st.threshold}%`,
        deficitUnits: st.deficitUnits,
        complianceStatus: st.complianceStatus === 'Critical' ? 'Critical Risk' : 'Warning Risk',
      }));

      return {
        reportType,
        title: `Low Attendance Warning Register (< ${filters.threshold || minAttendancePercent}%)`,
        generatedAt,
        appliedFilters: filters,
        summary: {
          'Total Students at Risk': lowRegister.length,
          'Configured Debarment Threshold': `${filters.threshold || minAttendancePercent}%`,
          'Status': 'Counseling & Recovery Required',
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. SESSION-WISE ATTENDANCE REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'session_wise_report') {
      if (userRole === 'student') throw new Error('Unauthorized');

      const { sessionId } = filters;
      if (!sessionId) throw new Error('sessionId is required for Session-Wise Report');

      const session = await AttendanceSession.findById(sessionId)
        .populate('subject', 'name code')
        .populate('faculty', 'name email')
        .lean();

      if (!session) throw new Error('Attendance session not found');

      // Authorization for faculty: must have conducted this session
      if (userRole === 'faculty' && session.faculty?._id?.toString() !== userId.toString()) {
        throw new Error('Unauthorized: You can only query reports for your own sessions');
      }

      const records = await Attendance.find({ session: sessionId })
        .populate('student', 'fullName rollNumber branch semester section')
        .sort({ 'student.rollNumber': 1 })
        .lean();

      const columns = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'class', label: 'Cohort' },
        { key: 'status', label: 'Attendance Status' },
        { key: 'method', label: 'Verification Method' },
        { key: 'confidence', label: 'Face Confidence' },
        { key: 'markedAt', label: 'Marked At (IST)' },
      ];

      const rows = records.map((r) => ({
        rollNumber: r.student?.rollNumber || 'N/A',
        name: r.student?.fullName || 'Student',
        class: `${r.student?.branch || ''}-Sem${r.student?.semester || ''}`,
        status: (r.status || '').toUpperCase(),
        method: r.verificationMethod || 'manual',
        confidence: r.confidence ? `${Math.round(r.confidence * 100)}%` : '—',
        markedAt: this.getIndianTimestamp(r.markedAt || r.createdAt),
      }));

      const presentCount = records.filter((r) => ['present', 'late'].includes((r.status || '').toLowerCase())).length;

      return {
        reportType,
        title: `Class Session Attendance Ledger — ${session.date} (Period ${session.period})`,
        generatedAt,
        appliedFilters: { sessionId, ...filters },
        summary: {
          'Subject': `${session.subject?.name} (${session.subject?.code})`,
          'Faculty': session.faculty?.name || 'Faculty',
          'Date': session.date,
          'Period': session.period,
          'Academic Units': this.getAcademicUnits(session),
          'Present Count': `${presentCount} / ${records.length}`,
          'Session Status': session.status,
        },
        columns,
        rows,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. MANUAL ADJUSTMENT AUDIT REPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (reportType === 'manual_adjustment_report') {
      if (userRole === 'student') throw new Error('Unauthorized');

      const facultyUserId = userRole === 'faculty' ? userId : filters.facultyUserId;

      const adjustmentData = await this.getManualAdjustmentLogs({
        facultyUserId,
        studentId: filters.studentId,
        sessionId: filters.sessionId,
        page: filters.page || 1,
        limit: filters.limit || 100,
      });

      const columns = [
        { key: 'timestamp', label: 'Timestamp (IST)' },
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'studentName', label: 'Student Name' },
        { key: 'subject', label: 'Subject' },
        { key: 'sessionDate', label: 'Session Date' },
        { key: 'period', label: 'Period' },
        { key: 'previousStatus', label: 'Previous Status' },
        { key: 'updatedStatus', label: 'Updated Status' },
        { key: 'actorName', label: 'Authorized Actor' },
        { key: 'reason', label: 'Mandatory Reason' },
      ];

      const rows = adjustmentData.logs.map((log) => ({
        timestamp: log.timestamp,
        rollNumber: log.rollNumber,
        studentName: log.studentName,
        subject: `${log.subjectName} (${log.subjectCode})`,
        sessionDate: log.sessionDate,
        period: log.sessionPeriod,
        previousStatus: log.previousStatus,
        updatedStatus: log.updatedStatus,
        actorName: `${log.actorName} (${log.actorRole})`,
        reason: log.reason,
      }));

      return {
        reportType,
        title: 'Manual Attendance Override & Correction Audit Ledger',
        generatedAt,
        appliedFilters: filters,
        summary: {
          'Total Audit Corrections': adjustmentData.pagination.total,
          'Integrity Policy': 'Immutable Append-Only Audit Records',
        },
        columns,
        rows,
      };
    }

    throw new Error(`Unsupported report type: ${reportType}`);
  }
}

const attendanceCalculationService = new AttendanceCalculationService();
module.exports = attendanceCalculationService;
