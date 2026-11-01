/**
 * server/controllers/timetable.controller.js
 * Controller for Timetable Management, Scheduling, Conflict Detection, and Versioning.
 */
'use strict';

const mongoose = require('mongoose');
const Timetable = require('../models/Timetable');
const TimetableVersion = require('../models/TimetableVersion');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const User = require('../models/User');
const { detectSchedulingConflicts } = require('../services/schedulingConflict.service');
const notificationService = require('../services/notification.service');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * POST /api/timetable
 * Create a new weekly timetable entry with conflict verification.
 */
async function createTimetableEntry(req, res) {
  try {
    const {
      subject,
      faculty,
      academicYear = '2026-2027',
      department = 'CSE',
      branch = 'CSE',
      semester,
      section = 'A',
      batch = 'All',
      dayOfWeek,
      period = 1,
      periodCount = 1,
      startTime,
      endTime,
      room = 'TBA',
      sessionType = 'Lecture',
      status = 'draft',
      effectiveStartDate,
      effectiveEndDate,
    } = req.body;

    if (!subject || !faculty || dayOfWeek === undefined || !startTime || !endTime || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, faculty, dayOfWeek, startTime, endTime, and semester are mandatory.',
      });
    }

    // Role check: Faculty can only schedule for themselves unless admin
    if (req.user.role === 'faculty' && req.user._id.toString() !== faculty.toString() && req.user.userId?.toString() !== faculty.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Faculty can only create timetable entries assigned to themselves.',
      });
    }

    // Conflict detection
    const conflictResult = await detectSchedulingConflicts({
      subject,
      faculty,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      department,
      semester: Number(semester),
      section,
      batch,
      room,
      specificDate: req.body.specificDate || effectiveStartDate,
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        message: conflictResult.reason,
        details: conflictResult.details,
      });
    }

    const newEntry = await Timetable.create({
      subject,
      faculty,
      academicYear,
      department: department.toUpperCase(),
      branch: (branch || department).toUpperCase(),
      semester: Number(semester),
      section,
      batch,
      dayOfWeek: Number(dayOfWeek),
      dayName: DAY_NAMES[Number(dayOfWeek)],
      period: Number(period),
      periodCount: Number(periodCount),
      startTime,
      endTime,
      room,
      sessionType,
      status: req.user.role === 'admin' ? status : 'draft',
      effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : null,
      effectiveEndDate: effectiveEndDate ? new Date(effectiveEndDate) : null,
    });

    const populated = await Timetable.findById(newEntry._id)
      .populate('subject', 'name code credits semester branch')
      .populate('faculty', 'name email');

    return res.status(201).json({
      success: true,
      message: 'Timetable entry created successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error creating timetable entry:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while creating timetable entry.',
    });
  }
}

/**
 * GET /api/timetable
 * Query timetable entries by filters (admin & faculty).
 */
async function getTimetableEntries(req, res) {
  try {
    const {
      department,
      semester,
      section,
      faculty,
      academicYear,
      status,
      dayOfWeek,
    } = req.query;

    const query = {};

    if (department) query.department = department.toUpperCase();
    if (semester) query.semester = Number(semester);
    if (section && section !== 'All') query.section = section;
    if (faculty) query.faculty = faculty;
    if (academicYear) query.academicYear = academicYear;
    if (dayOfWeek !== undefined) query.dayOfWeek = Number(dayOfWeek);

    // Filter status based on role
    if (req.user.role === 'student') {
      query.status = 'published';
    } else if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'archived' };
    }

    const entries = await Timetable.find(query)
      .populate('subject', 'name code credits semester branch')
      .populate('faculty', 'name email')
      .sort({ dayOfWeek: 1, startTime: 1 });

    return res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    console.error('Error fetching timetable entries:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching timetable entries.',
    });
  }
}

/**
 * GET /api/timetable/student
 * Retrieve published weekly timetable for authenticated student.
 */
async function getStudentTimetable(req, res) {
  try {
    const student = await Student.findOne({ user: req.user._id || req.user.userId }).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
    }

    const department = (student.branch || 'CSE').toUpperCase();
    const semester = student.semester || 5;
    const section = student.section || 'A';

    // Strictly fetch published entries
    const entries = await Timetable.find({
      department,
      semester,
      section: { $in: [section, 'All'] },
      status: 'published',
    })
      .populate('subject', 'name code credits semester branch')
      .populate('faculty', 'name email')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((t) => ({
      _id: t._id,
      dayOfWeek: t.dayOfWeek,
      dayName: t.dayName || DAY_NAMES[t.dayOfWeek],
      startTime: t.startTime,
      endTime: t.endTime,
      time: `${t.startTime} - ${t.endTime}`,
      room: t.room || 'TBA',
      sessionType: t.sessionType || 'Lecture',
      period: t.period,
      periodCount: t.periodCount,
      subject: t.subject,
      faculty: t.faculty,
    }));

    return res.status(200).json({
      success: true,
      cohort: { department, semester, section },
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching student timetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching student timetable.',
    });
  }
}

/**
 * GET /api/timetable/faculty
 * Retrieve weekly teaching schedule for authenticated faculty.
 */
async function getFacultyTimetable(req, res) {
  try {
    const facultyId = req.user._id || req.user.userId;

    const entries = await Timetable.find({
      faculty: facultyId,
      status: { $in: ['published', 'updated', 'draft'] },
    })
      .populate('subject', 'name code credits semester branch')
      .populate('faculty', 'name email')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((t) => ({
      _id: t._id,
      dayOfWeek: t.dayOfWeek,
      dayName: t.dayName || DAY_NAMES[t.dayOfWeek],
      startTime: t.startTime,
      endTime: t.endTime,
      time: `${t.startTime} - ${t.endTime}`,
      room: t.room || 'TBA',
      sessionType: t.sessionType || 'Lecture',
      period: t.period,
      periodCount: t.periodCount,
      semester: t.semester,
      section: t.section,
      department: t.department,
      status: t.status,
      subject: t.subject,
      faculty: t.faculty,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching faculty timetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching faculty timetable.',
    });
  }
}

/**
 * PUT /api/timetable/:id
 * Update an existing timetable entry with conflict verification and audited revision tracking.
 */
async function updateTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    const {
      subject,
      faculty,
      dayOfWeek,
      startTime,
      endTime,
      room,
      period,
      periodCount,
      sessionType,
      reason,
      status,
    } = req.body;

    const existing = await Timetable.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found.' });
    }

    // Role check: Only admin or assigned faculty
    const isOwner =
      existing.faculty.toString() === req.user._id.toString() ||
      existing.faculty.toString() === req.user.userId?.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to edit this timetable entry.',
      });
    }

    // If published, require mandatory reason
    if (existing.status === 'published' && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        message: 'Modification of a published timetable requires a mandatory reason (minimum 5 characters).',
      });
    }

    const updatedFaculty = faculty || existing.faculty;
    const updatedSubject = subject || existing.subject;
    const updatedDay = dayOfWeek !== undefined ? Number(dayOfWeek) : existing.dayOfWeek;
    const updatedStart = startTime || existing.startTime;
    const updatedEnd = endTime || existing.endTime;
    const updatedRoom = room !== undefined ? room : existing.room;

    // Run conflict check excluding this entry
    const conflictResult = await detectSchedulingConflicts(
      {
        subject: updatedSubject,
        faculty: updatedFaculty,
        dayOfWeek: updatedDay,
        startTime: updatedStart,
        endTime: updatedEnd,
        department: existing.department,
        semester: existing.semester,
        section: existing.section,
        batch: existing.batch,
        room: updatedRoom,
      },
      existing._id
    );

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        message: conflictResult.reason,
        details: conflictResult.details,
      });
    }

    // Record change history if published
    if (existing.status === 'published' || existing.status === 'updated') {
      existing.changeHistory.push({
        previousValue: {
          dayOfWeek: existing.dayOfWeek,
          dayName: existing.dayName,
          startTime: existing.startTime,
          endTime: existing.endTime,
          room: existing.room,
          faculty: existing.faculty,
        },
        newValue: {
          dayOfWeek: updatedDay,
          dayName: DAY_NAMES[updatedDay],
          startTime: updatedStart,
          endTime: updatedEnd,
          room: updatedRoom,
          faculty: updatedFaculty,
        },
        changedBy: req.user._id || req.user.userId,
        changedAt: new Date(),
        reason: reason ? reason.trim() : 'Schedule revision',
      });
      existing.status = 'updated';
    }

    if (subject) existing.subject = subject;
    if (faculty) existing.faculty = faculty;
    if (dayOfWeek !== undefined) {
      existing.dayOfWeek = Number(dayOfWeek);
      existing.dayName = DAY_NAMES[Number(dayOfWeek)];
    }
    if (startTime) existing.startTime = startTime;
    if (endTime) existing.endTime = endTime;
    if (room !== undefined) existing.room = room;
    if (period !== undefined) existing.period = Number(period);
    if (periodCount !== undefined) existing.periodCount = Number(periodCount);
    if (sessionType) existing.sessionType = sessionType;
    if (status && req.user.role === 'admin') existing.status = status;

    await existing.save();

    // Alert students if updated schedule was published
    if (existing.status === 'updated') {
      try {
        const students = await Student.find({
          branch: existing.department,
          semester: existing.semester,
        }).lean();

        for (const st of students) {
          await notificationService.createNotification({
            recipient: st.user,
            title: `Class Rescheduled: ${existing.dayName} (${existing.startTime} - ${existing.endTime})`,
            message: `Your class has been rescheduled to ${existing.dayName} at ${existing.startTime} in ${existing.room}. Reason: ${reason || 'Schedule update'}`,
            category: 'timetable',
            priority: 'normal',
            relatedEntityType: 'System',
          });
        }
      } catch (notifErr) {
        console.warn('Failed to dispatch reschedule notification:', notifErr.message);
      }
    }

    const populated = await Timetable.findById(existing._id)
      .populate('subject', 'name code credits semester branch')
      .populate('faculty', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Timetable entry updated successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error updating timetable entry:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while updating timetable entry.',
    });
  }
}

/**
 * DELETE /api/timetable/:id
 * Cancel or remove a timetable entry.
 */
async function cancelTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'Class cancelled by department' } = req.body;

    const entry = await Timetable.findById(id).populate('subject', 'code name');
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found.' });
    }

    const isOwner =
      entry.faculty.toString() === req.user._id.toString() ||
      entry.faculty.toString() === req.user.userId?.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to cancel this timetable entry.',
      });
    }

    entry.status = 'cancelled';
    entry.changeHistory.push({
      previousValue: { status: 'published' },
      newValue: { status: 'cancelled' },
      changedBy: req.user._id || req.user.userId,
      changedAt: new Date(),
      reason: reason.trim(),
    });

    await entry.save();

    // Notify cohort
    try {
      const students = await Student.find({
        branch: entry.department,
        semester: entry.semester,
      }).lean();

      for (const st of students) {
        await notificationService.createNotification({
          recipient: st.user,
          title: `Class Cancelled: ${entry.subject?.code || 'Course'} on ${entry.dayName}`,
          message: `The class for ${entry.subject?.name || 'Subject'} on ${entry.dayName} (${entry.startTime}) has been cancelled. Reason: ${reason}`,
          category: 'timetable',
          priority: 'high',
          relatedEntityType: 'System',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to dispatch class cancellation notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Timetable entry cancelled successfully.',
      data: entry,
    });
  } catch (error) {
    console.error('Error cancelling timetable entry:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while cancelling timetable entry.',
    });
  }
}

/**
 * POST /api/timetable/publish
 * Publish all draft/updated entries for an academic cohort, create an immutable version snapshot,
 * and dispatch centralized notifications.
 */
async function publishTimetable(req, res) {
  try {
    const {
      academicYear = '2026-2027',
      department = 'CSE',
      semester,
      section = 'A',
      notes = 'Official semester timetable published',
    } = req.body;

    if (!semester) {
      return res.status(400).json({
        success: false,
        message: 'Semester is required for timetable publication.',
      });
    }

    const cohortQuery = {
      academicYear,
      department: department.toUpperCase(),
      semester: Number(semester),
      section,
      status: { $in: ['draft', 'updated', 'published'] },
    };

    // Transition all active entries to 'published'
    await Timetable.updateMany(
      cohortQuery,
      { $set: { status: 'published' } }
    );

    const publishedEntries = await Timetable.find({
      academicYear,
      department: department.toUpperCase(),
      semester: Number(semester),
      section,
      status: 'published',
    })
      .populate('subject', 'name code')
      .populate('faculty', 'name email')
      .lean();

    if (!publishedEntries.length) {
      return res.status(400).json({
        success: false,
        message: 'No timetable entries found to publish for this cohort.',
      });
    }

    // Determine next version number
    const lastVersion = await TimetableVersion.findOne({
      academicYear,
      department: department.toUpperCase(),
      semester: Number(semester),
      section,
    }).sort({ versionNumber: -1 }).lean();

    const nextVersionNum = (lastVersion?.versionNumber || 0) + 1;

    // Create immutable snapshot in TimetableVersion
    const snapshot = publishedEntries.map((e) => ({
      timetableId: e._id,
      subjectId: e.subject?._id,
      subjectCode: e.subject?.code,
      subjectName: e.subject?.name,
      facultyId: e.faculty?._id,
      facultyName: e.faculty?.name,
      dayOfWeek: e.dayOfWeek,
      dayName: e.dayName,
      period: e.period,
      startTime: e.startTime,
      endTime: e.endTime,
      room: e.room,
      sessionType: e.sessionType,
    }));

    const versionDoc = await TimetableVersion.create({
      academicYear,
      department: department.toUpperCase(),
      semester: Number(semester),
      section,
      versionNumber: nextVersionNum,
      status: 'published',
      entryCount: snapshot.length,
      entriesSnapshot: snapshot,
      publishedBy: req.user._id || req.user.userId,
      publishedAt: new Date(),
      notes,
    });

    // Dispatch centralized notifications to all cohort students
    try {
      const students = await Student.find({
        branch: department.toUpperCase(),
        semester: Number(semester),
      }).lean();

      for (const st of students) {
        await notificationService.createNotification({
          recipient: st.user,
          title: `Official Timetable Published: Sem ${semester} (${department.toUpperCase()})`,
          message: `The official weekly timetable (Version ${nextVersionNum}) has been published for Semester ${semester} Section ${section}. Please review your lecture schedule.`,
          category: 'timetable',
          priority: 'high',
          relatedEntityType: 'System',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to dispatch timetable publication notifications:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Timetable Version ${nextVersionNum} published successfully.`,
      version: versionDoc,
      publishedCount: publishedEntries.length,
    });
  } catch (error) {
    console.error('Error publishing timetable:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while publishing timetable.',
    });
  }
}

/**
 * GET /api/timetable/versions
 * Retrieve historical timetable versions for a cohort.
 */
async function getTimetableVersions(req, res) {
  try {
    const { department = 'CSE', semester, section = 'A', academicYear = '2026-2027' } = req.query;

    const query = {
      academicYear,
      department: department.toUpperCase(),
    };
    if (semester) query.semester = Number(semester);
    if (section) query.section = section;

    const versions = await TimetableVersion.find(query)
      .populate('publishedBy', 'name email role')
      .sort({ versionNumber: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: versions.length,
      data: versions,
    });
  } catch (error) {
    console.error('Error fetching timetable versions:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching timetable versions.',
    });
  }
}

module.exports = {
  createTimetableEntry,
  getTimetableEntries,
  getStudentTimetable,
  getFacultyTimetable,
  updateTimetableEntry,
  cancelTimetableEntry,
  publishTimetable,
  getTimetableVersions,
};
