/**
 * server/models/Submission.js
 * Mongoose model for student assignment submissions, evaluation, and grading.
 */
'use strict';

const mongoose = require('mongoose');

const submissionFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const submissionVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    submissionFiles: [submissionFileSchema],
    textResponse: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
  },
  { _id: true }
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required'],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    studentUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student User reference is required'],
      index: true,
    },
    submissionFiles: [submissionFileSchema],
    textResponse: {
      type: String,
      trim: true,
      maxlength: [10000, 'Text response cannot exceed 10000 characters'],
      default: '',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['submitted', 'late', 'under_evaluation', 'evaluated', 'returned'],
      default: 'submitted',
      index: true,
    },
    isLate: {
      type: Boolean,
      default: false,
      index: true,
    },
    marksAwarded: {
      type: Number,
      default: null,
      min: [0, 'Marks awarded cannot be negative'],
    },
    maxMarksSnapshot: {
      type: Number,
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [5000, 'Feedback cannot exceed 5000 characters'],
      default: '',
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
    isResultPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    resultPublishedAt: {
      type: Date,
      default: null,
    },
    previousVersions: [submissionVersionSchema],
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Strictly ONE current submission document per student per assignment!
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ assignment: 1, status: 1 });
submissionSchema.index({ studentUser: 1, status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);

