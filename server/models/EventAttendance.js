/**
 * server/models/EventAttendance.js
 * Event-specific attendance tracking — strictly independent from academic attendance.
 */
'use strict';

const mongoose = require('mongoose');

const eventAttendanceSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventRegistration',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'present',
      index: true,
    },
    checkInTime: {
      type: Date,
      default: Date.now,
    },
    markingMethod: {
      type: String,
      enum: ['manual', 'qr_scan', 'organizer_override'],
      default: 'manual',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    correctionHistory: [
      {
        previousStatus: { type: String, required: true },
        newStatus: { type: String, required: true },
        correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: [true, 'Correction reason is mandatory'] },
        correctedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// One attendance record per student per event
eventAttendanceSchema.index({ event: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('EventAttendance', eventAttendanceSchema);

