/**
 * server/models/AttendanceSession.js
 * Represents a single smart attendance class session created by faculty.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema(
  {
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
      enum: ['open', 'closed', 'finalized'],
      default: 'open',
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
    totalStudents: {
      type: Number,
      default: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

attendanceSessionSchema.index({ subject: 1, date: 1, period: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
