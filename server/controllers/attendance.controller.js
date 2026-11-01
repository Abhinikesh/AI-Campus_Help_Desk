/**
 * server/controllers/attendance.controller.js
 * Comprehensive Smart Attendance Controller supporting:
 * - Student Attendance & History
 * - Faculty Sessions & Live Console
 * - Admin Attendance & Audit Logs
 * - Python-powered Calculation & Analytics Engine
 * - Duplicate Attendance Prevention & Controlled Manual Overrides
 */
'use strict';

const crypto = require('crypto');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');
const ConsentRecord = require('../models/ConsentRecord');
const FaceEmbedding = require('../models/FaceEmbedding');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const User = require('../models/User');
const pythonAiService = require('../services/pythonAi.service');
const { transitionSessionState } = require('../services/sessionStateMachine.service');
const sessionSchedulerService = require('../services/sessionScheduler.service');
const qrChallengeService = require('../services/qrChallenge.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getStudentForUser(userId) {
  const student = await Student.findOne({ user: userId });
  if (!student) throw new ApiError(404, 'Student profile not found');
  return student;
}

async function getFacultyForUser(userId) {
  const faculty = await Faculty.findOne({ user: userId });
  if (!faculty) throw new ApiError(404, 'Faculty profile not found');
  return faculty;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ATTENDANCE SESSION CONTROLLERS (Faculty & Admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/attendance/sessions
 * Create a new attendance session
 */
const createSession = asyncHandler(async (req, res) => {
  const {
    subjectId,
    date,
    period = 1,
    startTime = '09:00 AM',
    endTime = '10:00 AM',
    sessionType = 'regular',
    attendanceMethod = 'face',
    branch = 'CSE',
    semester = 4,
    section = 'A',
    academicYear = '2025-2026',
    status = 'scheduled'
  } = req.body;

  if (!subjectId || !date) {
    throw new ApiError(400, 'subjectId and date (YYYY-MM-DD) are required');
  }

  // Verify subject exists
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');

  // Verify faculty assignment if faculty
  if (req.user.role === 'faculty') {
    const faculty = await getFacultyForUser(req.user.userId);
    const isAssigned =
      (subject.faculty && (subject.faculty.toString() === req.user.userId || subject.faculty.toString() === faculty._id.toString())) ||
      faculty.assignedSubjects?.some(s => s.toString() === subjectId.toString());

    if (subject.faculty && !isAssigned) {
      throw new ApiError(403, 'You are not assigned to conduct attendance for this subject');
    }
  }

  // Multi-period array validation
  let sessionPeriods = [Number(period)];
  if (req.body.periods && Array.isArray(req.body.periods) && req.body.periods.length > 0) {
    sessionPeriods = [...new Set(req.body.periods.map(Number))].sort((a, b) => a - b);
    for (const p of sessionPeriods) {
      if (isNaN(p) || p < 1 || p > 10) {
        throw new ApiError(400, `Invalid period number ${p}. Periods must be integers between 1 and 10.`);
      }
    }
  }

  // Prevent conflicting active session for same subject, date, and any covered period
  const conflict = await AttendanceSession.findOne({
    subject: subjectId,
    date,
    $or: [
      { period: { $in: sessionPeriods } },
      { periods: { $in: sessionPeriods } }
    ],
    status: { $in: ['open', 'active', 'scheduled'] }
  });

  if (conflict) {
    throw new ApiError(409, `An active or scheduled session already exists covering Period(s) ${sessionPeriods.join(', ')} on ${date}`);
  }

  // Count total enrolled students in this branch/semester/section
  const totalStudents = await Student.countDocuments({
    branch: branch.toUpperCase(),
    semester: Number(semester)
  });

  const session = await AttendanceSession.create({
    subject: subjectId,
    faculty: req.user.userId,
    date,
    sessionDate: date,
    period: sessionPeriods[0],
    periods: sessionPeriods,
    periodCount: sessionPeriods.length,
    timetableEntry: req.body.timetableEntry || null,
    startTime,
    endTime,
    sessionType,
    attendanceMethod,
    branch: branch.toUpperCase(),
    semester: Number(semester),
    section: section.toUpperCase(),
    academicYear,
    status: status === 'active' ? 'open' : status,
    sessionStatus: status === 'active' ? 'open' : status,
    totalStudents: totalStudents || 0,
    presentCount: 0
  });

  // Record audit log
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'create_session',
    sessionId: session._id,
    newValue: { subject: subjectId, date, period, status: session.status },
    reason: 'Created new attendance session',
    ipAddress: req.ip
  });

  const populated = await AttendanceSession.findById(session._id)
    .populate('subject', 'name code')
    .populate('faculty', 'name');

  return res.status(201).json({
    success: true,
    data: populated,
    message: 'Attendance session created successfully'
  });
});

/**
 * GET /api/attendance/sessions/active
 * Return active sessions available to the authenticated student or faculty
 */
const getActiveSessions = asyncHandler(async (req, res) => {
  let query = {
    status: { $in: ['open', 'active'] }
  };

  if (req.user.role === 'student') {
    const student = await getStudentForUser(req.user.userId);
    query.semester = student.semester;
    query.branch = student.branch;

    const sessions = await AttendanceSession.find(query)
      .populate('subject', 'name code')
      .populate('faculty', 'name')
      .sort({ openedAt: -1 });

    // Enrich with student's marked status
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const record = await Attendance.findOne({
          session: s._id,
          student: student._id
        });
        return {
          ...s.toObject(),
          isAlreadyMarked: record ? ['present', 'late'].includes(record.status) : false,
          myRecord: record ? {
            status: record.status,
            verificationStatus: record.verificationStatus,
            markedAt: record.markedAt
          } : null
        };
      })
    );

    return res.status(200).json({ success: true, data: enriched });
  }

  if (req.user.role === 'faculty') {
    query.faculty = req.user.userId;
  }

  const sessions = await AttendanceSession.find(query)
    .populate('subject', 'name code')
    .populate('faculty', 'name')
    .sort({ openedAt: -1 });

  return res.status(200).json({ success: true, data: sessions });
});

/**
 * GET /api/attendance/sessions
 * Return sessions accessible to authenticated faculty/admin with filters and pagination
 */
const getSessions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    subjectId,
    date,
    semester,
    branch
  } = req.query;

  const filter = {};

  if (req.user.role === 'faculty') {
    filter.faculty = req.user.userId;
  }
  if (status && status !== 'all') {
    filter.$or = [{ status }, { sessionStatus: status }];
  }
  if (subjectId) filter.subject = subjectId;
  if (date) filter.date = date;
  if (semester) filter.semester = Number(semester);
  if (branch) filter.branch = branch.toUpperCase();

  const skip = (Number(page) - 1) * Number(limit);
  const total = await AttendanceSession.countDocuments(filter);
  const sessions = await AttendanceSession.find(filter)
    .populate('subject', 'name code')
    .populate('faculty', 'name email')
    .sort({ date: -1, period: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: sessions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1
    }
  });
});

/**
 * GET /api/attendance/sessions/:sessionId
 * Return authorized session details
 */
const getSessionById = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code')
    .populate('faculty', 'name email');

  if (!session) throw new ApiError(404, 'Attendance session not found');

  // Authorization check
  if (req.user.role === 'faculty' && session.faculty._id.toString() !== req.user.userId) {
    throw new ApiError(403, 'You are not authorized to view this session');
  }

  return res.status(200).json({ success: true, data: session });
});

/**
 * POST /api/attendance/sessions/:sessionId/start
 * Start an authorized session
 */
const startSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await transitionSessionState({
    sessionId,
    targetState: 'open',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason: 'Session opened for student verification',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance session is now live'
  });
});

/**
 * POST /api/attendance/sessions/:sessionId/pause
 * Pause an active session
 */
const pauseSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await transitionSessionState({
    sessionId,
    targetState: 'paused',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason: req.body.reason || 'Session paused by faculty',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance session has been paused'
  });
});

/**
 * POST /api/attendance/sessions/:sessionId/resume
 * Resume a paused session back to active
 */
const resumeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await transitionSessionState({
    sessionId,
    targetState: 'active',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason: 'Session resumed by faculty',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance session has been resumed'
  });
});

/**
 * POST /api/attendance/sessions/:sessionId/end
 * End / close an authorized session
 */
const endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await transitionSessionState({
    sessionId,
    targetState: 'completed',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason: 'Session ended by faculty',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance session has been closed'
  });
});

/**
 * POST /api/attendance/sessions/:sessionId/finalize
 * Finalize attendance session after validation and review
 */
const finalizeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AttendanceSession.findById(sessionId).populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Attendance session not found');

  if (req.user.role === 'faculty') {
    const facultyId = session.faculty?._id ? session.faculty._id.toString() : session.faculty.toString();
    if (facultyId !== req.user.userId) {
      throw new ApiError(403, 'You are not authorized to finalize this session');
    }
  }

  // Ensure all enrolled students who were not marked present have absent records
  const enrolledStudents = await Student.find({
    semester: session.semester,
    branch: session.branch
  });

  const sessionPeriods = session.periods && session.periods.length > 0 ? session.periods : [session.period];
  const sessionPeriodCount = session.periodCount || sessionPeriods.length;

  for (const st of enrolledStudents) {
    const existing = await Attendance.findOne({
      session: session._id,
      student: st._id
    });

    if (!existing) {
      try {
        await Attendance.create({
          session: session._id,
          subject: session.subject._id || session.subject,
          student: st._id,
          date: session.date,
          period: session.period,
          periods: sessionPeriods,
          periodCount: sessionPeriodCount,
          status: 'absent',
          attendanceStatus: 'absent',
          verificationMethod: 'system',
          verificationStatus: 'verified',
          markedAt: new Date()
        });
      } catch (dupErr) {
        // Concurrency safeguard: ignore duplicate key error if created simultaneously
      }
    }
  }

  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: { $in: ['present', 'late'] }
  });

  const updatedSession = await transitionSessionState({
    sessionId,
    targetState: 'finalized',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason: 'Finalized attendance roster and marked absentees',
    ipAddress: req.ip,
    extraFields: { presentCount }
  });

  return res.status(200).json({
    success: true,
    data: updatedSession,
    message: 'Attendance session finalized successfully'
  });
});

/**
 * POST /api/attendance/sessions/:sessionId/cancel
 * Cancel an authorized session
 */
const cancelSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { reason = 'Session cancelled by faculty' } = req.body;

  const session = await transitionSessionState({
    sessionId,
    targetState: 'cancelled',
    actorId: req.user.userId,
    actorRole: req.user.role,
    reason,
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: session,
    message: 'Attendance session has been cancelled'
  });
});

/**
 * GET /api/attendance/sessions/:sessionId/qr-challenge
 * Generate rotating short-lived challenge token for QR code display
 */
const getQrChallenge = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AttendanceSession.findById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');

  if (req.user.role === 'faculty') {
    const facultyId = session.faculty?._id ? session.faculty._id.toString() : session.faculty.toString();
    if (facultyId !== req.user.userId) {
      throw new ApiError(403, 'Unauthorized');
    }
  }

  const challenge = qrChallengeService.generateChallenge(session._id, 45);
  session.qrChallengeToken = challenge.token;
  session.qrChallengeExpiresAt = challenge.expiresAt;
  await session.save();

  return res.status(200).json({
    success: true,
    data: {
      sessionId: session._id,
      challengeToken: challenge.token,
      expiresAt: challenge.expiresAt.toISOString(),
      expiresInSeconds: challenge.expiresInSeconds
    }
  });
});
  if (!session) throw new ApiError(404, 'Session not found');

  if (req.user.role === 'faculty' && session.faculty.toString() !== req.user.userId) {
    throw new ApiError(403, 'Unauthorized');
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 45 * 1000); // 45 seconds validity

  session.qrChallengeToken = token;
  session.qrChallengeExpiresAt = expiresAt;
  await session.save();

  return res.status(200).json({
    success: true,
    data: {
      sessionId: session._id,
      challengeToken: token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 45
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STUDENT ATTENDANCE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/student/overview
 * Return student overview computed by Python AI analytics engine
 */
const getStudentOverview = asyncHandler(async (req, res) => {
  const student = await getStudentForUser(req.user.userId);

  // Fetch subjects for student's semester & branch
  const subjects = await Subject.find({
    semester: student.semester
  }).populate('faculty', 'name');

  // Fetch all sessions for student's branch & semester
  const sessions = await AttendanceSession.find({
    branch: student.branch,
    semester: student.semester
  }).populate('subject', 'name code');

  // Fetch attendance records for this student
  const records = await Attendance.find({
    student: student._id
  }).populate('subject', 'name code');

  const subjectsCatalog = subjects.map(s => ({
    _id: s._id.toString(),
    name: s.name,
    code: s.code,
    credits: s.credits
  }));

  // Invoke Python AI calculation engine
  const calculation = await pythonAiService.calculateStudentOverview(
    student._id,
    sessions,
    records,
    subjectsCatalog,
    false
  );

  // Active sessions student can join
  const activeSessions = await AttendanceSession.find({
    branch: student.branch,
    semester: student.semester,
    status: { $in: ['open', 'active'] }
  }).populate('subject', 'name code').populate('faculty', 'name');

  const activeWithStatus = await Promise.all(
    activeSessions.map(async (sess) => {
      const existing = await Attendance.findOne({
        session: sess._id,
        student: student._id
      });
      return {
        _id: sess._id,
        subject: sess.subject?.name || 'Class',
        code: sess.subject?.code || '',
        faculty: sess.faculty?.name || 'Faculty',
        period: sess.period,
        date: sess.date,
        startTime: sess.startTime,
        endTime: sess.endTime,
        attendanceMethod: sess.attendanceMethod,
        isJoined: existing ? ['present', 'late'].includes(existing.status) : false,
        status: sess.status
      };
    })
  );

  return res.status(200).json({
    success: true,
    data: calculation.subjectWise,
    summary: {
      overall: calculation.overallPercentage,
      totalClasses: calculation.totalClasses,
      totalAttended: calculation.classesAttended,
      totalMissed: calculation.classesMissed,
      minThreshold: calculation.minimumThreshold,
      status: calculation.status,
      hasRecords: calculation.hasData,
      activeSessions: activeWithStatus,
      recentHistory: records.slice(0, 5).map(r => ({
        _id: r._id,
        subject: r.subject?.name,
        code: r.subject?.code,
        date: r.date,
        period: r.period,
        status: r.status,
        method: r.verificationMethod
      }))
    },
    message: 'Student attendance overview loaded'
  });
});

/**
 * GET /api/attendance/student/history
 */
const getStudentHistory = asyncHandler(async (req, res) => {
  const student = await getStudentForUser(req.user.userId);
  const { subjectId, status, startDate, endDate, page = 1, limit = 15 } = req.query;

  const filter = { student: student._id };
  if (subjectId) filter.subject = subjectId;
  if (status && status !== 'all') filter.status = status;
  if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.date = { $gte: startDate };
  } else if (endDate) {
    filter.date = { $lte: endDate };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Attendance.countDocuments(filter);
  const records = await Attendance.find(filter)
    .populate('subject', 'name code')
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: {
      records: records.map(r => ({
        _id: r._id,
        attendanceId: r._id,
        subjectName: r.subject?.name || 'Class',
        subjectCode: r.subject?.code || '',
        date: r.date,
        period: r.period,
        status: r.status,
        verificationMethod: r.verificationMethod || 'face',
        confidence: r.confidence,
        isManualOverride: r.isManualOverride,
        timestamp: r.verifiedAt || r.createdAt
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    }
  });
});

/**
 * POST /api/attendance/student/:sessionId/join
 * Validate student enrollment and eligibility to join an active session
 */
const joinSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const student = await getStudentForUser(req.user.userId);

  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Attendance session not found');

  if (session.status === 'paused') {
    throw new ApiError(400, 'This session is currently paused. Please wait for the faculty to resume.');
  }

  if (!['open', 'active'].includes(session.status)) {
    throw new ApiError(400, 'This session is not currently active');
  }

  // Enrollment eligibility checks
  const isSameBranch = !session.branch || !student.branch ||
    session.branch.toLowerCase().trim() === student.branch.toLowerCase().trim() ||
    (session.branch.toUpperCase().includes('CSE') && student.branch.toUpperCase().includes('CSE')) ||
    (session.branch.toUpperCase().includes('COMPUTER') && student.branch.toUpperCase().includes('COMPUTER'));

  if (session.semester !== student.semester || !isSameBranch) {
    throw new ApiError(403, 'You are not enrolled in this session class/section');
  }

  // Check if student already marked
  const existing = await Attendance.findOne({
    session: session._id,
    student: student._id
  });

  return res.status(200).json({
    success: true,
    data: {
      sessionId: session._id,
      subject: session.subject?.name,
      code: session.subject?.code,
      date: session.date,
      period: session.period,
      periods: session.periods || [session.period],
      attendanceMethod: session.attendanceMethod,
      isAlreadyMarked: existing ? ['present', 'late'].includes(existing.status) : false,
      verificationRequired: true
    },
    message: 'Session eligibility verified. Ready for verification.'
  });
});

/**
 * POST /api/attendance/student/:sessionId/attendance
 * Create verified attendance record after verification workflow
 */
const recordStudentAttendance = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const {
    verificationMethod = 'face',
    confidence = 0.94,
    qrChallengeToken,
    liveImageData
  } = req.body;

  const student = await getStudentForUser(req.user.userId);

  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Attendance session not found');

  if (session.status === 'paused') {
    throw new ApiError(400, 'This session is currently paused. Please wait for the faculty to resume.');
  }

  if (!['open', 'active'].includes(session.status)) {
    throw new ApiError(400, 'This session is no longer active');
  }

  // Check deadline
  const deadline = sessionSchedulerService.calculateSessionDeadline(session);
  if (new Date() > deadline) {
    throw new ApiError(400, 'This attendance session has expired and is no longer accepting check-ins.');
  }

  // QR token validation if attendance method requires QR or token is supplied
  if ((session.attendanceMethod === 'qr_face' || qrChallengeToken) && session.attendanceMethod !== 'manual') {
    qrChallengeService.validateChallenge(session, qrChallengeToken, new Date());
  }

  // Biometric verification via Python AI service if liveImageData is provided
  let verificationStatus = 'verified';
  let verifiedConfidence = confidence;
  const targetStatus = verificationMethod === 'manual' ? 'pending' : 'present';
  const targetVerificationStatus = verificationMethod === 'manual' ? 'pending_review' : verificationStatus;

  if (verificationMethod === 'face') {
    const faceProfile = await FaceEmbedding.findOne({ student: student._id }).select('+encryptedData');
    if (!faceProfile || !faceProfile.isActive || !faceProfile.consentGiven || !faceProfile.encryptedData) {
      throw new ApiError(403, 'Active biometric enrollment and consent required. Please enroll your face first or request manual verification.');
    }

    if (liveImageData) {
      let bioResult;
      try {
        bioResult = await pythonAiService.verifyBiometricTemplate(faceProfile.encryptedData, liveImageData);
      } catch (pyErr) {
        throw new ApiError(503, `Biometric verification service error: ${pyErr.message}`);
      }

      if (!bioResult || !bioResult.success || !bioResult.isMatch) {
        const failureReason = bioResult?.message || 'Face does not match enrolled biometric template';
        throw new ApiError(400, `Biometric verification failed: ${failureReason}`);
      }
      verifiedConfidence = bioResult.confidence || 0.95;
      verificationStatus = bioResult.verificationStatus || 'verified';
    } else if (process.env.NODE_ENV === 'production') {
      throw new ApiError(400, 'Live camera image capture is required for face biometric verification');
    }
  }

  // Check for duplicate attendance record safely
  let attendance = await Attendance.findOne({
    session: session._id,
    student: student._id
  });

  if (attendance && ['present', 'late'].includes(attendance.status)) {
    return res.status(200).json({
      success: true,
      data: {
        attendanceId: attendance._id,
        studentName: student.name || req.user.name,
        rollNumber: student.rollNumber,
        subject: session.subject?.name,
        code: session.subject?.code,
        status: attendance.status,
        alreadyMarked: true
      },
      message: 'Attendance was already marked for this session'
    });
  }

  const sessionPeriods = session.periods && session.periods.length > 0 ? session.periods : [session.period];
  const sessionPeriodCount = session.periodCount || sessionPeriods.length;

  try {
    if (attendance) {
      attendance.status = targetStatus;
      attendance.attendanceStatus = targetStatus;
      attendance.verificationMethod = verificationMethod;
      attendance.verificationStatus = targetVerificationStatus;
      attendance.confidence = verificationMethod === 'manual' ? null : verifiedConfidence;
      attendance.periods = sessionPeriods;
      attendance.periodCount = sessionPeriodCount;
      attendance.markedAt = new Date();
      attendance.verifiedAt = new Date();
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        session: session._id,
        subject: session.subject._id || session.subject,
        student: student._id,
        date: session.date,
        period: session.period,
        periods: sessionPeriods,
        periodCount: sessionPeriodCount,
        status: targetStatus,
        attendanceStatus: targetStatus,
        verificationMethod,
        verificationStatus: targetVerificationStatus,
        confidence: verificationMethod === 'manual' ? null : verifiedConfidence,
        markedAt: new Date(),
        verifiedAt: new Date()
      });
    }
  } catch (dbErr) {
    if (dbErr.code === 11000) {
      const existing = await Attendance.findOne({ session: session._id, student: student._id });
      return res.status(200).json({
        success: true,
        data: {
          attendanceId: existing?._id,
          studentName: student.name || req.user.name,
          rollNumber: student.rollNumber,
          subject: session.subject?.name,
          code: session.subject?.code,
          status: existing?.status || 'present',
          alreadyMarked: true
        },
        message: 'Attendance was already marked for this session'
      });
    }
    throw dbErr;
  }

  // Increment session present count
  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: { $in: ['present', 'late'] }
  });
  await AttendanceSession.findByIdAndUpdate(session._id, { presentCount });

  // Audit log entry
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'mark_attendance',
    attendanceId: attendance._id,
    sessionId: session._id,
    affectedStudentId: student._id,
    newValue: { status: 'present', method: verificationMethod, confidence: verifiedConfidence },
    reason: 'Student self-check-in verification',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: {
      attendanceId: attendance._id,
      studentName: student.name || req.user.name,
      rollNumber: student.rollNumber,
      subject: session.subject?.name,
      code: session.subject?.code,
      status: attendance.status,
      verificationStatus,
      confidence: verifiedConfidence
    },
    message: verificationMethod === 'manual'
      ? 'Non-biometric verification request submitted. Awaiting faculty confirmation.'
      : 'Attendance verified and marked successfully! 🎓'
  });
});

/**
 * GET /api/attendance/student/:attendanceId
 * Return student's single authorized record
 */
const getStudentAttendanceRecord = asyncHandler(async (req, res) => {
  const { attendanceId } = req.params;
  const student = await getStudentForUser(req.user.userId);

  const record = await Attendance.findById(attendanceId)
    .populate('subject', 'name code')
    .populate('session', 'date period startTime endTime');

  if (!record) throw new ApiError(404, 'Attendance record not found');

  // Strict ownership check
  if (record.student.toString() !== student._id.toString()) {
    throw new ApiError(403, 'Unauthorized: You can only access your own attendance records');
  }

  return res.status(200).json({ success: true, data: record });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FACULTY ATTENDANCE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/faculty/overview
 */
const getFacultyOverview = asyncHandler(async (req, res) => {
  const faculty = await getFacultyForUser(req.user.userId);
  const today = new Date().toISOString().split('T')[0];

  const sessionsToday = await AttendanceSession.find({
    faculty: req.user.userId,
    date: today
  }).populate('subject', 'name code');

  const totalSessions = await AttendanceSession.countDocuments({
    faculty: req.user.userId,
    status: { $in: ['completed', 'finalized'] }
  });

  const subjects = await Subject.find({
    $or: [{ faculty: req.user.userId }, { faculty: faculty._id }, { _id: { $in: faculty.assignedSubjects || [] } }]
  });

  // Calculate overall average attendance across faculty sessions
  const pastSessions = await AttendanceSession.find({
    faculty: req.user.userId,
    status: { $in: ['completed', 'finalized'] }
  });

  let avgAttendance = 0;
  if (pastSessions.length > 0) {
    const totalPcts = pastSessions.reduce((acc, s) => {
      const pct = s.totalStudents > 0 ? (s.presentCount / s.totalStudents) * 100 : 0;
      return acc + pct;
    }, 0);
    avgAttendance = Math.round(totalPcts / pastSessions.length);
  }

  return res.status(200).json({
    success: true,
    data: {
      assignedSubjectsCount: subjects.length,
      classesToday: sessionsToday.length,
      sessionsConducted: totalSessions,
      averageAttendance: avgAttendance,
      sessionsToday
    }
  });
});

/**
 * GET /api/attendance/faculty/classes
 */
const getFacultyClasses = asyncHandler(async (req, res) => {
  const faculty = await getFacultyForUser(req.user.userId);
  const subjects = await Subject.find({
    $or: [{ faculty: req.user.userId }, { faculty: faculty._id }, { _id: { $in: faculty.assignedSubjects || [] } }]
  });

  const semesters = [...new Set(subjects.map(s => s.semester))];
  const classes = semesters.map(sem => ({
    semester: sem,
    branch: 'CSE',
    section: 'A',
    displayName: `B.Tech CSE - Semester ${sem}`
  }));

  return res.status(200).json({ success: true, data: classes });
});

/**
 * GET /api/attendance/faculty/subjects
 */
const getFacultySubjects = asyncHandler(async (req, res) => {
  const faculty = await getFacultyForUser(req.user.userId);
  const subjects = await Subject.find({
    $or: [{ faculty: req.user.userId }, { faculty: faculty._id }, { _id: { $in: faculty.assignedSubjects || [] } }]
  });

  return res.status(200).json({ success: true, data: subjects });
});

/**
 * GET /api/attendance/faculty/records
 */
const getFacultyRecords = asyncHandler(async (req, res) => {
  const { subjectId, date, status, page = 1, limit = 20 } = req.query;
  const faculty = await getFacultyForUser(req.user.userId);

  const subjects = await Subject.find({
    $or: [{ faculty: req.user.userId }, { faculty: faculty._id }, { _id: { $in: faculty.assignedSubjects || [] } }]
  });
  const subjectIds = subjects.map(s => s._id);

  const filter = { subject: { $in: subjectIds } };
  if (subjectId) filter.subject = subjectId;
  if (date) filter.date = date;
  if (status && status !== 'all') filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Attendance.countDocuments(filter);
  const records = await Attendance.find(filter)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('session', 'date period')
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: records,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1
    }
  });
});

/**
 * GET /api/attendance/faculty/sessions/:sessionId/students
 */
const getSessionStudents = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Session not found');

  // Get all students enrolled in this branch & semester
  const students = await Student.find({
    semester: session.semester,
    branch: session.branch
  }).populate('user', 'name email').sort({ rollNumber: 1 });

  // Get attendance records for this session
  const records = await Attendance.find({ session: session._id });
  const recordMap = new Map();
  records.forEach(r => recordMap.set(r.student.toString(), r));

  const studentList = students.map(st => {
    const rec = recordMap.get(st._id.toString());
    return {
      _id: st._id,
      name: st.name || st.user?.name || 'Student',
      rollNumber: st.rollNumber,
      avatar: st.avatar || null,
      status: rec ? rec.status : 'absent',
      attendanceStatus: rec ? rec.attendanceStatus || rec.status : 'absent',
      verificationMethod: rec ? rec.verificationMethod : null,
      verificationStatus: rec ? rec.verificationStatus : null,
      confidence: rec ? rec.confidence : null,
      isManualOverride: rec ? rec.isManualOverride : false,
      markedAt: rec ? rec.markedAt : null,
      attendanceRecordId: rec ? rec._id : null
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      session,
      students: studentList,
      totalStudents: studentList.length,
      presentCount: studentList.filter(s => ['present', 'late'].includes(s.status)).length
    }
  });
});

/**
 * PATCH /api/attendance/faculty/records/:attendanceId
 * Controlled manual correction with mandatory reason and append-only audit log
 */
const correctAttendanceRecord = asyncHandler(async (req, res) => {
  const { attendanceId } = req.params;
  const { status, reason } = req.body;

  if (!status || !reason || !reason.trim()) {
    throw new ApiError(400, 'New status and a valid correction reason are required');
  }

  const validStatuses = ['present', 'absent', 'late', 'excused'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const record = await Attendance.findById(attendanceId).populate('session');
  if (!record) throw new ApiError(404, 'Attendance record not found');

  // Permission verification
  if (req.user.role === 'faculty') {
    if (record.session && record.session.faculty && record.session.faculty.toString() !== req.user.userId) {
      throw new ApiError(403, 'Unauthorized: You can only correct attendance for your own sessions');
    }
  }

  const previousStatus = record.status;
  record.status = status;
  record.attendanceStatus = status;
  record.isManualOverride = true;
  record.verificationMethod = 'manual';
  record.verificationStatus = 'manual';
  record.correctedAt = new Date();
  record.correctedBy = req.user.userId;
  record.correctionReason = reason.trim();
  record.overrideBy = req.user.userId;
  record.overrideNote = reason.trim();
  await record.save();

  // Create append-only audit log
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'manual_correction',
    attendanceId: record._id,
    sessionId: record.session?._id || null,
    affectedStudentId: record.student,
    previousValue: { status: previousStatus },
    newValue: { status },
    reason: reason.trim(),
    ipAddress: req.ip
  });

  // Update session present count if attached to session
  if (record.session) {
    const presentCount = await Attendance.countDocuments({
      session: record.session._id,
      status: { $in: ['present', 'late'] }
    });
    await AttendanceSession.findByIdAndUpdate(record.session._id, { presentCount });
  }

  return res.status(200).json({
    success: true,
    data: record,
    message: 'Attendance record updated and audit log recorded'
  });
});

/**
 * GET /api/attendance/faculty/reports
 * Return authorized class-wise and subject-wise reports via Python engine
 */
const getFacultyReports = asyncHandler(async (req, res) => {
  const { semester = 4, branch = 'CSE' } = req.query;
  const faculty = await getFacultyForUser(req.user.userId);

  const sessions = await AttendanceSession.find({
    faculty: req.user.userId,
    semester: Number(semester),
    branch: branch.toUpperCase(),
    status: { $in: ['completed', 'finalized'] }
  });

  const sessionIds = sessions.map(s => s._id);
  const records = await Attendance.find({ session: { $in: sessionIds } });
  const students = await Student.find({
    semester: Number(semester),
    branch: branch.toUpperCase()
  }).populate('user', 'name email');

  const report = await pythonAiService.calculateFacultyReport(sessions, records, students);

  return res.status(200).json({
    success: true,
    data: report,
    message: 'Faculty attendance report generated'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ADMIN ATTENDANCE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/admin/overview
 */
const getAdminOverview = asyncHandler(async (req, res) => {
  const totalSessions = await AttendanceSession.countDocuments();
  const totalRecords = await Attendance.countDocuments();
  const enrolledFaces = await FaceEmbedding.countDocuments({
    status: { $in: ['active', 'enrolled'] }
  });
  const totalStudents = await Student.countDocuments();

  const recentSessions = await AttendanceSession.find()
    .populate('subject', 'name code')
    .populate('faculty', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  return res.status(200).json({
    success: true,
    data: {
      totalSessions,
      totalRecords,
      enrolledFaces,
      totalStudents,
      biometricEnrollmentRate: totalStudents > 0 ? Math.round((enrolledFaces / totalStudents) * 100) : 0,
      recentSessions
    }
  });
});

/**
 * GET /api/attendance/admin/audit-logs
 */
const getAdminAuditLogs = asyncHandler(async (req, res) => {
  const { action, actorRole, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (actorRole) filter.actorRole = actorRole;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await AttendanceAuditLog.countDocuments(filter);
  const logs = await AttendanceAuditLog.find(filter)
    .populate('actorId', 'name email role')
    .populate('affectedStudentId', 'name rollNumber')
    .populate('sessionId', 'date period')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1
    }
  });
});

/**
 * GET /api/attendance/admin/face-profiles
 * Secure endpoint: returns metadata ONLY (embeddings strictly excluded)
 */
const getAdminFaceProfiles = asyncHandler(async (req, res) => {
  const profiles = await FaceEmbedding.find()
    .populate('student', 'name rollNumber branch semester')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: profiles
  });
});

/**
 * DELETE /api/attendance/admin/face-profiles/:studentId
 */
const deleteAdminFaceProfile = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const profile = await FaceEmbedding.findOne({ student: studentId });
  if (!profile) throw new ApiError(404, 'Biometric profile not found');

  await FaceEmbedding.deleteOne({ student: studentId });

  // Update consent record
  await ConsentRecord.findOneAndUpdate(
    { student: studentId },
    { consentStatus: 'revoked', withdrawalTimestamp: new Date() }
  );

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'delete_biometric',
    affectedStudentId: studentId,
    reason: 'Admin deleted biometric profile upon student request',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    message: 'Biometric profile and templates deleted permanently'
  });
});

/**
 * GET /api/attendance/admin/settings & PUT /api/attendance/admin/settings
 */
const getAdminSettings = asyncHandler(async (req, res) => {
  let settings = await AttendanceSettings.findOne();
  if (!settings) {
    settings = await AttendanceSettings.create({
      minAttendancePercent: 75,
      allowManualOverride: true,
      lateGracePeriodMinutes: 10,
      biometricVerificationRequired: true
    });
  }
  return res.status(200).json({ success: true, data: settings });
});

const updateAdminSettings = asyncHandler(async (req, res) => {
  let settings = await AttendanceSettings.findOne();
  const prev = settings ? settings.toObject() : null;

  if (!settings) {
    settings = new AttendanceSettings(req.body);
  } else {
    Object.assign(settings, req.body);
  }
  await settings.save();

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'settings_update',
    previousValue: prev,
    newValue: settings.toObject(),
    reason: 'Updated institutional attendance policy settings',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: settings,
    message: 'Attendance settings updated successfully'
  });
});

module.exports = {
  createSession,
  getActiveSessions,
  getSessions,
  getSessionById,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  finalizeSession,
  cancelSession,
  getQrChallenge,
  getStudentOverview,
  getStudentHistory,
  joinSession,
  recordStudentAttendance,
  getStudentAttendanceRecord,
  getFacultyOverview,
  getFacultyClasses,
  getFacultySubjects,
  getFacultyRecords,
  getSessionStudents,
  correctAttendanceRecord,
  getFacultyReports,
  getAdminOverview,
  getAdminAuditLogs,
  getAdminFaceProfiles,
  deleteAdminFaceProfile,
  getAdminSettings,
  updateAdminSettings
};
