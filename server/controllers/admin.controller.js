const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const totalUsers       = await User.countDocuments();
    const totalStudents    = await User.countDocuments({ role: 'student' });
    const totalFaculty     = await User.countDocuments({ role: 'faculty' });
    const totalComplaints  = await Complaint.countDocuments();
    const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });
    const resolvedComplaints = await Complaint.countDocuments({ status: 'resolved' });

    console.log('✅ Admin stats fetched');
    res.status(200).json({
      success: true,
      data: { totalUsers, totalStudents, totalFaculty, totalComplaints, pendingComplaints, resolvedComplaints },
    });
  } catch (err) {
    console.error('❌ getStats error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    console.log('✅ All users fetched by admin');
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error('❌ getAllUsers error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/complaints
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('raisedBy', 'name email role')
      .sort({ createdAt: -1 });
    console.log('✅ All complaints fetched by admin');
    res.status(200).json({ success: true, data: complaints });
  } catch (err) {
    console.error('❌ getAllComplaints error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/complaints/:id/status
const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in-progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const update = { status };
    if (status === 'resolved') update.resolvedAt = new Date();

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    console.log(`✅ Complaint ${req.params.id} updated to status: ${status}`);
    res.status(200).json({ success: true, message: 'Status updated', data: complaint });
  } catch (err) {
    console.error('❌ updateComplaintStatus error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, body, targetRoles } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const announcement = await Announcement.create({
      title,
      body,
      targetRoles: targetRoles || ['student', 'faculty', 'parent', 'admission', 'admin'],
      createdBy: req.user.userId,
    });

    console.log(`✅ Admin announcement created`);
    res.status(201).json({ success: true, message: 'Announcement created', data: announcement });
  } catch (err) {
    console.error('❌ createAnnouncement error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/admin/users/:id
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    console.log(`✅ User ${req.params.id} deactivated by admin`);
    res.status(200).json({ success: true, message: 'User deactivated', data: user });
  } catch (err) {
    console.error('❌ deactivateUser error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getStats, getAllUsers, getAllComplaints, updateComplaintStatus, createAnnouncement, deactivateUser };
