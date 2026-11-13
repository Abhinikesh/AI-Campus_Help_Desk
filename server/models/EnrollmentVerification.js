/**
 * server/models/EnrollmentVerification.js
 *
 * Phase 3.7 — Enrollment Verification Workflow
 *
 * Tracks Admin enrollment-verification decisions for Batch 003 staging records.
 * This collection is WRITE-ONLY for verification decisions; it never touches
 * the production Student or User collections.
 */
'use strict';

const mongoose = require('mongoose');

const BATCH_ID = 'BATCH-20261112-STAGING-003';

// ── Allowed enum values ───────────────────────────────────────────────────────

const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW'];

const EVIDENCE_TYPES = [
  'REGISTRAR_ENROLLMENT_REGISTER',
  'OFFICIAL_SEMESTER_REGISTRATION',
  'OFFICIAL_FEE_CLEARANCE',
  'INSTITUTION_ENROLLMENT_CONFIRMATION',
  'OTHER',
];

const EVIDENCE_VERIFICATION_LEVELS = ['REFERENCE_RECORDED', 'DOCUMENT_VERIFIED'];

const AUDIT_ACTIONS = [
  'CREATED',
  'EVIDENCE_RECORDED',
  'STATUS_CHANGED',
  'APPROVED',
  'REJECTED',
  'REVIEW_REQUESTED',
  'PROMOTED',
];

// ── Audit history entry sub-schema ───────────────────────────────────────────

const auditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    status:          { type: String, enum: VERIFICATION_STATUSES },
    actorId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName:       { type: String, default: '' },
    actorRole:       { type: String, default: 'admin' },
    evidenceType:    { type: String, enum: [...EVIDENCE_TYPES, null], default: null },
    evidenceReference: { type: String, default: null },
    evidenceVerificationLevel: {
      type: String,
      enum: [...EVIDENCE_VERIFICATION_LEVELS, null],
      default: null,
    },
    remarks:  { type: String, default: '' },
    ip:       { type: String, default: '' },
    // immutable timestamp — set once at creation
    timestamp: { type: Date, immutable: true, default: () => new Date() },
  },
  { _id: true }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const enrollmentVerificationSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      default: BATCH_ID,
      enum: [BATCH_ID],  // strictly bound to Batch 003
    },
    normalizedRollNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    studentName: { type: String, default: null },
    stagingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentStaging',
      default: null,
    },

    // ── Verification decision ─────────────────────────────────────────────────
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'PENDING',
    },

    // ── Evidence ─────────────────────────────────────────────────────────────
    evidenceType: {
      type: String,
      enum: [...EVIDENCE_TYPES, null],
      default: null,
    },
    evidenceReference: { type: String, default: null },
    evidenceVerificationLevel: {
      type: String,
      enum: [...EVIDENCE_VERIFICATION_LEVELS, null],
      default: null,
    },

    // ── Reviewer identity ─────────────────────────────────────────────────────
    reviewerAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewerAdminName: { type: String, default: null },
    reviewerRemarks:   { type: String, default: '' },
    verifiedAt: { type: Date, default: null },

    // ── Promotion Tracking (Phase 3.8) ────────────────────────────────────────
    isPromoted: { type: Boolean, default: false },
    promotedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    promotedAt: { type: Date, default: null },
    promotedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    promotedByAdminName: { type: String, default: null },

    // ── Immutable audit trail ─────────────────────────────────────────────────
    auditHistory: { type: [auditEntrySchema], default: [] },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

enrollmentVerificationSchema.index(
  { batchId: 1, normalizedRollNumber: 1 },
  { unique: true, name: 'ev_batchId_rollNumber_unique' }
);
enrollmentVerificationSchema.index({ batchId: 1 }, { name: 'ev_batchId' });
enrollmentVerificationSchema.index({ verificationStatus: 1 }, { name: 'ev_status' });
enrollmentVerificationSchema.index({ reviewerAdminId: 1 }, { name: 'ev_reviewer' });
enrollmentVerificationSchema.index({ isPromoted: 1 }, { name: 'ev_isPromoted' });

// ── Static helper: append one audit entry ────────────────────────────────────

enrollmentVerificationSchema.statics.appendAuditEntry = async function (
  rollNumber,
  entry
) {
  return this.updateOne(
    { batchId: BATCH_ID, normalizedRollNumber: rollNumber.toUpperCase().trim() },
    { $push: { auditHistory: { ...entry, timestamp: new Date() } } }
  );
};

// ── Export constants for use in controller ────────────────────────────────────

const EnrollmentVerification = mongoose.model(
  'EnrollmentVerification',
  enrollmentVerificationSchema
);

module.exports = {
  EnrollmentVerification,
  BATCH_ID,
  VERIFICATION_STATUSES,
  EVIDENCE_TYPES,
  EVIDENCE_VERIFICATION_LEVELS,
};

