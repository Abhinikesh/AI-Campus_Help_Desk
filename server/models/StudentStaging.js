/**
 * server/models/StudentStaging.js
 * Ingestion Staging Model.
 * Preserves source student rows that cannot yet be safely promoted into canonical Student records.
 * Supports incomplete, ambiguous, and conflicting records with full provenance.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const conflictCandidateSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    rawValue: { type: String, required: true, trim: true },
    parsedCandidates: [{ type: String, trim: true }],
    resolution: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const studentStagingSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      trim: true,
    },
    sourceSheet: {
      type: String,
      required: [true, 'Source sheet is required'],
      enum: ['Student Master', 'Admission Records', 'Internship Records', 'Academic Records'],
    },
    sourceRow: {
      type: Number,
      required: [true, 'Source row is required'],
    },
    // Incomplete records permitted: identifiers are optional at staging level
    rawIdentifier: {
      type: String,
      trim: true,
      default: null,
    },
    normalizedRollNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    studentName: {
      type: String,
      trim: true,
      default: null,
    },
    // Sanitized verbatim payload as parsed from Excel (passwords/parental PII stripped at boundary)
    rawPayload: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true,
    },
    conflictCandidates: [conflictCandidateSchema],
    reviewStatus: {
      type: String,
      enum: ['pending_review', 'resolved', 'rejected', 'promoted'],
      default: 'pending_review',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    promotedTargetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// Standardized Batch Idempotency Index
studentStagingSchema.index({ batchId: 1, sourceSheet: 1, sourceRow: 1 }, { unique: true });
studentStagingSchema.index({ batchId: 1 });
studentStagingSchema.index({ sourceSheet: 1 });
studentStagingSchema.index({ normalizedRollNumber: 1 });
studentStagingSchema.index({ reviewStatus: 1 });

module.exports = mongoose.model('StudentStaging', studentStagingSchema);
