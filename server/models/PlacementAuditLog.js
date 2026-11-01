/**
 * server/models/PlacementAuditLog.js
 * Immutable administrative security audit trail for all placement lifecycle mutations.
 */
'use strict';

const mongoose = require('mongoose');

const placementAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'Company',
        'PlacementOpportunity',
        'PlacementDrive',
        'PlacementApplication',
        'PlacementSelectionStage',
        'PlacementStageResult',
        'PlacementOffer',
        'PlacementProfile',
        'CareerResource',
      ],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

placementAuditLogSchema.index({ performedBy: 1, timestamp: -1 });

module.exports = mongoose.model('PlacementAuditLog', placementAuditLogSchema);
