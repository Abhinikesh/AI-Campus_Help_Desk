/**
 * server/models/HostelAuditLog.js
 * Immutable audit trail for all sensitive hostel allocation, checkout, and administrative events.
 */
'use strict';

const mongoose = require('mongoose');

const hostelAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['hostel', 'room', 'bed', 'application', 'allocation', 'occupancy', 'transfer', 'policy'],
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
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('HostelAuditLog', hostelAuditLogSchema);

