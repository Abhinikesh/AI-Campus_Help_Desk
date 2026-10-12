/**
 * server/controllers/faculty.controller.js
 */
'use strict';

const Faculty = require('../models/Faculty');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/faculty/profile
const getProfile = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findOne({ user: req.user.userId })
    .populate('user', 'name email loginId');
  if (!faculty) throw new ApiError(404, 'Faculty profile not found');

  return res.status(200).json({ success: true, data: faculty, message: 'OK' });
});

// POST /api/faculty/announcements
const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, audience } = req.body;
  if (!title || !body) {
    throw new ApiError(400, 'Title and body are required');
  }

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

// GET /api/faculty/students — list students for faculty to view
const getStudents = asyncHandler(async (req, res) => {
  const { branch, semester } = req.query;
  const filter = {};
  if (branch) filter.branch = branch;
  if (semester) filter.semester = Number(semester);

  const students = await Student.find(filter)
    .populate('user', 'name email loginId')
    .sort({ rollNumber: 1 });

  return res.status(200).json({ success: true, data: students, message: 'OK' });
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

module.exports = { getProfile, createAnnouncement, getAnnouncements, getStudents, raiseComplaint };
