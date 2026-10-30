/**
 * server/models/AttendanceSettings.js
 * Configurable system-wide settings for Smart Attendance.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceSettingsSchema = new mongoose.Schema(
  {
    minAttendancePercent: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
    defaultSessionDurationMinutes: {
      type: Number,
      default: 60,
      min: 15,
      max: 180,
    },
    verificationRetryLimit: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    faceConfidenceThreshold: {
      type: Number,
      default: 0.65,
      min: 0.4,
      max: 0.95,
    },
    allowManualOverride: {
      type: Boolean,
      default: true,
    },
    biometricRetentionDays: {
      type: Number,
      default: 365,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceSettings', attendanceSettingsSchema);
