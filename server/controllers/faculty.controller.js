const Faculty = require('../models/Faculty');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');

// GET /api/faculty/profile
const getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user.userId }).populate('userId', 'name email');
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    console.log(`✅ Faculty profile fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: faculty });
  } catch (err) {
    console.error('❌ Faculty getProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/faculty/timetable
const getTimetable = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user.userId });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });

    console.log(`✅ Timetable fetched for userId: ${req.user.userId}`);
    res.status(200).json({ success: true, data: faculty.timetable });
  } catch (err) {
    console.error('❌ getTimetable error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/faculty/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, body, targetRoles } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const announcement = await Announcement.create({
      title,
      body,
      targetRoles: targetRoles || ['student'],
      createdBy: req.user.userId,
    });

    console.log(`✅ Announcement created by faculty userId: ${req.user.userId}`);
    res.status(201).json({ success: true, message: 'Announcement created', data: announcement });
  } catch (err) {
    console.error('❌ createAnnouncement error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/faculty/students
const getStudents = async (req, res) => {
  try {
    const students = await Student.find({}).populate('userId', 'name email');
    res.status(200).json({ success: true, data: students });
  } catch (err) {
    console.error('❌ getStudents error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/faculty/attendance
const markAttendance = async (req, res) => {
  try {
    const { subjectCode, attendanceData } = req.body;
    if (!subjectCode || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    let updatedCount = 0;
    for (const record of attendanceData) {
      if (record.status !== 'Present' && record.status !== 'Absent') continue;

      const student = await Student.findById(record.studentId);
      if (student) {
        // Find subject in attendance array or create one. Wait, let's just find and update.
        let subjectAtt = student.attendance.find(a => a.code === subjectCode);
        if (!subjectAtt) {
          student.attendance.push({ subject: record.subjectName || subjectCode, code: subjectCode, attended: 0, total: 0 });
          subjectAtt = student.attendance[student.attendance.length - 1];
        }

        subjectAtt.total += 1;
        if (record.status === 'Present') {
          subjectAtt.attended += 1;
        }

        await student.save();
        updatedCount++;
      }
    }

    res.status(200).json({ success: true, message: `Attendance updated for ${updatedCount} students` });
  } catch (err) {
    console.error('❌ markAttendance error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getProfile, getTimetable, createAnnouncement, getStudents, markAttendance };
