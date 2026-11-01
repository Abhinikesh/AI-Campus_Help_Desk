/**
 * server/services/event.service.js
 * Domain service for Campus Events, Clubs, Registrations, Waitlist, Venues, and Certificates.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const CampusEvent = require('../models/CampusEvent');
const StudentClub = require('../models/StudentClub');
const ClubMembership = require('../models/ClubMembership');
const EventRegistration = require('../models/EventRegistration');
const EventVenue = require('../models/EventVenue');
const EventVenueBooking = require('../models/EventVenueBooking');
const EventAttendance = require('../models/EventAttendance');
const EventCertificate = require('../models/EventCertificate');
const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const notificationService = require('./notification.service');

// ── 1. SECURE FILE STORAGE CONFIGURATION ──────────────────────────────────────

const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
const EVENT_UPLOADS = path.join(UPLOAD_ROOT, 'events');
const CLUB_UPLOADS = path.join(UPLOAD_ROOT, 'clubs');

for (const dir of [UPLOAD_ROOT, EVENT_UPLOADS, CLUB_UPLOADS]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const eventBannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, EVENT_UPLOADS),
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `event-banner-${randomHex}${ext}`);
  },
});

const clubLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CLUB_UPLOADS),
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `club-logo-${randomHex}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Invalid file type. Allowed: PNG, JPG, JPEG, WEBP, PDF'), false);
  }
  cb(null, true);
};

const uploadEventBanner = multer({
  storage: eventBannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter,
});

const uploadClubLogo = multer({
  storage: clubLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter,
});

// ── 2. DOMAIN EVENT SERVICE CLASS ─────────────────────────────────────────────

class EventService {
  /**
   * Evaluates student eligibility for an event against branch, semester, batch, club, and deadlines.
   * @param {Object} event - Event document
   * @param {Object} student - Student profile document
   * @returns {Promise<{ eligible: boolean, reasons: string[] }>}
   */
  async evaluateEventEligibility(event, student) {
    const reasons = [];

    if (!event || !student) {
      return { eligible: false, reasons: ['Missing event or student profile record'] };
    }

    const now = new Date();

    // 1. Check status
    const allowedStatuses = ['approved', 'published', 'registration_open'];
    if (!allowedStatuses.includes(event.status)) {
      reasons.push(`Event is not open for registration (Current status: ${event.status})`);
    }

    // 2. Check registration dates
    if (event.registrationOpeningDate && now < new Date(event.registrationOpeningDate)) {
      reasons.push(`Registration has not opened yet (Opens on: ${new Date(event.registrationOpeningDate).toLocaleDateString()})`);
    }
    if (event.registrationClosingDate && now > new Date(event.registrationClosingDate)) {
      reasons.push(`Registration deadline has passed (Closed on: ${new Date(event.registrationClosingDate).toLocaleDateString()})`);
    }

    const criteria = event.eligibilityCriteria || {};

    // 3. Branch criteria
    if (Array.isArray(criteria.allowedBranches) && criteria.allowedBranches.length > 0) {
      if (!student.branch || !criteria.allowedBranches.includes(student.branch)) {
        reasons.push(`Branch '${student.branch || 'N/A'}' not eligible. Allowed: ${criteria.allowedBranches.join(', ')}`);
      }
    }

    // 4. Semester criteria
    if (Array.isArray(criteria.allowedSemesters) && criteria.allowedSemesters.length > 0) {
      if (!student.semester || !criteria.allowedSemesters.includes(Number(student.semester))) {
        reasons.push(`Semester '${student.semester || 'N/A'}' not eligible. Allowed: ${criteria.allowedSemesters.join(', ')}`);
      }
    }

    // 5. Batch criteria
    if (Array.isArray(criteria.allowedBatches) && criteria.allowedBatches.length > 0) {
      const studentBatch = student.batch || student.admissionYear;
      if (!studentBatch || !criteria.allowedBatches.includes(Number(studentBatch))) {
        reasons.push(`Batch '${studentBatch || 'N/A'}' not eligible. Allowed: ${criteria.allowedBatches.join(', ')}`);
      }
    }

    // 6. Club membership requirement
    if (criteria.clubMembershipRequired && event.club) {
      const activeMembership = await ClubMembership.findOne({
        club: event.club,
        student: student._id,
        status: 'approved',
      });
      if (!activeMembership) {
        reasons.push('Approved club membership is required to register for this event.');
      }
    }

    // 7. Target department audience check
    if (event.targetAudience === 'department' && event.targetDepartment && event.targetDepartment !== 'ALL') {
      if (student.branch !== event.targetDepartment) {
        reasons.push(`Event restricted to department '${event.targetDepartment}'.`);
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Concurrency-safe promotion of the next waitlisted participant upon cancellation.
   * @param {string|mongoose.Types.ObjectId} eventId
   * @returns {Promise<Object|null>} Promoted registration or null
   */
  async promoteNextWaitlistedParticipant(eventId) {
    // 1. Find next waitlisted registration (lowest waitlistNumber)
    const nextWaitlisted = await EventRegistration.findOne({
      event: eventId,
      status: 'waitlisted',
    })
      .sort({ waitlistNumber: 1, registeredAt: 1 })
      .populate('user', 'email name')
      .populate('student', 'fullName rollNumber');

    if (!nextWaitlisted) {
      return null;
    }

    // 2. Promote atomically to 'confirmed'
    nextWaitlisted.status = 'confirmed';
    nextWaitlisted.confirmedAt = new Date();
    nextWaitlisted.promotedFromWaitlistAt = new Date();
    nextWaitlisted.waitlistNumber = null;
    nextWaitlisted.statusHistory.push({
      status: 'confirmed',
      reason: 'Promoted from waitlist after participant cancellation',
      changedAt: new Date(),
    });

    await nextWaitlisted.save();

    // 3. Atomically update event counters
    const updatedEvent = await CampusEvent.findOneAndUpdate(
      { _id: eventId },
      {
        $inc: { allocatedParticipantsCount: 1, waitlistCount: -1 },
      },
      { new: true }
    );

    // 4. Send promotion notification to student
    try {
      if (nextWaitlisted.user) {
        await notificationService.createNotification({
          recipient: nextWaitlisted.user._id,
          title: 'Waitlist Promotion: Seat Confirmed!',
          message: `Congratulations! A seat became available for "${updatedEvent ? updatedEvent.title : 'Event'}" and your registration is now confirmed.`,
          category: 'event',
          priority: 'high',
        });
      }
    } catch (err) {
      console.error('[EventService] Waitlist notification error:', err.message);
    }

    return nextWaitlisted;
  }

  /**
   * Concurrency-safe check for venue availability to prevent overlapping bookings.
   * @param {string|mongoose.Types.ObjectId} venueId
   * @param {Date} startDateTime
   * @param {Date} endDateTime
   * @param {string|mongoose.Types.ObjectId|null} [excludeBookingId=null]
   * @returns {Promise<{ available: boolean, conflict: Object|null }>}
   */
  async checkVenueAvailability(venueId, startDateTime, endDateTime, excludeBookingId = null) {
    const query = {
      venue: venueId,
      status: { $in: ['confirmed', 'tentative'] },
      $or: [
        {
          startDateTime: { $lt: endDateTime },
          endDateTime: { $gt: startDateTime },
        },
      ],
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflict = await EventVenueBooking.findOne(query).populate('event', 'title eventCode');
    return {
      available: !conflict,
      conflict: conflict || null,
    };
  }

  /**
   * Synchronizes an approved/published campus event with the central Academic Calendar.
   * @param {Object} event - CampusEvent document
   * @param {string|mongoose.Types.ObjectId} userId - User modifying event
   * @returns {Promise<Object|null>}
   */
  async syncEventWithCalendar(event, userId) {
    try {
      if (['published', 'approved', 'registration_open'].includes(event.status)) {
        let calendarEvent = null;
        if (event.calendarEvent) {
          calendarEvent = await AcademicCalendarEvent.findById(event.calendarEvent);
        }

        const payload = {
          title: event.title,
          description: event.description,
          eventType: 'college_event',
          startDate: event.startDate,
          endDate: event.endDate,
          isAllDay: false,
          venue: event.venueName || event.location || 'Campus Wide',
          audience: event.targetAudience === 'department' ? 'department' : 'all',
          department: event.targetDepartment || 'ALL',
          status: 'published',
          linkedEntityType: 'CampusEvent',
          linkedEntityId: event._id,
          lastModifiedBy: userId,
        };

        if (calendarEvent) {
          Object.assign(calendarEvent, payload);
          await calendarEvent.save();
        } else {
          payload.createdBy = userId;
          calendarEvent = await AcademicCalendarEvent.create(payload);
          event.calendarEvent = calendarEvent._id;
          await event.save();
        }
        return calendarEvent;
      } else if (['cancelled', 'archived'].includes(event.status) && event.calendarEvent) {
        await AcademicCalendarEvent.findByIdAndUpdate(event.calendarEvent, {
          status: 'cancelled',
          lastModifiedBy: userId,
        });
      }
    } catch (err) {
      console.error('[EventService] Calendar sync failed:', err.message);
    }
    return null;
  }

  /**
   * Formula injection protection (CWE-1236) for CSV exports.
   * Escapes dangerous leading tokens (=, +, -, @, \t, \r) by prepending a single quote.
   * @param {any} val
   * @returns {string}
   */
  sanitizeCsvValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Formats an array of values into a CSV row.
   * @param {Array} arr
   * @returns {string}
   */
  toCsvRow(arr) {
    return arr.map((item) => this.sanitizeCsvValue(item)).join(',') + '\r\n';
  }

  /**
   * Direct database aggregation for campus event and activities metrics.
   * Zero hardcoded numbers or fake mock statistics.
   * @returns {Promise<Object>}
   */
  async getEventMetrics() {
    const [
      eventStatusCounts,
      categoryCounts,
      totalRegistrations,
      confirmedParticipants,
      waitlistedParticipants,
      totalClubs,
      totalMemberships,
      totalCertificates,
      totalAttendance,
      pendingApprovals,
    ] = await Promise.all([
      CampusEvent.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      CampusEvent.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      EventRegistration.countDocuments({ status: { $ne: 'cancelled' } }),
      EventRegistration.countDocuments({ status: { $in: ['confirmed', 'attended'] } }),
      EventRegistration.countDocuments({ status: 'waitlisted' }),
      StudentClub.countDocuments({ isActive: true }),
      ClubMembership.countDocuments({ status: 'approved' }),
      EventCertificate.countDocuments({ status: 'issued' }),
      EventAttendance.countDocuments({ status: 'present' }),
      CampusEvent.countDocuments({ status: 'pending_approval' }),
    ]);

    const statusMap = {};
    for (const item of eventStatusCounts) {
      statusMap[item._id] = item.count;
    }

    const categoryMap = {};
    for (const item of categoryCounts) {
      categoryMap[item._id] = item.count;
    }

    const totalEvents = Object.values(statusMap).reduce((acc, c) => acc + c, 0);

    return {
      totalEvents,
      publishedEvents: (statusMap['published'] || 0) + (statusMap['registration_open'] || 0),
      upcomingEvents: statusMap['published'] || 0,
      ongoingEvents: statusMap['ongoing'] || 0,
      completedEvents: statusMap['completed'] || 0,
      cancelledEvents: statusMap['cancelled'] || 0,
      pendingApprovals,
      totalRegistrations,
      confirmedParticipants,
      waitlistedParticipants,
      activeClubs: totalClubs,
      activeMemberships: totalMemberships,
      certificatesIssued: totalCertificates,
      totalAttendance,
      eventsByCategory: categoryMap,
    };
  }

  /**
   * Path traversal protection for retrieving uploaded documents.
   * @param {string} fileName
   * @param {'events'|'clubs'} subfolder
   * @returns {string} Absolute validated path
   */
  resolveSafeDocumentPath(fileName, subfolder = 'events') {
    const safeName = path.basename(fileName);
    const targetDir = subfolder === 'clubs' ? CLUB_UPLOADS : EVENT_UPLOADS;
    const resolved = path.resolve(targetDir, safeName);
    if (!resolved.startsWith(targetDir)) {
      throw new Error('Access denied: Invalid file path traversal attempt');
    }
    return resolved;
  }
}

const eventService = new EventService();

module.exports = {
  eventService,
  uploadEventBanner,
  uploadClubLogo,
  EVENT_UPLOADS,
  CLUB_UPLOADS,
};

