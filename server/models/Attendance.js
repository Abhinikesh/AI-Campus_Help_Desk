/**
 * server/models/Attendance.js (AttendanceRecord)
 * Per-class attendance record.
 * One document = one student, one session/subject, one date, one period.
 * Extended with full Smart Attendance fields, duplicate prevention, and correction auditing.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      sparse: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
    },
    /** ISO date string, e.g. "2026-04-12" */
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    period: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused', 'pending', 'review'],
      required: [true, 'Status is required'],
      default: 'absent',
    },
    attendanceStatus: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused', 'pending', 'review'],
    },
    verificationMethod: {
      type: String,
      enum: ['face', 'manual', 'qr', 'system'],
      default: 'manual',
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'manual', 'pending_review', 'rejected'],
      default: 'verified',
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    isManualOverride: {
      type: Boolean,
      default: false,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctionReason: {
      type: String,
      default: '',
    },
    overrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    overrideNote: {
      type: String,
      default: '',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Pre-save synchronizers
attendanceSchema.pre('save', function (next) {
  if (this.status && !this.attendanceStatus) {
    this.attendanceStatus = this.status;
  }
  if (!this.status && this.attendanceStatus) {
    this.status = this.attendanceStatus;
  }
  if (!this.attendanceId) {
    this.attendanceId = this._id.toString();
  }
  if (this.isManualOverride && !this.correctedAt) {
    this.correctedAt = new Date();
  }
  if (this.overrideReason && !this.correctionReason) {
    this.correctionReason = this.overrideReason;
  }
  next();
});

// Compound unique indexes preventing duplicate marking
attendanceSchema.index(
  { subject: 1, student: 1, date: 1, period: 1 },
  { unique: true }
);

attendanceSchema.index({ session: 1, student: 1 });
attendanceSchema.index({ student: 1, status: 1 });
attendanceSchema.index({ session: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
