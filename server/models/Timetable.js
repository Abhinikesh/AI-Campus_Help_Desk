/**
 * server/models/Timetable.js
 * Authoritative Weekly Timetable Entry for academic classes and laboratory sessions.
 * Implements the approved canonical Phase 3.3.1 data model with 100% backward compatibility.
 */
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { buildCanonicalScopeKey, validateScopeKey } = require('../utils/scopeKey.util');

const timetableChangeSchema = new Schema(
  {
    previousValue: {
      type: Schema.Types.Mixed,
      default: {},
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: {},
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: [true, 'Modification reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters long'],
    },
  },
  { _id: true }
);

const timetableSchema = new Schema(
  {
    // --- 1. Subject Reference & Curricular Resolution ---
    // Nullable reference: 14 verified in MongoDB, 2 ambiguous, 100 unmatched
    // Unmatched subjects store subject: null without fabricating ObjectIds
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
      index: true,
    },
    subjectAcronym: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    subjectName: {
      type: String,
      trim: true,
      default: null,
    },
    unresolvedSubjectCode: {
      type: String,
      trim: true,
      default: null,
    },
    isSubjectResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    subjectResolutionStatus: {
      type: String,
      enum: ['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED'],
      default: 'UNRESOLVED',
      index: true,
    },

    // --- 2. Faculty Reference & Multi-Instructor Co-Teaching ---
    // Primary instructor scalar retained for 100% backward compatibility
    faculty: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Array of all co-teachers / laboratory instructors
    instructors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    instructorAbbreviations: {
      type: [String],
      default: [],
    },
    unresolvedFacultyAbbreviations: {
      type: [String],
      default: [],
    },
    isFacultyResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    facultyResolutionStatus: {
      type: String,
      enum: ['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED'],
      default: 'UNRESOLVED',
      index: true,
    },

    // --- 3. Academic & Cohort Dimensions ---
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
      required: true,
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
      default: 'CSE',
      trim: true,
      required: true,
    },
    departmentCode: {
      type: String,
      default: 'CSE',
      trim: true,
      uppercase: true,
      index: true,
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
      default: 5,
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
    shift: {
      type: String,
      enum: ['Morning', 'Evening', 'General'],
      default: 'Morning',
    },
    // Canonical deterministic scope key: AY=<ay>|PRG=<prg>|DPT=<dpt>|BRN=<brn>|SPC=<spc>|SEM=<sem>|SEC=<sec>
    scopeKey: {
      type: String,
      trim: true,
      index: true,
    },

    // --- 4. Subgroup & Batch Architecture ---
    // Canonical batch field; sourceGroupLabel preserves verbatim source text
    batch: {
      type: String,
      default: 'All',
      trim: true,
      index: true,
    },
    sourceGroupLabel: {
      type: String,
      trim: true,
      default: null,
    },
    isSubgroup: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --- 5. Day & Time Schedule ---
    /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: 0,
      max: 6,
      index: true,
    },
    dayName: {
      type: String,
      trim: true,
    },
    period: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
      index: true,
    },
    periodNumber: {
      type: Number,
      min: 1,
      max: 10,
    },
    periodCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    slotSpan: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    periodNumbers: {
      type: [Number],
      validate: {
        validator: function (v) {
          if (!v || !Array.isArray(v) || v.length === 0) return true;
          // Check range
          if (!v.every((p) => Number.isInteger(p) && p >= 1 && p <= 10)) return false;
          // Check contiguity: p[i+1] must equal p[i] + 1
          for (let i = 0; i < v.length - 1; i++) {
            if (v[i + 1] !== v[i] + 1) return false;
          }
          return true;
        },
        message: 'periodNumbers must be a non-empty array of contiguous integer periods between 1 and 10.',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    durationMinutes: {
      type: Number,
      default: 50,
      min: 20,
      max: 360,
    },

    // --- 6. Venue & Special Policy ---
    room: {
      type: String,
      default: 'TBA',
      trim: true,
      index: true,
    },
    isNonExclusiveVenue: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --- 7. Session Characteristics ---
    sessionType: {
      type: String,
      enum: ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Other', 'Project'],
      default: 'Lecture',
    },

    // --- 8. Hardened Joint Session Classification ---
    isJointSession: {
      type: Boolean,
      default: false,
      index: true,
    },
    jointSessionId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    jointCohortSummary: {
      type: [String],
      default: [],
    },
    jointSessionEvidence: {
      evidenceType: {
        type: String,
        enum: ['SOURCE_CELL_MATCH', 'IDENTICAL_TRIPLET_MATCH', 'ADMINISTRATIVE_CONFIRMATION', 'NONE'],
        default: 'NONE',
      },
      evidenceDetails: {
        type: String,
        default: null,
      },
      verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    // --- 9. Provenance & Anomaly Tracking ---
    sourcePage: {
      type: Number,
      min: 1,
      max: 50,
      default: null,
    },
    sourceCohortName: {
      type: String,
      trim: true,
      default: null,
    },
    sourceCellText: {
      type: String,
      trim: true,
      default: null,
    },
    extractionHash: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    anomalyFlags: {
      type: [String],
      default: [],
    },
    sourceDocumentChecksum: {
      type: String,
      trim: true,
      default: null,
    },
    validationStatus: {
      type: String,
      enum: ['PENDING_VALIDATION', 'VALIDATED', 'FLAGGED_ANOMALY', 'CONFLICT_DETECTED'],
      default: 'PENDING_VALIDATION',
    },

    // --- 10. Status, Version & Audit History ---
    effectiveStartDate: {
      type: Date,
      default: null,
    },
    effectiveEndDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'updated', 'cancelled', 'archived', 'staged', 'superseded'],
      default: 'draft',
      index: true,
    },
    versionNumber: {
      type: Number,
      default: 1,
    },
    changeHistory: [timetableChangeSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Virtuals ---
timetableSchema.virtual('timeSlot').get(function () {
  return `${this.startTime} - ${this.endTime}`;
});

timetableSchema.virtual('isDoublePeriod').get(function () {
  return this.slotSpan === 2 || (this.periodNumbers && this.periodNumbers.length === 2) || this.periodCount === 2;
});

timetableSchema.virtual('cohortIdentifier').get(function () {
  const spec = this.specialization && this.specialization !== 'Core' ? `-${this.specialization}` : '';
  return `${this.program} ${this.semester} ${this.branch}${spec}-${this.section}`;
});

// --- Pre-validate Hook ---
timetableSchema.pre('validate', function (next) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // 1. Synchronize dayOfWeek & dayName
  if (this.dayOfWeek !== undefined && !this.dayName) {
    this.dayName = days[this.dayOfWeek];
  }

  // 2. Synchronize period & periodNumber
  if (this.period && !this.periodNumber) {
    this.periodNumber = this.period;
  }
  if (this.periodNumber && !this.period) {
    this.period = this.periodNumber;
  }

  // 3. Synchronize periodCount, slotSpan, and periodNumbers
  if (this.periodCount && !this.slotSpan) {
    this.slotSpan = this.periodCount;
  }
  if (this.slotSpan && !this.periodCount) {
    this.periodCount = this.slotSpan;
  }

  if ((!this.periodNumbers || this.periodNumbers.length === 0) && this.period) {
    const span = this.slotSpan || this.periodCount || 1;
    this.periodNumbers = [];
    for (let i = 0; i < span; i++) {
      this.periodNumbers.push(this.period + i);
    }
  } else if (this.periodNumbers && this.periodNumbers.length > 0) {
    this.slotSpan = this.periodNumbers.length;
    this.periodCount = this.periodNumbers.length;
    this.period = this.periodNumbers[0];
    this.periodNumber = this.periodNumbers[0];
  }

  // 4. Compute durationMinutes if default 50
  if (!this.durationMinutes || this.durationMinutes === 50) {
    const span = this.periodNumbers ? this.periodNumbers.length : this.slotSpan || 1;
    this.durationMinutes = span * 50;
  }

  // 5. Compute canonical scopeKey deterministically
  if (!this.departmentCode) {
    this.departmentCode = this.department ? String(this.department).toUpperCase() : 'CSE';
  }
  this.scopeKey = buildCanonicalScopeKey({
    academicYear: this.academicYear,
    program: this.program,
    departmentCode: this.departmentCode,
    branch: this.branch,
    specialization: this.specialization,
    semester: this.semester,
    section: this.section,
  });

  // 6. Synchronize primary faculty and instructors array
  if (this.faculty && (!this.instructors || this.instructors.length === 0)) {
    this.instructors = [this.faculty];
  } else if (!this.faculty && this.instructors && this.instructors.length > 0) {
    this.faculty = this.instructors[0];
  }

  // 7. Detect non-exclusive venues
  const nonExclusiveVenues = ['NOT FIXED', 'GROUND', 'OUTDOOR', 'SPORTS', 'TBA', 'FIELD'];
  if (this.room && nonExclusiveVenues.includes(this.room.trim().toUpperCase())) {
    this.isNonExclusiveVenue = true;
  }

  // 8. Detect subgroup status
  if (this.batch && this.batch !== 'All' && this.batch !== 'ALL') {
    this.isSubgroup = true;
  } else {
    this.isSubgroup = false;
  }

  // 9. Synchronize subject resolution status
  if (this.subject) {
    this.isSubjectResolved = true;
    this.subjectResolutionStatus = 'RESOLVED';
  } else {
    this.isSubjectResolved = false;
    if (!this.subjectResolutionStatus || this.subjectResolutionStatus === 'RESOLVED') {
      this.subjectResolutionStatus = 'UNRESOLVED';
    }
  }

  // 10. Synchronize faculty resolution status
  if (this.faculty || (this.instructors && this.instructors.length > 0)) {
    if (!this.unresolvedFacultyAbbreviations || this.unresolvedFacultyAbbreviations.length === 0) {
      this.isFacultyResolved = true;
      this.facultyResolutionStatus = 'RESOLVED';
    } else {
      this.isFacultyResolved = false;
      this.facultyResolutionStatus = 'AMBIGUOUS';
    }
  } else {
    this.isFacultyResolved = false;
    this.facultyResolutionStatus = 'UNRESOLVED';
  }

  next();
});

// --- Pre-save Hook ---
timetableSchema.pre('save', function (next) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (this.dayOfWeek !== undefined && !this.dayName) {
    this.dayName = days[this.dayOfWeek];
  }
  next();
});

// --- Static Helpers ---
timetableSchema.statics.buildCanonicalScopeKey = buildCanonicalScopeKey;
timetableSchema.statics.validateScopeKey = validateScopeKey;

// --- Indexes ---
// Retain all existing indexes for 100% backward compatibility
timetableSchema.index({ department: 1, semester: 1, section: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ faculty: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ room: 1, dayOfWeek: 1, status: 1 });
timetableSchema.index({ subject: 1, status: 1 });

// New compound multikey indexes for canonical queries and conflict detection
// Note: MongoDB multikey index allows at most ONE array field per index.
// instructors is array, so period is scalar here.
timetableSchema.index(
  { scopeKey: 1, dayOfWeek: 1, period: 1, batch: 1, status: 1 },
  { name: 'idx_timetable_scope_schedule' }
);
timetableSchema.index(
  { instructors: 1, dayOfWeek: 1, period: 1, status: 1 },
  { name: 'idx_timetable_multi_faculty_conflict' }
);
timetableSchema.index(
  { faculty: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 },
  { name: 'idx_timetable_faculty_periods_conflict' }
);
timetableSchema.index(
  { room: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 },
  { name: 'idx_timetable_room_conflict' }
);
timetableSchema.index(
  { jointSessionId: 1, status: 1 },
  { name: 'idx_timetable_joint_session', sparse: true }
);

module.exports = mongoose.model('Timetable', timetableSchema);
