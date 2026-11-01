/**
 * server/models/Mark.js
 * Comprehensive Examination Mark, Evaluation, and Approval Model.
 * Supports individual exam marks, absent tracking, approval states, and audited correction histories.
 */
'use strict';

const mongoose = require('mongoose');
const { getGrade } = require('../utils/grades');

const correctionItemSchema = new mongoose.Schema(
  {
    previousMarks: { type: Number, default: null },
    newMarks: { type: Number, required: true },
    previousIsAbsent: { type: Boolean, default: false },
    newIsAbsent: { type: Boolean, default: false },
    reason: {
      type: String,
      required: [true, 'Correction reason is mandatory'],
      trim: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const markSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      default: null,
      index: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
    },
    /** Raw marks scored by the student in this examination */
    marksObtained: {
      type: Number,
      default: null,
      min: [0, 'Marks cannot be negative'],
    },
    /** Snapshot of the examination maximum marks at evaluation time */
    maxMarks: {
      type: Number,
      default: 100,
      min: [1, 'Maximum marks must be positive'],
    },
    /** Snapshot of the passing marks threshold */
    passingMarks: {
      type: Number,
      default: 40,
      min: [0, 'Passing marks cannot be negative'],
    },
    /** Student was absent for the examination */
    isAbsent: {
      type: Boolean,
      default: false,
    },
    /** Result is withheld due to disciplinary/administrative hold */
    isWithheld: {
      type: Boolean,
      default: false,
    },
    /** Lifecycle state */
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'published', 'correction_requested'],
      default: 'draft',
      index: true,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    feedback: {
      type: String,
      default: '',
      trim: true,
    },
    correctionHistory: [correctionItemSchema],

    // Legacy fields preserved for backward compatibility
    internal: {
      type: Number,
      default: 0,
      min: [0, 'Internal marks cannot be negative'],
      max: [30, 'Internal marks max is 30'],
    },
    external: {
      type: Number,
      default: 0,
      min: [0, 'External marks cannot be negative'],
      max: [70, 'External marks max is 70'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure a student has at most ONE mark record per examination
markSchema.index(
  { student: 1, exam: 1 },
  {
    unique: true,
    partialFilterExpression: { exam: { $exists: true, $ne: null } },
  }
);

// Legacy fallback index for subject-only entries
markSchema.index(
  { student: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { exam: null },
  }
);

/**
 * Virtual: compute percentage (0-100)
 */
markSchema.virtual('percentage').get(function () {
  if (this.isAbsent || this.marksObtained === null || this.marksObtained === undefined) return null;
  const max = this.maxMarks || 100;
  return max > 0 ? Math.round((this.marksObtained / max) * 1000) / 10 : 0;
});

/**
 * Virtual: compute letter grade based on UGC standard
 */
markSchema.virtual('grade').get(function () {
  if (this.isAbsent) return 'F';
  if (this.marksObtained === null || this.marksObtained === undefined) return null;
  const max = this.maxMarks || 100;
  const pct = max > 0 ? (this.marksObtained / max) * 100 : 0;
  return getGrade(pct).grade;
});

/**
 * Virtual: compute pass/fail outcome
 */
markSchema.virtual('isPassed').get(function () {
  if (this.isAbsent) return false;
  if (this.marksObtained === null || this.marksObtained === undefined) return null;
  return this.marksObtained >= (this.passingMarks || 40);
});

// Legacy virtuals
markSchema.virtual('total').get(function () {
  if (this.marksObtained !== null && this.marksObtained !== undefined) {
    return this.marksObtained;
  }
  return (this.internal || 0) + (this.external || 0);
});

markSchema.virtual('gradeInfo').get(function () {
  const tot = this.total || 0;
  return getGrade(tot);
});

markSchema.set('toJSON', { virtuals: true });
markSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Mark', markSchema);
