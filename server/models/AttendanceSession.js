/**
 * server/models/AttendanceSession.js
 * Represents a single smart attendance class session created by faculty.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty user is required'],
    },
    date: {
      type: String, // YYYY-MM-DD
      required: [true, 'Session date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    sessionDate: {
      type: String,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    period: {
      type: Number,
      required: [true, 'Period is required'],
      min: 1,
      max: 10,
      default: 1,
    },
    /** Multi-period support for laboratory and combined block sessions (e.g. [3, 4]) */
    periods: {
      type: [Number],
      default: undefined,
    },
    periodCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    /** Linkage to authoritative weekly timetable entry */
    timetableEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      default: null,
    },
    startTime: {
      type: String,
      default: '09:00 AM',
    },
    endTime: {
      type: String,
      default: '10:00 AM',
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    academicYear: {
      type: String,
      default: '2025-2026',
    },
    sessionType: {
      type: String,
      enum: ['regular', 'makeup', 'lab', 'tutorial'],
      default: 'regular',
    },
    attendanceMethod: {
      type: String,
      enum: ['face', 'qr_face', 'manual'],
      default: 'face',
    },
    status: {
      type: String,
      enum: ['scheduled', 'open', 'active', 'paused', 'closed', 'completed', 'finalized', 'cancelled', 'expired'],
      default: 'open',
    },
    sessionStatus: {
      type: String,
      enum: ['scheduled', 'open', 'active', 'paused', 'closed', 'completed', 'finalized', 'cancelled', 'expired'],
    },
    branch: {
      type: String,
      default: 'CSE',
      trim: true,
    },
    semester: {
      type: Number,
      default: 4,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    totalStudents: {
      type: Number,
      default: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
    },
    // Rotating QR challenge fields
    qrChallengeToken: {
      type: String,
      default: null,
    },
    qrChallengeExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Track original status on document load or after save for transition validation
attendanceSessionSchema.post('init', function () {
  this._originalStatus = this.status;
});

attendanceSessionSchema.post('save', function () {
  this._originalStatus = this.status;
});

// Synchronize sessionDate with date, sessionStatus with status, and enforce multi-period / state-machine rules
attendanceSessionSchema.pre('save', function (next) {
  if (this.date && !this.sessionDate) {
    this.sessionDate = this.date;
  }
  if (!this.date && this.sessionDate) {
    this.date = this.sessionDate;
  }
  if (this.status && !this.sessionStatus) {
    this.sessionStatus = this.status;
  }
  if (!this.status && this.sessionStatus) {
    this.status = this.sessionStatus;
  }
  if (!this.sessionId) {
    this.sessionId = this._id.toString();
  }

  // Multi-period array synchronization
  if (this.periods && Array.isArray(this.periods) && this.periods.length > 0) {
    this.periodCount = this.periods.length;
    this.period = this.periods[0];
  } else if (this.period) {
    this.periods = [this.period];
    this.periodCount = 1;
  }

  // Session state transition validation
  if (!this.isNew && this.isModified('status') && this._originalStatus && this._originalStatus !== this.status) {
    const allowedTransitions = {
      scheduled: ['open', 'active', 'cancelled'],
      open: ['active', 'paused', 'closed', 'finalized', 'cancelled'],
      active: ['paused', 'closed', 'finalized', 'cancelled'],
      paused: ['open', 'active', 'closed', 'cancelled'],
      closed: ['finalized', 'cancelled'],
      finalized: [], // terminal
      cancelled: [], // terminal
      expired: ['closed', 'finalized', 'cancelled'],
    };
    const allowed = allowedTransitions[this._originalStatus] || [];
    if (!allowed.includes(this.status)) {
      return next(new Error(`Invalid session state transition from "${this._originalStatus}" to "${this.status}"`));
    }
  }

  next();
});

attendanceSessionSchema.index({ subject: 1, date: 1, period: 1 });
attendanceSessionSchema.index({ faculty: 1, date: 1 });
attendanceSessionSchema.index({ branch: 1, semester: 1, status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
