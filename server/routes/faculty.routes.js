/**
 * server/routes/faculty.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile, createAnnouncement, getAnnouncements, getStudents, raiseComplaint,
} = require('../controllers/faculty.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All faculty routes require auth + faculty role
router.use(authMiddleware, allowRoles('faculty'));

router.get('/profile',          getProfile);
router.post('/announcements',   createAnnouncement);
router.get('/announcements',    getAnnouncements);
router.get('/students',         getStudents);
router.post('/complaints',      raiseComplaint);

module.exports = router;
