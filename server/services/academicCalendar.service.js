/**
 * server/services/academicCalendar.service.js
 * Centralized Academic Calendar Aggregation Service.
 * Unifies institutional events, examinations (Part 14), and assignment deadlines (Part 13).
 */
'use strict';

const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const Exam = require('../models/Exam');
const Assignment = require('../models/Assignment');
const Timetable = require('../models/Timetable');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

/**
 * Resolves aggregated academic calendar events for a specific user and date range.
 *
 * @param {Object} user - The authenticated req.user object
 * @param {Object} options - Query filters
 * @param {Date} [options.startDate]
 * @param {Date} [options.endDate]
 * @param {string} [options.eventType]
 * @param {string} [options.academicYear]
 * @returns {Promise<Array<Object>>} Unified list of calendar events
 */
async function getAggregatedCalendarEvents(user, options = {}) {
  const {
    startDate,
    endDate,
    eventType,
    academicYear = '2026-2027',
  } = options;

  const role = user?.role || 'student';
  const userId = user?.userId || user?._id;

  // Resolve user cohort details
  let userDept = 'CSE';
  let userSemester = 5;
  let userSection = 'A';

  if (role === 'student') {
    const studentProfile = await Student.findOne({ user: userId }).lean();
    if (studentProfile) {
      userDept = studentProfile.branch || 'CSE';
      userSemester = studentProfile.semester || 5;
      userSection = studentProfile.section || 'A';
    }
  } else if (role === 'faculty') {
    const facultyProfile = await Faculty.findOne({ user: userId }).lean();
    if (facultyProfile) {
      userDept = facultyProfile.department || 'CSE';
    }
  }

  // 1. Fetch AcademicCalendarEvent documents
  const eventQuery = {
    status: 'published',
  };

  if (academicYear) {
    eventQuery.academicYear = academicYear;
  }

  if (startDate && endDate) {
    eventQuery.$or = [
      { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      {
        startDate: { $lte: new Date(startDate) },
        endDate: { $gte: new Date(endDate) },
      },
    ];
  }

  if (eventType && eventType !== 'all') {
    eventQuery.eventType = eventType;
  }

  // Role & Audience Filtering
  if (role === 'student') {
    eventQuery.$and = [
      {
        audience: { $in: ['all', 'students', 'department', 'semester'] },
      },
      {
        $or: [
          { department: 'ALL' },
          { department: userDept },
        ],
      },
      {
        $or: [
          { semester: 0 },
          { semester: userSemester },
        ],
      },
    ];
  } else if (role === 'faculty') {
    eventQuery.$and = [
      {
        audience: { $in: ['all', 'faculty', 'department', 'semester', 'admin'] },
      },
      {
        $or: [
          { department: 'ALL' },
          { department: userDept },
        ],
      },
    ];
  }
  // Admin sees all events

  const rawEvents = await AcademicCalendarEvent.find(eventQuery)
    .populate('createdBy', 'name role')
    .sort({ startDate: 1 })
    .lean();

  const unifiedEvents = rawEvents.map((ev) => ({
    _id: ev._id,
    id: ev._id,
    title: ev.title,
    description: ev.description,
    eventType: ev.eventType,
    category: 'institutional',
    startDate: ev.startDate,
    endDate: ev.endDate,
    isAllDay: ev.isAllDay,
    academicYear: ev.academicYear,
    department: ev.department,
    semester: ev.semester,
    audience: ev.audience,
    venue: ev.venue,
    status: ev.status,
    source: 'calendar_event',
    createdBy: ev.createdBy?.name || 'Administrator',
  }));

  // 2. Fetch Integrated Examinations (Part 14)
  if (!eventType || eventType === 'all' || eventType === 'examination') {
    const examQuery = {
      status: { $in: ['scheduled', 'ongoing', 'completed'] },
    };

    if (role === 'student') {
      examQuery.department = userDept;
      examQuery.semester = userSemester;
      examQuery.section = { $in: [userSection, 'All'] };
    } else if (role === 'faculty') {
      examQuery.$or = [{ faculty: userId }, { department: userDept }];
    }

    if (startDate && endDate) {
      examQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const exams = await Exam.find(examQuery)
      .populate('subject', 'name code')
      .populate('faculty', 'name')
      .lean();

    exams.forEach((ex) => {
      unifiedEvents.push({
        _id: ex._id,
        id: `exam-${ex._id}`,
        title: `Exam: ${ex.title} (${ex.subject?.code || ''})`,
        description: `Examination for ${ex.subject?.name || 'Subject'}. Timing: ${ex.startTime} - ${ex.endTime}. Instructions: ${ex.instructions || 'Standard examination rules apply.'}`,
        eventType: 'examination_period',
        category: 'examination',
        startDate: ex.date,
        endDate: ex.date,
        startTime: ex.startTime,
        endTime: ex.endTime,
        isAllDay: false,
        academicYear: ex.academicYear,
        department: ex.department,
        semester: ex.semester,
        audience: 'all',
        venue: ex.room || ex.venue || 'Examination Hall',
        status: ex.status,
        source: 'exam_record',
        createdBy: ex.faculty?.name || 'Academic Cell',
      });
    });
  }

  // 3. Fetch Integrated Assignment Deadlines (Part 13)
  if (!eventType || eventType === 'all' || eventType === 'assignment') {
    const assignmentQuery = {
      status: { $in: ['published', 'closed'] },
    };

    if (role === 'student') {
      assignmentQuery.semester = userSemester;
      if (userDept) assignmentQuery.department = { $in: [userDept, ''] };
      assignmentQuery.section = { $in: [userSection, 'All'] };
    } else if (role === 'faculty') {
      assignmentQuery.$or = [{ faculty: userId }, { department: userDept }];
    }

    if (startDate && endDate) {
      assignmentQuery.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const assignments = await Assignment.find(assignmentQuery)
      .populate('subject', 'name code')
      .populate('faculty', 'name')
      .lean();

    assignments.forEach((asg) => {
      unifiedEvents.push({
        _id: asg._id,
        id: `asg-${asg._id}`,
        title: `Due: ${asg.title} (${asg.subject?.code || ''})`,
        description: `Assignment submission deadline for ${asg.subject?.name || 'Subject'}. Max Marks: ${asg.maximumMarks}.`,
        eventType: 'assignment_deadline',
        category: 'assignment',
        startDate: asg.dueDate,
        endDate: asg.dueDate,
        isAllDay: false,
        academicYear: academicYear,
        department: asg.department || userDept,
        semester: asg.semester,
        audience: 'students',
        venue: 'Online Submission Portal',
        status: asg.status,
        source: 'assignment_record',
        createdBy: asg.faculty?.name || 'Course Instructor',
      });
    });
  }

  // Sort chronologically by start date
  unifiedEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  return unifiedEvents;
}

module.exports = {
  getAggregatedCalendarEvents,
};

