/**
 * server/models/AdmissionApplication.js
 * Institutional Admission / Application Record.
 * Preserves admission applications independently of portal User accounts and enrolled Student records.
 * Duplicate application numbers are supported and reviewable.
 * Passwords and external credentials are permanently excluded.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const admissionApplicationSchema = new mongoose.Schema(
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
    // Application number is required, but NOT unique globally (preserves authentic duplicate pairs)
    applicationNumber: {
      type: String,
      required: [true, 'Application number is required'],
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    course: {
      type: String,
      trim: true,
      default: null,
    },
    school: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    teamsId: {
      type: String,
      trim: true,
      default: null,
    },
    dateOfReporting: {
      type: String,
      trim: true,
      default: null,
    },
    // Optional linkage to enrolled Student
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    admissionStatus: {
      type: String,
      enum: ['applicant', 'enrolled', 'duplicate_flagged', 'withdrawn'],
      default: 'applicant',
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
admissionApplicationSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
admissionApplicationSchema.index({ batchId: 1 });
admissionApplicationSchema.index({ applicationNumber: 1 });
admissionApplicationSchema.index({ studentId: 1 });
admissionApplicationSchema.index({ admissionStatus: 1 });

module.exports = mongoose.model('AdmissionApplication', admissionApplicationSchema);
