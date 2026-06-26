const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');

// GET /api/student/profile
const getProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId }).populate('userId', 'name email rollNumber');
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    console.log(`✅ Student profile fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    console.error('❌ getProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/attendance
const getAttendance = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    console.log(`✅ Attendance fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: student.attendance });
  } catch (err) {
    console.error('❌ getAttendance error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/results
const getResults = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    console.log(`✅ Results fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: student.results });
  } catch (err) {
    console.error('❌ getResults error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/fees
const getFees = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    console.log(`✅ Fees fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: student.fees });
  } catch (err) {
    console.error('❌ getFees error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/announcements
const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ targetRoles: 'student' }).sort({ date: -1 });
    console.log(`✅ Announcements fetched for student`);
    res.status(200).json({ success: true, data: announcements });
  } catch (err) {
    console.error('❌ getAnnouncements error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/student/complaints
const raiseComplaint = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !description || !category) {
      return res.status(400).json({ success: false, message: 'All complaint fields are required' });
    }

    const complaint = await Complaint.create({
      raisedBy: req.user.userId,
      role: req.user.role,
      title,
      description,
      category,
    });

    console.log(`✅ Complaint raised by userId: ${req.user.userId}`);
    res.status(201).json({ success: true, message: 'Complaint submitted successfully', data: complaint });
  } catch (err) {
    console.error('❌ raiseComplaint error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/complaints
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ raisedBy: req.user.userId }).sort({ createdAt: -1 });
    console.log(`✅ Complaints fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: complaints });
  } catch (err) {
    console.error('❌ getMyComplaints error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/student/exams
const getExams = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    console.log(`✅ Exams fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: student.exams });
  } catch (err) {
    console.error('❌ getExams error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getProfile, getAttendance, getResults, getExams, getFees, getAnnouncements, raiseComplaint, getMyComplaints };
