/**
 * server/services/schedulingConflict.service.js
 * Centralized Conflict Detection & Validation Engine for Timetables and Schedules.
 */
'use strict';

const Timetable = require('../models/Timetable');
const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Subject = require('../models/Subject');

/**
 * Converts a time string (e.g., "09:30", "9:30", "09:30 AM", "02:00 PM")
 * into integer minutes from midnight (0–1439).
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim().toUpperCase();

  // Check 12-hour AM/PM format
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3];
    if (hours === 12) hours = 0;
    if (meridiem === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  // Check 24-hour HH:mm format
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Determines whether two time intervals [start1, end1] and [start2, end2] strictly overlap.
 * Assumes start < end for each interval.
 */
function doIntervalsOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

/**
 * Validates scheduling parameters and checks for faculty, class, room, holiday, and exam conflicts.
 *
 * @param {Object} slot
 * @param {string|ObjectId} slot.subject
 * @param {string|ObjectId} slot.faculty
 * @param {number} slot.dayOfWeek
 * @param {string} slot.startTime
 * @param {string} slot.endTime
 * @param {string} slot.department
 * @param {number} slot.semester
 * @param {string} slot.section
 * @param {string} [slot.batch]
 * @param {string} [slot.room]
 * @param {Date} [slot.specificDate]
 * @param {string|ObjectId} [excludeId] - Timetable ID to exclude if updating
 * @returns {Promise<{ hasConflict: boolean, reason?: string, details?: Object }>}
 */
async function detectSchedulingConflicts(slot, excludeId = null) {
  const {
    subject: subjectId,
    faculty: facultyId,
    dayOfWeek,
    startTime,
    endTime,
    department,
    semester,
    section,
    batch = 'All',
    room = 'TBA',
    specificDate = null,
  } = slot;

  // 1. Time Interval Bounds
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);

  if (startMin === null || endMin === null) {
    return {
      hasConflict: true,
      reason: `Invalid time format: startTime "${startTime}" or endTime "${endTime}" could not be parsed. Use "HH:mm" or "HH:mm AM/PM".`,
    };
  }

  if (startMin >= endMin) {
    return {
      hasConflict: true,
      reason: `Invalid time interval: Start time (${startTime}) must be strictly before end time (${endTime}).`,
    };
  }

  // 2. Fetch subject and faculty details for clear error messaging
  const [subjectDoc, facultyUser] = await Promise.all([
    Subject.findById(subjectId).lean(),
    User.findById(facultyId).lean(),
  ]);

  if (!subjectDoc) {
    return {
      hasConflict: true,
      reason: `Subject with ID "${subjectId}" does not exist.`,
    };
  }

  const subjectCode = subjectDoc.code || 'Unknown';
  const facultyName = facultyUser?.name || 'Assigned Instructor';

  // Base query matching day of week and active entries
  const baseDayQuery = {
    dayOfWeek,
    status: { $in: ['draft', 'published', 'updated'] },
  };
  if (excludeId) {
    baseDayQuery._id = { $ne: excludeId };
  }

  // Query existing entries on the same day
  const existingEntries = await Timetable.find(baseDayQuery)
    .populate('subject', 'code name')
    .populate('faculty', 'name')
    .lean();

  for (const entry of existingEntries) {
    const eStart = parseTimeToMinutes(entry.startTime);
    const eEnd = parseTimeToMinutes(entry.endTime);
    if (eStart === null || eEnd === null) continue;

    if (!doIntervalsOverlap(startMin, endMin, eStart, eEnd)) {
      continue;
    }

    // A. Faculty Double-Booking Check
    if (entry.faculty && entry.faculty._id.toString() === facultyId.toString()) {
      return {
        hasConflict: true,
        reason: `Faculty Conflict: Professor ${entry.faculty.name || facultyName} is already scheduled to teach ${entry.subject?.code || 'another class'} in room "${entry.room}" from ${entry.startTime} to ${entry.endTime}.`,
        details: { type: 'FACULTY_DOUBLE_BOOKED', conflictingEntry: entry },
      };
    }

    // B. Class Cohort Double-Booking Check
    // Same department, semester, and section
    const sameDept = entry.department?.toUpperCase() === department?.toUpperCase();
    const sameSem = Number(entry.semester) === Number(semester);
    const sameSection =
      entry.section === 'All' || section === 'All' || entry.section === section;
    const sameBatch =
      entry.batch === 'All' || batch === 'All' || entry.batch === batch;

    if (sameDept && sameSem && sameSection && sameBatch) {
      return {
        hasConflict: true,
        reason: `Class Cohort Conflict: ${department} Semester ${semester} Section ${section} already has ${entry.subject?.code || 'another course'} scheduled from ${entry.startTime} to ${entry.endTime}.`,
        details: { type: 'CLASS_COHORT_DOUBLE_BOOKED', conflictingEntry: entry },
      };
    }

    // C. Classroom Double-Booking Check (if room is assigned and not 'TBA')
    if (
      room &&
      room.trim().toUpperCase() !== 'TBA' &&
      entry.room &&
      entry.room.trim().toUpperCase() === room.trim().toUpperCase()
    ) {
      return {
        hasConflict: true,
        reason: `Classroom Conflict: Room "${room}" is already allocated to ${entry.subject?.code || 'another course'} (${entry.department} Sem ${entry.semester}) from ${entry.startTime} to ${entry.endTime}.`,
        details: { type: 'ROOM_DOUBLE_BOOKED', conflictingEntry: entry },
      };
    }
  }

  // 3. Holiday Conflict Check (if specificDate is provided or looking at active institutional holidays)
  if (specificDate) {
    const checkDate = new Date(specificDate);
    const startOfDay = new Date(checkDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);

    const holidayEvent = await AcademicCalendarEvent.findOne({
      eventType: { $in: ['holiday_academic', 'holiday_national', 'holiday_college'] },
      status: 'published',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    }).lean();

    if (holidayEvent) {
      return {
        hasConflict: true,
        reason: `Holiday Conflict: Cannot schedule class on ${checkDate.toDateString()} due to published holiday "${holidayEvent.title}".`,
        details: { type: 'HOLIDAY_CONFLICT', holidayEvent },
      };
    }
  }

  // 4. Examination Conflict Check
  // Check if an exam is scheduled for this cohort during overlapping time
  const examQuery = {
    department,
    semester,
    status: { $in: ['scheduled', 'ongoing'] },
  };
  if (section && section !== 'All') {
    examQuery.section = { $in: [section, 'All'] };
  }

  const existingExams = await Exam.find(examQuery).populate('subject', 'code name').lean();

  for (const ex of existingExams) {
    if (!ex.date) continue;
    const examDate = new Date(ex.date);
    if (examDate.getDay() === dayOfWeek) {
      const exStart = parseTimeToMinutes(ex.startTime);
      const exEnd = parseTimeToMinutes(ex.endTime);
      if (exStart !== null && exEnd !== null && doIntervalsOverlap(startMin, endMin, exStart, exEnd)) {
        return {
          hasConflict: true,
          reason: `Examination Conflict: ${department} Sem ${semester} has an examination scheduled: "${ex.title}" (${ex.subject?.code || ''}) from ${ex.startTime} to ${ex.endTime}.`,
          details: { type: 'EXAMINATION_CONFLICT', conflictingExam: ex },
        };
      }
    }
  }

  return { hasConflict: false };
}

module.exports = {
  parseTimeToMinutes,
  doIntervalsOverlap,
  detectSchedulingConflicts,
};

