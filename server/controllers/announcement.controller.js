/**
 * server/controllers/announcement.controller.js
 * Centralized Announcement Management with Audience Targeting & Automated Notification Delivery.
 */
'use strict';

const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Helper to resolve target recipient user IDs based on announcement audience rules.
 */
async function resolveAudienceRecipients(announcement) {
  const { audience, targetBranches = [], targetSemesters = [] } = announcement;
  let targetUserIds = [];

  if (audience === 'all') {
    const users = await User.find({ isActive: true }, '_id').lean();
    return users.map((u) => u._id);
  }

  if (audience === 'faculty') {
    const users = await User.find({ role: 'faculty', isActive: true }, '_id').lean();
    return users.map((u) => u._id);
  }

  if (audience === 'student' || audience === 'department' || audience === 'semester') {
    const studentQuery = {};

    if (targetBranches && targetBranches.length > 0) {
      studentQuery.branch = { $in: targetBranches };
    }
    if (targetSemesters && targetSemesters.length > 0) {
      studentQuery.semester = { $in: targetSemesters };
    }

    const students = await Student.find(studentQuery, 'user').lean();
    targetUserIds = students.map((s) => s.user).filter(Boolean);

    // If department was selected, also include faculty from those departments
    if (audience === 'department' && targetBranches && targetBranches.length > 0) {
      const faculties = await Faculty.find({ department: { $in: targetBranches } }, 'user').lean();
      targetUserIds.push(...faculties.map((f) => f.user).filter(Boolean));
    }

    return targetUserIds;
  }

  return targetUserIds;
}

/**
 * GET /api/announcements
 * Returns announcements tailored strictly to the authenticated user's audience scope.
 */
const getVisibleAnnouncements = asyncHandler(async (req, res) => {
  const { role, userId } = req.user;
  const now = new Date();

  const baseFilter = {
    status: 'published',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };

  if (role === 'admin') {
    // Admins see all published announcements
    const announcements = await Announcement.find(baseFilter)
      .populate('createdBy', 'name role')
      .sort({ priority: -1, publishedAt: -1 });

    return res.status(200).json({ success: true, data: announcements, message: 'Announcements loaded' });
  }

  if (role === 'student') {
    const student = await Student.findOne({ user: userId }).lean();
    const branch = student?.branch || '';
    const semester = student?.semester || 1;

    const studentAudienceConditions = [
      { audience: 'all' },
    ];

    if (branch) {
      studentAudienceConditions.push({ audience: 'department', targetBranches: branch });
    }

    if (semester) {
      studentAudienceConditions.push({ audience: 'semester', targetSemesters: semester });
    }

    // For audience: 'student', student must satisfy both branch and semester if specified
    const studentBranchCondition = branch
      ? { $or: [{ targetBranches: { $size: 0 } }, { targetBranches: branch }] }
      : { targetBranches: { $size: 0 } };

    const studentSemesterCondition = semester
      ? { $or: [{ targetSemesters: { $size: 0 } }, { targetSemesters: semester }] }
      : { targetSemesters: { $size: 0 } };

    studentAudienceConditions.push({
      audience: 'student',
      $and: [studentBranchCondition, studentSemesterCondition],
    });

    const query = {
      status: 'published',
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: studentAudienceConditions },
      ],
    };

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name role')
      .sort({ priority: -1, publishedAt: -1 });

    return res.status(200).json({ success: true, data: announcements, message: 'Announcements loaded' });
  }

  if (role === 'faculty') {
    const faculty = await Faculty.findOne({ user: userId }).lean();
    const department = faculty?.department || '';

    const audienceConditions = [
      { audience: 'all' },
      { audience: 'faculty' },
    ];

    if (department) {
      audienceConditions.push({ audience: 'department', targetBranches: department });
    }

    const query = {
      status: 'published',
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: audienceConditions },
      ],
    };

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name role')
      .sort({ priority: -1, publishedAt: -1 });

    return res.status(200).json({ success: true, data: announcements, message: 'Announcements loaded' });
  }

  return res.status(200).json({ success: true, data: [], message: 'No announcements' });
});

/**
 * GET /api/announcements/:id
 * Retrieves one authorized announcement by ID with strict audience & status scoping.
 */
const getAnnouncementById = asyncHandler(async (req, res) => {
  const { role, userId } = req.user;
  const ann = await Announcement.findById(req.params.id).populate('createdBy', 'name role');
  if (!ann) throw new ApiError(404, 'Announcement not found');

  // Admin has access to all announcements
  if (role === 'admin') {
    return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
  }

  // Original author has access to their own announcements (even drafts)
  const isAuthor = String(ann.createdBy?._id || ann.createdBy) === String(userId);
  if (isAuthor) {
    return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
  }

  // Non-authors cannot view draft or archived announcements
  if (ann.status !== 'published') {
    throw new ApiError(404, 'Announcement not found');
  }

  // Check expiration for non-admin/non-author
  if (ann.expiresAt && new Date(ann.expiresAt) <= new Date()) {
    throw new ApiError(404, 'Announcement has expired');
  }

  // Faculty audience check
  if (role === 'faculty') {
    if (ann.audience === 'all' || ann.audience === 'faculty') {
      return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
    }
    if (ann.audience === 'department') {
      const faculty = await Faculty.findOne({ user: userId }).lean();
      if (faculty?.department && ann.targetBranches.includes(faculty.department)) {
        return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
      }
    }
    throw new ApiError(403, 'Access denied: Announcement outside your audience');
  }

  // Student audience check
  if (role === 'student') {
    if (ann.audience === 'all') {
      return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
    }
    const student = await Student.findOne({ user: userId }).lean();
    const branch = student?.branch || '';
    const semester = student?.semester || 1;

    if (ann.audience === 'department' && branch && ann.targetBranches.includes(branch)) {
      return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
    }
    if (ann.audience === 'semester' && semester && ann.targetSemesters.includes(semester)) {
      return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
    }
    if (ann.audience === 'student') {
      const branchOk = ann.targetBranches.length === 0 || (branch && ann.targetBranches.includes(branch));
      const semesterOk = ann.targetSemesters.length === 0 || (semester && ann.targetSemesters.includes(semester));
      if (branchOk && semesterOk) {
        return res.status(200).json({ success: true, data: ann, message: 'Announcement details' });
      }
    }
    throw new ApiError(403, 'Access denied: Announcement outside your audience');
  }

  throw new ApiError(403, 'Access denied');
});

/**
 * POST /api/announcements
 * Admin or Faculty creation of an announcement with optional audience targeting.
 */
const createAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    body,
    content,
    audience = 'all',
    category = 'general',
    priority = 'normal',
    targetBranches = [],
    targetSemesters = [],
    status = 'published',
    expiresAt = null,
  } = req.body;

  const announcementBody = body || content;
  if (!title || !announcementBody) {
    throw new ApiError(400, 'Title and body/content are required');
  }

  const allowedAudiences = ['all', 'student', 'faculty', 'department', 'semester'];
  if (!allowedAudiences.includes(audience)) {
    throw new ApiError(400, `Invalid audience: '${audience}'. Permitted: [${allowedAudiences.join(', ')}]`);
  }

  // Non-admins cannot publish faculty-wide announcements
  const userRole = req.user.role;
  if (userRole !== 'admin' && audience === 'faculty') {
    throw new ApiError(403, 'Faculty cannot publish faculty-wide announcements');
  }

  const ann = await Announcement.create({
    title,
    body: announcementBody,
    audience,
    category,
    priority,
    targetBranches: Array.isArray(targetBranches) ? targetBranches : [],
    targetSemesters: Array.isArray(targetSemesters) ? targetSemesters.map(Number) : [],
    status,
    createdBy: req.user.userId,
    authorName: req.user.name || 'CampusSphere',
    authorRole: userRole,
    publishedAt: status === 'published' ? new Date() : null,
    expiresAt,
  });

  // If immediately published, deliver notifications to targeted audience
  if (status === 'published') {
    const recipients = await resolveAudienceRecipients(ann);
    if (recipients.length > 0) {
      await notificationService.createBulkNotifications({
        recipients,
        title: `Announcement: ${ann.title}`,
        message: ann.body.length > 140 ? `${ann.body.slice(0, 137)}...` : ann.body,
        category: 'announcement',
        priority: ann.priority,
        relatedEntityType: 'Announcement',
        relatedEntityId: ann._id,
        targetRoute: '/student/dashboard',
        actor: req.user.userId,
        actorName: req.user.name,
        actorRole: userRole,
        eventIdPrefix: `ann_${ann._id}`,
      });
    }
  }

  return res.status(201).json({
    success: true,
    data: ann,
    message: status === 'published' ? 'Announcement published successfully' : 'Draft saved',
  });
});

/**
 * PATCH /api/announcements/:id
 * Update an announcement (Admin or original author).
 */
const updateAnnouncement = asyncHandler(async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) throw new ApiError(404, 'Announcement not found');

  if (req.user.role !== 'admin' && String(ann.createdBy) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to edit this announcement');
  }

  const { title, body, content, audience, category, priority, targetBranches, targetSemesters, expiresAt } = req.body;

  if (title) ann.title = title;
  if (body || content) ann.body = body || content;
  if (audience) {
    const allowedAudiences = ['all', 'student', 'faculty', 'department', 'semester'];
    if (!allowedAudiences.includes(audience)) {
      throw new ApiError(400, `Invalid audience: '${audience}'`);
    }
    if (req.user.role !== 'admin' && audience === 'faculty') {
      throw new ApiError(403, 'Faculty cannot set audience to faculty broadcast');
    }
    ann.audience = audience;
  }
  if (category) ann.category = category;
  if (priority) ann.priority = priority;
  if (targetBranches) ann.targetBranches = targetBranches;
  if (targetSemesters) ann.targetSemesters = targetSemesters;
  if (expiresAt !== undefined) ann.expiresAt = expiresAt;

  await ann.save();

  return res.status(200).json({ success: true, data: ann, message: 'Announcement updated' });
});

/**
 * POST /api/announcements/:id/publish
 * Transition draft announcement to published and dispatch audience notifications.
 */
const publishAnnouncement = asyncHandler(async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) throw new ApiError(404, 'Announcement not found');

  if (req.user.role !== 'admin' && String(ann.createdBy) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to publish this announcement');
  }

  // Idempotency: if already published, do not re-dispatch bulk notifications
  if (ann.status === 'published') {
    return res.status(200).json({ success: true, data: ann, message: 'Announcement is already published' });
  }

  ann.status = 'published';
  ann.publishedAt = new Date();
  await ann.save();

  // Dispatch notifications
  const recipients = await resolveAudienceRecipients(ann);
  if (recipients.length > 0) {
    await notificationService.createBulkNotifications({
      recipients,
      title: `Announcement: ${ann.title}`,
      message: ann.body.length > 140 ? `${ann.body.slice(0, 137)}...` : ann.body,
      category: 'announcement',
      priority: ann.priority,
      relatedEntityType: 'Announcement',
      relatedEntityId: ann._id,
      targetRoute: '/student/dashboard',
      actor: req.user.userId,
      actorName: req.user.name,
      actorRole: req.user.role,
      eventIdPrefix: `ann_${ann._id}`,
    });
  }

  return res.status(200).json({ success: true, data: ann, message: 'Announcement published successfully' });
});

/**
 * POST /api/announcements/:id/archive
 * Archive an announcement so it is no longer shown in active feeds.
 */
const archiveAnnouncement = asyncHandler(async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) throw new ApiError(404, 'Announcement not found');

  if (req.user.role !== 'admin' && String(ann.createdBy) !== String(req.user.userId)) {
    throw new ApiError(403, 'Not authorized to archive this announcement');
  }

  ann.status = 'archived';
  await ann.save();

  return res.status(200).json({ success: true, data: ann, message: 'Announcement archived' });
});

/**
 * GET /api/announcements/admin/all
 * Administrative view of all announcements (drafts, published, archived) with pagination.
 */
const getAdminAnnouncements = asyncHandler(async (req, res) => {
  const { status, category, priority, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (status && status !== 'all') filter.status = status;
  if (category && category !== 'all') filter.category = category;
  if (priority && priority !== 'all') filter.priority = priority;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Announcement.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: announcements,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
    message: 'All announcements retrieved',
  });
});

module.exports = {
  getVisibleAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  getAdminAnnouncements,
};

