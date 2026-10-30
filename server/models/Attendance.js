/**
 * server/models/Attendance.js
 * Per-class attendance record.
 * One document = one student, one subject, one date, one period.
 * Extended with Smart Attendance session and face verification fields.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
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
      enum: ['present', 'absent', 'pending', 'review'],
      required: [true, 'Status is required'],
      default: 'absent',
    },
    verificationMethod: {
      type: String,
      enum: ['face', 'manual', 'qr', 'system'],
      default: 'manual',
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    isManualOverride: {
      type: Boolean,
      default: false,
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
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevent duplicate entries for the same class
attendanceSchema.index(
  { subject: 1, student: 1, date: 1, period: 1 },
  { unique: true }
);

attendanceSchema.index({ session: 1, student: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
