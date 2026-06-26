const express = require('express');
const router = express.Router();
const { getProfile, getTimetable, createAnnouncement, getStudents, markAttendance } = require('../controllers/faculty.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All faculty routes require auth + faculty role
router.use(authMiddleware, allowRoles('faculty'));

router.get('/profile',         getProfile);
router.get('/timetable',       getTimetable);
router.post('/announcements',  createAnnouncement);
router.get('/students',        getStudents);
router.post('/attendance',     markAttendance);

module.exports = router;
