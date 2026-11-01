/**
 * server/routes/event.routes.js
 * Express router for CampusSphere AI Campus Events, Clubs & Activities Management.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  submitEventForApproval,
  reviewEventApproval,
  publishEvent,
  cancelEvent,
  createClub,
  getClubs,
  getClubById,
  applyForMembership,
  reviewMembership,
  getMyMemberships,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventRegistrations,
  createVenue,
  getVenues,
  bookVenue,
  recordAttendance,
  correctAttendance,
  getEventAttendance,
  issueCertificate,
  getMyCertificates,
  verifyCertificate,
  createAnnouncement,
  getAnnouncements,
  submitFeedback,
  getOverviewMetrics,
  exportParticipantsCsv,
} = require('../controllers/event.controller');

// ── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────────

// Public certificate verification by unique certificate ID or token
router.get('/certificates/verify/:identifier', verifyCertificate);

// All subsequent routes require authentication
router.use(authMiddleware);

// ── 1. CAMPUS EVENTS ──────────────────────────────────────────────────────────

router.get('/reports/overview', allowRoles('admin', 'faculty', 'event_organizer'), getOverviewMetrics);
router.get('/my-registrations', allowRoles('student'), getMyRegistrations);
router.get('/my-certificates', allowRoles('student'), getMyCertificates);
router.get('/announcements', getAnnouncements);
router.post('/announcements', allowRoles('admin', 'faculty', 'event_organizer', 'club_coordinator'), createAnnouncement);

router.post('/', allowRoles('admin', 'faculty', 'event_organizer'), createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.patch('/:id', allowRoles('admin', 'faculty', 'event_organizer'), updateEvent);
router.post('/:id/submit', allowRoles('admin', 'faculty', 'event_organizer'), submitEventForApproval);
router.patch('/:id/approval', allowRoles('admin', 'faculty'), reviewEventApproval);
router.post('/:id/publish', allowRoles('admin', 'faculty'), publishEvent);
router.post('/:id/cancel', allowRoles('admin', 'faculty', 'event_organizer'), cancelEvent);
router.get('/:id/export-participants', allowRoles('admin', 'faculty', 'event_organizer'), exportParticipantsCsv);

// ── 2. REGISTRATIONS & WAITLIST ───────────────────────────────────────────────

router.post('/:id/register', allowRoles('student'), registerForEvent);
router.patch('/:id/registrations/:registrationId/cancel', allowRoles('student', 'admin'), cancelRegistration);
router.get('/:id/registrations', allowRoles('admin', 'faculty', 'event_organizer', 'club_coordinator'), getEventRegistrations);

// ── 3. ATTENDANCE & CERTIFICATES ──────────────────────────────────────────────

router.post('/:id/attendance', allowRoles('admin', 'faculty', 'event_organizer', 'club_coordinator'), recordAttendance);
router.patch('/:id/attendance/:attendanceId', allowRoles('admin', 'faculty', 'event_organizer'), correctAttendance);
router.get('/:id/attendance', allowRoles('admin', 'faculty', 'event_organizer', 'club_coordinator'), getEventAttendance);

router.post('/:id/certificates/issue', allowRoles('admin', 'faculty', 'event_organizer'), issueCertificate);
router.post('/:id/feedback', allowRoles('student'), submitFeedback);

// ── 4. CLUBS & MEMBERSHIPS ────────────────────────────────────────────────────

router.post('/clubs', allowRoles('admin', 'faculty', 'club_coordinator'), createClub);
router.get('/clubs', getClubs);
router.get('/clubs/my-memberships', allowRoles('student'), getMyMemberships);
router.get('/clubs/:id', getClubById);
router.post('/clubs/:id/membership', allowRoles('student'), applyForMembership);
router.patch('/clubs/:clubId/membership/:membershipId', allowRoles('admin', 'faculty', 'club_coordinator'), reviewMembership);

// ── 5. VENUES & BOOKINGS ──────────────────────────────────────────────────────

router.post('/venues', allowRoles('admin'), createVenue);
router.get('/venues', getVenues);
router.post('/venues/bookings', allowRoles('admin', 'faculty', 'event_organizer'), bookVenue);

module.exports = router;

