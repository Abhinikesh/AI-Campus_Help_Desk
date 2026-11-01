/**
 * server/models/Timetable.js
 * Authoritative Weekly Timetable Entry for academic classes and laboratory sessions.
 */
'use strict';

const mongoose = require('mongoose');

const timetableChangeSchema = new mongoose.Schema(
  {
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: [true, 'Modification reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters long'],
    },
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
      required: true,
    },
    department: {
      type: String,
      default: 'CSE',
      trim: true,
      required: true,
    },
    branch: {
      type: String,
      default: 'CSE',
      trim: true,
    },
    semester: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    batch: {
      type: String,
      default: 'All',
      trim: true,
    },
    /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: 0,
      max: 6,
    },
    dayName: {
      type: String,
      trim: true,
    },
    period: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    periodCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    room: {
      type: String,
      default: 'TBA',
      trim: true,
    },
    sessionType: {
      type: String,
      enum: ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Other'],
      default: 'Lecture',
    },
    effectiveStartDate: {
      type: Date,
      default: null,
    },
    effectiveEndDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'updated', 'cancelled', 'archived'],
      default: 'draft',
      index: true,
    },
    versionNumber: {
      type: Number,
      default: 1,
    },
    changeHistory: [timetableChangeSchema],
  },
  { timestamps: true }
);

// Helpful virtual for display label
timetableSchema.virtual('timeSlot').get(function () {
  return `${this.startTime} - ${this.endTime}`;
});

// Auto-fill dayName if not supplied
timetableSchema.pre('save', function () {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (this.dayOfWeek !== undefined && !this.dayName) {
    this.dayName = days[this.dayOfWeek];
  }
});

// Indexes for scheduling lookups and conflict prevention
timetableSchema.index({ department: 1, semester: 1, section: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ faculty: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ room: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ subject: 1, status: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
