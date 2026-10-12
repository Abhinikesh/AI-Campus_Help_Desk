/**
 * server/controllers/admin.controller.js
 */
'use strict';

const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
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

module.exports = {
  getStats,
  getAllUsers,
  deactivateUser,
  activateUser,
  getAllComplaints,
  updateComplaintStatus,
  createAnnouncement,
  getAllAnnouncements,
};
