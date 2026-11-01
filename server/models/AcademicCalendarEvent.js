/**
 * server/models/AcademicCalendarEvent.js
 * Centralized Academic Calendar Events for institutional scheduling and awareness.
 */
'use strict';

const mongoose = require('mongoose');

const academicCalendarEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    eventType: {
      type: String,
      enum: [
        'semester_start',
        'semester_end',
        'holiday_academic',
        'holiday_national',
        'holiday_college',
        'examination_period',
        'internal_assessment_period',
        'practical_exam_period',
        'assignment_deadline',
        'college_event',
        'workshop_seminar',
        'faculty_meeting',
        'registration_period',
        'result_publication',
        'other',
      ],
      default: 'college_event',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    isAllDay: {
      type: Boolean,
      default: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
      required: true,
    },
    department: {
      type: String,
      default: 'ALL',
      trim: true,
    },
    branch: {
      type: String,
      default: 'ALL',
      trim: true,
    },
    semester: {
      type: Number,
      default: 0, // 0 = all semesters / institutional
      min: 0,
      max: 10,
    },
    section: {
      type: String,
      default: 'ALL',
      trim: true,
    },
    audience: {
      type: String,
      enum: ['all', 'students', 'faculty', 'department', 'semester', 'admin'],
      default: 'all',
      index: true,
    },
    venue: {
      type: String,
      default: 'Campus Wide',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'archived'],
      default: 'published',
      index: true,
    },
    linkedEntityType: {
      type: String,
      enum: ['Exam', 'Assignment', 'None'],
      default: 'None',
    },
    linkedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound indexes for range and audience filtering
academicCalendarEventSchema.index({ academicYear: 1, startDate: 1, endDate: 1, status: 1 });
academicCalendarEventSchema.index({ audience: 1, department: 1, semester: 1 });
academicCalendarEventSchema.index({ eventType: 1, startDate: 1 });

module.exports = mongoose.model('AcademicCalendarEvent', academicCalendarEventSchema);

