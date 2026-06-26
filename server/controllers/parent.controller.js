const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Announcement = require('../models/Announcement');

// GET /api/parent/student-data
const getStudentData = async (req, res) => {
  try {
    const parent = await Parent.findOne({ userId: req.user.userId });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent profile not found' });
    }

    const student = await Student.findOne({ rollNumber: parent.studentRollNumber })
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Linked student not found' });
    }

    const announcements = await Announcement.find({ targetRoles: 'student' }).sort({ date: -1 }).limit(5);

    res.status(200).json({
      success: true,
      data: {
        studentName: student.userId.name,
        rollNumber: student.rollNumber,
        branch: student.branch,
        semester: student.semester,
        attendance: student.attendance,
        results: student.results,
        exams: student.exams,
        fees: student.fees,
        announcements: announcements
      }
    });
  } catch (err) {
    console.error('❌ getStudentData error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getStudentData };
