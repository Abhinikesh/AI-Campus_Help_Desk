/**
 * server/models/EnrollmentRegisterRow.js
 *
 * Phase 3.9A — Official Enrollment Register Import & Reconciliation
 *
 * One row from an uploaded enrollment register file.
 * Tracks validation state, reconciliation result against Batch 003 staging,
 * and evidence-review decision by an Administrator.
 *
 * This collection never touches the production Student or User collections.
 */
'use strict';

const mongoose = require('mongoose');

const BATCH_ID = 'BATCH-20261112-STAGING-003';

// ── Allowed enum values ───────────────────────────────────────────────────────

const ROW_STATUSES = [
  'VALID',
  'INVALID_IDENTIFIER',
  'MISSING_ROLL',
  'DUPLICATE_IN_REGISTER',
];

const RECONCILIATION_STATUSES = [
  'PENDING',
  'CONFIRMED_MATCH',
  'NAME_MISMATCH_REQUIRES_REVIEW',
  'DUPLICATE_REGISTER_ENTRY',
  'UNMATCHED_REGISTER_ENTRY',
  'INVALID_IDENTIFIER',
];

const EVIDENCE_REVIEW_STATUSES = [
  'UNREVIEWED',
  'CONFIRMED',
  'REJECTED',
];

// ── Schema ────────────────────────────────────────────────────────────────────

const enrollmentRegisterRowSchema = new mongoose.Schema(
  {
    // ── Linkage ───────────────────────────────────────────────────────────────
    /** Links to EnrollmentRegisterImport.importId (not the _id). */
    importId: { type: String, required: true, index: true },
    batchId:  { type: String, required: true, default: BATCH_ID },

    /** 1-based row number in the source file (after the header row). */
    sourceRow: { type: Number, required: true },

    // ── Raw values from the register (as-is from spreadsheet) ────────────────
    rawRollNumber:   { type: String, default: '' },
    rawStudentName:  { type: String, default: '' },
    rawProgram:      { type: String, default: '' },
    rawBranch:       { type: String, default: '' },
    rawSemester:     { type: String, default: '' },
    rawSection:      { type: String, default: '' },
    rawAcademicYear: { type: String, default: '' },
    rawRegistrationId: { type: String, default: '' },

    // ── Normalized values (used for matching) ─────────────────────────────────
    normalizedRollNumber:  { type: String, uppercase: true, trim: true, default: '' },
    normalizedStudentName: { type: String, default: '' },

    // ── Row validation state ──────────────────────────────────────────────────
    rowStatus: {
      type: String,
      enum: ROW_STATUSES,
      default: 'VALID',
    },
    rowStatusReason: { type: String, default: '' },

    // ── Reconciliation result ─────────────────────────────────────────────────
    reconciliationStatus: {
      type: String,
      enum: RECONCILIATION_STATUSES,
      default: 'PENDING',
    },
    matchedStagingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentStaging',
      default: null,
    },
    matchedStagingRollNumber: { type: String, default: null },
    matchedStagingName:       { type: String, default: null },

    // ── Evidence review state ─────────────────────────────────────────────────
    evidenceReviewStatus: {
      type: String,
      enum: EVIDENCE_REVIEW_STATUSES,
      default: 'UNREVIEWED',
    },
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedByAdminName: { type: String, default: null },
    reviewedAt:          { type: Date, default: null },
    reviewRemarks:       { type: String, default: '' },

    /** If this row was confirmed as evidence, the linked EnrollmentVerification _id. */
    linkedVerificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnrollmentVerification',
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

enrollmentRegisterRowSchema.index({ importId: 1 },                           { name: 'err_importId' });
enrollmentRegisterRowSchema.index({ importId: 1, sourceRow: 1 },             { unique: true, name: 'err_importId_row_unique' });
enrollmentRegisterRowSchema.index({ normalizedRollNumber: 1 },               { name: 'err_rollNumber' });
enrollmentRegisterRowSchema.index({ reconciliationStatus: 1 },               { name: 'err_reconStatus' });
enrollmentRegisterRowSchema.index({ batchId: 1 },                            { name: 'err_batchId' });
enrollmentRegisterRowSchema.index({ importId: 1, reconciliationStatus: 1 }, { name: 'err_import_recon' });

// ── Export ────────────────────────────────────────────────────────────────────

const EnrollmentRegisterRow = mongoose.model(
  'EnrollmentRegisterRow',
  enrollmentRegisterRowSchema
);

module.exports = {
  EnrollmentRegisterRow,
  BATCH_ID,
  ROW_STATUSES,
  RECONCILIATION_STATUSES,
  EVIDENCE_REVIEW_STATUSES,
};

