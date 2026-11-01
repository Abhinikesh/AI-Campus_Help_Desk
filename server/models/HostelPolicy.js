/**
 * server/models/HostelPolicy.js
 * Configurable institutional rules for hostel admissions, allocations, and operations.
 */
'use strict';

const mongoose = require('mongoose');

const hostelPolicySchema = new mongoose.Schema(
  {
    applicationWindowOpen: {
      type: Boolean,
      default: true,
    },
    applicationDeadline: {
      type: Date,
      default: null,
    },
    maxActiveApplicationsPerStudent: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxAllocationDurationMonths: {
      type: Number,
      default: 12,
      min: 1,
    },
    allowCrossGenderAllocation: {
      type: Boolean,
      default: false,
    },
    requireGuardianConsent: {
      type: Boolean,
      default: false,
    },
    defaultHostelFeeInPaise: {
      type: Number,
      default: 4500000, // ₹45,000
      min: 0,
    },
    defaultSecurityDepositInPaise: {
      type: Number,
      default: 1000000, // ₹10,000
      min: 0,
    },
    defaultMessFeeInPaise: {
      type: Number,
      default: 2500000, // ₹25,000
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('HostelPolicy', hostelPolicySchema);

