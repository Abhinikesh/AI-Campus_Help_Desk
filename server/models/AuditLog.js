/**
 * server/models/AuditLog.js
 * Append-only log of important user actions (admin operations, logins, etc.)
 * Used from Part 2 onward; defined here so the model is available.
 */
'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    entityType: {
      type: String,
      default: '',
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    ip: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    // Audit logs are never updated
    strict: true,
  }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
