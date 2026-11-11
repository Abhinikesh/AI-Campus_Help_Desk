/**
 * server/models/ConflictRecord.js
 * Tracks hard timetable conflicts, joint session verifications, and publication blockers.
 * Implements the approved Phase 3.3.1 conflict detection engine specification.
 */
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const conflictEntryDetailSchema = new Schema(
  {
    timetableEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'Timetable',
      default: null,
    },
    sourcePage: {
      type: Number,
      default: null,
    },
    cohort: {
      type: String,
      trim: true,
      default: null,
    },
    subjectAcronym: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    room: {
      type: String,
      trim: true,
      default: null,
    },
    instructors: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const conflictRecordSchema = new Schema(
  {
    // --- 1. Conflict Classification & Severity ---
    conflictCode: {
      type: String,
      required: [true, 'Conflict code is required'],
      enum: [
        'POTENTIAL_FACULTY_CONFLICT', // e.g. SJ Wednesday P8 AS18 (P12) vs AS19 (P13)
        'FACULTY_DOUBLE_BOOKED',
        'ROOM_DOUBLE_BOOKED',
        'COHORT_DOUBLE_BOOKED',
        'SUBGROUP_DOUBLE_BOOKED',
        'WHOLE_CLASS_SUBGROUP_COLLISION',
        'INVALID_PERIOD_SPAN',
        'UNRESOLVED_CRITICAL_FACULTY',
        'CALENDAR_HOLIDAY_COLLISION',
      ],
      index: true,
    },
    severity: {
      type: String,
      enum: ['BLOCKER', 'WARNING', 'INFO'],
      default: 'BLOCKER',
      index: true,
    },

    // --- 2. Temporal & Cohort Dimensions ---
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of week is required'],
      trim: true,
    },
    periodNumbers: {
      type: [Number],
      default: [],
    },
    timeWindow: {
      startTime: { type: String, trim: true },
      endTime: { type: String, trim: true },
    },

    // --- 3. Conflicting Entities ---
    conflictingEntries: {
      type: [conflictEntryDetailSchema],
      default: [],
    },
    resourceType: {
      type: String,
      enum: ['FACULTY', 'ROOM', 'COHORT', 'SUBGROUP', 'CALENDAR', 'OTHER'],
      default: 'FACULTY',
    },
    resourceId: {
      type: String,
      trim: true,
      required: [true, 'Resource identifier is required (e.g. SJ, AS18, 5 CSE-B)'],
    },
    description: {
      type: String,
      required: [true, 'Conflict description is required'],
      trim: true,
    },

    // --- 4. Evidentiary Joint Session Evaluation ---
    evidenceType: {
      type: String,
      enum: ['SOURCE_CELL_MATCH', 'IDENTICAL_TRIPLET_MATCH', 'ADMINISTRATIVE_CONFIRMATION', 'NONE'],
      default: 'NONE',
    },
    evidenceDetails: {
      type: String,
      trim: true,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'VERIFIED_JOINT', 'REJECTED_OVERLAP'],
      default: 'UNVERIFIED',
      index: true,
    },

    // --- 5. Resolution & Governance ---
    resolutionStatus: {
      type: String,
      enum: ['OPEN', 'RESOLVED_SPLIT_DUTY', 'RESOLVED_CO_TEACHING', 'RESOLVED_CORRECTED', 'ACCEPTED_OVERRIDE'],
      default: 'OPEN',
      index: true,
    },
    resolutionJustification: {
      type: String,
      trim: true,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// --- Instance Methods ---
/**
 * Determines whether this conflict record constitutes an active publication blocker.
 * @returns {boolean}
 */
conflictRecordSchema.methods.isPublicationBlocker = function () {
  return this.severity === 'BLOCKER' && this.resolutionStatus === 'OPEN';
};

// --- Static Helpers ---
/**
 * Factory helper that instantiates the ground-truth SJ Wednesday P8 publication blocker.
 * Ground truth: Instructor abbreviation SJ (printed in PDF legend as SRISHTY JINDAL, unprovisioned in MongoDB)
 * Wednesday Period 8 (14:00-14:50) across Room AS18 (Page 12, 5 CSE-B) and Room AS19 (Page 13, 5 CSE-C2).
 *
 * @param {Object} options
 * @param {string} [options.academicYear='2026-2027']
 * @returns {Object} Unsaved ConflictRecord instance
 */
conflictRecordSchema.statics.createSJConflictRecord = function (options = {}) {
  const ay = options.academicYear || '2026-2027';
  return new this({
    conflictCode: 'POTENTIAL_FACULTY_CONFLICT',
    severity: 'BLOCKER',
    academicYear: ay,
    dayOfWeek: 'Wednesday',
    periodNumbers: [8],
    timeWindow: {
      startTime: '14:00',
      endTime: '14:50',
    },
    resourceType: 'FACULTY',
    resourceId: 'SJ',
    description:
      'Instructor SJ (Srishty Jindal, unprovisioned) Wednesday Period 8 collision across Page 12 (5 CSE-B, AICA, AS18) and Page 13 (5 CSE-C2, FLAT, AS19). Distinct subjects and rooms preclude joint session exemption.',
    conflictingEntries: [
      {
        sourcePage: 12,
        cohort: '5 CSE-B',
        subjectAcronym: 'AICA',
        room: 'AS18',
        instructors: ['SJ'],
      },
      {
        sourcePage: 13,
        cohort: '5 CSE-C2',
        subjectAcronym: 'FLAT',
        room: 'AS19',
        instructors: ['SJ'],
      },
    ],
    evidenceType: 'NONE',
    evidenceDetails: 'Distinct subjects (AICA vs FLAT) and distinct rooms (AS18 vs AS19) preclude intentional joint session.',
    verificationStatus: 'UNVERIFIED',
    resolutionStatus: 'OPEN',
  });
};

// --- Indexes ---
conflictRecordSchema.index(
  { conflictCode: 1, resolutionStatus: 1, severity: 1 },
  { name: 'idx_open_blocker_conflicts' }
);
conflictRecordSchema.index(
  { academicYear: 1, resolutionStatus: 1, severity: 1 },
  { name: 'idx_academic_year_conflicts' }
);
conflictRecordSchema.index(
  { resourceType: 1, resourceId: 1, resolutionStatus: 1 },
  { name: 'idx_resource_conflicts' }
);

module.exports = mongoose.model('ConflictRecord', conflictRecordSchema);

