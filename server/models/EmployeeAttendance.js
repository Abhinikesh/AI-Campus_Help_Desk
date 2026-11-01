/**
 * server/models/EmployeeAttendance.js
 * Dedicated daily attendance record for faculty and non-teaching personnel.
 * Strictly decoupled from Student Attendance.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    reason: { type: String, required: [true, 'Correction reason is mandatory'], trim: true },
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    correctedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const employeeAttendanceSchema = new mongoose.Schema(
  {
    attendanceNumber: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Attendance date YYYY-MM-DD is required'],
      index: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'present',
        'absent',
        'late',
        'half_day',
        'on_leave',
        'holiday',
        'weekly_off',
        'work_from_home',
        'official_duty',
      ],
      required: true,
      index: true,
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0,
    },
    workingHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    workSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeWorkSchedule',
      default: null,
    },
    approvedLeave: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeLeaveApplication',
      default: null,
    },
    source: {
      type: String,
      enum: ['manual_checkin', 'biometric_device', 'portal', 'leave_sync', 'admin_correction', 'web_portal'],
      default: 'portal',
    },
    verificationMethod: {
      type: String,
      default: 'web_portal',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    isCorrected: {
      type: Boolean,
      default: false,
    },
    correctionHistory: [attendanceCorrectionSchema],
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

employeeAttendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

employeeAttendanceSchema.pre('validate', async function (next) {
  if (!this.attendanceNumber) {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.attendanceNumber = `ATT-${ts}-${rand}`;
  }

  if (this.date instanceof Date) {
    this.date = this.date.toISOString().split('T')[0];
  } else if (typeof this.date === 'string' && this.date.includes('T')) {
    this.date = this.date.split('T')[0];
  }

  if (this.checkIn && !this.checkInTime) {
    this.checkInTime = this.checkIn;
  }
  if (this.checkInTime && !this.checkIn) {
    this.checkIn = this.checkInTime;
  }

  if (this.checkOut && !this.checkOutTime) {
    this.checkOutTime = this.checkOut;
  }
  if (this.checkOutTime && !this.checkOut) {
    this.checkOut = this.checkOutTime;
  }

  if (this.workingHours && !this.hoursWorked) {
    this.hoursWorked = this.workingHours;
  }
  if (this.hoursWorked && !this.workingHours) {
    this.workingHours = this.hoursWorked;
  }

  if (!this.user && this.employee) {
    try {
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      const emp = await EmployeeProfile.findById(this.employee);
      if (emp && emp.user) {
        this.user = emp.user;
      }
    } catch (_) {}
  }

  next();
});

module.exports = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);
