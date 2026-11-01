/**
 * server/routes/announcement.routes.js
 * Centralized Announcement APIs for Student, Faculty, and Admin.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  getVisibleAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  getAdminAnnouncements,
} = require('../controllers/announcement.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All announcement endpoints require authentication
router.use(authMiddleware);

// Visible to authenticated users according to audience
router.get('/',                            getVisibleAnnouncements);
router.get('/admin/all',                   allowRoles('admin'), getAdminAnnouncements);
router.get('/:id',                         getAnnouncementById);

// Authoring (Admin & Faculty)
router.post('/',                           allowRoles('admin', 'faculty'), createAnnouncement);
router.patch('/:id',                       allowRoles('admin', 'faculty'), updateAnnouncement);
router.post('/:id/publish',                allowRoles('admin', 'faculty'), publishAnnouncement);
router.post('/:id/archive',                allowRoles('admin'), archiveAnnouncement);

module.exports = router;

