/**
 * server/models/ImportFieldChangeLog.js
 * Field-Level Promotion and Rollback Audit Log.
 * Preserves field-level before/after values for safe, surgical rollback.
 * Schema-only implementation; rollback execution is deferred to future authorized phases.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const importFieldChangeLogSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      trim: true,
    },
    collectionName: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Document ID is required'],
    },
    operation: {
      type: String,
      enum: ['INSERT', 'UPDATE', 'RELATIONSHIP_LINK'],
      required: [true, 'Operation is required'],
    },
    fieldPath: {
      type: String,
      trim: true,
      default: null,
    },
    beforeValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sourceProvenance: {
      sourceSheet: { type: String, trim: true, default: null },
      sourceRow: { type: Number, default: null },
      stagingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    changeStatus: {
      type: String,
      enum: ['applied', 'reverted', 'conflict_halted'],
      default: 'applied',
    },
    documentUpdatedAtSnapshot: {
      type: Date,
      required: [true, 'Document updatedAt snapshot is required'],
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

importFieldChangeLogSchema.index({ batchId: 1, collectionName: 1, documentId: 1 });
importFieldChangeLogSchema.index({ batchId: 1, changeStatus: 1 });
importFieldChangeLogSchema.index({ documentId: 1, fieldPath: 1 });

module.exports = mongoose.model('ImportFieldChangeLog', importFieldChangeLogSchema);
