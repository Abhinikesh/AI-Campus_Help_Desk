/**
 * server/models/TimetableAnomaly.js
 * Tracks parser token anomalies, legend alias discrepancies, and unmapped entities.
 * Implements the approved Phase 3.3.1 anomaly governance specification.
 */
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const timetableAnomalySchema = new Schema(
  {
    // --- 1. Anomaly Classification ---
    anomalyType: {
      type: String,
      required: [true, 'Anomaly type is required'],
      enum: [
        'TOKEN_SPLIT_ANOMALY',
        'LEGEND_ALIAS_MAPPING',
        'UNMATCHED_FACULTY',
        'UNMATCHED_SUBJECT',
        'AMBIGUOUS_SUBJECT',
        'MULTI_FACULTY_OVERLAP',
        'VENUE_COLLISION',
        'PERIOD_BOUNDARY_DISCREPANCY',
      ],
      index: true,
    },

    // --- 2. Source Provenance ---
    sourcePage: {
      type: Number,
      required: [true, 'Source page number is required'],
      min: 1,
      max: 50,
      index: true,
    },
    sourceCohort: {
      type: String,
      required: [true, 'Source cohort label is required'],
      trim: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of week is required'],
      trim: true,
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: 1,
      max: 10,
    },
    rawCellText: {
      type: String,
      required: [true, 'Raw source cell text is required'],
      trim: true,
    },

    // --- 3. Representations ---
    parsedRepresentation: {
      type: Schema.Types.Mixed,
      default: {},
    },
    normalizedRepresentation: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // --- 4. Resolution & Review ---
    resolutionStrategy: {
      type: String,
      enum: ['AUTOMATIC_REGEX_RULE', 'LEGEND_ALIAS_CORRECTION', 'ADMINISTRATIVE_OVERRIDE', 'PENDING_REVIEW'],
      default: 'PENDING_REVIEW',
    },
    status: {
      type: String,
      enum: ['IDENTIFIED', 'RECONCILED', 'IGNORED', 'BLOCKED'],
      default: 'IDENTIFIED',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// --- Compound Indexes ---
timetableAnomalySchema.index(
  { anomalyType: 1, status: 1 },
  { name: 'idx_anomaly_type_status' }
);
timetableAnomalySchema.index(
  { sourcePage: 1, sourceCohort: 1 },
  { name: 'idx_anomaly_page_cohort' }
);

module.exports = mongoose.model('TimetableAnomaly', timetableAnomalySchema);

