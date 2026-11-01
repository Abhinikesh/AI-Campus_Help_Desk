/**
 * server/controllers/exam.controller.js
 * Comprehensive Examination Management, Marks Entry, Review, Approval & Result Publication.
 */
'use strict';

const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Mark = require('../models/Mark');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const notificationService = require('../services/notification.service');
const {
  calculateSubjectResult,
  calculateSemesterResult,
  validateMarksPayload,
} = require('../services/resultCalculation.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Helper to record audit logs
async function recordAudit(actorId, action, entityType, entityId, summary) {
  try {
    await AuditLog.create({
      actor: actorId,
      action,
      entityType,
      entityId,
      summary,
    });
  } catch (err) {
    console.error('AuditLog creation warning:', err.message);
  }
}

// ── 1. EXAMINATION SCHEDULING (FACULTY & ADMIN) ──────────────────────────────

/**
 * POST /api/exams
 * Create a new examination.
 */
const createExam = asyncHandler(async (req, res) => {
  const {
    title,
    examinationType = 'mid_semester',
    academicYear = '2026-2027',
    department = 'CSE',
    semester,
    section = 'All',
    subject: subjectId,
    date,
    startTime,
    endTime,
    durationMinutes = 180,
    maximumMarks = 100,
    passingMarks = 40,
    room = 'TBA',
    venue = 'Campus Examination Hall',
    instructions = '',
    status = 'scheduled',
  } = req.body;

  if (!title || !subjectId || !date || !startTime || !endTime) {
    throw new ApiError(400, 'Title, subject, date, startTime, and endTime are required');
  }

  const subjectDoc = await Subject.findById(subjectId);
  if (!subjectDoc) throw new ApiError(404, 'Subject not found');

  // Academic ownership: Faculty must teach this subject (or admin)
  if (req.user.role === 'faculty') {
    const facultyProfile = await Faculty.findOne({ user: req.user.userId });
    const isOwner =
      subjectDoc.faculty &&
      (String(subjectDoc.faculty) === String(req.user.userId) ||
        (facultyProfile && String(subjectDoc.faculty) === String(facultyProfile._id)));
    if (!isOwner) {
      throw new ApiError(403, 'You are not authorized: You do not teach this subject');
    }
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ApiError(400, 'Invalid examination date');
  }

  const maxMarksNum = Number(maximumMarks);
  const passingMarksNum = Number(passingMarks);
  if (isNaN(maxMarksNum) || maxMarksNum <= 0) {
    throw new ApiError(400, 'Maximum marks must be a positive number');
  }
  if (isNaN(passingMarksNum) || passingMarksNum < 0) {
    throw new ApiError(400, 'Passing marks cannot be negative');
  }
  if (passingMarksNum > maxMarksNum) {
    throw new ApiError(400, 'Passing marks cannot exceed maximum marks');
  }

  // Conflict detection: Same room, same date, and time
  if (room && room !== 'TBA') {
    const existingRoomConflict = await Exam.findOne({
      room: room.trim(),
      date: {
        $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
        $lte: new Date(parsedDate.setHours(23, 59, 59, 999)),
      },
      startTime: startTime.trim(),
      status: { $in: ['scheduled', 'ongoing'] },
    });
    if (existingRoomConflict) {
      throw new ApiError(
        409,
        `Examination schedule conflict: Room '${room}' is already booked for '${existingRoomConflict.title}' at ${startTime}`
      );
    }
  }

  // Department & semester conflict: Same class cannot have two exams at the same time
  const targetSemester = Number(semester) || subjectDoc.semester || 4;
  const existingClassConflict = await Exam.findOne({
    department: department.trim(),
    semester: targetSemester,
    date: {
      $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
      $lte: new Date(parsedDate.setHours(23, 59, 59, 999)),
    },
    startTime: startTime.trim(),
    status: { $in: ['scheduled', 'ongoing'] },
  });
  if (existingClassConflict) {
    throw new ApiError(
      409,
      `Class schedule conflict: ${department} Semester ${targetSemester} already has '${existingClassConflict.title}' scheduled at ${startTime}`
    );
  }

  const exam = await Exam.create({
    title: title.trim(),
    examinationType,
    academicYear,
    department: department.trim(),
    semester: targetSemester,
    section: section.trim(),
    subject: subjectDoc._id,
    faculty: req.user.userId,
    date: parsedDate,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    durationMinutes: Number(durationMinutes) || 180,
    maximumMarks: maxMarksNum,
    passingMarks: passingMarksNum,
    room: room.trim(),
    venue: venue.trim(),
    instructions: instructions.trim(),
    status,
    evaluationStatus: 'marks_pending',
  });

  await recordAudit(
    req.user.userId,
    'EXAM_CREATED',
    'Exam',
    exam._id,
    `Created ${examinationType} exam: '${exam.title}' for ${subjectDoc.name}`
  );

  // Notify students if scheduled immediately
  if (status === 'scheduled') {
    const studentFilter = {
      branch: department,
      semester: targetSemester,
    };
    if (section && section !== 'All') studentFilter.section = section;

    const enrolledStudents = await Student.find(studentFilter, 'user');
    for (const st of enrolledStudents) {
      if (st.user) {
        notificationService
          .createNotification({
            recipient: st.user,
            title: `New Exam Scheduled: ${exam.title}`,
            message: `${subjectDoc.name} (${subjectDoc.code}) examination scheduled on ${parsedDate.toISOString().split('T')[0]} at ${startTime} (${room}).`,
            category: 'examination',
            priority: 'normal',
            relatedEntityType: 'Exam',
            relatedEntityId: exam._id,
            targetRoute: '/student/exams',
            actor: req.user.userId,
            actorName: req.user.name || 'Faculty',
            actorRole: req.user.role,
            eventId: `exam_sched_${exam._id}_${st.user}`,
          })
          .catch(() => {});
      }
    }
  }

  return res.status(201).json({
    success: true,
    data: exam,
    message: 'Examination created successfully',
  });
});

/**
 * GET /api/exams/faculty
 * List examinations for the authenticated faculty (or all for admin).
 */
const getFacultyExams = asyncHandler(async (req, res) => {
  const { status, semester, subject, academicYear } = req.query;
  const filter = {};

  if (req.user.role === 'faculty') {
    filter.faculty = req.user.userId;
  }
  if (status) filter.status = status;
  if (semester) filter.semester = Number(semester);
  if (subject) filter.subject = subject;
  if (academicYear) filter.academicYear = academicYear;

  const exams = await Exam.find(filter)
    .populate('subject', 'name code credits')
    .sort({ date: -1, startTime: 1 })
    .lean();

  // Attach progress metrics
  const examIds = exams.map((e) => e._id);
  const marksSummary = await Mark.aggregate([
    { $match: { exam: { $in: examIds } } },
    {
      $group: {
        _id: '$exam',
        totalEntered: { $sum: 1 },
        totalPublished: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        totalAbsent: { $sum: { $cond: ['$isAbsent', 1, 0] } },
      },
    },
  ]);

  const marksMap = new Map();
  marksSummary.forEach((m) => marksMap.set(String(m._id), m));

  const enriched = exams.map((e) => {
    const mInfo = marksMap.get(String(e._id)) || { totalEntered: 0, totalPublished: 0, totalAbsent: 0 };
    return {
      ...e,
      marksStats: mInfo,
    };
  });

  return res.status(200).json({
    success: true,
    data: enriched,
    message: 'Faculty examinations loaded',
  });
});

/**
 * GET /api/exams/:id
 * Retrieve specific examination details.
 */
const getExamById = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
    .populate('subject', 'name code credits branch semester')
    .populate('faculty', 'name email')
    .populate('approvedBy', 'name email')
    .populate('publishedBy', 'name email');

  if (!exam) throw new ApiError(404, 'Examination not found');

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Examination details retrieved',
  });
});

/**
 * PATCH /api/exams/:id
 * Update examination settings.
 */
const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to update this examination');
  }

  const { title, room, venue, instructions, startTime, endTime, durationMinutes, status } = req.body;
  if (title) exam.title = title.trim();
  if (room) exam.room = room.trim();
  if (venue) exam.venue = venue.trim();
  if (instructions !== undefined) exam.instructions = instructions.trim();
  if (startTime) exam.startTime = startTime.trim();
  if (endTime) exam.endTime = endTime.trim();
  if (durationMinutes) exam.durationMinutes = Number(durationMinutes);
  if (status) exam.status = status;

  await exam.save();
  await recordAudit(req.user.userId, 'EXAM_UPDATED', 'Exam', exam._id, `Updated details for '${exam.title}'`);

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Examination updated successfully',
  });
});

/**
 * POST /api/exams/:id/cancel
 * Cancel an examination with mandatory notification to class.
 */
const cancelExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject');
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to cancel this examination');
  }

  exam.status = 'cancelled';
  await exam.save();

  await recordAudit(req.user.userId, 'EXAM_CANCELLED', 'Exam', exam._id, `Cancelled examination '${exam.title}'`);

  // Notify students
  const enrolledStudents = await Student.find(
    { branch: exam.department, semester: exam.semester },
    'user'
  );
  for (const st of enrolledStudents) {
    if (st.user) {
      notificationService
        .createNotification({
          recipient: st.user,
          title: `Exam Cancelled: ${exam.title}`,
          message: `The examination '${exam.title}' (${exam.subject?.name}) scheduled for ${exam.date.toISOString().split('T')[0]} has been cancelled.`,
          category: 'examination',
          priority: 'high',
          relatedEntityType: 'Exam',
          relatedEntityId: exam._id,
          targetRoute: '/student/exams',
          actor: req.user.userId,
          actorName: req.user.name || 'Faculty',
          actorRole: req.user.role,
          eventId: `exam_cancel_${exam._id}_${st.user}`,
        })
        .catch(() => {});
    }
  }

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Examination cancelled successfully',
  });
});

/**
 * GET /api/exams/:id/roster
 * Retrieve class roster of students eligible for this exam along with any existing marks.
 */
const getExamRoster = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject');
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to view roster for this examination');
  }

  const filter = {
    branch: exam.department,
    semester: exam.semester,
  };
  if (exam.section && exam.section !== 'All') {
    filter.section = exam.section;
  }

  const students = await Student.find(filter)
    .populate('user', 'name email loginId')
    .sort({ rollNumber: 1 })
    .lean();

  const existingMarks = await Mark.find({ exam: exam._id }).lean();
  const marksMap = new Map();
  existingMarks.forEach((m) => marksMap.set(String(m.student), m));

  const roster = students.map((st) => {
    const markDoc = marksMap.get(String(st._id)) || null;
    return {
      studentId: st._id,
      fullName: st.fullName || st.user?.name || 'Student',
      rollNumber: st.rollNumber || st.rollNo || '',
      branch: st.branch,
      semester: st.semester,
      section: st.section,
      marks: markDoc
        ? {
            markId: markDoc._id,
            marksObtained: markDoc.marksObtained,
            isAbsent: markDoc.isAbsent,
            isWithheld: markDoc.isWithheld,
            status: markDoc.status,
            feedback: markDoc.feedback,
            percentage: markDoc.percentage,
            grade: markDoc.grade,
            isPassed: markDoc.isPassed,
          }
        : null,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      exam: {
        _id: exam._id,
        title: exam.title,
        maximumMarks: exam.maximumMarks,
        passingMarks: exam.passingMarks,
        evaluationStatus: exam.evaluationStatus,
        date: exam.date,
        subject: exam.subject,
      },
      roster,
    },
    message: 'Examination roster loaded',
  });
});

// ── 2. MARKS ENTRY WORKFLOW (FACULTY) ────────────────────────────────────────

/**
 * POST /api/exams/:id/marks/draft
 * Save marks as draft without submitting for administrative review.
 */
const saveDraftMarks = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to enter marks for this examination');
  }

  const { marks = [] } = req.body;
  const validated = validateMarksPayload(marks, exam);

  const bulkOps = validated.map((entry) => ({
    updateOne: {
      filter: { student: entry.student, exam: exam._id },
      update: {
        $set: {
          student: entry.student,
          subject: exam.subject,
          exam: exam._id,
          academicYear: exam.academicYear,
          semester: exam.semester,
          marksObtained: entry.marksObtained,
          maxMarks: exam.maximumMarks,
          passingMarks: exam.passingMarks,
          isAbsent: entry.isAbsent,
          status: 'draft',
          evaluatedBy: req.user.userId,
          evaluatedAt: new Date(),
          feedback: entry.feedback || '',
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await Mark.bulkWrite(bulkOps);
  }

  await recordAudit(
    req.user.userId,
    'MARKS_SAVED_DRAFT',
    'Exam',
    exam._id,
    `Saved draft marks for ${validated.length} students in '${exam.title}'`
  );

  return res.status(200).json({
    success: true,
    count: validated.length,
    message: `Draft marks saved successfully for ${validated.length} students`,
  });
});

/**
 * POST /api/exams/:id/marks/submit
 * Submit entered marks for administrative/departmental review.
 */
const submitMarksForReview = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to submit marks for this examination');
  }

  const marksCount = await Mark.countDocuments({ exam: exam._id });
  if (marksCount === 0) {
    throw new ApiError(400, 'Cannot submit marks for review: No marks records exist for this examination');
  }

  // Update all marks to 'submitted'
  await Mark.updateMany(
    { exam: exam._id, status: { $in: ['draft', 'correction_requested'] } },
    { $set: { status: 'submitted' } }
  );

  exam.evaluationStatus = 'submitted_for_review';
  await exam.save();

  await recordAudit(
    req.user.userId,
    'MARKS_SUBMITTED_FOR_REVIEW',
    'Exam',
    exam._id,
    `Submitted marks for '${exam.title}' for review (${marksCount} records)`
  );

  // Notify Admins
  const admins = await User.find({ role: 'admin' }, '_id');
  for (const adm of admins) {
    notificationService
      .createNotification({
        recipient: adm._id,
        title: `Marks Submitted for Review: ${exam.title}`,
        message: `${req.user.name || 'Faculty'} submitted marks for examination '${exam.title}' for review.`,
        category: 'administrative',
        priority: 'normal',
        relatedEntityType: 'Exam',
        relatedEntityId: exam._id,
        targetRoute: '/faculty/results',
        actor: req.user.userId,
        actorName: req.user.name || 'Faculty',
        actorRole: req.user.role,
        eventId: `exam_sub_review_${exam._id}_${adm._id}`,
      })
      .catch(() => {});
  }

  return res.status(200).json({
    success: true,
    message: 'Marks submitted for review successfully',
  });
});

// ── 3. RESULT REVIEW, APPROVAL & PUBLICATION (ADMIN & REVIEWER) ──────────────

/**
 * POST /api/exams/:id/marks/approve
 * Reviewer/Admin approves submitted marks.
 */
const reviewAndApproveMarks = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Examination not found');

  // Role verification: Admin or a different reviewer (faculty cannot self-approve unless admin)
  if (req.user.role !== 'admin') {
    if (String(exam.faculty) === String(req.user.userId)) {
      throw new ApiError(403, 'Permission denied: Instructors cannot approve their own submitted results. Review must be conducted by an administrator or department head.');
    }
  }

  if (exam.evaluationStatus !== 'submitted_for_review') {
    throw new ApiError(400, `Cannot approve examination in status '${exam.evaluationStatus}'. Must be 'submitted_for_review'.`);
  }

  const now = new Date();
  await Mark.updateMany(
    { exam: exam._id },
    {
      $set: {
        status: 'approved',
        approvedBy: req.user.userId,
        approvedAt: now,
      },
    }
  );

  exam.evaluationStatus = 'approved';
  exam.approvedBy = req.user.userId;
  exam.approvedAt = now;
  await exam.save();

  await recordAudit(
    req.user.userId,
    'MARKS_APPROVED',
    'Exam',
    exam._id,
    `Approved examination results for '${exam.title}'`
  );

  // Notify instructor
  notificationService
    .createNotification({
      recipient: exam.faculty,
      title: `Marks Approved: ${exam.title}`,
      message: `Your submitted marks for '${exam.title}' have been approved. You may now publish the results.`,
      category: 'examination',
      priority: 'normal',
      relatedEntityType: 'Exam',
      relatedEntityId: exam._id,
      targetRoute: '/faculty/results',
      actor: req.user.userId,
      actorName: req.user.name || 'Admin',
      actorRole: req.user.role,
      eventId: `exam_appr_${exam._id}_${Date.now()}`,
    })
    .catch(() => {});

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Examination marks approved successfully',
  });
});

/**
 * POST /api/exams/:id/results/publish
 * Formally publish approved results to students.
 */
const publishExamResults = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject');
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin' && String(exam.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to publish results for this examination');
  }

  if (exam.evaluationStatus !== 'approved' && req.user.role !== 'admin') {
    throw new ApiError(400, 'Cannot publish results before administrative approval');
  }

  const now = new Date();
  await Mark.updateMany(
    { exam: exam._id },
    {
      $set: {
        status: 'published',
        publishedBy: req.user.userId,
        publishedAt: now,
      },
    }
  );

  exam.evaluationStatus = 'published';
  exam.publishedBy = req.user.userId;
  exam.publishedAt = now;
  await exam.save();

  await recordAudit(
    req.user.userId,
    'RESULTS_PUBLISHED',
    'Exam',
    exam._id,
    `Published examination results for '${exam.title}'`
  );

  // Idempotent notifications to affected students
  const studentMarks = await Mark.find({ exam: exam._id }).populate('student', 'user');
  for (const m of studentMarks) {
    if (m.student?.user) {
      try {
        await notificationService.createNotification({
          recipient: m.student.user,
          title: `Exam Results Published: ${exam.title}`,
          message: `Official results for '${exam.title}' (${exam.subject?.name}) are now available in your Student Portal.`,
          category: 'examination',
          priority: 'normal',
          relatedEntityType: 'Exam',
          relatedEntityId: exam._id,
          targetRoute: '/student/results',
          actor: req.user.userId,
          actorName: req.user.name || 'Examiner',
          actorRole: req.user.role,
          eventId: `exam_pub_${exam._id}_${m.student.user}`,
        });
      } catch (err) {
        // Non-blocking notification delivery
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Examination results published successfully',
  });
});

/**
 * POST /api/exams/:id/marks/request-correction
 * Return submitted marks for instructor correction.
 */
const requestMarksCorrection = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'A mandatory reason is required to return marks for correction');
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Examination not found');

  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators or reviewers can request marks corrections');
  }

  exam.evaluationStatus = 'correction_requested';
  await exam.save();

  await Mark.updateMany(
    { exam: exam._id },
    { $set: { status: 'correction_requested' } }
  );

  await recordAudit(
    req.user.userId,
    'RESULT_CORRECTION_REQUESTED',
    'Exam',
    exam._id,
    `Requested correction for '${exam.title}': ${reason.trim()}`
  );

  // Alert faculty
  notificationService
    .createNotification({
      recipient: exam.faculty,
      title: `Marks Correction Requested: ${exam.title}`,
      message: `Correction requested for '${exam.title}': ${reason.trim()}`,
      category: 'examination',
      priority: 'high',
      relatedEntityType: 'Exam',
      relatedEntityId: exam._id,
      targetRoute: '/faculty/results',
      actor: req.user.userId,
      actorName: req.user.name || 'Reviewer',
      actorRole: req.user.role,
      eventId: `exam_corr_req_${exam._id}_${Date.now()}`,
    })
    .catch(() => {});

  return res.status(200).json({
    success: true,
    data: exam,
    message: 'Marks returned for correction successfully',
  });
});

// ── 4. AUDITED PUBLISHED RESULT CORRECTION ───────────────────────────────────

/**
 * POST /api/marks/:markId/correct
 * Correct an already published student mark with mandatory justification & audit history.
 */
const correctPublishedMark = asyncHandler(async (req, res) => {
  const { newMarks, newIsAbsent = false, reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    throw new ApiError(400, 'A mandatory justification reason (at least 5 characters) is required for grade correction');
  }

  const mark = await Mark.findById(req.params.markId).populate('exam');
  if (!mark) throw new ApiError(404, 'Mark record not found');

  const exam = mark.exam;
  if (req.user.role !== 'admin' && (!exam || String(exam.faculty) !== String(req.user.userId))) {
    throw new ApiError(403, 'Not authorized to correct this mark');
  }

  let validNewMarks = null;
  if (!newIsAbsent) {
    if (newMarks === undefined || newMarks === null || newMarks === '') {
      throw new ApiError(400, 'New marks value is required');
    }
    validNewMarks = Number(newMarks);
    if (isNaN(validNewMarks) || validNewMarks < 0) {
      throw new ApiError(400, 'New marks cannot be negative');
    }
    const maxMarks = mark.maxMarks || exam?.maximumMarks || 100;
    if (validNewMarks > maxMarks) {
      throw new ApiError(400, `New marks (${validNewMarks}) cannot exceed maximum marks (${maxMarks})`);
    }
  }

  // Preserve previous value in immutable correction history
  mark.correctionHistory.push({
    previousMarks: mark.marksObtained,
    newMarks: validNewMarks,
    previousIsAbsent: mark.isAbsent,
    newIsAbsent: Boolean(newIsAbsent),
    reason: reason.trim(),
    requestedBy: req.user.userId,
    approvedBy: req.user.userId,
    correctedAt: new Date(),
  });

  mark.marksObtained = validNewMarks;
  mark.isAbsent = Boolean(newIsAbsent);
  mark.status = 'published'; // Remains published with updated score
  mark.publishedAt = new Date();
  await mark.save();

  await recordAudit(
    req.user.userId,
    'RESULT_CORRECTED_AND_REPUBLISHED',
    'Mark',
    mark._id,
    `Audited mark correction for student ${mark.student}: was ${mark.correctionHistory[mark.correctionHistory.length - 1].previousMarks}, now ${validNewMarks}. Reason: ${reason.trim()}`
  );

  // Notify student about the score correction
  const studentDoc = await Student.findById(mark.student, 'user');
  if (studentDoc?.user) {
    notificationService
      .createNotification({
        recipient: studentDoc.user,
        title: `Grade Correction: ${exam?.title || 'Examination'}`,
        message: `Your result for '${exam?.title || 'Examination'}' was updated to ${validNewMarks !== null ? validNewMarks : 'Absent'}. Reason: ${reason.trim()}`,
        category: 'examination',
        priority: 'high',
        relatedEntityType: 'Mark',
        relatedEntityId: mark._id,
        targetRoute: '/student/results',
        actor: req.user.userId,
        actorName: req.user.name || 'Faculty',
        actorRole: req.user.role,
        eventId: `mark_corr_${mark._id}_${Date.now()}`,
      })
      .catch(() => {});
  }

  return res.status(200).json({
    success: true,
    data: mark,
    message: 'Mark corrected and republished successfully',
  });
});

// ── 5. STUDENT EXAMINATION & RESULTS APIS ───────────────────────────────────

/**
 * GET /api/student/exams (or /api/exams/student/schedule)
 * Retrieve upcoming and completed examination timetable for authenticated student.
 */
const getStudentExamSchedule = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const exams = await Exam.find({
    department: student.branch,
    semester: student.semester,
    status: { $in: ['scheduled', 'ongoing', 'completed'] },
  })
    .populate('subject', 'name code credits')
    .sort({ date: 1, startTime: 1 })
    .lean();

  const formatted = exams.map((e) => ({
    _id: e._id,
    subject: e.subject?.name || 'Subject',
    code: e.subject?.code || '',
    title: e.title,
    type: e.examinationType,
    date: e.date.toISOString().split('T')[0],
    rawDate: e.date,
    time: `${e.startTime} - ${e.endTime}`,
    startTime: e.startTime,
    endTime: e.endTime,
    durationMinutes: e.durationMinutes,
    room: e.room,
    venue: e.venue,
    maximumMarks: e.maximumMarks,
    passingMarks: e.passingMarks,
    instructions: e.instructions,
    status: e.status,
    credits: e.subject?.credits || 3,
  }));

  return res.status(200).json({
    success: true,
    data: formatted,
    message: 'Exams schedule loaded',
  });
});

/**
 * GET /api/student/results (or /api/exams/student/results)
 * Retrieve official published examination results and CGPA for authenticated student.
 */
const getStudentResults = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  // STRICT PRIVACY: Only fetch results with status === 'published'
  const publishedMarks = await Mark.find({
    student: student._id,
    status: 'published',
  })
    .populate('subject', 'name code credits semester branch')
    .populate('exam', 'title examinationType date maximumMarks passingMarks')
    .lean();

  // If no published marks yet, check if there are legacy subject marks
  if (!publishedMarks.length) {
    const legacyMarks = await Mark.find({
      student: student._id,
      exam: null,
    }).populate('subject', 'name code credits semester branch').lean();

    if (legacyMarks.length) {
      const summary = calculateSemesterResult(legacyMarks);
      return res.status(200).json({
        success: true,
        data: summary.subjects,
        summary,
        message: 'Results loaded',
      });
    }
  }

  const semesterSummary = calculateSemesterResult(publishedMarks);

  return res.status(200).json({
    success: true,
    data: semesterSummary.subjects,
    summary: semesterSummary,
    message: 'Results loaded',
  });
});

// ── 6. ADMINISTRATOR OVERSIGHT ───────────────────────────────────────────────

/**
 * GET /api/exams/admin/overview
 * Institutional examination metrics for administrators.
 */
const getAdminExamsOverview = asyncHandler(async (req, res) => {
  const { department, semester, academicYear } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (semester) filter.semester = Number(semester);
  if (academicYear) filter.academicYear = academicYear;

  const totalExams = await Exam.countDocuments(filter);
  const scheduledExams = await Exam.countDocuments({ ...filter, status: 'scheduled' });
  const completedExams = await Exam.countDocuments({ ...filter, status: 'completed' });
  const pendingEvaluation = await Exam.countDocuments({ ...filter, evaluationStatus: 'marks_pending' });
  const submittedForReview = await Exam.countDocuments({ ...filter, evaluationStatus: 'submitted_for_review' });
  const approvedExams = await Exam.countDocuments({ ...filter, evaluationStatus: 'approved' });
  const publishedResults = await Exam.countDocuments({ ...filter, evaluationStatus: 'published' });

  const totalMarksRecords = await Mark.countDocuments({});
  const totalPublishedMarks = await Mark.countDocuments({ status: 'published' });

  return res.status(200).json({
    success: true,
    data: {
      totalExams,
      scheduledExams,
      completedExams,
      pendingEvaluation,
      submittedForReview,
      approvedExams,
      publishedResults,
      totalMarksRecords,
      totalPublishedMarks,
    },
    message: 'Admin examination overview loaded',
  });
});

module.exports = {
  createExam,
  getFacultyExams,
  getExamById,
  updateExam,
  cancelExam,
  getExamRoster,
  saveDraftMarks,
  submitMarksForReview,
  reviewAndApproveMarks,
  publishExamResults,
  requestMarksCorrection,
  correctPublishedMark,
  getStudentExamSchedule,
  getStudentResults,
  getAdminExamsOverview,
};
