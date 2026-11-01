/**
 * server/models/LibraryAuditLog.js
 * Immutable audit trail for library circulation, manual fine waivers, condition updates, and policy modifications.
 */
'use strict';

const mongoose = require('mongoose');

const libraryAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true,
    },
    entityType: {
      type: String,
      enum: ['book', 'copy', 'loan', 'reservation', 'fine', 'policy'],
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
  { timestamps: false }
);

libraryAuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

module.exports = mongoose.model('LibraryAuditLog', libraryAuditLogSchema);

