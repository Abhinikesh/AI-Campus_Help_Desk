/**
 * server/models/ImportOperationLog.js
 * Ingestion Operation Metadata and Lifecycle Log.
 * Tracks batch execution, counts, validation summaries, and status transitions.
 * Schema-only implementation; execution logic is deferred to future authorized phases.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const importOperationLogSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      unique: true,
      trim: true,
    },
    operationType: {
      type: String,
      enum: ['staging_ingestion', 'staging_validation', 'production_promotion', 'rollback'],
      required: [true, 'Operation type is required'],
    },
    sourceMetadata: {
      workbookName: { type: String, trim: true, default: null },
      workbookHash: { type: String, trim: true, default: null },
      workbookSizeBytes: { type: Number, default: null },
      sheetsProcessed: [{ type: String, trim: true }],
    },
    status: {
      type: String,
      enum: [
        'started',
        'staged',
        'validated',
        'promoted',
        'partially_promoted',
        'rollback_in_progress',
        'rolled_back',
        'failed',
      ],
      default: 'started',
    },
    counts: {
      type: Map,
      of: Number,
      default: {},
    },
    validationSummary: {
      totalRecords: { type: Number, default: 0 },
      validRecords: { type: Number, default: 0 },
      invalidRecords: { type: Number, default: 0 },
      errorDetails: [mongoose.Schema.Types.Mixed],
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Executing user ID is required'],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

importOperationLogSchema.index({ operationType: 1, status: 1 });
importOperationLogSchema.index({ startedAt: -1 });

module.exports = mongoose.model('ImportOperationLog', importOperationLogSchema);
