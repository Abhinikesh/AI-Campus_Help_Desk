/**
 * server/models/EmployeeLeaveApplication.js
 * Manages employee leave requests and multi-tier approval workflow.
 */
'use strict';

const mongoose = require('mongoose');

const approvalStageSchema = new mongoose.Schema(
  {
    step: { type: Number, default: 1 },
    role: { type: String, default: 'reviewer' },
    stage: {
      type: String,
      enum: ['reporting_manager', 'hod', 'hr', 'reviewer'],
      default: 'reviewer',
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      default: 'approved',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actionDate: {
      type: Date,
      default: Date.now,
    },
    actionAt: {
      type: Date,
      default: Date.now,
    },
    comments: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const employeeLeaveApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: true,
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
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy',
      required: true,
    },
    leaveCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'LEAVE',
    },
    startDate: {
      type: Date,
      required: [true, 'Leave start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'Leave end date is required'],
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    halfDaySession: {
      type: String,
      enum: ['first_half', 'second_half', 'none'],
      default: 'none',
    },
    halfDayType: {
      type: String,
      default: null,
    },
    daysRequested: {
      type: Number,
      min: [0.5, 'Minimum leave requested is 0.5 days'],
    },
    totalDays: {
      type: Number,
      min: [0.5, 'Minimum leave requested is 0.5 days'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave is required'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
    },
    contactDuringLeave: {
      type: String,
      default: '',
      trim: true,
    },
    supportingDocuments: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'pending_approval',
        'pending',
        'approved',
        'rejected',
        'withdrawn',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
    currentApprovalStage: {
      type: String,
      enum: ['reporting_manager', 'hod', 'hr', 'completed'],
      default: 'reporting_manager',
    },
    approvalWorkflow: [approvalStageSchema],
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

employeeLeaveApplicationSchema.index({ employee: 1, status: 1, startDate: 1, endDate: 1 });

employeeLeaveApplicationSchema.pre('validate', async function (next) {
  if (this.totalDays !== undefined && this.daysRequested === undefined) {
    this.daysRequested = this.totalDays;
  }
  if (this.daysRequested !== undefined && this.totalDays === undefined) {
    this.totalDays = this.daysRequested;
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
  if ((!this.leaveCode || this.leaveCode === 'LEAVE') && this.policy) {
    try {
      const LeavePolicy = mongoose.model('LeavePolicy');
      const pol = await LeavePolicy.findById(this.policy);
      if (pol && pol.code) {
        this.leaveCode = pol.code;
      }
    } catch (_) {}
  }
  if (this.isHalfDay && !this.halfDaySession && this.halfDayType) {
    this.halfDaySession = this.halfDayType;
  }
  next();
});

module.exports = mongoose.model('EmployeeLeaveApplication', employeeLeaveApplicationSchema);
