/**
 * server/controllers/calendar.controller.js
 * Controller for Centralized Academic Calendar Management and Aggregated Event Delivery.
 */
'use strict';

const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const { getAggregatedCalendarEvents } = require('../services/academicCalendar.service');
const notificationService = require('../services/notification.service');
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * POST /api/calendar/events
 * Create an academic calendar event (Admin only).
 */
async function createCalendarEvent(req, res) {
  try {
    const {
      title,
      description = '',
      eventType = 'college_event',
      startDate,
      endDate,
      isAllDay = true,
      academicYear = '2026-2027',
      department = 'ALL',
      branch = 'ALL',
      semester = 0,
      section = 'ALL',
      audience = 'all',
      venue = 'Campus Wide',
      status = 'published',
      sendNotification = true,
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, startDate, and endDate are mandatory.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for startDate or endDate. Use standard ISO date strings.',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date interval: startDate must be on or before endDate.',
      });
    }

    const event = await AcademicCalendarEvent.create({
      title: title.trim(),
      description: description.trim(),
      eventType,
      startDate: start,
      endDate: end,
      isAllDay: Boolean(isAllDay),
      academicYear,
      department: department.toUpperCase(),
      branch: branch.toUpperCase(),
      semester: Number(semester),
      section: section.toUpperCase(),
      audience,
      venue: venue.trim(),
      status,
      createdBy: req.user._id || req.user.userId,
    });

    // Optionally notify audience if published and event is significant
    if (status === 'published' && sendNotification) {
      try {
        let recipientQuery = {};
        if (audience === 'students') {
          recipientQuery.role = 'student';
        } else if (audience === 'faculty') {
          recipientQuery.role = 'faculty';
        } else if (audience === 'all') {
          recipientQuery.role = { $in: ['student', 'faculty'] };
        }

        const recipients = await User.find(recipientQuery).select('_id').lean();
        for (const u of recipients) {
          await notificationService.createNotification({
            recipient: u._id,
            title: `Academic Calendar: ${event.title}`,
            message: `${event.title} is scheduled from ${start.toDateString()} to ${end.toDateString()} at ${event.venue}.`,
            category: 'academic',
            priority: eventType.includes('holiday') ? 'high' : 'normal',
            relatedEntityType: 'System',
          });
        }
      } catch (notifErr) {
        console.warn('Failed to dispatch calendar event notification:', notifErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Academic calendar event created successfully.',
      data: event,
    });
  } catch (error) {
    console.error('Error creating academic calendar event:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while creating calendar event.',
    });
  }
}

/**
 * GET /api/calendar/events
 * Retrieve unified, aggregated calendar events (Academic Events + Exams + Assignments).
 */
async function getCalendarEvents(req, res) {
  try {
    const { startDate, endDate, eventType, academicYear } = req.query;

    const events = await getAggregatedCalendarEvents(req.user, {
      startDate,
      endDate,
      eventType,
      academicYear,
    });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching calendar events.',
    });
  }
}

/**
 * GET /api/calendar/upcoming
 * Lightweight upcoming events list for user dashboard widgets.
 */
async function getUpcomingEvents(req, res) {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = await getAggregatedCalendarEvents(req.user, {
      startDate: now.toISOString(),
      endDate: thirtyDaysLater.toISOString(),
    });

    const upcoming = events.slice(0, 8);

    return res.status(200).json({
      success: true,
      count: upcoming.length,
      data: upcoming,
    });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching upcoming events.',
    });
  }
}

/**
 * PUT /api/calendar/events/:id
 * Update an existing calendar event (Admin only).
 */
async function updateCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    const event = await AcademicCalendarEvent.findById(id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Calendar event not found.' });
    }

    const updates = req.body;
    if (updates.startDate) event.startDate = new Date(updates.startDate);
    if (updates.endDate) event.endDate = new Date(updates.endDate);
    if (updates.title) event.title = updates.title.trim();
    if (updates.description !== undefined) event.description = updates.description.trim();
    if (updates.eventType) event.eventType = updates.eventType;
    if (updates.isAllDay !== undefined) event.isAllDay = Boolean(updates.isAllDay);
    if (updates.venue) event.venue = updates.venue.trim();
    if (updates.status) event.status = updates.status;
    if (updates.audience) event.audience = updates.audience;

    event.lastModifiedBy = req.user._id || req.user.userId;
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Calendar event updated successfully.',
      data: event,
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while updating calendar event.',
    });
  }
}

/**
 * DELETE /api/calendar/events/:id
 * Cancel or archive a calendar event (Admin only).
 */
async function deleteCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    const event = await AcademicCalendarEvent.findById(id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Calendar event not found.' });
    }

    event.status = 'cancelled';
    event.lastModifiedBy = req.user._id || req.user.userId;
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Calendar event cancelled successfully.',
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while deleting calendar event.',
    });
  }
}

module.exports = {
  createCalendarEvent,
  getCalendarEvents,
  getUpcomingEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
};

