/**
 * server/models/Mark.js
 * Internal + external marks for a student in a subject.
 * Unique on (student, subject) — one record per student per subject.
 * Grade is calculated on the fly using utils/grades.js.
 */
'use strict';

const mongoose = require('mongoose');
const { getGrade } = require('../utils/grades');

const markSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    /** Internal marks — max 30 */
    internal: {
      type: Number,
      default: 0,
      min: [0, 'Internal marks cannot be negative'],
      max: [30, 'Internal marks max is 30'],
    },
    /** External marks — max 70 */
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

// Prevent duplicate marks for same student+subject
markSchema.index({ student: 1, subject: 1 }, { unique: true });

/**
 * Virtual: compute total and grade from stored internal + external
 */
markSchema.virtual('total').get(function () {
  return this.internal + this.external;
});

markSchema.virtual('gradeInfo').get(function () {
  return getGrade(this.internal + this.external);
});

markSchema.set('toJSON', { virtuals: true });
markSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Mark', markSchema);
