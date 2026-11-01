/**
 * server/routes/timetable.routes.js
 * API routes for Timetable Management, Scheduling, and Versioning.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const {
  createTimetableEntry,
  getTimetableEntries,
  getStudentTimetable,
  getFacultyTimetable,
  updateTimetableEntry,
  cancelTimetableEntry,
  publishTimetable,
  getTimetableVersions,
} = require('../controllers/timetable.controller');

// All timetable endpoints require authentication
router.use(authMiddleware);

// Student timetable
router.get('/student', allowRoles('student'), getStudentTimetable);

// Faculty timetable
router.get('/faculty', allowRoles('faculty', 'admin'), getFacultyTimetable);

// Version history (Admin only)
router.get('/versions', allowRoles('admin'), getTimetableVersions);

// Timetable publication (Admin only)
router.post('/publish', allowRoles('admin'), publishTimetable);

// General query (Admin & Faculty)
router.get('/', allowRoles('admin', 'faculty'), getTimetableEntries);

// Create entry (Admin & Faculty)
router.post('/', allowRoles('admin', 'faculty'), createTimetableEntry);

// Update entry (Admin & Faculty)
router.put('/:id', allowRoles('admin', 'faculty'), updateTimetableEntry);

// Cancel entry (Admin & Faculty)
router.delete('/:id', allowRoles('admin', 'faculty'), cancelTimetableEntry);

module.exports = router;

