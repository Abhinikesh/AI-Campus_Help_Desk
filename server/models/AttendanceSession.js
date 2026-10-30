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
    startTime: {
      type: String,
      default: '09:00 AM',
    },
    endTime: {
      type: String,
      default: '10:00 AM',
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

// Synchronize sessionDate with date, and sessionStatus with status
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
  next();
});

attendanceSessionSchema.index({ subject: 1, date: 1, period: 1 });
attendanceSessionSchema.index({ faculty: 1, date: 1 });
attendanceSessionSchema.index({ branch: 1, semester: 1, status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
