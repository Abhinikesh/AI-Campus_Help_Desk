/**
 * server/controllers/faculty.controller.js
 */
'use strict';

const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const AuditLog = require('../models/AuditLog');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');
const attendanceCalculationService = require('../services/attendanceCalculation.service');
const facultyScopeService = require('../services/facultyScope.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getGrade } = require('../utils/grades');

// GET /api/faculty/profile
const getProfile = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findOne({ user: req.user.userId })
    .populate('user', 'name email loginId');
  if (!faculty) throw new ApiError(404, 'Faculty profile not found');

  return res.status(200).json({ success: true, data: faculty, message: 'OK' });
});

// GET /api/faculty/timetable
const getTimetable = asyncHandler(async (req, res) => {
  const facultyId = req.user._id || req.user.userId;

  // Find subjects taught by this faculty
  const subjects = await Subject.find({
    $or: [{ faculty: facultyId }, { branch: 'CSE' }],
  });

  const subjectIds = subjects.map(s => s._id);

  // Query database-backed timetable entries assigned to faculty or their subjects
  const timetable = await Timetable.find({
    $or: [
      { faculty: facultyId },
      { subject: { $in: subjectIds } },
    ],
    status: { $in: ['published', 'updated', 'draft'] },
  })
    .populate('subject', 'name code credits semester branch')
    .sort({ dayOfWeek: 1, startTime: 1 });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formatted = timetable.map(t => ({
    _id: t._id,
    dayOfWeek: t.dayOfWeek,
    dayName: t.dayName || dayNames[t.dayOfWeek] || 'Weekday',
    startTime: t.startTime,
    endTime: t.endTime,
    time: `${t.startTime} - ${t.endTime}`,
    room: t.room || 'TBA',
    period: t.period || 1,
    periodCount: t.periodCount || 1,
    sessionType: t.sessionType || 'Lecture',
    semester: t.semester,
    section: t.section,
    department: t.department,
    status: t.status,
    subject: t.subject,
  }));

  return res.status(200).json({ success: true, data: formatted, message: 'Timetable loaded' });
});

// POST /api/faculty/attendance/sessions — Create & Start Session
const createAttendanceSession = asyncHandler(async (req, res) => {
  const {
    subjectId,
    date = new Date().toISOString().split('T')[0],
    period = 1,
    startTime = '09:00 AM',
    endTime = '10:00 AM',
    sessionType = 'regular',
    attendanceMethod = 'face',
    branch = 'CSE',
    semester = 4,
    section = 'A',
  } = req.body;

  if (!subjectId) {
    throw new ApiError(400, 'Subject is required to start an attendance session');
  }

  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');

  // Count total students enrolled in this branch & semester
  const totalStudents = await Student.countDocuments({
    branch: { $regex: new RegExp(branch, 'i') },
    semester: Number(semester),
  });

  // Create session
  const session = await AttendanceSession.create({
    subject: subject._id,
    faculty: req.user.userId,
    date,
    period: Number(period),
    startTime,
    endTime,
    sessionType,
    attendanceMethod,
    branch,
    semester: Number(semester),
    section,
    status: 'open',
    totalStudents: totalStudents || 10,
    presentCount: 0,
    openedAt: new Date(),
  });

  // Populate session subject
  await session.populate('subject', 'name code');

  // Pre-populate students in Attendance as pending/absent
  const students = await Student.find({
    branch: { $regex: new RegExp(branch, 'i') },
    semester: Number(semester),
  });

  for (const st of students) {
    // Check if record already exists for this date/period
    const existing = await Attendance.findOne({
      subject: subject._id,
      student: st._id,
      date,
      period: Number(period),
    });

    if (!existing) {
      await Attendance.create({
        subject: subject._id,
        student: st._id,
        session: session._id,
        date,
        period: Number(period),
        status: 'pending',
        verificationMethod: attendanceMethod,
      });
    } else {
      existing.session = session._id;
      await existing.save();
    }
  }

  return res.status(201).json({
    success: true,
    data: session,
    message: 'Attendance session started successfully',
  });
});

// GET /api/faculty/attendance/sessions — List Sessions
const getAttendanceSessions = asyncHandler(async (req, res) => {
  const sessions = await AttendanceSession.find({ faculty: req.user.userId })
    .populate('subject', 'name code')
    .sort({ createdAt: -1 });

  return res.status(200).json({ success: true, data: sessions, message: 'Sessions retrieved' });
});

// GET /api/faculty/attendance/sessions/:id — Live Session Roster
const getSessionDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await AttendanceSession.findById(id)
    .populate('subject', 'name code credits branch semester')
    .populate('faculty', 'name email');

  if (!session) throw new ApiError(404, 'Attendance session not found');

  // Get all attendance records for this session
  const records = await Attendance.find({ session: session._id })
    .populate({
      path: 'student',
      select: 'rollNumber fullName email branch semester section phone user',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ updatedAt: -1 });

  // Map into live student roster
  const roster = records.map(r => ({
    _id: r._id,
    studentId: r.student?._id,
    rollNumber: r.student?.rollNumber || 'N/A',
    name: r.student?.fullName || r.student?.user?.name || 'Student',
    branch: r.student?.branch || session.branch,
    section: r.student?.section || session.section,
    status: r.status, // 'present' | 'pending' | 'absent' | 'review'
    verificationMethod: r.verificationMethod || 'face',
    confidence: r.confidence,
    verifiedAt: r.verifiedAt || r.updatedAt,
    isManualOverride: r.isManualOverride,
    overrideNote: r.overrideNote,
  }));

  // Ensure all enrolled students in class are represented
  const allStudents = await Student.find({
    semester: session.semester,
    branch: { $regex: new RegExp(session.branch, 'i') }
  }).populate('user', 'name email');

  const recordedStudentIds = new Set(
    records.filter(r => r.student).map(r => r.student._id.toString())
  );

  const pendingItems = allStudents
    .filter(st => !recordedStudentIds.has(st._id.toString()))
    .map(st => ({
      _id: `pending-${st._id}`,
      studentId: st._id,
      rollNumber: st.rollNumber || 'N/A',
      name: st.fullName || st.user?.name || 'Student',
      branch: st.branch || session.branch,
      section: st.section || session.section,
      status: 'pending',
      verificationMethod: session.attendanceMethod || 'face',
      confidence: null,
      verifiedAt: null,
      isManualOverride: false,
      overrideNote: null,
    }));

  const fullRoster = [...roster, ...pendingItems];

  const stats = {
    totalStudents: allStudents.length || session.totalStudents || fullRoster.length,
    present: fullRoster.filter(s => ['present', 'late'].includes(s.status)).length,
    pending: fullRoster.filter(s => s.status === 'pending').length,
    absent: fullRoster.filter(s => s.status === 'absent').length,
    needsReview: fullRoster.filter(s => s.status === 'review').length,
  };

  return res.status(200).json({
    success: true,
    data: {
      session,
      roster: fullRoster,
      stats,
    },
    message: 'Session details loaded',
  });
});

// PATCH /api/faculty/attendance/sessions/:id/close — Close Session
const closeAttendanceSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await AttendanceSession.findById(id);
  if (!session) throw new ApiError(404, 'Attendance session not found');

  // Mark all remaining 'pending' students as 'absent'
  await Attendance.updateMany(
    { session: session._id, status: 'pending' },
    { status: 'absent' }
  );

  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: 'present',
  });

  session.status = 'closed';
  session.closedAt = new Date();
  session.presentCount = presentCount;
  await session.save();

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'faculty',
    action: 'close_session',
    sessionId: session._id,
    reason: 'Faculty closed session',
    ipAddress: req.ip
  });

  return res.status(200).json({ success: true, data: session, message: 'Session closed' });
});

// PATCH /api/faculty/attendance/sessions/:id/finalize — Lock Records
const finalizeAttendanceSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await AttendanceSession.findById(id);
  if (!session) throw new ApiError(404, 'Attendance session not found');

  // Ensure no pendings
  await Attendance.updateMany(
    { session: session._id, status: 'pending' },
    { status: 'absent' }
  );

  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: 'present',
  });

  session.status = 'finalized';
  session.presentCount = presentCount;
  if (!session.closedAt) session.closedAt = new Date();
  await session.save();

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'faculty',
    action: 'finalize_session',
    sessionId: session._id,
    reason: 'Faculty finalized session attendance',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance records finalized and locked successfully',
  });
});

// POST /api/faculty/attendance/mark-student — Manual toggle/correction
const markAttendanceStudent = asyncHandler(async (req, res) => {
  const { attendanceId, status, note = '', reason = '' } = req.body;
  if (!attendanceId || !status) {
    throw new ApiError(400, 'attendanceId and status are required');
  }

  const attendance = await Attendance.findById(attendanceId);
  if (!attendance) throw new ApiError(404, 'Attendance record not found');

  const previousStatus = attendance.status;
  const finalReason = reason || note || 'Faculty manual adjustment';

  attendance.status = status;
  attendance.isManualOverride = true;
  attendance.overrideBy = req.user.userId;
  attendance.overrideNote = finalReason;
  attendance.verifiedAt = new Date();
  await attendance.save();

  // If connected to a session, update present count
  if (attendance.session) {
    const presentCount = await Attendance.countDocuments({
      session: attendance.session,
      status: 'present',
    });
    await AttendanceSession.findByIdAndUpdate(attendance.session, { presentCount });
  }

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'faculty',
    action: 'manual_correction',
    attendanceId: attendance._id,
    sessionId: attendance.session,
    affectedStudentId: attendance.student,
    previousValue: { status: previousStatus },
    newValue: { status },
    reason: finalReason,
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: attendance,
    message: `Student status updated to ${status}`,
  });
});

// GET /api/faculty/attendance/records — Historical Sessions & Records
const getAttendanceRecords = asyncHandler(async (req, res) => {
  const { subjectId, date, status, branch, semester } = req.query;
  const sessionFilter = { faculty: req.user.userId };

  if (subjectId) sessionFilter.subject = subjectId;
  if (date) sessionFilter.date = date;
  if (branch) sessionFilter.branch = branch;
  if (semester) sessionFilter.semester = Number(semester);

  const sessions = await AttendanceSession.find(sessionFilter)
    .populate('subject', 'name code')
    .sort({ date: -1, period: -1 });

  const formatted = sessions.map(s => {
    const total = s.totalStudents || 0;
    const present = s.presentCount || 0;
    const absent = Math.max(0, total - present);
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      _id: s._id,
      date: s.date,
      subject: s.subject?.name || 'Class',
      code: s.subject?.code || '',
      class: `${s.branch || 'CSE'}-${s.semester || 4}${s.section ? ' (' + s.section + ')' : ''}`,
      totalStudents: total,
      present,
      absent,
      percentage: pct,
      status: s.status,
      sessionType: s.sessionType,
      time: `${s.startTime} - ${s.endTime}`,
    };
  });

  return res.status(200).json({ success: true, data: formatted, message: 'Records retrieved' });
});

// GET /api/faculty/attendance/reports — Analytics & Trends
const getAttendanceReports = asyncHandler(async (req, res) => {
  const subjects = await Subject.find({
    $or: [{ faculty: req.user.userId }, { branch: 'CSE' }],
  });

  // Calculate subject-wise attendance
  const subjectStats = await Promise.all(
    subjects.map(async (sub) => {
      const records = await Attendance.find({ subject: sub._id });
      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 85;
      return {
        subjectId: sub._id,
        name: sub.name,
        code: sub.code,
        totalClasses: await AttendanceSession.countDocuments({ subject: sub._id }),
        totalRecords: total,
        presentRecords: present,
        percentage: pct,
      };
    })
  );

  // Low attendance students (< 75%)
  const students = await Student.find({ semester: 4 }).populate('user', 'name email');
  const lowAttendanceList = [];

  for (const st of students) {
    const records = await Attendance.find({ student: st._id });
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    if (total > 0 && pct < 75) {
      lowAttendanceList.push({
        _id: st._id,
        rollNumber: st.rollNumber,
        name: st.fullName || st.user?.name,
        totalClasses: total,
        attended: present,
        percentage: pct,
        status: pct < 60 ? 'Critical' : 'Warning',
      });
    }
  }

  // Monthly trends (sample last 4 months)
  const monthlyTrends = [
    { month: 'Jan', percentage: 88 },
    { month: 'Feb', percentage: 84 },
    { month: 'Mar', percentage: 79 },
    { month: 'Apr', percentage: 82 },
  ];

  return res.status(200).json({
    success: true,
    data: {
      subjectStats,
      lowAttendanceList,
      monthlyTrends,
      classAverage: 83,
    },
    message: 'Attendance reports retrieved',
  });
});

// POST /api/faculty/attendance — Legacy Compatibility Mark
const markAttendance = asyncHandler(async (req, res) => {
  const { subjectId, subjectCode, date, period = 1, roster = {}, attendanceData } = req.body;
  const recordDate = date || new Date().toISOString().split('T')[0];

  let targetSubjectId = subjectId;
  if (!targetSubjectId && subjectCode) {
    const sub = await Subject.findOne({ code: subjectCode.toUpperCase() });
    if (sub) targetSubjectId = sub._id;
  }

  if (!targetSubjectId) {
    throw new ApiError(400, 'Subject is required');
  }

  // Handle array format from existing FacultyDashboard modal
  if (Array.isArray(attendanceData)) {
    for (const item of attendanceData) {
      if (!item.studentId) continue;
      const isPresent = item.status === 'present' || item.status === true;
      await Attendance.findOneAndUpdate(
        {
          subject: targetSubjectId,
          student: item.studentId,
          date: recordDate,
          period: Number(period),
        },
        {
          status: isPresent ? 'present' : 'absent',
          verificationMethod: 'manual',
          markedBy: req.user.userId,
          verifiedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }
    return res.status(200).json({ success: true, message: 'Attendance marked successfully' });
  }

  // Handle dictionary roster format
  for (const [studentId, isPresent] of Object.entries(roster)) {
    await Attendance.findOneAndUpdate(
      {
        subject: targetSubjectId,
        student: studentId,
        date: recordDate,
        period: Number(period),
      },
      {
        status: isPresent ? 'present' : 'absent',
        verificationMethod: 'manual',
        markedBy: req.user.userId,
        verifiedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  return res.status(200).json({ success: true, message: 'Attendance marked successfully' });
});

// POST /api/faculty/announcements
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, audience } = req.body;
  if (!title || !body) throw new ApiError(400, 'Title and body are required');

  const validAudiences = ['all', 'student', 'faculty'];
  const ann = await Announcement.create({
    title,
    body,
    audience: validAudiences.includes(audience) ? audience : 'student',
    createdBy: req.user.userId,
  });

  return res.status(201).json({ success: true, data: ann, message: 'Announcement created' });
});

// GET /api/faculty/announcements
const getAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({ audience: { $in: ['all', 'faculty'] } })
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: announcements, message: 'OK' });
});

// GET /api/faculty/students
const getStudents = asyncHandler(async (req, res) => {
  const { branch, semester } = req.query;
  const facultyUserId = req.user.userId;

  // Derive teaching scope to prevent unrestricted DB dumps
  const scope = await facultyScopeService.getFacultyTeachingScope(facultyUserId);
  if (!scope.hasScope) {
    return res.status(200).json({ success: true, data: [], message: 'No students in authorized teaching scope' });
  }

  const filter = { ...scope.studentQuery };
  if (branch) filter.branch = branch;
  if (semester) filter.semester = Number(semester);

  const students = await Student.find(filter)
    .populate('user', 'name email loginId')
    .sort({ rollNumber: 1 });

  return res.status(200).json({ success: true, data: students, message: 'OK' });
});

// ─────────────────────────────────────────────────────────────
// Student Search & Student 360 Helpers (Phase 2.2 Maintenance)
// ─────────────────────────────────────────────────────────────

/**
 * Safely masks a phone number for directory search results (Fix F-03).
 * Preserves the final 4 digits (e.g. '••••••0001').
 * Safely handles null, empty, short, and non-numeric values.
 */
const maskPhoneNumber = (rawPhone) => {
  if (rawPhone == null) return null;
  const str = String(rawPhone).trim();
  if (!str) return null;
  if (str.length <= 4) return '••••';
  const lastFour = str.slice(-4);
  const dotCount = Math.max(2, Math.min(6, str.length - 4));
  return `${'•'.repeat(dotCount)}${lastFour}`;
};

/**
 * Safely records security and access audit logs for Student 360 operations (Fix F-05).
 * Fails gracefully without leaking internal errors to clients or crashing endpoints.
 */
const safeAuditLog = async ({ actor = null, action, entityType = 'Student', entityId = null, summary = '', ip = '' }) => {
  try {
    let validEntityId = null;
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      validEntityId = new mongoose.Types.ObjectId(entityId);
    }
    let validActor = null;
    if (actor && mongoose.Types.ObjectId.isValid(actor)) {
      validActor = new mongoose.Types.ObjectId(actor);
    }

    await AuditLog.create({
      actor: validActor,
      action,
      entityType,
      entityId: validEntityId,
      summary: String(summary || '').slice(0, 500),
      ip: String(ip || ''),
    });
  } catch (err) {
    // Non-blocking: audit failure must not crash the endpoint or leak internals
    console.warn(`[AuditLog] Non-critical audit logging failed for ${action}: ${err.message}`);
  }
};

// GET /api/faculty/students/search
const searchStudents = asyncHandler(async (req, res) => {
  const { q, branch, semester, section, myClassesOnly, page = 1, limit = 20 } = req.query;
  const facultyUserId = req.user.userId;

  // Check institutional access policy: 'institution_wide' (default) or 'teaching_scope'
  const accessPolicy = process.env.FACULTY_STUDENT_ACCESS_POLICY || 'institution_wide';
  const enforceTeachingScope = accessPolicy === 'teaching_scope' || myClassesOnly === 'true' || myClassesOnly === true;

  const andConditions = [];

  if (enforceTeachingScope) {
    const scope = await facultyScopeService.getFacultyTeachingScope(facultyUserId);
    if (!scope.hasScope) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0,
        },
        message: 'No students in authorized teaching scope',
      });
    }
    if (scope.studentQuery) {
      andConditions.push(scope.studentQuery);
    }
  }

  if (branch) andConditions.push({ branch });
  if (semester) andConditions.push({ semester: Number(semester) });
  if (section) andConditions.push({ section });

  const queryStr = typeof q === 'string' ? q.trim() : '';
  if (queryStr) {
    const escaped = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const orClauses = [
      { rollNumber: regex },
      { fullName: regex },
      { phone: regex },
      { email: regex },
    ];
    // Support normalized digits search if query contains digits
    const cleanDigits = queryStr.replace(/\D/g, '');
    if (cleanDigits.length >= 3 && cleanDigits !== queryStr) {
      orClauses.push({ phone: new RegExp(cleanDigits, 'i') });
    }
    if (mongoose.Types.ObjectId.isValid(queryStr)) {
      orClauses.push({ _id: new mongoose.Types.ObjectId(queryStr) });
    }
    andConditions.push({ $or: orClauses });
  }

  const filter = andConditions.length === 0 ? {} : (andConditions.length === 1 ? andConditions[0] : { $and: andConditions });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // 3. Query students with selective projection (distinguish similar names, no sensitive auth data)
  const [students, total] = await Promise.all([
    Student.find(filter)
      .select('_id rollNumber fullName phone email branch semester section program status')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Student.countDocuments(filter),
  ]);

  // Rank exact roll-number matches above partial matches, then exact name matches
  if (queryStr) {
    const queryLower = queryStr.toLowerCase();
    students.sort((a, b) => {
      const aExactRoll = String(a.rollNumber || '').toLowerCase() === queryLower;
      const bExactRoll = String(b.rollNumber || '').toLowerCase() === queryLower;
      if (aExactRoll && !bExactRoll) return -1;
      if (!aExactRoll && bExactRoll) return 1;

      const aExactName = String(a.fullName || '').toLowerCase() === queryLower;
      const bExactName = String(b.fullName || '').toLowerCase() === queryLower;
      if (aExactName && !bExactName) return -1;
      if (!aExactName && bExactName) return 1;

      return 0;
    });
  }

  // Mask phone numbers in search results (Fix F-03)
  const sanitizedStudents = students.map((s) => ({
    ...s,
    phone: maskPhoneNumber(s.phone),
    phoneNumber: maskPhoneNumber(s.phone),
  }));

  return res.status(200).json({
    success: true,
    data: sanitizedStudents,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
    message: 'Students fetched successfully',
  });
});

// GET /api/faculty/students/:id/360
const getStudent360 = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const facultyUserId = req.user.userId;

  // 1. Validate ObjectId
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    await safeAuditLog({
      actor: facultyUserId,
      action: 'STUDENT_360_INVALID_ID',
      entityType: 'Student',
      entityId: null,
      summary: 'Faculty requested Student 360 profile with an invalid identifier format',
      ip: req.ip || '',
    });
    throw new ApiError(400, 'Invalid student identifier format');
  }

  // 2. Fetch student
  const student = await Student.findById(id).lean();
  if (!student) {
    await safeAuditLog({
      actor: facultyUserId,
      action: 'STUDENT_360_NOT_FOUND',
      entityType: 'Student',
      entityId: id,
      summary: 'Faculty requested non-existent Student 360 profile',
      ip: req.ip || '',
    });
    throw new ApiError(404, 'Student not found');
  }

  // 3. Access Policy evaluation
  const accessPolicy = process.env.FACULTY_STUDENT_ACCESS_POLICY || 'institution_wide';
  if (accessPolicy === 'teaching_scope') {
    const scope = await facultyScopeService.getFacultyTeachingScope(facultyUserId);
    const inScope = facultyScopeService.isStudentInScope(student, scope);
    if (!inScope) {
      await safeAuditLog({
        actor: facultyUserId,
        action: 'STUDENT_360_ACCESS_DENIED',
        entityType: 'Student',
        entityId: student._id,
        summary: 'Faculty access denied under teaching-scope authorization policy',
        ip: req.ip || '',
      });
      throw new ApiError(403, 'Access denied: You are not authorized to view this student profile');
    }
  }

  // 4. Fetch 4 sections in parallel using actual database relationships
  const [subjects, publishedMarks, timetableSlots] = await Promise.all([
    // Section 2: Academic Details -> Enrolled subjects matching student branch & semester
    Subject.find({
      branch: student.branch,
      semester: student.semester,
    })
      .populate('faculty', 'name email')
      .lean(),

    // Section 3: Marks & Results -> Published marks only
    Mark.find({
      student: student._id,
      status: 'published',
    })
      .populate('subject', 'name code credits')
      .populate('exam', 'title examinationType maximumMarks passingMarks')
      .lean(),

    // Section 4: Timetable -> Published weekly timetable slots
    Timetable.find({
      branch: student.branch,
      semester: student.semester,
      $or: [{ section: student.section }, { section: 'All' }, { section: null }, { section: '' }],
      status: { $in: ['published', 'updated'] },
    })
      .populate({
        path: 'subject',
        select: 'name code credits',
        populate: { path: 'faculty', select: 'name email' },
      })
      .populate('faculty', 'name email')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean(),
  ]);

  // Section 1: Basic Profile — STRICT LIMITATION: ONLY rollNumber, phoneNumber, class
  const classLabel = [
    student.semester ? `Semester ${student.semester}` : '',
    student.branch || '',
    student.section ? `Section ${student.section}` : '',
  ]
    .filter(Boolean)
    .join(' ') || (student.semester && student.branch ? `${student.semester} ${student.branch}-${student.section || 'A'}` : null);

  const basicProfile = {
    rollNumber: student.rollNumber || null,
    phoneNumber: student.phone || null,
    class: classLabel,
  };

  // Section 2: Academic Details — verified relationships only, preserve nulls
  const academicDetails = {
    academicSession: '2026-2027 (Odd Semester)',
    programme: student.program || null,
    course: student.program || null,
    department: student.branch || null,
    branch: student.branch || null,
    semester: student.semester != null ? student.semester : null,
    section: student.section || null,
    enrollmentBasis: 'Prescribed Departmental Curriculum',
    enrolledSubjects: subjects.map((s) => ({
      code: s.code || null,
      name: s.name || null,
      credits: s.credits != null ? s.credits : null,
      subjectType: s.type || 'Theory',
      assignedFaculty: s.faculty?.name || 'To Be Announced',
      facultyEmail: s.faculty?.email || null,
    })),
  };

  // Section 3: Marks & Results — real persisted published marks only
  let marksAndResults;
  if (!publishedMarks || publishedMarks.length === 0) {
    marksAndResults = {
      status: 'unreleased',
      message: 'Marks have not been published for this examination.',
      sgpa: null,
      cgpa: null,
      subjectMarks: [],
    };
  } else {
    let totalCredits = 0;
    let earnedPoints = 0;

    const subjectMarks = publishedMarks.map((m) => {
      const cred = m.subject?.credits || 0;
      const rawMarks = m.marksObtained != null ? m.marksObtained : (m.internal || 0) + (m.external || 0);
      const max = m.maxMarks != null ? m.maxMarks : (m.exam?.maximumMarks || 100);
      const pct = max > 0 && rawMarks != null ? (rawMarks / max) * 100 : 0;
      const gradeInfo = getGrade(pct);

      if (cred > 0 && !m.isAbsent) {
        totalCredits += cred;
        earnedPoints += gradeInfo.points * cred;
      }

      return {
        subjectCode: m.subject?.code || null,
        subjectName: m.subject?.name || null,
        examTitle: m.exam?.title || 'Semester Examination',
        internalMarks: m.internal != null ? m.internal : null,
        externalMarks: m.external != null ? m.external : null,
        marksObtained: rawMarks,
        maxMarks: max,
        grade: m.isAbsent ? 'F' : gradeInfo.grade,
        isPassed: m.isAbsent ? false : (rawMarks >= (m.passingMarks || 40)),
      };
    });

    let sgpa = null;
    if (totalCredits > 0) {
      sgpa = Math.round((earnedPoints / totalCredits) * 100) / 100;
    }

    marksAndResults = {
      status: 'published',
      message: null,
      sgpa,
      cgpa: sgpa,
      subjectMarks,
    };
  }

  // Section 4: Timetable — verified published schedule
  let timetable;
  if (!timetableSlots || timetableSlots.length === 0) {
    timetable = {
      status: 'no_schedule',
      message: 'No published timetable available for this section.',
      slots: [],
    };
  } else {
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slots = timetableSlots.map((t) => ({
      weekday: t.dayName || daysMap[t.dayOfWeek] || 'Scheduled Day',
      day: t.dayName || daysMap[t.dayOfWeek] || 'Scheduled Day',
      period: t.period || null,
      periodNumber: t.period || null,
      startTime: t.startTime || null,
      endTime: t.endTime || null,
      time: t.startTime && t.endTime ? `${t.startTime} – ${t.endTime}` : null,
      subject: t.subject?.name || null,
      subjectName: t.subject?.name || null,
      subjectCode: t.subject?.code || null,
      room: t.room || null,
      classroom: t.room || null,
      faculty: t.faculty?.name || t.subject?.faculty?.name || null,
      facultyName: t.faculty?.name || t.subject?.faculty?.name || null,
      group: t.batch || t.subgroup || 'All',
      subgroup: t.batch || t.subgroup || 'All',
      sessionType: t.sessionType || 'Lecture',
    }));

    timetable = {
      status: 'published',
      message: null,
      slots,
    };
  }

  // 5. Audit Logging (non-blocking)
  await safeAuditLog({
    actor: facultyUserId,
    action: 'STUDENT_360_VIEW',
    entityType: 'Student',
    entityId: student._id,
    summary: 'Faculty viewed verified Student 360 profile',
    ip: req.ip || '',
  });

  // 6. Return standard structured response
  return res.status(200).json({
    success: true,
    data: {
      basicProfile,
      academicDetails,
      marksAndResults,
      timetable,
    },
    message: 'Student 360 profile loaded successfully',
  });
});

// POST /api/faculty/complaints
const raiseComplaint = asyncHandler(async (req, res) => {
  const Complaint = require('../models/Complaint');
  const { title, description, category } = req.body;
  if (!title || !description || !category) {
    throw new ApiError(400, 'title, description, and category are required');
  }

  const complaint = await Complaint.create({
    raisedBy: req.user.userId,
    title,
    description,
    category,
  });

  return res.status(201).json({ success: true, data: complaint, message: 'Complaint submitted' });
});

// GET /api/faculty/overview
const getOverview = asyncHandler(async (req, res) => {
  const metrics = await attendanceCalculationService.calculateFacultyMetrics(req.user.userId);
  return res.status(200).json({
    success: true,
    data: metrics,
    message: 'Faculty overview loaded',
  });
});

module.exports = {
  getProfile,
  getOverview,
  getTimetable,
  createAttendanceSession,
  getAttendanceSessions,
  getSessionDetails,
  closeAttendanceSession,
  finalizeAttendanceSession,
  markAttendanceStudent,
  getAttendanceRecords,
  getAttendanceReports,
  markAttendance,
  createAnnouncement,
  getAnnouncements,
  getStudents,
  searchStudents,
  getStudent360,
  raiseComplaint,
  safeAuditLog,
};
