/**
 * server/controllers/student.controller.js
 */
'use strict';

const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');
const Fee = require('../models/Fee');
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

module.exports = { getProfile, getAnnouncements, raiseComplaint, getMyComplaints, getFees };
