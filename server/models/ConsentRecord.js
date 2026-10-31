/**
 * server/models/ConsentRecord.js
 * Explicit informed consent history for biometric attendance.
 */
'use strict';

const mongoose = require('mongoose');

const consentRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    consentVersion: {
      type: String,
      default: 'v1.0',
      required: true,
    },
    consentStatus: {
      type: String,
      enum: ['active', 'withdrawn', 'revoked'],
      default: 'active',
      required: true,
    },
    consentTimestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    withdrawalTimestamp: {
      type: Date,
      default: null,
    },
    policyReference: {
      type: String,
      default: 'CAMPUS-BIO-PRIVACY-v1.0',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

consentRecordSchema.index({ student: 1, consentStatus: 1 });
consentRecordSchema.index({ student: 1, consentTimestamp: -1 });

module.exports = mongoose.model('ConsentRecord', consentRecordSchema);
