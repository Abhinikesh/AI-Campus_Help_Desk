/**
 * server/models/EmployeeWorkSchedule.js
 * Working hours, shift configurations, and weekly off definitions.
 */
'use strict';

const mongoose = require('mongoose');

const employeeWorkScheduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Schedule name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Schedule code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    applicableCategories: [
      {
        type: String,
      },
    ],
    weeklyOffDays: {
      type: [Number], // 0 = Sunday, 6 = Saturday
      default: [0],
    },
    shiftStartTime: {
      type: String,
      required: true,
      default: '09:00',
      match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'],
    },
    shiftEndTime: {
      type: String,
      required: true,
      default: '17:00',
      match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'],
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    halfDayMinimumHours: {
      type: Number,
      default: 4,
      min: 1,
    },
    fullDayMinimumHours: {
      type: Number,
      default: 7,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeWorkSchedule', employeeWorkScheduleSchema);
