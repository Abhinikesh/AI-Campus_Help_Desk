/**
 * server/routes/student.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile, getAnnouncements, raiseComplaint, getMyComplaints, getFees,
} = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All student routes require auth + student role
router.use(authMiddleware, allowRoles('student'));

router.get('/profile',          getProfile);
router.get('/announcements',    getAnnouncements);
router.post('/complaints',      raiseComplaint);
router.get('/complaints',       getMyComplaints);
router.get('/fees',             getFees);

module.exports = router;
