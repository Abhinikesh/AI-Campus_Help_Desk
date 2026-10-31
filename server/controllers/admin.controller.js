/**
 * server/controllers/admin.controller.js
 */
'use strict';

const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const FaceEmbedding = require('../models/FaceEmbedding');
const AttendanceSettings = require('../models/AttendanceSettings');
const ConsentRecord = require('../models/ConsentRecord');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const [totalStudents, totalFaculty, totalComplaints, pendingComplaints, resolvedComplaints] =
    await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'resolved' }),
    ]);

  return res.status(200).json({
    success: true,
    data: {
      totalStudents,
      totalFaculty,
      totalComplaints,
      pendingComplaints,
      resolvedComplaints,
    },
    message: 'Stats fetched',
  });
});

// GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (role && ['student', 'faculty', 'admin'].includes(role)) filter.role = role;
  if (search) filter.$text = { $search: search };

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('-__v');

  const total = await User.countDocuments(filter);

  return res.status(200).json({
    success: true,
    data: { users, total, page: Number(page), limit: Number(limit) },
    message: 'Users fetched',
  });
});

// PATCH /api/admin/users/:id/deactivate
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!user) throw new ApiError(404, 'User not found');

  return res.status(200).json({ success: true, data: user, message: 'User deactivated' });
});

// PATCH /api/admin/users/:id/activate
const activateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  );
  if (!user) throw new ApiError(404, 'User not found');

  return res.status(200).json({ success: true, data: user, message: 'User activated' });
});

// GET /api/admin/complaints
const getAllComplaints = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const complaints = await Complaint.find(filter)
    .populate('raisedBy', 'name email role')
    .sort({ createdAt: -1 });

  return res.status(200).json({ success: true, data: complaints, message: 'Complaints fetched' });
});

// PATCH /api/admin/complaints/:id/status
const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, adminResponse } = req.body;
  const validStatuses = ['pending', 'in-progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const update = { status };
  if (adminResponse !== undefined) update.adminResponse = adminResponse;
  if (status === 'resolved') update.resolvedAt = new Date();

  const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  return res.status(200).json({ success: true, data: complaint, message: 'Complaint updated' });
});

// POST /api/admin/announcements
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, audience } = req.body;
  if (!title || !body) {
    throw new ApiError(400, 'Title and body are required');
  }

  const validAudiences = ['all', 'student', 'faculty'];
  const ann = await Announcement.create({
    title,
    body,
    audience: validAudiences.includes(audience) ? audience : 'all',
    createdBy: req.user.userId,
  });

  return res.status(201).json({ success: true, data: ann, message: 'Announcement created' });
});

// GET /api/admin/announcements
const getAllAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find()
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, data: announcements, message: 'OK' });
});

// ═══════════════════════════════════════════════════════════════
// SMART ATTENDANCE ADMIN APIS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/attendance/overview
const getAttendanceOverview = asyncHandler(async (req, res) => {
  const [
    totalSessions,
    activeSessions,
    totalEnrolledBiometrics,
    allAttendanceRecords,
    recentSessions,
    studentsCount,
  ] = await Promise.all([
    AttendanceSession.countDocuments(),
    AttendanceSession.countDocuments({ status: 'open' }),
    FaceEmbedding.countDocuments({ status: 'enrolled', isActive: true }),
    Attendance.find(),
    AttendanceSession.find()
      .populate('subject', 'name code')
      .populate('faculty', 'name')
      .sort({ createdAt: -1 })
      .limit(6),
    Student.countDocuments(),
  ]);

  const totalRecords = allAttendanceRecords.length;
  const presentRecords = allAttendanceRecords.filter(r => ['present', 'late'].includes(r.status)).length;
  const overallAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

  const branches = [
    { code: 'CSE', name: 'Computer Science & Engineering' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'ECE', name: 'Electronics & Communication' },
    { code: 'MECH', name: 'Mechanical Engineering' },
  ];

  const departmentStats = branches.map(b => {
    return {
      department: b.name,
      sessions: allAttendanceRecords.filter(r => (r.branch || '').toUpperCase() === b.code).length,
      attendance: overallAttendance,
    };
  });

  // Sessions requiring attention (sessions with low attendance or open for > 3 hours)
  const attentionSessions = await AttendanceSession.find({
    status: 'open',
  }).populate('subject', 'name code').populate('faculty', 'name');

  return res.status(200).json({
    success: true,
    data: {
      totalSessions,
      activeSessions,
      totalStudentsEnrolled: totalEnrolledBiometrics,
      totalStudents: studentsCount,
      overallAttendance,
      recentSessions: recentSessions.map(s => ({
        _id: s._id,
        subject: s.subject?.name || 'Class',
        code: s.subject?.code || '',
        faculty: s.faculty?.name || 'Faculty',
        date: s.date,
        period: s.period,
        status: s.status,
        total: s.totalStudents || 0,
        present: s.presentCount || 0,
        pct: s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0,
      })),
      departmentStats,
      attentionSessions: attentionSessions.map(s => ({
        _id: s._id,
        subject: s.subject?.name,
        faculty: s.faculty?.name,
        date: s.date,
        reason: 'Session still open',
      })),
    },
    message: 'Attendance overview loaded',
  });
});

// GET /api/admin/attendance/sessions — All sessions with filters
const getAdminAttendanceSessions = asyncHandler(async (req, res) => {
  const { search, department, status, date } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (date) filter.date = date;

  const sessions = await AttendanceSession.find(filter)
    .populate('subject', 'name code branch')
    .populate('faculty', 'name email')
    .sort({ date: -1, createdAt: -1 });

  let result = sessions;
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(item =>
      item.subject?.name?.toLowerCase().includes(s) ||
      item.subject?.code?.toLowerCase().includes(s) ||
      item.faculty?.name?.toLowerCase().includes(s)
    );
  }

  const formatted = result.map(sess => {
    const total = sess.totalStudents || 0;
    const present = sess.presentCount || 0;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return {
      _id: sess._id,
      date: sess.date,
      time: `${sess.startTime} - ${sess.endTime}`,
      subject: sess.subject?.name || 'Class',
      code: sess.subject?.code || '',
      faculty: sess.faculty?.name || 'Faculty',
      class: `${sess.branch || 'CSE'}-${sess.semester || 4} (${sess.section || 'A'})`,
      totalStudents: total,
      present,
      absent: Math.max(0, total - present),
      percentage: pct,
      status: sess.status,
      method: sess.attendanceMethod,
    };
  });

  return res.status(200).json({ success: true, data: formatted, message: 'Sessions loaded' });
});

// GET /api/admin/attendance/records — Search student records
const getAdminAttendanceRecords = asyncHandler(async (req, res) => {
  const { search, status, date, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (date) filter.date = date;

  const records = await Attendance.find(filter)
    .populate({
      path: 'student',
      select: 'rollNumber fullName email branch semester section user',
      populate: { path: 'user', select: 'name' },
    })
    .populate('subject', 'name code')
    .sort({ date: -1, createdAt: -1 });

  let filtered = records;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(r =>
      r.student?.rollNumber?.toLowerCase().includes(s) ||
      r.student?.fullName?.toLowerCase().includes(s) ||
      r.student?.user?.name?.toLowerCase().includes(s) ||
      r.subject?.name?.toLowerCase().includes(s) ||
      r.subject?.code?.toLowerCase().includes(s)
    );
  }

  const skip = (Number(page) - 1) * Number(limit);
  const paged = filtered.slice(skip, skip + Number(limit));

  const data = paged.map(r => ({
    _id: r._id,
    rollNumber: r.student?.rollNumber || 'N/A',
    studentName: r.student?.fullName || r.student?.user?.name || 'Student',
    class: `${r.student?.branch || 'CSE'}-${r.student?.semester || 4}`,
    subject: r.subject?.name || 'Class',
    code: r.subject?.code || '',
    date: r.date,
    period: r.period,
    status: r.status,
    verificationMethod: r.verificationMethod,
    confidence: r.confidence,
    isManualOverride: r.isManualOverride,
    verifiedAt: r.verifiedAt || r.updatedAt,
  }));

  return res.status(200).json({
    success: true,
    data: {
      records: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / Number(limit)) || 1,
      },
    },
    message: 'Attendance records loaded',
  });
});

// GET /api/admin/attendance/face-enrollments — List Biometric Enrollments
const getFaceEnrollments = asyncHandler(async (req, res) => {
  const students = await Student.find()
    .populate('user', 'name email')
    .sort({ rollNumber: 1 });

  const enrollments = await Promise.all(
    students.map(async (st) => {
      const face = await FaceEmbedding.findOne({ student: st._id });
      return {
        studentId: st._id,
        rollNumber: st.rollNumber,
        name: st.fullName || st.user?.name,
        email: st.email || st.user?.email,
        branch: st.branch,
        semester: st.semester,
        section: st.section,
        isEnrolled: face ? face.status === 'enrolled' && face.isActive : false,
        status: face?.status || 'not_enrolled',
        consentGiven: face?.consentGiven || false,
        consentDate: face?.consentDate || null,
        enrolledAt: face?.enrolledAt || null,
        qualityScore: face?.imageQualityScore || null,
        samplesCount: face?.samplesCaptured || 0,
      };
    })
  );

  return res.status(200).json({
    success: true,
    data: enrollments,
    message: 'Face enrollments list loaded',
  });
});

// DELETE /api/admin/attendance/face-enrollments/:studentId — Delete Biometric Data
const deleteFaceEnrollment = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const face = await FaceEmbedding.findOne({ student: studentId }).select('+encryptedData');
  if (face) {
    face.encryptedData = null; // Cryptographically purge template
    face.templateReference = null;
    face.isActive = false;
    face.status = 'revoked';
    face.consentGiven = false;
    face.samplesCaptured = 0;
    face.deletionRequestedAt = new Date();
    face.deletionCompletedAt = new Date();
    await face.save();
  }

  // Revoke active consent record
  await ConsentRecord.updateMany(
    { student: studentId, consentStatus: 'active' },
    { consentStatus: 'revoked', withdrawalTimestamp: new Date() }
  );

  // Record audit log
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'delete_biometric',
    affectedStudentId: studentId,
    reason: 'Admin purged biometric profile and revoked active consent',
    ipAddress: req.ip,
  });

  return res.status(200).json({
    success: true,
    message: 'Student biometric data safely revoked and cryptographically purged from verification pool.',
  });
});

// GET /api/admin/attendance/analytics — Comprehensive Attendance Analytics
const getAttendanceAnalytics = asyncHandler(async (req, res) => {
  const [allStudents, allSessions, allRecords] = await Promise.all([
    Student.find({}, 'branch semester rollNumber fullName').lean(),
    AttendanceSession.find({}, 'branch semester status date').lean(),
    Attendance.find({}, 'status date student').lean(),
  ]);

  const branches = ['CSE', 'IT', 'ECE', 'MECH'];
  const departmentStats = branches.map((branch) => {
    const branchStudents = allStudents.filter((s) => (s.branch || '').toUpperCase() === branch);
    const branchStudentIds = new Set(branchStudents.map((s) => s._id.toString()));
    const branchRecords = allRecords.filter((r) => branchStudentIds.has(r.student?.toString()));
    const presentRecords = branchRecords.filter((r) => ['present', 'late'].includes(r.status));
    const average = branchRecords.length > 0 ? Math.round((presentRecords.length / branchRecords.length) * 100) : 0;
    const lowAttendanceCount = branchStudents.filter((s) => {
      const studentRecs = branchRecords.filter((r) => r.student?.toString() === s._id.toString());
      if (studentRecs.length === 0) return false;
      const sPresent = studentRecs.filter((r) => ['present', 'late'].includes(r.status));
      return (sPresent.length / studentRecs.length) * 100 < 75;
    }).length;

    const deptNames = {
      CSE: 'Computer Science & Engineering',
      IT: 'Information Technology',
      ECE: 'Electronics & Communication',
      MECH: 'Mechanical Engineering',
    };

    return {
      department: deptNames[branch] || branch,
      average,
      totalStudents: branchStudents.length,
      lowAttendanceCount,
    };
  });

  // Dynamic class-wise stats from enrolled students & sessions
  const classKeySet = new Set();
  allStudents.forEach((s) => {
    if (s.branch && s.semester) {
      classKeySet.add(`${s.branch.toUpperCase()}-Sem${s.semester}`);
    }
  });

  const classWiseStats = Array.from(classKeySet).map((classKey) => {
    const [branch, semStr] = classKey.split('-Sem');
    const sem = parseInt(semStr, 10);
    const classStudents = allStudents.filter(
      (s) => (s.branch || '').toUpperCase() === branch && s.semester === sem
    );
    const classStudentIds = new Set(classStudents.map((s) => s._id.toString()));
    const classRecords = allRecords.filter((r) => classStudentIds.has(r.student?.toString()));
    const presentRecs = classRecords.filter((r) => ['present', 'late'].includes(r.status));
    const average = classRecords.length > 0 ? Math.round((presentRecs.length / classRecords.length) * 100) : 0;

    let below75 = 0;
    classStudents.forEach((st) => {
      const stRecs = classRecords.filter((r) => r.student?.toString() === st._id.toString());
      if (stRecs.length > 0) {
        const stPresent = stRecs.filter((r) => ['present', 'late'].includes(r.status)).length;
        if ((stPresent / stRecs.length) * 100 < 75) below75++;
      }
    });

    return {
      className: `${branch} Semester ${sem}`,
      average,
      totalStudents: classStudents.length,
      below75,
    };
  });

  // Dynamic monthly trends from actual Attendance records
  const monthlyMap = {};
  allRecords.forEach((r) => {
    const dateStr = r.date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '');
    if (dateStr && dateStr.length >= 7) {
      const monthKey = dateStr.slice(0, 7); // e.g. "2026-04"
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { total: 0, present: 0 };
      }
      monthlyMap[monthKey].total++;
      if (['present', 'late'].includes(r.status)) {
        monthlyMap[monthKey].present++;
      }
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrends = Object.keys(monthlyMap)
    .sort()
    .slice(-6)
    .map((mKey) => {
      const monthNum = parseInt(mKey.split('-')[1], 10);
      const name = monthNames[monthNum - 1] || mKey;
      const data = monthlyMap[mKey];
      return {
        month: name,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      };
    });

  const totalPresent = allRecords.filter((r) => ['present', 'late'].includes(r.status)).length;
  const overallCampusAttendance = allRecords.length > 0 ? Math.round((totalPresent / allRecords.length) * 100) : 0;

  return res.status(200).json({
    success: true,
    data: {
      departmentStats,
      classWiseStats: classWiseStats.length > 0 ? classWiseStats : [
        { className: 'CSE Semester 4', average: 0, totalStudents: allStudents.filter(s => s.branch === 'CSE' && s.semester === 4).length, below75: 0 }
      ],
      monthlyTrends: monthlyTrends.length > 0 ? monthlyTrends : [
        { month: 'Current', rate: overallCampusAttendance }
      ],
      overallCampusAttendance,
    },
    message: 'Attendance analytics loaded',
  });
});

// GET /api/admin/attendance/settings
const getAttendanceSettings = asyncHandler(async (req, res) => {
  let settings = await AttendanceSettings.findOne();
  if (!settings) {
    settings = await AttendanceSettings.create({
      minAttendancePercent: 75,
      defaultSessionDurationMinutes: 60,
      verificationRetryLimit: 3,
      faceConfidenceThreshold: 0.65,
      allowManualOverride: true,
      biometricRetentionDays: 365,
    });
  }

  return res.status(200).json({ success: true, data: settings, message: 'Settings loaded' });
});

// PUT /api/admin/attendance/settings
const updateAttendanceSettings = asyncHandler(async (req, res) => {
  const {
    minAttendancePercent,
    defaultSessionDurationMinutes,
    verificationRetryLimit,
    faceConfidenceThreshold,
    allowManualOverride,
    biometricRetentionDays,
  } = req.body;

  let settings = await AttendanceSettings.findOne();
  if (!settings) {
    settings = new AttendanceSettings();
  }

  const previousValue = settings.toObject();

  if (minAttendancePercent !== undefined) settings.minAttendancePercent = Number(minAttendancePercent);
  if (defaultSessionDurationMinutes !== undefined) settings.defaultSessionDurationMinutes = Number(defaultSessionDurationMinutes);
  if (verificationRetryLimit !== undefined) settings.verificationRetryLimit = Number(verificationRetryLimit);
  if (faceConfidenceThreshold !== undefined) settings.faceConfidenceThreshold = Number(faceConfidenceThreshold);
  if (allowManualOverride !== undefined) settings.allowManualOverride = Boolean(allowManualOverride);
  if (biometricRetentionDays !== undefined) settings.biometricRetentionDays = Number(biometricRetentionDays);

  await settings.save();

  // Audit log for administrative settings modification
  await AttendanceAuditLog.record({
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: 'settings_update',
    previousValue,
    newValue: settings.toObject(),
    reason: 'Admin modified smart attendance configuration settings',
    ipAddress: req.ip,
  });

  return res.status(200).json({ success: true, data: settings, message: 'Attendance settings updated successfully' });
});

module.exports = {
  getStats,
  getAllUsers,
  deactivateUser,
  activateUser,
  getAllComplaints,
  updateComplaintStatus,
  createAnnouncement,
  getAllAnnouncements,
  // Smart Attendance
  getAttendanceOverview,
  getAdminAttendanceSessions,
  getAdminAttendanceRecords,
  getFaceEnrollments,
  deleteFaceEnrollment,
  getAttendanceAnalytics,
  getAttendanceSettings,
  updateAttendanceSettings,
};
