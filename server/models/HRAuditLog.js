/**
 * server/models/HRAuditLog.js
 * Immutable administrative audit trail for HR operations.
 */
'use strict';

const mongoose = require('mongoose');

const hrAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'EmployeeProfile',
        'EmployeeLeaveApplication',
        'EmployeeLeaveBalance',
        'EmployeeAttendance',
        'EmployeeDocument',
        'Department',
        'Designation',
        'LeavePolicy',
        'HRAnnouncement',
        'EmployeeTrainingRecord',
        'EmploymentHistory'
      ],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    performedByRole: {
      type: String,
      default: ''
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

hrAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.models.HRAuditLog || mongoose.model('HRAuditLog', hrAuditLogSchema);
