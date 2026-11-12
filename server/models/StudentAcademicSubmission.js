/**
 * server/models/StudentAcademicSubmission.js
 * Student Academic Survey Submission.
 * Preserves every survey submission as an immutable, independent audit record.
 * All submissions remain non-canonical by default (isCanonical: false).
 * Excludes parental PII and raw marksheet URLs per privacy mandate.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const studentAcademicSubmissionSchema = new mongoose.Schema(
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
    submissionTimestamp: {
      type: Date,
      default: null,
    },
    rawRollNumber: {
      type: String,
      required: [true, 'Raw roll number is required'],
      trim: true,
    },
    normalizedRollNumber: {
      type: String,
      required: [true, 'Normalized roll number is required'],
      trim: true,
      uppercase: true,
    },
    // Optional link to Student profile
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    studentName: {
      type: String,
      trim: true,
      default: null,
    },
    branch: {
      type: String,
      trim: true,
      default: null,
    },
    tenthPercentage: {
      type: Number,
      default: null,
    },
    tenthBoard: {
      type: String,
      trim: true,
      default: null,
    },
    twelfthPercentage: {
      type: Number,
      default: null,
    },
    twelfthBoard: {
      type: String,
      trim: true,
      default: null,
    },
    selfReportedCgpa: {
      type: Number,
      default: null,
    },
    selfReportedActiveReappears: {
      type: Number,
      default: null,
    },
    selfReportedDeadReappears: {
      type: Number,
      default: null,
    },
    reappearSubjects: [
      {
        type: String,
        trim: true,
      },
    ],
    contactNumber: {
      type: String,
      trim: true,
      default: null,
    },
    personalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    collegeEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    // Canonical Flag: NEVER auto-selected; false by default
    isCanonical: {
      type: Boolean,
      default: false,
    },
    reviewStatus: {
      type: String,
      enum: ['pending_review', 'approved_canonical', 'archived_historical', 'flagged_conflict'],
      default: 'pending_review',
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    promotedToStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    promotedAt: {
      type: Date,
      default: null,
    },
    promotedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// Standardized Batch Idempotency Index (Batch + Source Row)
studentAcademicSubmissionSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
studentAcademicSubmissionSchema.index({ batchId: 1 });
studentAcademicSubmissionSchema.index({ normalizedRollNumber: 1 });
studentAcademicSubmissionSchema.index({ studentId: 1 });
studentAcademicSubmissionSchema.index({ reviewStatus: 1 });

module.exports = mongoose.model('StudentAcademicSubmission', studentAcademicSubmissionSchema);
