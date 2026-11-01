/**
 * server/routes/calendar.routes.js
 * API routes for Centralized Academic Calendar.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const {
  createCalendarEvent,
  getCalendarEvents,
  getUpcomingEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} = require('../controllers/calendar.controller');

// All calendar endpoints require authentication
router.use(authMiddleware);

// Aggregated calendar views (accessible to all authenticated roles)
router.get('/events', allowRoles('student', 'faculty', 'admin'), getCalendarEvents);
router.get('/upcoming', allowRoles('student', 'faculty', 'admin'), getUpcomingEvents);

// Administrative Event Management
router.post('/events', allowRoles('admin'), createCalendarEvent);
router.put('/events/:id', allowRoles('admin'), updateCalendarEvent);
router.delete('/events/:id', allowRoles('admin'), deleteCalendarEvent);

module.exports = router;

