/**
 * server/models/TimetableVersion.js
 * Tracks immutable snapshots of published timetable versions for auditing and governance.
 * Implements the approved Phase 3.3.1 canonical scopeKey architecture.
 */
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { buildCanonicalScopeKey, validateScopeKey } = require('../utils/scopeKey.util');

const timetableVersionSchema = new Schema(
  {
    // --- 1. Cohort Scope Dimensions ---
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    program: {
      type: String,
      enum: ['B.Tech', 'BCA', 'MCA', 'MBA', 'M.Tech', 'Integrated', 'Diploma', 'Other'],
      default: 'B.Tech',
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    departmentCode: {
      type: String,
      default: 'CSE',
      trim: true,
      uppercase: true,
    },
    branch: {
      type: String,
      default: 'CSE',
      trim: true,
      uppercase: true,
      index: true,
    },
    specialization: {
      type: String,
      default: 'Core',
      trim: true,
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
      index: true,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
      index: true,
    },
    // Canonical deterministic scope key: AY=<ay>|PRG=<prg>|DPT=<dpt>|BRN=<brn>|SPC=<spc>|SEM=<sem>|SEC=<sec>
    scopeKey: {
      type: String,
      required: [true, 'Canonical scopeKey is required'],
      trim: true,
      index: true,
    },

    // --- 2. Version Information ---
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'validation_pending', 'validated', 'approved', 'published', 'superseded', 'archived'],
      default: 'published',
      index: true,
    },
    entryCount: {
      type: Number,
      default: 0,
    },

    // --- 3. Immutable Snapshot Data ---
    entries: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Timetable',
      },
    ],
    entriesSnapshot: [
      {
        timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable' },
        subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
        subjectCode: String,
        subjectAcronym: String,
        subjectName: String,
        facultyId: { type: Schema.Types.ObjectId, ref: 'User' },
        facultyName: String,
        instructors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        instructorAbbreviations: [String],
        dayOfWeek: Number,
        dayName: String,
        period: Number,
        periodNumbers: [Number],
        slotSpan: Number,
        startTime: String,
        endTime: String,
        room: String,
        sessionType: String,
        batch: String,
        sourceGroupLabel: String,
        isJointSession: Boolean,
        jointSessionId: String,
      },
    ],

    // --- 4. Validation Metrics ---
    validationSummary: {
      totalEntries: { type: Number, default: 0 },
      resolvedFacultyCount: { type: Number, default: 0 },
      unresolvedFacultyCount: { type: Number, default: 0 },
      resolvedSubjectCount: { type: Number, default: 0 },
      unresolvedSubjectCount: { type: Number, default: 0 },
      hardConflictsCount: { type: Number, default: 0 },
      softWarningsCount: { type: Number, default: 0 },
      isValidated: { type: Boolean, default: false },
      validatedAt: Date,
    },

    // --- 5. Governance & Audit ---
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    changeLog: [
      {
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        action: {
          type: String,
          enum: ['CREATED', 'VALIDATED', 'MODIFIED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED'],
        },
        description: String,
        diff: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

// --- Pre-validate Hook ---
timetableVersionSchema.pre('validate', function (next) {
  // 1. Sync departmentCode with department
  if (!this.departmentCode && this.department) {
    this.departmentCode = String(this.department).trim().toUpperCase();
  }

  // 2. Prevent mutation of cohort identity dimensions on existing version documents
  if (!this.isNew) {
    const immutableFields = ['academicYear', 'program', 'departmentCode', 'branch', 'specialization', 'semester', 'section', 'scopeKey'];
    for (const field of immutableFields) {
      if (this.isModified(field)) {
        return next(new Error(`Version cohort identity is immutable. Changing "${field}" after version creation is prohibited.`));
      }
    }
  }

  // 3. Compute canonical scopeKey deterministically if not explicitly provided
  if (!this.scopeKey) {
    this.scopeKey = buildCanonicalScopeKey({
      academicYear: this.academicYear,
      program: this.program,
      departmentCode: this.departmentCode || this.department,
      branch: this.branch,
      specialization: this.specialization,
      semester: this.semester,
      section: this.section,
    });
  } else {
    // Validate provided scopeKey against canonical dimensions
    const expected = buildCanonicalScopeKey({
      academicYear: this.academicYear,
      program: this.program,
      departmentCode: this.departmentCode || this.department,
      branch: this.branch,
      specialization: this.specialization,
      semester: this.semester,
      section: this.section,
    });
    if (this.scopeKey !== expected) {
      return next(new Error(`Provided scopeKey "${this.scopeKey}" does not match computed canonical scope "${expected}".`));
    }
  }

  // 4. Update entryCount from snapshot
  if (this.entriesSnapshot && Array.isArray(this.entriesSnapshot)) {
    this.entryCount = this.entriesSnapshot.length;
  }

  next();
});

// --- Static Helpers ---
timetableVersionSchema.statics.buildCanonicalScopeKey = buildCanonicalScopeKey;
timetableVersionSchema.statics.validateScopeKey = validateScopeKey;

// --- Indexes ---
// Legacy compound unique index preserved for existing data
timetableVersionSchema.index(
  { academicYear: 1, department: 1, semester: 1, section: 1, versionNumber: 1 },
  { unique: true, name: 'idx_legacy_cohort_version' }
);

// Canonical unique scope key index (100% immune to null-indexing collisions)
timetableVersionSchema.index(
  { scopeKey: 1, versionNumber: 1 },
  { unique: true, name: 'idx_unique_cohort_version_scope' }
);

module.exports = mongoose.model('TimetableVersion', timetableVersionSchema);
