/**
 * server/models/EmploymentHistory.js
 * Immutable chronological audit log for employee lifecycle transitions.
 */
'use strict';

const mongoose = require('mongoose');

const employmentHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      enum: [
        'onboarding',
        'confirmation',
        'promotion',
        'department_transfer',
        'transfer',
        'designation_change',
        'manager_change',
        'contract_renewal',
        'status_change',
        'suspension',
        'separation',
        'resignation',
        'termination',
      ],
      required: true,
      index: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: [true, 'Change reason is required'],
      trim: true,
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

employmentHistorySchema.index({ employee: 1, effectiveDate: -1 });

module.exports = mongoose.model('EmploymentHistory', employmentHistorySchema);
