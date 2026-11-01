/**
 * server/models/TransportAuditLog.js
 * Immutable operational audit trail for transport management.
 */
'use strict';

const mongoose = require('mongoose');

const transportAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: [
        'vehicle',
        'route',
        'stop',
        'staff',
        'application',
        'allocation',
        'trip',
        'maintenance',
        'incident',
        'policy',
      ],
      required: true,
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

module.exports = mongoose.model('TransportAuditLog', transportAuditLogSchema);

