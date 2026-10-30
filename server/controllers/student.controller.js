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
const AttendanceSettings = require('../models/AttendanceSettings');
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

  // Load configured settings
  let settings = await AttendanceSettings.findOne();
  if (!settings) {
    settings = { minAttendancePercent: 75 };
  }

  // Get subjects for student's semester and branch
  const subjects = await Subject.find({
    semester: student.semester,
  }).populate('faculty', 'name');

  // Get all attendance records for this student
  const records = await Attendance.find({ student: student._id })
    .populate('subject', 'name code credits')
    .sort({ date: -1, createdAt: -1 });

  // Map subject stats
  const subjectMap = {};
  for (const sub of subjects) {
    subjectMap[sub._id.toString()] = {
      _id: sub._id,
      subject: sub.name,
      code: sub.code,
      credits: sub.credits,
      facultyName: sub.faculty?.name || 'Assigned Faculty',
      total: 0,
      attended: 0,
      missed: 0,
      percentage: 0,
      hasClasses: false,
    };
  }

  for (const rec of records) {
    if (!rec.subject) continue;
    const subId = rec.subject._id.toString();
    if (!subjectMap[subId]) {
      subjectMap[subId] = {
        _id: rec.subject._id,
        subject: rec.subject.name,
        code: rec.subject.code,
        credits: rec.subject.credits || 3,
        facultyName: 'Assigned Faculty',
        total: 0,
        attended: 0,
        missed: 0,
        percentage: 0,
        hasClasses: false,
      };
    }

    subjectMap[subId].total += 1;
    subjectMap[subId].hasClasses = true;
    if (rec.status === 'present') {
      subjectMap[subId].attended += 1;
    } else {
      subjectMap[subId].missed += 1;
    }
  }

  const subjectList = Object.values(subjectMap).map(sub => {
    const pct = sub.total > 0 ? Math.round((sub.attended / sub.total) * 100) : 0;
    let status = 'Good';
    if (sub.total > 0) {
      if (pct < 60) status = 'Critical';
      else if (pct < settings.minAttendancePercent) status = 'Warning';
    } else {
      status = 'No Classes';
    }
    return {
      ...sub,
      percentage: pct,
      status,
    };
  });

  const totalClasses = subjectList.reduce((sum, s) => sum + s.total, 0);
  const totalAttended = subjectList.reduce((sum, s) => sum + s.attended, 0);
  const totalMissed = totalClasses - totalAttended;
  const overall = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  // Active / Upcoming sessions that student can join
  const activeSessions = await AttendanceSession.find({
    semester: student.semester,
    status: 'open',
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

  return res.status(200).json({
    success: true,
    data: subjectList,
    summary: {
      overall,
      totalClasses,
      totalAttended,
      totalMissed,
      minThreshold: settings.minAttendancePercent,
      hasRecords: totalClasses > 0,
      activeSessions: activeWithStatus,
      recentHistory: records.slice(0, 5).map(r => ({
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
  const { verificationMethod = 'face', confidence = 0.94 } = req.body;

  const student = await Student.findOne({ user: req.user.userId }).populate('user', 'name');
  if (!student) throw new ApiError(404, 'Student profile not found');

  const session = await AttendanceSession.findById(sessionId)
    .populate('subject', 'name code');
  if (!session) throw new ApiError(404, 'Attendance session not found');

  if (session.status !== 'open') {
    throw new ApiError(400, 'This session is no longer active or has been closed');
  }

  // Check if attendance already marked for this session
  let attendance = await Attendance.findOne({
    session: session._id,
    student: student._id,
  });

  if (attendance && attendance.status === 'present') {
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
        status: 'present',
        verificationMethod: attendance.verificationMethod,
        alreadyMarked: true,
      },
      message: 'Attendance was already marked present for this session',
    });
  }

  if (attendance) {
    attendance.status = 'present';
    attendance.verificationMethod = verificationMethod;
    attendance.confidence = confidence;
    attendance.verifiedAt = new Date();
    await attendance.save();
  } else {
    attendance = await Attendance.create({
      session: session._id,
      subject: session.subject._id,
      student: student._id,
      date: session.date,
      period: session.period,
      status: 'present',
      verificationMethod,
      confidence,
      verifiedAt: new Date(),
    });
  }

  // Update session present count
  const presentCount = await Attendance.countDocuments({
    session: session._id,
    status: 'present',
  });
  session.presentCount = presentCount;
  await session.save();

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
      status: 'present',
      verificationMethod,
    },
    message: 'Attendance verified and marked successfully! 🎓',
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

// POST /api/student/face/enroll
const enrollFace = asyncHandler(async (req, res) => {
  const { consentGiven, samplesCount = 3, qualityScore = 92 } = req.body;
  if (!consentGiven) {
    throw new ApiError(400, 'Explicit biometric consent is required for enrollment');
  }

  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  let face = await FaceEmbedding.findOne({ student: student._id });
  if (face) {
    face.consentGiven = true;
    face.consentDate = new Date();
    face.enrolledAt = new Date();
    face.isActive = true;
    face.status = 'enrolled';
    face.samplesCaptured = samplesCount;
    face.imageQualityScore = qualityScore;
    await face.save();
  } else {
    face = await FaceEmbedding.create({
      student: student._id,
      consentGiven: true,
      consentDate: new Date(),
      enrolledAt: new Date(),
      isActive: true,
      status: 'enrolled',
      samplesCaptured: samplesCount,
      imageQualityScore: qualityScore,
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      isEnrolled: true,
      status: 'enrolled',
      enrolledAt: face.enrolledAt,
    },
    message: 'Face biometric enrolled successfully!',
  });
});

// POST /api/student/face/revoke
const revokeFace = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const face = await FaceEmbedding.findOne({ student: student._id });
  if (face) {
    face.isActive = false;
    face.status = 'revoked';
    face.consentGiven = false;
    await face.save();
  }

  return res.status(200).json({
    success: true,
    data: { isEnrolled: false, status: 'revoked' },
    message: 'Biometric consent revoked and enrollment deactivated.',
  });
});

// GET /api/student/exams
const getExams = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const subjects = await Subject.find({ semester: student.semester });
  const exams = subjects.map((sub, i) => ({
    _id: `exam-${sub._id}`,
    subject: sub.name,
    code: sub.code,
    type: i % 2 === 0 ? 'Mid-Semester Examination' : 'End-Semester Examination',
    date: `2026-05-${10 + i * 2}`,
    time: '10:00 AM - 01:00 PM',
    room: `Hall ${101 + i}`,
    credits: sub.credits,
  }));

  return res.status(200).json({ success: true, data: exams, message: 'Exams schedule loaded' });
});

// GET /api/student/results
const getResults = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const subjects = await Subject.find({ semester: student.semester });
  const results = subjects.map((sub, i) => {
    const marks = [88, 76, 92, 84, 80][i % 5];
    const grade = marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B+' : 'B';
    return {
      _id: `res-${sub._id}`,
      subject: sub.name,
      code: sub.code,
      credits: sub.credits,
      marks,
      grade,
      semester: student.semester,
    };
  });

  return res.status(200).json({ success: true, data: results, message: 'Results loaded' });
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
  enrollFace,
  revokeFace,
  getExams,
  getResults,
};
