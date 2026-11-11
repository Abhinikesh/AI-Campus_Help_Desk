/**
 * server/models/TimetableStaging.js
 * Isolated staging model for parsed timetable entries awaiting validation and migration.
 * Implements the approved Phase 3.3.1 staging schema specification.
 */
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const extractedEntrySchema = new Schema(
  {
    sourcePage: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    sourceCohortName: {
      type: String,
      required: true,
      trim: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
      trim: true,
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    slotSpan: {
      type: Number,
      default: 1,
      min: 1,
      max: 4,
    },
    periodNumbers: {
      type: [Number],
      default: [],
    },
    rawSubjectAcronym: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    rawFacultyAbbreviations: {
      type: [String],
      default: [],
    },
    rawRoom: {
      type: String,
      required: true,
      trim: true,
    },
    rawSubgroup: {
      type: String,
      trim: true,
      default: null,
    },
    sourceCellText: {
      type: String,
      required: true,
      trim: true,
    },
    extractionHash: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const normalizedDataSchema = new Schema(
  {
    program: { type: String, default: 'B.Tech' },
    departmentCode: { type: String, default: 'CSE' },
    branch: { type: String, default: 'CSE' },
    specialization: { type: String, default: 'Core' },
    semester: { type: Number, default: 5 },
    section: { type: String, default: 'A' },
    canonicalSubjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    canonicalSubjectCode: { type: String, default: null },
    canonicalFacultyIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    canonicalRoom: { type: String, default: null },
    batch: { type: String, default: 'All' },
    isJointSession: { type: Boolean, default: false },
    jointSessionId: { type: String, default: null },
    jointSessionEvidence: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const timetableStagingSchema = new Schema(
  {
    importBatchId: {
      type: String,
      required: [true, 'Import batch ID is required'],
      trim: true,
      index: true,
    },
    sourceDocument: {
      fileName: {
        type: String,
        required: [true, 'Source document file name is required'],
        trim: true,
      },
      fileChecksumSha256: {
        type: String,
        required: [true, 'Source document SHA-256 checksum is required'],
        trim: true,
      },
      totalPages: {
        type: Number,
        default: 50,
      },
    },
    stagingStatus: {
      type: String,
      enum: ['staged', 'dry_run_passed', 'dry_run_failed', 'approved_for_migration', 'migrated', 'discarded'],
      default: 'staged',
      index: true,
    },
    extractedEntry: {
      type: extractedEntrySchema,
      required: true,
    },
    normalizedData: {
      type: normalizedDataSchema,
      default: () => ({}),
    },
    validationErrors: {
      type: [String],
      default: [],
    },
    validationWarnings: {
      type: [String],
      default: [],
    },
    anomalyFlags: {
      type: [String],
      default: [],
    },
    isReadyForImport: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotent extraction uniqueness index
timetableStagingSchema.index(
  { importBatchId: 1, 'extractedEntry.extractionHash': 1 },
  { unique: true, name: 'idx_staging_idempotent_hash' }
);

module.exports = mongoose.model('TimetableStaging', timetableStagingSchema);

