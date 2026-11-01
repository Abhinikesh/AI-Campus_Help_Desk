/**
 * server/controllers/event.controller.js
 * Comprehensive controller for Campus Events, Clubs, Registrations, Venues, Attendance, and Certificates.
 */
'use strict';

const crypto = require('crypto');
const CampusEvent = require('../models/CampusEvent');
const EventApproval = require('../models/EventApproval');
const StudentClub = require('../models/StudentClub');
const ClubMembership = require('../models/ClubMembership');
const EventRegistration = require('../models/EventRegistration');
const EventVenue = require('../models/EventVenue');
const EventVenueBooking = require('../models/EventVenueBooking');
const EventAttendance = require('../models/EventAttendance');
const EventCertificate = require('../models/EventCertificate');
const EventAnnouncement = require('../models/EventAnnouncement');
const EventFeedback = require('../models/EventFeedback');
const EventAuditLog = require('../models/EventAuditLog');
const Student = require('../models/Student');
const User = require('../models/User');
const { eventService } = require('../services/event.service');
const notificationService = require('../services/notification.service');

// ── 1. CAMPUS EVENTS MANAGEMENT ───────────────────────────────────────────────

/**
 * Creates a new campus event in draft or pending_approval state.
 * POST /api/events
 */
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      eventCode,
      description,
      category,
      startDate,
      endDate,
      registrationOpeningDate,
      registrationClosingDate,
      maxParticipants,
      isWaitlistEnabled,
      waitlistCapacity,
      eligibilityCriteria,
      targetAudience,
      targetDepartment,
      registrationType,
      maxTeamSize,
      location,
      venue,
      club,
      facultyCoordinator,
      studentCoordinator,
    } = req.body;

    if (!title || !eventCode || !description || !category || !startDate || !endDate || !registrationOpeningDate || !registrationClosingDate) {
      return res.status(400).json({ success: false, message: 'Missing required event fields' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const regOpen = new Date(registrationOpeningDate);
    const regClose = new Date(registrationClosingDate);

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'Event start date must be before end date' });
    }
    if (regOpen >= regClose) {
      return res.status(400).json({ success: false, message: 'Registration opening date must be before closing date' });
    }
    if (regClose > end) {
      return res.status(400).json({ success: false, message: 'Registration cannot close after event ends' });
    }

    // Check unique eventCode
    const existing = await CampusEvent.findOne({ eventCode: eventCode.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Event with code '${eventCode}' already exists` });
    }

    let venueName = '';
    if (venue) {
      const venueDoc = await EventVenue.findById(venue);
      if (venueDoc) venueName = venueDoc.name;
    }

    const initialStatus = req.user.role === 'admin' ? 'approved' : 'draft';

    const event = await CampusEvent.create({
      title,
      eventCode: eventCode.toUpperCase().trim(),
      description,
      category,
      organizer: req.user._id,
      organizerRole: req.user.role,
      facultyCoordinator: facultyCoordinator || null,
      studentCoordinator: studentCoordinator || null,
      club: club || null,
      location: location || 'Main Campus',
      venue: venue || null,
      venueName,
      startDate: start,
      endDate: end,
      registrationOpeningDate: regOpen,
      registrationClosingDate: regClose,
      maxParticipants: Number(maxParticipants) || 100,
      isWaitlistEnabled: isWaitlistEnabled !== false,
      waitlistCapacity: Number(waitlistCapacity) || 50,
      eligibilityCriteria: eligibilityCriteria || {},
      targetAudience: targetAudience || 'students',
      targetDepartment: targetDepartment || 'ALL',
      registrationType: registrationType || 'individual',
      maxTeamSize: Number(maxTeamSize) || 1,
      status: initialStatus,
    });

    await EventAuditLog.create({
      action: 'EVENT_CREATED',
      performedBy: req.user._id,
      targetEntity: 'CampusEvent',
      targetId: event._id,
      newState: { eventCode: event.eventCode, status: event.status },
      reason: 'Event created',
    });

    return res.status(201).json({
      success: true,
      message: `Event '${event.title}' created successfully`,
      data: event,
    });
  } catch (error) {
    console.error('[createEvent] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves paginated campus events with audience and role filtering.
 * GET /api/events
 */
exports.getEvents = async (req, res) => {
  try {
    const { category, status, search, department, page = 1, limit = 20 } = req.query;
    const query = {};

    // Role-based visibility check:
    // Students only see published, approved, registration_open, completed, or cancelled events
    if (req.user && req.user.role === 'student') {
      query.status = { $in: ['approved', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled'] };
    } else if (status) {
      query.status = status;
    }

    if (category) query.category = category;
    if (department && department !== 'ALL') {
      query.$or = [{ targetDepartment: 'ALL' }, { targetDepartment: department }];
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { eventCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [events, total] = await Promise.all([
      CampusEvent.find(query)
        .populate('organizer', 'name email role')
        .populate('club', 'name code category')
        .populate('venue', 'name code location capacity')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      CampusEvent.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: events,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('[getEvents] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves details for a specific event with live student eligibility check.
 * GET /api/events/:id
 */
exports.getEventById = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id)
      .populate('organizer', 'name email role')
      .populate('club', 'name code category logoUrl')
      .populate('venue', 'name code location capacity facilities')
      .populate('facultyCoordinator', 'employeeId department designation')
      .populate('studentCoordinator', 'fullName rollNumber branch');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Role visibility check
    if (req.user && req.user.role === 'student') {
      if (['draft', 'pending_approval', 'archived'].includes(event.status)) {
        return res.status(403).json({ success: false, message: 'This event is not published' });
      }
    }

    let eligibility = null;
    let myRegistration = null;

    if (req.user && req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) {
        eligibility = await eventService.evaluateEventEligibility(event, student);
        myRegistration = await EventRegistration.findOne({ event: event._id, student: student._id });
      }
    }

    return res.json({
      success: true,
      data: event,
      eligibility,
      myRegistration,
    });
  } catch (error) {
    console.error('[getEventById] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Updates an event.
 * PATCH /api/events/:id
 */
exports.updateEvent = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Authorization: Admin or the organizer
    const isOrganizer = String(event.organizer) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this event' });
    }

    const previousState = event.toObject();

    // Prevent direct status change to approved or published by unprivileged organizers
    const updates = { ...req.body };
    if (!isAdmin && updates.status && ['approved', 'published'].includes(updates.status)) {
      delete updates.status;
    }

    if (updates.startDate && updates.endDate) {
      if (new Date(updates.startDate) >= new Date(updates.endDate)) {
        return res.status(400).json({ success: false, message: 'Start date must be before end date' });
      }
    }

    Object.assign(event, updates);
    await event.save();

    await EventAuditLog.create({
      action: 'EVENT_UPDATED',
      performedBy: req.user._id,
      targetEntity: 'CampusEvent',
      targetId: event._id,
      previousState: { status: previousState.status, maxParticipants: previousState.maxParticipants },
      newState: { status: event.status, maxParticipants: event.maxParticipants },
      reason: req.body.updateReason || 'Event details updated',
    });

    return res.json({
      success: true,
      message: 'Event updated successfully',
      data: event,
    });
  } catch (error) {
    console.error('[updateEvent] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submits draft event for formal approval.
 * POST /api/events/:id/submit
 */
exports.submitEventForApproval = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isOrganizer = String(event.organizer) === String(req.user._id);
    if (!isOrganizer && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the organizer can submit for approval' });
    }

    if (event.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot submit event with status '${event.status}'` });
    }

    event.status = 'pending_approval';
    await event.save();

    await EventApproval.create({
      event: event._id,
      stage: 'faculty_coordinator',
      reviewer: req.user._id,
      status: 'pending',
    });

    await EventAuditLog.create({
      action: 'EVENT_SUBMITTED_FOR_APPROVAL',
      performedBy: req.user._id,
      targetEntity: 'CampusEvent',
      targetId: event._id,
      newState: { status: 'pending_approval' },
      reason: 'Submitted for faculty/admin review',
    });

    return res.json({
      success: true,
      message: 'Event submitted for approval successfully',
      data: event,
    });
  } catch (error) {
    console.error('[submitEventForApproval] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approves or rejects an event.
 * PATCH /api/events/:id/approval
 */
exports.reviewEventApproval = async (req, res) => {
  try {
    const { action, comments, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length < 5)) {
      return res.status(400).json({ success: false, message: 'Rejection reason must be at least 5 characters' });
    }

    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (action === 'approve') {
      event.status = 'approved';
      event.approvalNotes = comments || 'Approved by authority';
      await eventService.syncEventWithCalendar(event, req.user._id);
    } else {
      event.status = 'draft';
      event.approvalNotes = `Rejected: ${rejectionReason}`;
    }

    await event.save();

    await EventApproval.create({
      event: event._id,
      stage: 'dean_admin',
      reviewer: req.user._id,
      status: action === 'approve' ? 'approved' : 'rejected',
      decisionDate: new Date(),
      comments: comments || '',
      rejectionReason: rejectionReason || '',
    });

    // Notify organizer
    try {
      await notificationService.createNotification({
        recipient: event.organizer,
        title: action === 'approve' ? 'Event Approved!' : 'Event Approval Rejected',
        message: action === 'approve'
          ? `Your event "${event.title}" has been approved.`
          : `Your event "${event.title}" was not approved. Reason: ${rejectionReason}`,
        category: 'event',
        priority: 'high',
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: `Event has been ${action}d successfully`,
      data: event,
    });
  } catch (error) {
    console.error('[reviewEventApproval] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Publishes an approved event to students and synchronizes with academic calendar.
 * POST /api/events/:id/publish
 */
exports.publishEvent = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!['approved', 'draft'].includes(event.status) && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: `Cannot publish event in '${event.status}' state without approval` });
    }

    event.status = 'published';
    await event.save();

    await eventService.syncEventWithCalendar(event, req.user._id);

    await EventAuditLog.create({
      action: 'EVENT_PUBLISHED',
      performedBy: req.user._id,
      targetEntity: 'CampusEvent',
      targetId: event._id,
      newState: { status: 'published' },
      reason: 'Event opened to campus audience',
    });

    return res.json({
      success: true,
      message: `Event '${event.title}' is now published`,
      data: event,
    });
  } catch (error) {
    console.error('[publishEvent] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancels a published or ongoing event with audited reason and notifies attendees.
 * POST /api/events/:id/cancel
 */
exports.cancelEvent = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    if (!cancellationReason || cancellationReason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required (min 5 chars)' });
    }

    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event.status = 'cancelled';
    event.cancellationReason = cancellationReason;
    await event.save();

    // Release booked venues
    await EventVenueBooking.updateMany(
      { event: event._id, status: { $in: ['confirmed', 'tentative'] } },
      { status: 'cancelled' }
    );

    // Sync with calendar
    await eventService.syncEventWithCalendar(event, req.user._id);

    // Notify confirmed attendees
    const registrations = await EventRegistration.find({
      event: event._id,
      status: { $in: ['confirmed', 'registered', 'waitlisted'] },
    }).populate('user', '_id');

    const recipients = registrations.map((r) => r.user?._id).filter(Boolean);
    if (recipients.length > 0) {
      try {
        await notificationService.createBulkNotifications({
          recipients,
          title: `Event Cancelled: ${event.title}`,
          message: `The event "${event.title}" has been cancelled. Reason: ${cancellationReason}`,
          category: 'event',
          priority: 'urgent',
          sender: req.user._id,
        });
      } catch (_) {}
    }

    await EventAuditLog.create({
      action: 'EVENT_CANCELLED',
      performedBy: req.user._id,
      targetEntity: 'CampusEvent',
      targetId: event._id,
      newState: { status: 'cancelled', cancellationReason },
      reason: cancellationReason,
    });

    return res.json({
      success: true,
      message: 'Event has been cancelled and attendees notified',
      data: event,
    });
  } catch (error) {
    console.error('[cancelEvent] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 2. STUDENT CLUBS & MEMBERSHIPS ───────────────────────────────────────────

/**
 * Creates a student club.
 * POST /api/clubs
 */
exports.createClub = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      category,
      facultyAdvisor,
      studentPresident,
      studentCoordinator,
      membershipCapacity,
      meetingSchedule,
      contactEmail,
      contactPhone,
    } = req.body;

    if (!name || !code || !description || !category) {
      return res.status(400).json({ success: false, message: 'Missing required club details' });
    }

    const existing = await StudentClub.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Club with code '${code}' already exists` });
    }

    const club = await StudentClub.create({
      name,
      code: code.toUpperCase().trim(),
      description,
      category,
      facultyAdvisor: facultyAdvisor || null,
      studentPresident: studentPresident || null,
      studentCoordinator: studentCoordinator || null,
      membershipCapacity: Number(membershipCapacity) || 200,
      meetingSchedule: meetingSchedule || 'Weekly',
      contactEmail: contactEmail || '',
      contactPhone: contactPhone || '',
      isActive: true,
    });

    await EventAuditLog.create({
      action: 'CLUB_CREATED',
      performedBy: req.user._id,
      targetEntity: 'StudentClub',
      targetId: club._id,
      newState: { code: club.code, name: club.name },
      reason: 'Club created',
    });

    return res.status(201).json({
      success: true,
      message: `Club '${club.name}' created successfully`,
      data: club,
    });
  } catch (error) {
    console.error('[createClub] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves list of student clubs.
 * GET /api/clubs
 */
exports.getClubs = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const clubs = await StudentClub.find(query)
      .populate('facultyAdvisor', 'employeeId department designation')
      .populate('studentPresident', 'fullName rollNumber branch')
      .populate('studentCoordinator', 'fullName rollNumber branch')
      .sort({ name: 1 });

    return res.json({ success: true, data: clubs });
  } catch (error) {
    console.error('[getClubs] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves specific club details.
 * GET /api/clubs/:id
 */
exports.getClubById = async (req, res) => {
  try {
    const club = await StudentClub.findById(req.params.id)
      .populate('facultyAdvisor', 'employeeId department designation')
      .populate('studentPresident', 'fullName rollNumber branch')
      .populate('studentCoordinator', 'fullName rollNumber branch');

    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    let myMembership = null;
    if (req.user && req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) {
        myMembership = await ClubMembership.findOne({ club: club._id, student: student._id });
      }
    }

    return res.json({ success: true, data: club, myMembership });
  } catch (error) {
    console.error('[getClubById] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Student applies for membership in a club.
 * POST /api/clubs/:id/membership
 */
exports.applyForMembership = async (req, res) => {
  try {
    const club = await StudentClub.findById(req.params.id);
    if (!club || !club.isActive) {
      return res.status(404).json({ success: false, message: 'Active club not found' });
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Check for existing active or pending application
    const existing = await ClubMembership.findOne({
      club: club._id,
      student: student._id,
      status: { $in: ['submitted', 'under_review', 'approved'] },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You already have an active or pending membership in ${club.name} (Status: ${existing.status})`,
      });
    }

    // Check capacity
    const isFull = club.activeMembersCount >= club.membershipCapacity;
    const initialStatus = isFull ? 'waitlisted' : 'submitted';

    const membership = await ClubMembership.create({
      club: club._id,
      student: student._id,
      user: req.user._id,
      academicYear: '2026-2027',
      role: 'member',
      status: initialStatus,
      statementOfPurpose: req.body.statementOfPurpose || '',
      statusHistory: [
        {
          status: initialStatus,
          changedBy: req.user._id,
          note: isFull ? 'Waitlisted due to club membership capacity' : 'Application submitted',
          changedAt: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: isFull ? 'Club is full; application placed on waitlist' : 'Membership application submitted successfully',
      data: membership,
    });
  } catch (error) {
    console.error('[applyForMembership] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Club coordinator, faculty advisor, or admin reviews membership.
 * PATCH /api/clubs/:clubId/membership/:membershipId
 */
exports.reviewMembership = async (req, res) => {
  try {
    const { status, role, rejectionReason } = req.body;
    if (!['approved', 'rejected', 'under_review'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid membership status' });
    }

    if (status === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory' });
    }

    const membership = await ClubMembership.findById(req.params.membershipId).populate('club');
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Membership application not found' });
    }

    const previousStatus = membership.status;
    membership.status = status;
    membership.reviewedBy = req.user._id;
    membership.reviewedAt = new Date();
    if (role) membership.role = role;
    if (status === 'rejected') membership.rejectionReason = rejectionReason;

    membership.statusHistory.push({
      status,
      changedBy: req.user._id,
      note: status === 'rejected' ? rejectionReason : `Status updated to ${status}`,
      changedAt: new Date(),
    });

    await membership.save();

    // If transitioned to approved, increment activeMembersCount atomically
    if (status === 'approved' && previousStatus !== 'approved') {
      await StudentClub.findByIdAndUpdate(membership.club._id, { $inc: { activeMembersCount: 1 } });
    } else if (previousStatus === 'approved' && status !== 'approved') {
      await StudentClub.findByIdAndUpdate(membership.club._id, { $inc: { activeMembersCount: -1 } });
    }

    // Send notification
    try {
      await notificationService.createNotification({
        recipient: membership.user,
        title: `Club Membership Update: ${membership.club.name}`,
        message: status === 'approved'
          ? `Your membership in ${membership.club.name} has been approved as ${membership.role}!`
          : `Your membership application was ${status}. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
        category: 'event',
        priority: 'normal',
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: `Membership status updated to '${status}'`,
      data: membership,
    });
  } catch (error) {
    console.error('[reviewMembership] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Student retrieves their club memberships.
 * GET /api/clubs/my-memberships
 */
exports.getMyMemberships = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const memberships = await ClubMembership.find({ student: student._id })
      .populate('club', 'name code category meetingSchedule logoUrl')
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: memberships });
  } catch (error) {
    console.error('[getMyMemberships] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 3. EVENT REGISTRATIONS & CONCURRENCY-SAFE WAITLIST ────────────────────────

/**
 * Registers student for an event with atomic concurrency protection and deterministic waitlisting.
 * POST /api/events/:id/register
 */
exports.registerForEvent = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Check backend eligibility
    const eligibility = await eventService.evaluateEventEligibility(event, student);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: 'You are not eligible to register for this event',
        reasons: eligibility.reasons,
      });
    }

    // Prevent duplicate active registration
    const existing = await EventRegistration.findOne({
      event: event._id,
      student: student._id,
      status: { $in: ['registered', 'confirmed', 'waitlisted'] },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You already have an active registration for this event (Status: ${existing.status})`,
      });
    }

    const regNumber = `REG-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Attempt atomic increment on allocatedParticipantsCount if below capacity
    const seatAllocated = await CampusEvent.findOneAndUpdate(
      {
        _id: event._id,
        $expr: { $lt: ['$allocatedParticipantsCount', '$maxParticipants'] },
      },
      {
        $inc: { allocatedParticipantsCount: 1 },
      },
      { new: true }
    );

    let finalStatus = 'confirmed';
    let waitlistNum = null;

    if (seatAllocated) {
      finalStatus = 'confirmed';
    } else {
      // Seat full — check if waitlist is enabled and has capacity
      if (!event.isWaitlistEnabled) {
        return res.status(409).json({
          success: false,
          message: 'Event is fully booked and waitlisting is not enabled.',
        });
      }

      const waitlistAllocated = await CampusEvent.findOneAndUpdate(
        {
          _id: event._id,
          $expr: { $lt: ['$waitlistCount', '$waitlistCapacity'] },
        },
        {
          $inc: { waitlistCount: 1 },
        },
        { new: true }
      );

      if (!waitlistAllocated) {
        return res.status(409).json({
          success: false,
          message: 'Event and waitlist capacity are both completely full.',
        });
      }

      finalStatus = 'waitlisted';
      waitlistNum = waitlistAllocated.waitlistCount;
    }

    const registration = await EventRegistration.create({
      event: event._id,
      student: student._id,
      user: req.user._id,
      registrationNumber: regNumber,
      status: finalStatus,
      waitlistNumber: waitlistNum,
      teamName: req.body.teamName || '',
      eligibilitySnapshot: {
        branch: student.branch || '',
        semester: student.semester || 1,
        isClubMember: eligibility.reasons.length === 0,
        evaluatedAt: new Date(),
      },
      registeredAt: new Date(),
      confirmedAt: finalStatus === 'confirmed' ? new Date() : null,
      statusHistory: [
        {
          status: finalStatus,
          changedBy: req.user._id,
          reason: finalStatus === 'confirmed' ? 'Seat confirmed' : `Waitlisted at position #${waitlistNum}`,
          changedAt: new Date(),
        },
      ],
    });

    // Send real-time notification
    try {
      await notificationService.createNotification({
        recipient: req.user._id,
        title: finalStatus === 'confirmed' ? 'Event Registration Confirmed!' : 'Event Waitlisted',
        message: finalStatus === 'confirmed'
          ? `Your seat for "${event.title}" is confirmed! Reg #: ${regNumber}`
          : `You are on the waitlist (Position #${waitlistNum}) for "${event.title}".`,
        category: 'event',
        priority: 'normal',
      });
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: finalStatus === 'confirmed' ? 'Registration confirmed successfully' : `Added to waitlist at position #${waitlistNum}`,
      data: registration,
    });
  } catch (error) {
    console.error('[registerForEvent] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancels a student registration and automatically promotes the next waitlisted student.
 * PATCH /api/events/:id/registrations/:registrationId/cancel
 */
exports.cancelRegistration = async (req, res) => {
  try {
    const registration = await EventRegistration.findById(req.params.registrationId).populate('event');
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Anti-IDOR: only student owner or admin can cancel
    const isOwner = String(registration.user) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this registration' });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Registration is already cancelled' });
    }

    const previousStatus = registration.status;
    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    registration.cancellationReason = req.body.reason || 'Cancelled by student';
    registration.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user._id,
      reason: registration.cancellationReason,
      changedAt: new Date(),
    });

    await registration.save();

    let promotedRegistration = null;

    if (previousStatus === 'confirmed') {
      // Decrement allocated count and attempt to promote next waitlisted candidate
      await CampusEvent.findByIdAndUpdate(registration.event._id, {
        $inc: { allocatedParticipantsCount: -1 },
      });
      promotedRegistration = await eventService.promoteNextWaitlistedParticipant(registration.event._id);
    } else if (previousStatus === 'waitlisted') {
      await CampusEvent.findByIdAndUpdate(registration.event._id, {
        $inc: { waitlistCount: -1 },
      });
    }

    return res.json({
      success: true,
      message: 'Registration cancelled successfully',
      data: registration,
      promotedParticipant: promotedRegistration ? promotedRegistration.registrationNumber : null,
    });
  } catch (error) {
    console.error('[cancelRegistration] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Authenticated student retrieves their registrations.
 * GET /api/events/my-registrations
 */
exports.getMyRegistrations = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const registrations = await EventRegistration.find({ student: student._id })
      .populate('event', 'title eventCode category startDate endDate location venueName status bannerUrl')
      .sort({ registeredAt: -1 });

    return res.json({ success: true, data: registrations });
  } catch (error) {
    console.error('[getMyRegistrations] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Event organizers and admins retrieve registrations for an event.
 * GET /api/events/:id/registrations
 */
exports.getEventRegistrations = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { event: req.params.id };

    if (status) query.status = status;

    const registrations = await EventRegistration.find(query)
      .populate('student', 'fullName rollNumber branch semester phone email')
      .populate('user', 'email name')
      .sort({ registeredAt: -1 });

    return res.json({ success: true, data: registrations });
  } catch (error) {
    console.error('[getEventRegistrations] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 4. EVENT VENUES & CONFLICT MANAGEMENT ─────────────────────────────────────

/**
 * Creates a physical event venue.
 * POST /api/venues
 */
exports.createVenue = async (req, res) => {
  try {
    const { name, code, type, location, capacity, facilities } = req.body;
    if (!name || !code || !location || !capacity) {
      return res.status(400).json({ success: false, message: 'Missing required venue fields' });
    }

    if (Number(capacity) <= 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be positive' });
    }

    const existing = await EventVenue.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Venue with code '${code}' already exists` });
    }

    const venue = await EventVenue.create({
      name,
      code: code.toUpperCase().trim(),
      type: type || 'seminar_hall',
      location,
      capacity: Number(capacity),
      facilities: facilities || ['Projector', 'Sound System', 'Wi-Fi'],
      isActive: true,
    });

    return res.status(201).json({ success: true, message: 'Venue created successfully', data: venue });
  } catch (error) {
    console.error('[createVenue] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Lists all active venues.
 * GET /api/venues
 */
exports.getVenues = async (req, res) => {
  try {
    const venues = await EventVenue.find({ isActive: true }).sort({ name: 1 });
    return res.json({ success: true, data: venues });
  } catch (error) {
    console.error('[getVenues] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Schedules a venue booking with concurrency-safe overlap check.
 * POST /api/venues/bookings
 */
exports.bookVenue = async (req, res) => {
  try {
    const { venueId, eventId, bookingDate, startTime, endTime, purpose } = req.body;
    if (!venueId || !eventId || !bookingDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields' });
    }

    const venue = await EventVenue.findById(venueId);
    if (!venue || !venue.isActive) {
      return res.status(404).json({ success: false, message: 'Active venue not found' });
    }

    const dateStr = new Date(bookingDate).toISOString().split('T')[0];
    const startDateTime = new Date(`${dateStr}T${startTime}:00.000Z`);
    const endDateTime = new Date(`${dateStr}T${endTime}:00.000Z`);

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    // Check for overlapping bookings
    const availability = await eventService.checkVenueAvailability(venueId, startDateTime, endDateTime);
    if (!availability.available) {
      return res.status(409).json({
        success: false,
        message: `Venue conflict: Venue '${venue.name}' is already booked during this time interval.`,
        conflict: availability.conflict,
      });
    }

    const booking = await EventVenueBooking.create({
      venue: venueId,
      event: eventId,
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      startDateTime,
      endDateTime,
      bookedBy: req.user._id,
      status: 'confirmed',
      purpose: purpose || 'Campus Event Hosting',
    });

    // Also update venue and venueName on the CampusEvent
    await CampusEvent.findByIdAndUpdate(eventId, {
      venue: venueId,
      venueName: venue.name,
    });

    return res.status(201).json({
      success: true,
      message: `Venue '${venue.name}' booked successfully`,
      data: booking,
    });
  } catch (error) {
    console.error('[bookVenue] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 5. EVENT ATTENDANCE (DECOUPLED FROM ACADEMIC ATTENDANCE) ──────────────────

/**
 * Records attendance for an event participant.
 * POST /api/events/:id/attendance
 */
exports.recordAttendance = async (req, res) => {
  try {
    const { studentId, registrationId, status = 'present', markingMethod = 'manual', notes } = req.body;
    if (!studentId || !registrationId) {
      return res.status(400).json({ success: false, message: 'Student ID and Registration ID are required' });
    }

    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    let attendance = await EventAttendance.findOne({ event: event._id, student: studentId });
    if (attendance) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already recorded for this student in this event. Use correction endpoint to modify.',
      });
    }

    attendance = await EventAttendance.create({
      event: event._id,
      student: studentId,
      registration: registrationId,
      status,
      markingMethod,
      markedBy: req.user._id,
      notes: notes || '',
    });

    // Update status in EventRegistration
    await EventRegistration.findByIdAndUpdate(registrationId, {
      status: status === 'present' ? 'attended' : 'absent',
    });

    return res.status(201).json({
      success: true,
      message: `Attendance marked as '${status}'`,
      data: attendance,
    });
  } catch (error) {
    console.error('[recordAttendance] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Audited correction of event attendance with mandatory reason.
 * PATCH /api/events/:id/attendance/:attendanceId
 */
exports.correctAttendance = async (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    if (!['present', 'absent'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'Status must be present or absent' });
    }
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Mandatory correction reason required (min 5 chars)' });
    }

    const attendance = await EventAttendance.findById(req.params.attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const prev = attendance.status;
    attendance.status = newStatus;
    attendance.correctionHistory.push({
      previousStatus: prev,
      newStatus,
      correctedBy: req.user._id,
      reason,
      correctedAt: new Date(),
    });

    await attendance.save();

    await EventRegistration.findByIdAndUpdate(attendance.registration, {
      status: newStatus === 'present' ? 'attended' : 'absent',
    });

    return res.json({
      success: true,
      message: 'Attendance corrected and audit record logged',
      data: attendance,
    });
  } catch (error) {
    console.error('[correctAttendance] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves attendance summary and records for an event.
 * GET /api/events/:id/attendance
 */
exports.getEventAttendance = async (req, res) => {
  try {
    const records = await EventAttendance.find({ event: req.params.id })
      .populate('student', 'fullName rollNumber branch semester')
      .populate('markedBy', 'name role')
      .sort({ checkInTime: -1 });

    const totalMarked = records.length;
    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;

    return res.json({
      success: true,
      summary: {
        totalMarked,
        presentCount,
        absentCount,
      },
      data: records,
    });
  } catch (error) {
    console.error('[getEventAttendance] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 6. EVENT CERTIFICATES & VERIFICATION ──────────────────────────────────────

/**
 * Issues verifiable certificates to attendees, winners, or volunteers.
 * POST /api/events/:id/certificates/issue
 */
exports.issueCertificate = async (req, res) => {
  try {
    const { studentId, certificateType = 'participation', position, issuerName, issuerDesignation } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const student = await Student.findById(studentId).populate('user');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Participation certificate requires verified attendance
    if (certificateType === 'participation') {
      const attendance = await EventAttendance.findOne({ event: event._id, student: student._id, status: 'present' });
      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: 'Participation certificates require verified attendance (status: present).',
        });
      }
    }

    // Check duplicate
    const existing = await EventCertificate.findOne({
      event: event._id,
      student: student._id,
      certificateType,
      status: 'issued',
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Certificate of type '${certificateType}' has already been issued to this student for this event.`,
      });
    }

    const certNumber = `CERT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const token = crypto.randomBytes(16).toString('hex');

    const certificate = await EventCertificate.create({
      certificateNumber: certNumber,
      event: event._id,
      student: student._id,
      user: student.user ? student.user._id : req.user._id,
      participantName: student.fullName,
      studentRollNumber: student.rollNumber,
      eventTitle: event.title,
      eventDate: event.startDate,
      certificateType,
      position: position || '',
      issuerName: issuerName || 'Dean of Student Affairs',
      issuerDesignation: issuerDesignation || 'Dean, Student Welfare & Activities',
      verificationToken: token,
      status: 'issued',
    });

    // Notify student
    try {
      if (student.user) {
        await notificationService.createNotification({
          recipient: student.user._id,
          title: 'Certificate Issued!',
          message: `Your ${certificateType} certificate for "${event.title}" is ready. Certificate #: ${certNumber}`,
          category: 'event',
          priority: 'high',
        });
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: 'Certificate issued successfully',
      data: certificate,
    });
  } catch (error) {
    console.error('[issueCertificate] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Authenticated student retrieves their certificates.
 * GET /api/events/my-certificates
 */
exports.getMyCertificates = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const certificates = await EventCertificate.find({ student: student._id, status: 'issued' })
      .populate('event', 'title eventCode category startDate endDate location')
      .sort({ issueDate: -1 });

    return res.json({ success: true, data: certificates });
  } catch (error) {
    console.error('[getMyCertificates] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public certificate verification endpoint (Zero IDOR / privacy protection).
 * GET /api/certificates/verify/:identifier
 */
exports.verifyCertificate = async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const certificate = await EventCertificate.findOne({
      $or: [{ certificateNumber: identifier }, { verificationToken: identifier }],
    });

    if (!certificate) {
      return res.status(404).json({ success: false, valid: false, message: 'Certificate not found or invalid' });
    }

    return res.json({
      success: true,
      valid: certificate.status === 'issued',
      certificate: {
        certificateNumber: certificate.certificateNumber,
        eventTitle: certificate.eventTitle,
        participantName: certificate.participantName,
        eventDate: certificate.eventDate,
        certificateType: certificate.certificateType,
        position: certificate.position,
        issueDate: certificate.issueDate,
        issuerName: certificate.issuerName,
        issuerDesignation: certificate.issuerDesignation,
        status: certificate.status,
      },
    });
  } catch (error) {
    console.error('[verifyCertificate] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 7. EVENT ANNOUNCEMENTS & FEEDBACK ─────────────────────────────────────────

/**
 * Creates targeted event or club announcement.
 * POST /api/events/announcements
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, eventId, clubId, targetAudience, department, expiryDate } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const announcement = await EventAnnouncement.create({
      title,
      content,
      event: eventId || null,
      club: clubId || null,
      organizer: req.user._id,
      targetAudience: targetAudience || 'all',
      department: department || 'ALL',
      publishDate: new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: 'published',
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement published successfully',
      data: announcement,
    });
  } catch (error) {
    console.error('[createAnnouncement] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves announcements.
 * GET /api/events/announcements
 */
exports.getAnnouncements = async (req, res) => {
  try {
    const { eventId, clubId } = req.query;
    const query = { status: 'published' };
    if (eventId) query.event = eventId;
    if (clubId) query.club = clubId;

    const announcements = await EventAnnouncement.find(query)
      .populate('organizer', 'name role')
      .sort({ publishDate: -1 })
      .limit(30);

    return res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('[getAnnouncements] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submits post-event feedback.
 * POST /api/events/:id/feedback
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { ratings, comments, isAnonymous } = req.body;
    if (!ratings || !ratings.overall) {
      return res.status(400).json({ success: false, message: 'Ratings are required' });
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Verify attendee or confirmed registration
    const registration = await EventRegistration.findOne({
      event: req.params.id,
      student: student._id,
      status: { $in: ['confirmed', 'attended'] },
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'Only confirmed or attended participants can submit feedback for this event',
      });
    }

    const existing = await EventFeedback.findOne({ event: req.params.id, student: student._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already submitted feedback for this event' });
    }

    const feedback = await EventFeedback.create({
      event: req.params.id,
      student: student._id,
      ratings: {
        overall: Number(ratings.overall) || 5,
        organization: Number(ratings.organization) || 5,
        venue: Number(ratings.venue) || 5,
        content: Number(ratings.content) || 5,
      },
      comments: comments || '',
      isAnonymous: Boolean(isAnonymous),
    });

    // Update aggregate rating summary on event
    const allFeedback = await EventFeedback.find({ event: req.params.id });
    const avg = allFeedback.reduce((acc, f) => acc + f.ratings.overall, 0) / allFeedback.length;
    await CampusEvent.findByIdAndUpdate(req.params.id, {
      'feedbackSummary.averageRating': Math.round(avg * 10) / 10,
      'feedbackSummary.totalReviews': allFeedback.length,
    });

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you!',
      data: feedback,
    });
  } catch (error) {
    console.error('[submitFeedback] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 8. METRICS & CSV EXPORTS (CWE-1236 DEFENSE) ───────────────────────────────

/**
 * Returns direct database-calculated metrics for admin dashboard.
 * GET /api/events/reports/overview
 */
exports.getOverviewMetrics = async (req, res) => {
  try {
    const metrics = await eventService.getEventMetrics();
    return res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[getOverviewMetrics] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Exports event participants to CSV with formula injection sanitization.
 * GET /api/events/:id/export-participants
 */
exports.exportParticipantsCsv = async (req, res) => {
  try {
    const event = await CampusEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const registrations = await EventRegistration.find({ event: event._id })
      .populate('student', 'fullName rollNumber branch semester email phone')
      .sort({ registeredAt: 1 });

    const headers = [
      'Registration Number',
      'Roll Number',
      'Student Name',
      'Branch',
      'Semester',
      'Status',
      'Waitlist Number',
      'Registered At',
    ];

    let csvContent = eventService.toCsvRow(headers);

    for (const reg of registrations) {
      const student = reg.student || {};
      const row = [
        reg.registrationNumber,
        student.rollNumber || 'N/A',
        student.fullName || 'N/A',
        student.branch || 'N/A',
        student.semester || 'N/A',
        reg.status,
        reg.waitlistNumber !== null ? String(reg.waitlistNumber) : '',
        reg.registeredAt ? new Date(reg.registeredAt).toISOString() : '',
      ];
      csvContent += eventService.toCsvRow(row);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="participants-${event.eventCode}-${Date.now()}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[exportParticipantsCsv] error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
