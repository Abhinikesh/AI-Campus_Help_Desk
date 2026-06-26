const express = require('express');
const router = express.Router();
const {
  getProfile, getAttendance, getResults, getExams,
  getFees, getAnnouncements, raiseComplaint, getMyComplaints
} = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All student routes require auth + student role
router.use(authMiddleware, allowRoles('student'));

router.get('/profile',       getProfile);
router.get('/attendance',    getAttendance);
router.get('/results',       getResults);
router.get('/exams',         getExams);
router.get('/fees',          getFees);
router.get('/announcements', getAnnouncements);
router.post('/complaints',   raiseComplaint);
router.get('/complaints',    getMyComplaints);

module.exports = router;
