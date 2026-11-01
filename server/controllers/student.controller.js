/**
 * server/controllers/student.controller.js
 */
'use strict';

const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');
const Fee = require('../models/Fee');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const FaceEmbedding = require('../models/FaceEmbedding');
const ConsentRecord = require('../models/ConsentRecord');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const AttendanceSettings = require('../models/AttendanceSettings');
const pythonAiService = require('../services/pythonAi.service');
const qrChallengeService = require('../services/qrChallenge.service');
const attendanceCalculationService = require('../services/attendanceCalculation.service');
const notificationService = require('../services/notification.service');
const examController = require('./exam.controller');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/student/profile
const getProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId })
    .populate('user', 'name email loginId');
  if (!student) throw new ApiError(404, 'Student profile not found');

  return res.status(200).json({ success: true, data: student, message: 'OK' });
});

// GET /api/student/announcements
const getAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({ audience: { $in: ['all', 'student'] } })
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: announcements, message: 'OK' });
});

// POST /api/student/complaints
const raiseComplaint = asyncHandler(async (req, res) => {
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

// GET /api/student/complaints
const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ raisedBy: req.user.userId }).sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: complaints, message: 'OK' });
});

// GET /api/student/fees
const getFees = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student not found');

  const fees = await Fee.find({ student: student._id }).sort({ dueDate: 1 });
  return res.status(200).json({ success: true, data: fees, message: 'OK' });
});

// GET /api/student/attendance
const getAttendance = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  // Authoritative academic attendance calculation
  const calculation = await attendanceCalculationService.calculateStudentOverview({
    studentId: student._id,
    semester: student.semester,
    branch: student.branch,
  });

  // Active / Upcoming sessions that student can join
  const activeSessions = await AttendanceSession.find({
    semester: student.semester,
    status: { $in: ['open', 'active'] },
  }).populate('subject', 'name code').populate('faculty', 'name');

  // Check if student has already been marked in these active sessions
  const activeWithStatus = await Promise.all(
    activeSessions.map(async (sess) => {
      const existing = await Attendance.findOne({
        session: sess._id,
        student: student._id,
      });
      return {
        _id: sess._id,
        subject: sess.subject?.name || 'Class',
        code: sess.subject?.code || '',
        faculty: sess.faculty?.name || 'Professor',
        period: sess.period,
        date: sess.date,
        startTime: sess.startTime,
        endTime: sess.endTime,
        sessionType: sess.sessionType,
        attendanceMethod: sess.attendanceMethod,
        isJoined: existing ? existing.status === 'present' : false,
        status: sess.status,
      };
    })
  );

  // Recent attendance history
  const recentRecords = await Attendance.find({ student: student._id })
    .populate('subject', 'name code')
    .sort({ date: -1, createdAt: -1 })
    .limit(5);

  return res.status(200).json({
    success: true,
    data: calculation.data,
    summary: {
      ...calculation.summary,
      activeSessions: activeWithStatus,
      recentHistory: recentRecords.map(r => ({
        _id: r._id,
        subject: r.subject?.name,
        code: r.subject?.code,
        date: r.date,
        period: r.period,
        status: r.status,
        method: r.verificationMethod,
      })),
    },
    message: 'Attendance data loaded',
  });
});

// GET /api/student/attendance/history
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

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
        subjectName: r.subject?.name || 'Class',
        subjectCode: r.subject?.code || '',
        date: r.date,
        period: r.period,
        status: r.status,
        verificationMethod: r.verificationMethod || 'face',
        confidence: r.confidence,
        isManualOverride: r.isManualOverride,
        timestamp: r.verifiedAt || r.createdAt,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
    message: 'Attendance history loaded',
  });
});

// GET /api/student/attendance/sessions
const getActiveSessions = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const sessions = await AttendanceSession.find({
    semester: student.semester,
    status: 'open',
  })
    .populate('subject', 'name code')
    .populate('faculty', 'name');

  const enriched = await Promise.all(
    sessions.map(async (sess) => {
      const record = await Attendance.findOne({
        session: sess._id,
        student: student._id,
      });
      return {
        _id: sess._id,
        subject: sess.subject?.name,
        code: sess.subject?.code,
        faculty: sess.faculty?.name || 'Faculty',
        date: sess.date,
        period: sess.period,
        startTime: sess.startTime,
        endTime: sess.endTime,
        sessionType: sess.sessionType,
        attendanceMethod: sess.attendanceMethod,
        isAlreadyMarked: record ? record.status === 'present' : false,
        status: sess.status,
      };
    })
  );

  return res.status(200).json({ success: true, data: enriched, message: 'Active sessions retrieved' });
});

// POST /api/student/attendance/join/:sessionId
const joinAttendanceSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const {
    verificationMethod = 'face',
    confidence = 0.94,
    liveImageData,
    qrChallengeToken
  } = req.body;

  const student = await Student.findOne({ user: req.user.userId }).populate('user', 'name');
  if (!student) throw new ApiError(404, 'Student profile not found');

  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Attendance session not found');

  if (!['open', 'active'].includes(session.status)) {
    throw new ApiError(400, 'This session is no longer active or has been closed');
  }

  // Branch & semester eligibility check
  const isSameBranch = !session.branch || !student.branch ||
    session.branch.toLowerCase().trim() === student.branch.toLowerCase().trim() ||
    (session.branch.toUpperCase().includes('CSE') && student.branch.toUpperCase().includes('CSE')) ||
    (session.branch.toUpperCase().includes('COMPUTER') && student.branch.toUpperCase().includes('COMPUTER'));

  if (session.semester !== student.semester || !isSameBranch) {
    throw new ApiError(403, 'You are not enrolled in this session class/section');
  }

  // QR challenge token validation if required
  if (session.attendanceMethod === 'qr_face' || (session.qrChallengeToken && qrChallengeToken)) {
    if (!qrChallengeToken) {
      throw new ApiError(400, 'QR challenge token is required for this session');
    }
    qrChallengeService.validateChallenge(session, qrChallengeToken);
  }

  // Biometric verification via Python AI Service if face verification is used
  let verifiedConfidence = confidence;
  let verificationStatus = 'verified';
  const targetStatus = verificationMethod === 'manual' ? 'pending' : 'present';
  const targetVerificationStatus = verificationMethod === 'manual' ? 'pending_review' : verificationStatus;

  if (verificationMethod === 'face') {
    const faceProfile = await FaceEmbedding.findOne({ student: student._id }).select('+encryptedData');
    if (
      !faceProfile ||
      !faceProfile.isActive ||
      faceProfile.status !== 'enrolled' ||
      faceProfile.enrollmentStatus !== 'enrolled' ||
      !faceProfile.consentGiven ||
      !faceProfile.encryptedData
    ) {
      throw new ApiError(403, 'Active biometric consent and enrollment required. Please enroll your face first or request manual verification.');
    }

    const activeConsent = await ConsentRecord.findOne({ student: student._id, consentStatus: 'active' });
    if (!activeConsent) {
      throw new ApiError(403, 'Biometric consent has been withdrawn. Biometric verification is unavailable.');
    }

    if (liveImageData) {
      const bioResult = await pythonAiService.verifyBiometricTemplate(faceProfile.encryptedData, liveImageData);
      if (!bioResult || !bioResult.success || !bioResult.isMatch) {
        throw new ApiError(400, `Biometric verification failed: ${bioResult?.message || 'Face does not match enrolled biometric template'}`);
      }
      verifiedConfidence = bioResult.confidence || 0.95;
      verificationStatus = bioResult.verificationStatus || 'verified';
    } else if (process.env.NODE_ENV === 'production') {
      throw new ApiError(400, 'Live camera image capture is required for face biometric verification');
    }
  }

  // Check if attendance already marked for this session
  let attendance = await Attendance.findOne({
    session: session._id,
    student: student._id,
  });

  if (attendance && ['present', 'late'].includes(attendance.status)) {
    return res.status(200).json({
      success: true,
      data: {
        attendanceId: attendance._id,
        studentName: student.fullName || student.user?.name,
        rollNumber: student.rollNumber,
        subject: session.subject?.name,
        code: session.subject?.code,
        date: session.date,
        time: new Date().toLocaleTimeString(),
        status: attendance.status,
        verificationMethod: attendance.verificationMethod,
        alreadyMarked: true,
      },
      message: 'Attendance was already marked present for this session',
    });
  }

  if (attendance) {
    attendance.status = targetStatus;
    attendance.attendanceStatus = targetStatus;
    attendance.verificationMethod = verificationMethod;
    attendance.verificationStatus = targetVerificationStatus;
    attendance.confidence = verificationMethod === 'manual' ? null : verifiedConfidence;
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
      status: targetStatus,
      attendanceStatus: targetStatus,
      verificationMethod,
      verificationStatus: targetVerificationStatus,
      confidence: verificationMethod === 'manual' ? null : verifiedConfidence,
      markedAt: new Date(),
      verifiedAt: new Date(),
    });
  }

  // Update session present count
  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: { $in: ['present', 'late'] },
  });
  session.presentCount = presentCount;
  await session.save();

  // Audit log entry
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'student',
    action: 'mark_attendance',
    attendanceId: attendance._id,
    sessionId: session._id,
    affectedStudentId: student._id,
    newValue: { status: 'present', method: verificationMethod, confidence: verifiedConfidence },
    reason: 'Student verified attendance check-in',
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: {
      attendanceId: attendance._id,
      studentName: student.fullName || student.user?.name,
      rollNumber: student.rollNumber,
      subject: session.subject?.name,
      code: session.subject?.code,
      date: session.date,
      time: new Date().toLocaleTimeString(),
      status: attendance.status,
      verificationStatus: attendance.verificationStatus,
      verificationMethod: attendance.verificationMethod,
      confidence: attendance.confidence,
    },
    message: verificationMethod === 'manual'
      ? 'Non-biometric verification request submitted. Awaiting faculty confirmation in live roster.'
      : 'Attendance verified and marked successfully! 🎓',
  });
});

// GET /api/student/face/status
const getFaceStatus = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  let face = await FaceEmbedding.findOne({ student: student._id });
  if (!face) {
    return res.status(200).json({
      success: true,
      data: {
        isEnrolled: false,
        status: 'not_enrolled',
        consentGiven: false,
        lastEnrolled: null,
      },
      message: 'No face biometric enrolled',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      isEnrolled: face.status === 'enrolled' && face.isActive,
      status: face.status,
      consentGiven: face.consentGiven,
      consentDate: face.consentDate,
      lastEnrolled: face.enrolledAt,
      samplesCaptured: face.samplesCaptured,
      imageQualityScore: face.imageQualityScore,
    },
    message: 'Face enrollment status retrieved',
  });
});

// POST /api/student/face/consent
const grantConsent = asyncHandler(async (req, res) => {
  const { consentGiven, policyReference = 'CAMPUS-BIO-PRIVACY-v1.0' } = req.body;
  if (!consentGiven) {
    throw new ApiError(400, 'Consent flag must be explicitly true');
  }
  if (policyReference !== 'CAMPUS-BIO-PRIVACY-v1.0') {
    throw new ApiError(400, 'Invalid biometric policy reference. Accepted policy: CAMPUS-BIO-PRIVACY-v1.0');
  }

  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const activeExisting = await ConsentRecord.findOne({ student: student._id, consentStatus: 'active' });
  let consent;
  if (activeExisting) {
    consent = activeExisting;
  } else {
    consent = await ConsentRecord.create({
      student: student._id,
      consentStatus: 'active',
      consentTimestamp: new Date(),
      policyReference,
      ipAddress: req.ip || '',
    });
  }

  let face = await FaceEmbedding.findOne({ student: student._id });
  if (face) {
    face.consentGiven = true;
    face.consentStatus = 'active';
    face.consentDate = new Date();
    if (face.status === 'not_enrolled' || face.status === 'revoked' || face.status === 'consent_withdrawn') {
      face.status = 'consent_granted';
      face.enrollmentStatus = 'consent_granted';
    }
    await face.save();
  }

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'student',
    action: 'consent_granted',
    affectedStudentId: student._id,
    reason: `Student granted informed biometric consent under policy ${policyReference}`,
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: {
      consentStatus: 'active',
      consentDate: consent.consentTimestamp,
      policyReference
    },
    message: 'Biometric consent recorded successfully.'
  });
});

// POST /api/student/face/re-enroll
const requestReEnrollment = asyncHandler(async (req, res) => {
  const { reason = 'Student requested face template re-enrollment' } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    throw new ApiError(400, 'A valid reason is required to request biometric re-enrollment');
  }

  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  let face = await FaceEmbedding.findOne({ student: student._id });
  if (!face || (face.status !== 'enrolled' && face.enrollmentStatus !== 'enrolled')) {
    throw new ApiError(400, 'No active biometric enrollment found to re-enroll');
  }

  face.status = 're_enrollment_required';
  face.enrollmentStatus = 're_enrollment_required';
  face.isActive = false;
  await face.save();

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'student',
    action: 're_enrollment_requested',
    affectedStudentId: student._id,
    reason: `Student requested re-enrollment: ${reason}`,
    ipAddress: req.ip
  });

  return res.status(200).json({
    success: true,
    data: { status: 're_enrollment_required' },
    message: 'Re-enrollment authorized. You may now capture a new face biometric.'
  });
});

// POST /api/student/face/enroll
const enrollFace = asyncHandler(async (req, res) => {
  const {
    consentGiven,
    isReEnrollment = false,
    policyReference = 'CAMPUS-BIO-PRIVACY-v1.0',
    samplesCount = 3,
    qualityScore = 92,
    imageData,
    imageSamples
  } = req.body;

  if (policyReference && policyReference !== 'CAMPUS-BIO-PRIVACY-v1.0') {
    throw new ApiError(400, 'Invalid biometric policy reference. Accepted policy: CAMPUS-BIO-PRIVACY-v1.0');
  }

  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  // Verify explicit active consent in ConsentRecord
  const activeConsent = await ConsentRecord.findOne({ student: student._id, consentStatus: 'active' });
  if (!activeConsent) {
    throw new ApiError(403, 'Explicit active biometric consent is required before face enrollment. Please accept the consent agreement.');
  }

  let face = await FaceEmbedding.findOne({ student: student._id });

  // A client-provided boolean must never grant authorization.
  // Validate existing enrollment and require backend re-enrollment authorization state.
  if (face && face.isActive && (face.status === 'enrolled' || face.enrollmentStatus === 'enrolled')) {
    if (face.enrollmentStatus !== 're_enrollment_required') {
      throw new ApiError(409, 'Student already has an active biometric enrollment. Re-enrollment authorization required.');
    }
  }

  // Prevent concurrent in-flight enrollment requests (within 30 seconds)
  if (face && face.enrollmentStatus === 'enrolling' && face.updatedAt && (Date.now() - new Date(face.updatedAt).getTime() < 30000)) {
    throw new ApiError(429, 'Biometric enrollment is currently in progress. Please wait.');
  }

  const samples = Array.isArray(imageSamples) && imageSamples.length > 0
    ? imageSamples
    : (imageData ? [imageData] : []);

  if (samples.length === 0) {
    throw new ApiError(400, 'At least one face image sample is required for biometric enrollment');
  }

  // Deactivate existing template during enrollment attempt to prevent use of stale vectors
  if (face) {
    face.status = 'enrolling';
    face.enrollmentStatus = 'enrolling';
    face.isActive = false;
    await face.save();
  }

  let encryptedData = null;
  let templateReference = null;
  let measuredQuality = qualityScore;

  try {
    const aiResult = await pythonAiService.enrollBiometricTemplate(
      student._id.toString(),
      samples[0],
      samples
    );

    if (!aiResult || !aiResult.success) {
      if (face) {
        face.status = 'enrollment_failed';
        face.enrollmentStatus = 'enrollment_failed';
        face.isActive = false;
        await face.save();
      }
      await AttendanceAuditLog.record({
        actorId: req.user.userId,
        actorRole: 'student',
        action: 'enrollment_failed',
        affectedStudentId: student._id,
        reason: `Biometric extraction rejected: ${aiResult?.message || 'Face quality criteria not met'}`,
        ipAddress: req.ip
      });
      throw new ApiError(400, aiResult?.message || 'Face biometric extraction rejected. Ensure face is centered and lit.');
    }

    const bioData = aiResult.data || aiResult;
    encryptedData = bioData.encryptedData;
    templateReference = bioData.templateReference;
    if (bioData.qualitySummary?.averageQuality) {
      measuredQuality = Math.round(bioData.qualitySummary.averageQuality * 100);
    }
  } catch (aiErr) {
    if (face) {
      face.status = 'enrollment_failed';
      face.enrollmentStatus = 'enrollment_failed';
      face.isActive = false;
      await face.save();
    }
    await AttendanceAuditLog.record({
      actorId: req.user.userId,
      actorRole: 'student',
      action: 'enrollment_failed',
      affectedStudentId: student._id,
      reason: `Biometric processing error: ${aiErr.message}`,
      ipAddress: req.ip
    });
    if (aiErr instanceof ApiError) throw aiErr;
    throw new ApiError(400, `Biometric processing error: ${aiErr.message}`);
  }

  if (face) {
    face.consentGiven = true;
    face.consentStatus = 'active';
    face.consentDate = new Date();
    face.enrolledAt = new Date();
    face.isActive = true;
    face.status = 'enrolled';
    face.enrollmentStatus = 'enrolled';
    face.samplesCaptured = samples.length;
    face.imageQualityScore = measuredQuality;
    face.encryptedData = encryptedData;
    face.templateReference = templateReference;
    face.deletionRequestedAt = null;
    face.deletionCompletedAt = null;
    await face.save();
  } else {
    face = await FaceEmbedding.create({
      student: student._id,
      consentGiven: true,
      consentStatus: 'active',
      consentDate: new Date(),
      enrolledAt: new Date(),
      isActive: true,
      status: 'enrolled',
      enrollmentStatus: 'enrolled',
      samplesCaptured: samples.length,
      imageQualityScore: measuredQuality,
      encryptedData,
      templateReference,
    });
  }

  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: 'student',
    action: 'enroll_biometric',
    affectedStudentId: student._id,
    newValue: { status: 'enrolled', samplesCount: samples.length, qualityScore: measuredQuality },
    reason: isReEnrollment
      ? 'Student voluntary face biometric re-enrollment with explicit consent'
      : 'Student voluntary face biometric enrollment with explicit consent',
    ipAddress: req.ip
  });

  notificationService.createNotification({
    recipient: req.user.userId,
    title: 'Biometric Enrollment Confirmed',
    message: 'Your facial biometric template has been captured, verified, and securely encrypted (AES-256-GCM).',
    category: 'system',
    priority: 'normal',
    relatedEntityType: 'FaceEmbedding',
    relatedEntityId: face._id,
    targetRoute: '/student/attendance',
    actor: req.user.userId,
    actorName: 'Security System',
    actorRole: 'system',
    eventId: `bio_enrolled_${req.user.userId}_${Date.now()}`
  }).catch(() => {});

  return res.status(200).json({
    success: true,
    data: {
      isEnrolled: true,
      status: 'enrolled',
      enrolledAt: face.enrolledAt,
      qualityScore: measuredQuality,
      samplesCaptured: samples.length
    },
    message: 'Face biometric enrolled successfully!',
  });
});

// POST /api/student/face/revoke
const revokeFace = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  try {
    const face = await FaceEmbedding.findOne({ student: student._id });
    if (face) {
      face.isActive = false;
      face.status = 'revoked';
      face.enrollmentStatus = 'consent_withdrawn';
      face.consentStatus = 'withdrawn';
      face.consentGiven = false;
      face.encryptedData = null; // Cryptographically purge template
      face.templateReference = null;
      face.samplesCaptured = 0;
      face.deletionRequestedAt = new Date();
      face.deletionCompletedAt = new Date();
      await face.save();
    }

    // Update consent record to withdrawn
    await ConsentRecord.updateMany(
      { student: student._id, consentStatus: 'active' },
      { consentStatus: 'withdrawn', withdrawalTimestamp: new Date() }
    );

    // Record audit trails in append-only log
    await AttendanceAuditLog.record({
      actorId: req.user.userId,
      actorRole: 'student',
      action: 'consent_withdrawn',
      affectedStudentId: student._id,
      reason: 'Student withdrew biometric consent',
      ipAddress: req.ip
    });

    await AttendanceAuditLog.record({
      actorId: req.user.userId,
      actorRole: 'student',
      action: 'revoke_biometric',
      affectedStudentId: student._id,
      reason: 'Biometric template purged following consent withdrawal',
      ipAddress: req.ip
    });

    notificationService.createNotification({
      recipient: req.user.userId,
      title: 'Biometric Consent Revoked',
      message: 'Your biometric consent has been withdrawn and facial templates permanently purged.',
      category: 'system',
      priority: 'normal',
      targetRoute: '/student/attendance',
      actor: req.user.userId,
      actorName: 'Security System',
      actorRole: 'system',
      eventId: `bio_revoked_${req.user.userId}_${Date.now()}`
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Biometric consent withdrawn and face profile successfully purged.',
    });
  } catch (err) {
    await AttendanceAuditLog.record({
      actorId: req.user.userId,
      actorRole: 'student',
      action: 'deletion_failed',
      affectedStudentId: student._id,
      reason: `Consent withdrawal / template purge failed: ${err.message}`,
      ipAddress: req.ip
    });
    throw err;
  }
});

// GET /api/student/exams
const getExams = asyncHandler(async (req, res) => {
  return examController.getStudentExamSchedule(req, res);
});

// GET /api/student/results
const getResults = asyncHandler(async (req, res) => {
  return examController.getStudentResults(req, res);
});

module.exports = {
  getProfile,
  getAnnouncements,
  raiseComplaint,
  getMyComplaints,
  getFees,
  getAttendance,
  getAttendanceHistory,
  getActiveSessions,
  joinAttendanceSession,
  getFaceStatus,
  grantConsent,
  enrollFace,
  requestReEnrollment,
  revokeFace,
  getExams,
  getResults,
};
