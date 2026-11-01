/**
 * server/controllers/assignment.controller.js
 * Comprehensive Assignment Management, Student Submissions & Faculty Evaluation Controller.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const notificationService = require('../services/notification.service');
const { verifySafePath } = require('../services/assignmentStorage.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// ── 1. FACULTY ASSIGNMENT CREATION & MANAGEMENT ──────────────────────────────

/**
 * POST /api/assignments
 * Faculty or Admin creates an assignment (draft or published).
 */
const createAssignment = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    subject: subjectId,
    semester,
    section = 'All',
    maximumMarks = 100,
    assignmentType = 'homework',
    dueDate,
    latePolicy = 'allowed',
    gracePeriodMinutes = 0,
    status = 'draft',
  } = req.body;

  if (!title || !description || !subjectId || !dueDate) {
    throw new ApiError(400, 'Title, description, subject, and dueDate are required');
  }

  const subjectDoc = await Subject.findById(subjectId);
  if (!subjectDoc) {
    throw new ApiError(404, 'Subject not found');
  }

  // Academic ownership: Faculty must be assigned to teach this subject (or admin)
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

  const parsedDueDate = new Date(dueDate);
  if (isNaN(parsedDueDate.getTime())) {
    throw new ApiError(400, 'Invalid dueDate timestamp');
  }

  const maxMarksNum = Number(maximumMarks);
  if (isNaN(maxMarksNum) || maxMarksNum <= 0) {
    throw new ApiError(400, 'Maximum marks must be a positive number');
  }

  // Process uploaded attachments (if any)
  const attachments = (req.files || []).map((file) => ({
    name: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
  }));

  const isPublished = status === 'published';

  const assignment = await Assignment.create({
    title: title.trim(),
    description: description.trim(),
    subject: subjectDoc._id,
    faculty: req.user.userId,
    department: subjectDoc.branch || '',
    semester: Number(semester) || subjectDoc.semester,
    section: section.trim(),
    maximumMarks: maxMarksNum,
    assignmentType,
    attachments,
    status: isPublished ? 'published' : 'draft',
    dueDate: parsedDueDate,
    latePolicy,
    gracePeriodMinutes: Math.max(0, Number(gracePeriodMinutes) || 0),
    publishedAt: isPublished ? new Date() : null,
  });

  // If immediately published, notify all eligible students
  if (isPublished) {
    await dispatchAssignmentPublishedNotifications(assignment, subjectDoc, req.user);
  }

  const populated = await Assignment.findById(assignment._id)
    .populate('subject', 'name code branch semester')
    .populate('faculty', 'name email');

  return res.status(201).json({
    success: true,
    data: populated,
    message: isPublished ? 'Assignment published successfully' : 'Assignment draft saved',
  });
});

/**
 * Helper to dispatch broadcast notifications to enrolled students when an assignment is published.
 */
async function dispatchAssignmentPublishedNotifications(assignment, subjectDoc, actorUser) {
  try {
    const studentQuery = {
      branch: assignment.department || subjectDoc.branch,
      semester: assignment.semester || subjectDoc.semester,
    };
    if (assignment.section && assignment.section !== 'All') {
      studentQuery.section = assignment.section;
    }

    const students = await Student.find(studentQuery, 'user').lean();
    const recipientUserIds = students.map((s) => s.user).filter(Boolean);

    if (recipientUserIds.length > 0) {
      await notificationService.createBulkNotifications({
        recipients: recipientUserIds,
        title: `New Assignment: ${assignment.title}`,
        message: `${subjectDoc.name} (${subjectDoc.code}) — Due on ${new Date(assignment.dueDate).toLocaleDateString('en-IN')}`,
        category: 'assignment',
        priority: 'normal',
        relatedEntityType: 'Assignment',
        relatedEntityId: assignment._id,
        targetRoute: '/student/assignments',
        actor: actorUser.userId,
        actorName: actorUser.name,
        actorRole: actorUser.role,
        eventIdPrefix: `assign_pub_${assignment._id}`,
      });
    }
  } catch (err) {
    console.error('Failed to dispatch assignment notifications:', err.message);
  }
}

/**
 * GET /api/assignments/faculty
 * Retrieves all assignments created by or assigned to the authenticated faculty member.
 */
const getFacultyAssignments = asyncHandler(async (req, res) => {
  const { status, subjectId } = req.query;
  const filter = { faculty: req.user.userId };

  if (status && status !== 'all') filter.status = status;
  if (subjectId) filter.subject = subjectId;

  const assignments = await Assignment.find(filter)
    .populate('subject', 'name code branch semester')
    .sort({ createdAt: -1 })
    .lean();

  // Populate submission progress counts for each assignment
  const assignmentsWithStats = await Promise.all(
    assignments.map(async (assign) => {
      const studentQuery = {
        branch: assign.department,
        semester: assign.semester,
      };
      if (assign.section && assign.section !== 'All') {
        studentQuery.section = assign.section;
      }

      const expectedCount = await Student.countDocuments(studentQuery);
      const submissions = await Submission.find({ assignment: assign._id }, 'status isLate marksAwarded isResultPublished').lean();

      const submittedCount = submissions.length;
      const lateCount = submissions.filter((s) => s.isLate).length;
      const evaluatedCount = submissions.filter((s) => s.status === 'evaluated' || s.marksAwarded !== null).length;
      const pendingCount = Math.max(0, expectedCount - submittedCount);

      return {
        ...assign,
        stats: {
          expectedCount,
          submittedCount,
          pendingCount,
          lateCount,
          evaluatedCount,
        },
      };
    })
  );

  return res.status(200).json({
    success: true,
    data: assignmentsWithStats,
    message: 'Faculty assignments retrieved',
  });
});

/**
 * GET /api/assignments/faculty/dashboard
 * Aggregated analytics for the faculty assignment management overview dashboard.
 */
const getFacultyAssignmentDashboard = asyncHandler(async (req, res) => {
  const facultyUserId = req.user.userId;

  const assignments = await Assignment.find({ faculty: facultyUserId }).lean();
  const now = new Date();

  const totalAssignments = assignments.length;
  const publishedAssignments = assignments.filter((a) => a.status === 'published').length;
  const draftAssignments = assignments.filter((a) => a.status === 'draft').length;
  const activeAssignments = assignments.filter((a) => a.status === 'published' && new Date(a.dueDate) > now).length;
  const closedAssignments = assignments.filter((a) => a.status === 'closed' || (a.status === 'published' && new Date(a.dueDate) <= now)).length;

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = await Submission.find({ assignment: { $in: assignmentIds } }, 'status isLate marksAwarded isResultPublished').lean();

  const totalSubmissionsReceived = submissions.length;
  const totalLateSubmissions = submissions.filter((s) => s.isLate).length;
  const totalEvaluated = submissions.filter((s) => s.status === 'evaluated' || s.marksAwarded !== null).length;
  const pendingEvaluations = Math.max(0, totalSubmissionsReceived - totalEvaluated);

  return res.status(200).json({
    success: true,
    data: {
      totalAssignments,
      publishedAssignments,
      draftAssignments,
      activeAssignments,
      closedAssignments,
      totalSubmissionsReceived,
      totalLateSubmissions,
      totalEvaluated,
      pendingEvaluations,
    },
    message: 'Faculty assignment dashboard metrics loaded',
  });
});

/**
 * GET /api/assignments/faculty/subjects
 * Retrieve subjects taught by the authenticated faculty member for assignment creation.
 */
const getFacultyTaughtSubjects = asyncHandler(async (req, res) => {
  const facultyProfile = await Faculty.findOne({ user: req.user.userId });
  const facultyIds = [req.user.userId];
  if (facultyProfile) facultyIds.push(facultyProfile._id);

  const subjects = await Subject.find({
    $or: [{ faculty: { $in: facultyIds } }, { branch: facultyProfile?.department || 'CSE' }],
  }).select('name code semester branch credits');

  return res.status(200).json({
    success: true,
    data: subjects,
    message: 'Faculty subjects loaded',
  });
});

/**
 * GET /api/assignments/:id
 * Retrieve assignment details by ID with strict role-based scoping.
 */
const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('subject', 'name code branch semester')
    .populate('faculty', 'name email');

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found');
  }

  // Admin and creator faculty can view any status
  if (req.user.role === 'admin' || String(assignment.faculty._id || assignment.faculty) === String(req.user.userId)) {
    return res.status(200).json({ success: true, data: assignment, message: 'Assignment details' });
  }

  // Students can only view published or closed assignments matching their class
  if (req.user.role === 'student') {
    if (assignment.status === 'draft') {
      throw new ApiError(404, 'Assignment not found');
    }

    const student = await Student.findOne({ user: req.user.userId });
    if (!student) throw new ApiError(404, 'Student profile not found');

    const branchMatch = !assignment.department || assignment.department === student.branch;
    const semMatch = assignment.semester === student.semester;
    const secMatch = !assignment.section || assignment.section === 'All' || assignment.section === student.section;

    if (!branchMatch || !semMatch || !secMatch) {
      throw new ApiError(403, 'Access denied: Assignment outside your enrolled class');
    }

    return res.status(200).json({ success: true, data: assignment, message: 'Assignment details' });
  }

  throw new ApiError(403, 'Access denied');
});

/**
 * PATCH /api/assignments/:id
 * Update assignment details (Creator faculty or Admin).
 */
const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to edit this assignment');
  }

  const { title, description, maximumMarks, dueDate, latePolicy, gracePeriodMinutes, section } = req.body;

  if (title) assignment.title = title.trim();
  if (description) assignment.description = description.trim();
  if (maximumMarks) assignment.maximumMarks = Math.max(1, Number(maximumMarks));
  if (dueDate) assignment.dueDate = new Date(dueDate);
  if (latePolicy) assignment.latePolicy = latePolicy;
  if (gracePeriodMinutes !== undefined) assignment.gracePeriodMinutes = Math.max(0, Number(gracePeriodMinutes));
  if (section) assignment.section = section.trim();

  // Attach any newly uploaded files
  if (req.files && req.files.length > 0) {
    const newAttachments = req.files.map((file) => ({
      name: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
    }));
    assignment.attachments.push(...newAttachments);
  }

  await assignment.save();

  return res.status(200).json({ success: true, data: assignment, message: 'Assignment updated successfully' });
});

/**
 * POST /api/assignments/:id/publish
 * Transitions draft assignment to published and dispatches notifications.
 */
const publishAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to publish this assignment');
  }

  if (assignment.status === 'published') {
    return res.status(200).json({ success: true, data: assignment, message: 'Assignment is already published' });
  }

  assignment.status = 'published';
  assignment.publishedAt = new Date();
  await assignment.save();

  const subjectDoc = await Subject.findById(assignment.subject);
  await dispatchAssignmentPublishedNotifications(assignment, subjectDoc || {}, req.user);

  return res.status(200).json({ success: true, data: assignment, message: 'Assignment published successfully' });
});

/**
 * POST /api/assignments/:id/close
 * Closes an assignment to prevent further submissions.
 */
const closeAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to close this assignment');
  }

  assignment.status = 'closed';
  assignment.closedAt = new Date();
  await assignment.save();

  return res.status(200).json({ success: true, data: assignment, message: 'Assignment closed successfully' });
});

/**
 * GET /api/assignments/:id/submissions
 * Faculty retrieval of student submissions for a specific assignment.
 */
const getAssignmentSubmissions = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to view submissions for this assignment');
  }

  const { status } = req.query;
  const filter = { assignment: assignment._id };
  if (status && status !== 'all') filter.status = status;

  const submissions = await Submission.find(filter)
    .populate('student', 'fullName rollNumber branch semester section')
    .sort({ submittedAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: submissions,
    assignment: {
      _id: assignment._id,
      title: assignment.title,
      maximumMarks: assignment.maximumMarks,
      dueDate: assignment.dueDate,
    },
    message: 'Submissions retrieved successfully',
  });
});

/**
 * POST /api/submissions/:id/evaluate
 * Faculty records marks and feedback for an individual submission.
 */
const evaluateSubmission = asyncHandler(async (req, res) => {
  const { marksAwarded, feedback = '' } = req.body;

  if (marksAwarded === undefined || marksAwarded === null || marksAwarded === '') {
    throw new ApiError(400, 'Marks awarded are required');
  }

  const marksNum = Number(marksAwarded);
  if (isNaN(marksNum) || marksNum < 0) {
    throw new ApiError(400, 'Marks awarded cannot be negative');
  }

  const submissionId = req.params.submissionId || req.params.id;
  const submission = await Submission.findById(submissionId).populate('assignment');
  if (!submission) throw new ApiError(404, 'Submission not found');

  const assignment = submission.assignment;
  if (!assignment) throw new ApiError(404, 'Associated assignment not found');

  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to evaluate this submission');
  }

  if (marksNum > assignment.maximumMarks) {
    throw new ApiError(400, `Marks awarded (${marksNum}) cannot exceed maximum marks (${assignment.maximumMarks})`);
  }

  submission.marksAwarded = marksNum;
  submission.maxMarksSnapshot = assignment.maximumMarks;
  submission.feedback = feedback.trim();
  submission.status = 'evaluated';
  submission.evaluatedBy = req.user.userId;
  submission.evaluatedAt = new Date();

  await submission.save();

  return res.status(200).json({
    success: true,
    data: submission,
    message: 'Submission evaluated successfully',
  });
});

/**
 * POST /api/submissions/:id/publish-result
 * Publishes evaluation results for a submission so the student can view marks & feedback.
 */
const publishSubmissionResult = asyncHandler(async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;
  const submission = await Submission.findById(submissionId).populate('assignment');
  if (!submission) throw new ApiError(404, 'Submission not found');

  const assignment = submission.assignment;
  if (req.user.role !== 'admin' && String(assignment.faculty) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to publish results for this submission');
  }

  if (submission.marksAwarded === null) {
    throw new ApiError(400, 'Cannot publish result before evaluating the submission');
  }

  submission.isResultPublished = true;
  submission.resultPublishedAt = new Date();
  await submission.save();

  // Notify the student
  try {
    await notificationService.createNotification({
      recipient: submission.studentUser,
      title: `Assignment Graded: ${assignment.title}`,
      message: `Your submission for '${assignment.title}' was evaluated: ${submission.marksAwarded} / ${submission.maxMarksSnapshot} marks.`,
      category: 'assignment',
      priority: 'normal',
      relatedEntityType: 'Submission',
      relatedEntityId: submission._id,
      targetRoute: '/student/assignments',
      actor: req.user.userId,
      actorName: req.user.name || 'Faculty',
      actorRole: req.user.role,
      eventId: `assign_eval_${submission._id}_${Date.now()}`,
    });
  } catch (err) {
    // Non-blocking notification failure
  }

  return res.status(200).json({
    success: true,
    data: submission,
    message: 'Evaluation result published to student successfully',
  });
});

// ── 2. STUDENT ASSIGNMENT EXPERIENCE ─────────────────────────────────────────

/**
 * GET /api/assignments/student
 * Student view of all assignments published for their enrolled branch and semester.
 */
const getStudentAssignments = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const { status } = req.query; // 'all', 'pending', 'submitted', 'evaluated'

  const assignmentQuery = {
    department: student.branch,
    semester: student.semester,
    status: { $in: ['published', 'closed'] },
    $or: [{ section: 'All' }, { section: student.section }, { section: '' }, { section: null }],
  };

  const assignments = await Assignment.find(assignmentQuery)
    .populate('subject', 'name code branch semester')
    .populate('faculty', 'name email')
    .sort({ dueDate: 1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = await Submission.find({
    assignment: { $in: assignmentIds },
    student: student._id,
  }).lean();

  const subMap = new Map();
  for (const s of submissions) {
    subMap.set(String(s.assignment), s);
  }

  const now = new Date();

  let results = assignments.map((assign) => {
    const sub = subMap.get(String(assign._id));
    const isSubmitted = Boolean(sub);
    const isPastDue = now > new Date(assign.dueDate);

    // If evaluated but results not published, hide marks from student
    let studentMarks = null;
    let studentFeedback = null;
    if (sub && sub.isResultPublished) {
      studentMarks = sub.marksAwarded;
      studentFeedback = sub.feedback;
    }

    return {
      _id: assign._id,
      title: assign.title,
      description: assign.description,
      subject: assign.subject,
      faculty: assign.faculty,
      maximumMarks: assign.maximumMarks,
      assignmentType: assign.assignmentType,
      dueDate: assign.dueDate,
      latePolicy: assign.latePolicy,
      attachmentsCount: (assign.attachments || []).length,
      status: assign.status,
      submission: sub
        ? {
            _id: sub._id,
            version: sub.version,
            submittedAt: sub.submittedAt,
            isLate: sub.isLate,
            status: sub.status,
            marksAwarded: studentMarks,
            maxMarksSnapshot: sub.maxMarksSnapshot,
            feedback: studentFeedback,
            isResultPublished: sub.isResultPublished,
            filesCount: (sub.submissionFiles || []).length,
          }
        : null,
      isSubmitted,
      isPastDue,
    };
  });

  // Client-side category filtering
  if (status === 'pending') {
    results = results.filter((a) => !a.isSubmitted);
  } else if (status === 'submitted') {
    results = results.filter((a) => a.isSubmitted && !a.submission?.isResultPublished);
  } else if (status === 'evaluated') {
    results = results.filter((a) => a.submission && a.submission.isResultPublished);
  } else if (status === 'late') {
    results = results.filter((a) => a.submission && a.submission.isLate);
  }

  return res.status(200).json({
    success: true,
    data: results,
    message: 'Student assignments retrieved',
  });
});

/**
 * GET /api/assignments/student/:id
 * Detailed assignment view for an enrolled student including their submission history.
 */
const getStudentAssignmentDetails = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const assignment = await Assignment.findById(req.params.id)
    .populate('subject', 'name code branch semester')
    .populate('faculty', 'name email');

  if (!assignment || assignment.status === 'draft') {
    throw new ApiError(404, 'Assignment not found');
  }

  const branchMatch = !assignment.department || assignment.department === student.branch;
  const semMatch = assignment.semester === student.semester;
  if (!branchMatch || !semMatch) {
    throw new ApiError(403, 'Access denied: Assignment outside your enrolled class');
  }

  const submission = await Submission.findOne({
    assignment: assignment._id,
    student: student._id,
  }).lean();

  let sanitizedSubmission = null;
  if (submission) {
    sanitizedSubmission = {
      ...submission,
      // Hide marks and feedback if results are not yet published
      marksAwarded: submission.isResultPublished ? submission.marksAwarded : null,
      feedback: submission.isResultPublished ? submission.feedback : null,
    };
  }

  return res.status(200).json({
    success: true,
    data: {
      assignment,
      submission: sanitizedSubmission,
    },
    message: 'Assignment details loaded',
  });
});

/**
 * POST /api/assignments/:id/submit
 * Student uploads work and submits assignment (with versioned resubmission protection).
 */
const submitAssignment = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user.userId });
  if (!student) throw new ApiError(404, 'Student profile not found');

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || assignment.status === 'draft') {
    throw new ApiError(404, 'Assignment not found');
  }

  if (assignment.status === 'closed' || assignment.status === 'archived') {
    throw new ApiError(400, 'Assignment is closed. Submissions are no longer accepted.');
  }

  // Verify student is enrolled in this subject's class
  const branchMatch = !assignment.department || assignment.department === student.branch;
  const semMatch = assignment.semester === student.semester;
  if (!branchMatch || !semMatch) {
    throw new ApiError(403, 'Access denied: You are not enrolled in this subject');
  }

  // Server-authoritative deadline evaluation (Phase G)
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const isPastDue = now > dueDate;

  if (isPastDue) {
    if (assignment.latePolicy === 'none') {
      throw new ApiError(400, 'Deadline has passed. Late submissions are not permitted for this assignment.');
    }
    if (assignment.latePolicy === 'grace_period') {
      const graceMs = (assignment.gracePeriodMinutes || 0) * 60 * 1000;
      if (now.getTime() > dueDate.getTime() + graceMs) {
        throw new ApiError(400, 'Grace period has expired. Submissions are closed.');
      }
    }
  }

  const { textResponse = '' } = req.body;
  const uploadedFiles = req.files || [];

  if (uploadedFiles.length === 0 && !textResponse.trim()) {
    throw new ApiError(400, 'Submission must contain at least one file or a written text response');
  }

  const submissionFiles = uploadedFiles.map((file) => ({
    name: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: now,
  }));

  const isLate = isPastDue;
  const submissionStatus = isLate ? 'late' : 'submitted';

  // Atomic / idempotent upsert preserving previous submission history
  let existing = await Submission.findOne({
    assignment: assignment._id,
    student: student._id,
  });

  const isNewSubmission = !existing;
  let submission;
  if (existing) {
    // Preserve current version in history
    existing.previousVersions.push({
      version: existing.version,
      submissionFiles: existing.submissionFiles,
      textResponse: existing.textResponse,
      submittedAt: existing.submittedAt,
      isLate: existing.isLate,
    });

    existing.version += 1;
    existing.submissionFiles = submissionFiles;
    existing.textResponse = textResponse.trim();
    existing.submittedAt = now;
    existing.isLate = isLate;
    existing.status = submissionStatus;
    existing.marksAwarded = null; // Reset evaluation on resubmission
    existing.isResultPublished = false;

    await existing.save();
    submission = existing;
  } else {
    submission = await Submission.create({
      assignment: assignment._id,
      student: student._id,
      studentUser: req.user.userId,
      submissionFiles,
      textResponse: textResponse.trim(),
      submittedAt: now,
      version: 1,
      isLate,
      status: submissionStatus,
      maxMarksSnapshot: assignment.maximumMarks,
    });
  }

  // Confirmation notification to student
  try {
    await notificationService.createNotification({
      recipient: req.user.userId,
      title: `Assignment Submitted: ${assignment.title}`,
      message: `Your submission (v${submission.version}) was recorded on ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.${isLate ? ' [LATE]' : ''}`,
      category: 'assignment',
      priority: 'normal',
      relatedEntityType: 'Submission',
      relatedEntityId: submission._id,
      targetRoute: '/student/assignments',
      actor: req.user.userId,
      actorName: student.fullName,
      actorRole: 'student',
      eventId: `sub_conf_${submission._id}_v${submission.version}`,
    });

    // Alert assigned faculty member
    await notificationService.createNotification({
      recipient: assignment.faculty,
      title: `Submission Received: ${student.fullName}`,
      message: `${student.fullName} submitted work for '${assignment.title}' (v${submission.version})${isLate ? ' [LATE]' : ''}.`,
      category: 'assignment',
      priority: 'normal',
      relatedEntityType: 'Submission',
      relatedEntityId: submission._id,
      targetRoute: `/faculty/assignments/${assignment._id}/submissions`,
      actor: req.user.userId,
      actorName: student.fullName,
      actorRole: 'student',
      eventId: `sub_fac_${submission._id}_v${submission.version}`,
    });
  } catch (err) {
    // Non-blocking notification delivery
  }

  return res.status(isNewSubmission ? 201 : 200).json({
    success: true,
    data: submission,
    message: isLate ? 'Late assignment submission recorded' : 'Assignment submitted successfully',
  });
});

// ── 3. SECURE FILE DOWNLOAD CONTROLLERS ───────────────────────────────────────

/**
 * GET /api/assignments/:assignmentId/attachments/:attachmentId
 * Authoritative download of an assignment's supporting attachment.
 */
const downloadAssignmentAttachment = asyncHandler(async (req, res) => {
  const assignmentId = req.params.assignmentId || req.params.id;
  const attachmentId = req.params.attachmentId || req.params.fileId;
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const attachment = assignment.attachments.id(attachmentId);
  if (!attachment) throw new ApiError(404, 'Attachment not found');

  // Authorization check: Admin, Creator faculty, or Enrolled Student
  if (req.user.role === 'student') {
    const student = await Student.findOne({ user: req.user.userId });
    if (!student) throw new ApiError(403, 'Student record not found');

    const branchMatch = !assignment.department || assignment.department === student.branch;
    const semMatch = assignment.semester === student.semester;
    if (!branchMatch || !semMatch) {
      throw new ApiError(403, 'Access denied: You are not authorized to download this file');
    }
  }

  const safePath = verifySafePath(attachment.path);
  if (!fs.existsSync(safePath)) {
    throw new ApiError(404, 'File not found on server');
  }

  return res.download(safePath, attachment.name);
});

/**
 * GET /api/submissions/:submissionId/files/:fileId
 * Authoritative download of a student's private submission file.
 */
const downloadSubmissionFile = asyncHandler(async (req, res) => {
  const submissionId = req.params.submissionId || req.params.id;
  const fileId = req.params.fileId || req.params.attachmentId;
  const submission = await Submission.findById(submissionId).populate('assignment');
  if (!submission) throw new ApiError(404, 'Submission not found');

  const fileDoc = submission.submissionFiles.id(fileId);
  if (!fileDoc) throw new ApiError(404, 'Submission file not found');

  // Authorization check: Admin, Creator faculty, or the Submitting student
  const isOwnerStudent = String(submission.studentUser) === String(req.user.userId);
  const isAssignedFaculty = String(submission.assignment?.faculty) === String(req.user.userId);
  const isAdmin = req.user.role === 'admin';

  if (!isOwnerStudent && !isAssignedFaculty && !isAdmin) {
    throw new ApiError(403, 'Access denied: You are not authorized to download this submission');
  }

  const safePath = verifySafePath(fileDoc.path);
  if (!fs.existsSync(safePath)) {
    throw new ApiError(404, 'File not found on server');
  }

  return res.download(safePath, fileDoc.name);
});

// ── 4. ADMIN OVERSIGHT ───────────────────────────────────────────────────────

/**
 * GET /api/assignments/admin/overview
 * Institutional assignment analytics for administrators.
 */
const getAdminAssignmentOverview = asyncHandler(async (req, res) => {
  const { department, semester } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (semester) filter.semester = Number(semester);

  const totalAssignments = await Assignment.countDocuments(filter);
  const publishedAssignments = await Assignment.countDocuments({ ...filter, status: 'published' });
  const draftAssignments = await Assignment.countDocuments({ ...filter, status: 'draft' });
  const closedAssignments = await Assignment.countDocuments({ ...filter, status: 'closed' });

  // Compute submission statistics for admin oversight
  const targetAssignments = await Assignment.find(filter, '_id');
  const targetAssignmentIds = targetAssignments.map((a) => a._id);
  const subFilter = targetAssignmentIds.length ? { assignment: { $in: targetAssignmentIds } } : {};
  const totalSubmissions = await Submission.countDocuments(subFilter);
  const evaluatedSubmissions = await Submission.countDocuments({
    ...subFilter,
    $or: [{ status: 'evaluated' }, { marksAwarded: { $ne: null } }],
  });

  return res.status(200).json({
    success: true,
    data: {
      totalAssignments,
      publishedAssignments,
      draftAssignments,
      closedAssignments,
      totalSubmissions,
      evaluatedSubmissions,
    },
    message: 'Admin assignment overview retrieved',
  });
});

module.exports = {
  createAssignment,
  getFacultyAssignments,
  getFacultyAssignmentDashboard,
  getFacultyTaughtSubjects,
  getAssignmentById,
  updateAssignment,
  publishAssignment,
  closeAssignment,
  getAssignmentSubmissions,
  evaluateSubmission,
  publishSubmissionResult,
  getStudentAssignments,
  getStudentAssignmentDetails,
  submitAssignment,
  downloadAssignmentAttachment,
  downloadSubmissionFile,
  getAdminAssignmentOverview,
};
