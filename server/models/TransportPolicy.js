/**
 * server/models/TransportPolicy.js
 * Institutional policy settings for campus transportation.
 */
'use strict';

const mongoose = require('mongoose');

const transportPolicySchema = new mongoose.Schema(
  {
    applicationWindowOpen: {
      type: Boolean,
      default: true,
    },
    maxActiveApplicationsPerStudent: {
      type: Number,
      default: 1,
      min: 1,
    },
    defaultTransportFeeInPaise: {
      type: Number,
      default: 1800000, // Rs. 18,000.00
      min: 0,
    },
    allowRouteChanges: {
      type: Boolean,
      default: true,
    },
    requireEmergencyContact: {
      type: Boolean,
      default: true,
    },
    maxCapacityBufferPercent: {
      type: Number,
      default: 0, // Strict zero over-allocation
      min: 0,
      max: 10,
    },
    documentExpiryNoticeDays: {
      type: Number,
      default: 30, // Warn 30 days before document expiry
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TransportPolicy', transportPolicySchema);

