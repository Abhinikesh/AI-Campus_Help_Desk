/**
 * server/models/StudentInternship.js
 * Institutional Student Internship Record.
 * Preserves internship records independently, supporting multiple records per student.
 * studentId and organizationName are optional to preserve incomplete/unmatched records.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const studentInternshipSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      trim: true,
    },
    sourceRow: {
      type: Number,
      required: [true, 'Source row is required'],
    },
    normalizedRollNumber: {
      type: String,
      required: [true, 'Normalized roll number is required'],
      trim: true,
      uppercase: true,
    },
    // Optional Student reference: preserves unmatched or ambiguous records safely
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
      default: null,
    },
    studentNameAsPerRS: {
      type: String,
      trim: true,
      default: null,
    },
    branch: {
      type: String,
      trim: true,
      default: null,
    },
    section: {
      type: String,
      trim: true,
      default: null,
    },
    verticalMentor: {
      type: String,
      trim: true,
      default: null,
    },
    officialId: {
      type: String,
      trim: true,
      default: null,
    },
    // Allows null/empty values: 52 authentic records have incomplete company names
    organizationName: {
      type: String,
      trim: true,
      default: null,
      required: false,
    },
    completeAddress: {
      type: String,
      trim: true,
      default: null,
    },
    // No synthetic defaults: explicit null when unverified
    mode: {
      type: String,
      enum: ['Offline', 'Online', 'Hybrid', 'Unknown', null],
      default: null,
    },
    contactNumber: {
      type: String,
      trim: true,
      default: null,
    },
    emailId: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    startDate: {
      type: String,
      trim: true,
      default: null,
    },
    internshipTitle: {
      type: String,
      trim: true,
      default: null,
    },
    stipendProvided: {
      type: Boolean,
      default: null,
    },
    monthlyStipendAmount: {
      type: Number,
      default: null,
    },
    placementDone: {
      type: Boolean,
      default: null,
    },
    offerLetterUrl: {
      type: String,
      trim: true,
      default: null,
    },
    linkageStatus: {
      type: String,
      enum: ['unmatched', 'candidate_linked', 'confirmed_linked', 'flagged'],
      default: 'unmatched',
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// Standardized Batch Idempotency Index (Batch + Source Row)
studentInternshipSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
studentInternshipSchema.index({ batchId: 1 });
studentInternshipSchema.index({ normalizedRollNumber: 1 });
studentInternshipSchema.index({ studentId: 1 });
studentInternshipSchema.index({ linkageStatus: 1 });

module.exports = mongoose.model('StudentInternship', studentInternshipSchema);
