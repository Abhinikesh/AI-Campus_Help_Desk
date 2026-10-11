/**
 * server/models/Attendance.js
 * Per-class attendance record.
 * One document = one student, one subject, one date, one period.
 * Unique compound index prevents double-marking.
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
    /** ISO date string, e.g. "2026-04-12" — stored as string for easy grouping */
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
      enum: ['present', 'absent'],
      required: [true, 'Status is required'],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate entries for the same class
attendanceSchema.index(
  { subject: 1, student: 1, date: 1, period: 1 },
  { unique: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
