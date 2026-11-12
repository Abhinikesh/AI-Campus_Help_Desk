/**
 * server/models/Student.js
 * Authoritative Student Profile.
 * Supports both portal-authenticated students (linked to User via ObjectId)
 * and offline institutional students (user: null) without breaking ERP references.
 * Implements the approved Phase 3.1 code-only specification.
 */
'use strict';

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    /**
     * Optional portal user link.
     * Offline institutional students have user: null.
     * Partial unique index below ensures uniqueness ONLY when user is an ObjectId.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    // Institutional Academic Placement (No synthetic defaults; null if unverified)
    branch: {
      type: String,
      default: null,
      trim: true,
    },
    program: {
      type: String,
      default: null,
      trim: true,
    },
    semester: {
      type: Number,
      default: null,
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      default: null,
      trim: true,
    },
    admissionYear: {
      type: Number,
      default: null,
    },
    school: {
      type: String,
      default: null,
      trim: true,
    },
    admissionApplicationNumber: {
      type: String,
      default: null,
      trim: true,
    },
    teamsId: {
      type: String,
      default: null,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    guardianName: {
      type: String,
      default: '',
      trim: true,
    },
    guardianPhone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'alumni', 'suspended', 'withdrawn'],
      default: 'active',
    },
    // Lifecycle Account State
    accountStatus: {
      type: String,
      enum: ['enrolled_offline', 'account_pending', 'active_user', 'graduated', 'withdrawn'],
      default: 'enrolled_offline',
    },
    // Pre-University Academic Record (Populated ONLY after authorized promotion)
    academicDetails: {
      tenthPercentage: { type: Number, default: null },
      tenthBoard: { type: String, trim: true, default: null },
      twelfthPercentage: { type: Number, default: null },
      twelfthBoard: { type: String, trim: true, default: null },
      selfReportedCgpa: { type: Number, default: null },
      selfReportedActiveReappears: { type: Number, default: null },
      selfReportedDeadReappears: { type: Number, default: null },
      reappearSubjects: [{ type: String, trim: true }],
      promotedFromSubmissionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      promotedAt: { type: Date, default: null },
      promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      promotionStatus: {
        type: String,
        enum: ['unpromoted', 'promoted', 'revised', 'withdrawn'],
        default: 'unpromoted',
      },
    },
    // Field-level revision audit log
    academicHistoryAudit: [
      {
        fieldPath: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, trim: true },
      },
    ],
    // Provenance & Staging Linkage
    sourceBatchId: {
      type: String,
      default: null,
    },
    importSourceRow: {
      type: Number,
      default: null,
    },
    hasUnresolvedConflicts: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // CRITICAL PHASE 3.1 SAFETY GUARDS: Prevent automatic index or collection mutation
    autoIndex: false,
    autoCreate: false,
  }
);

// Intended partial unique index for user (Enforced in MongoDB via migration script).
// Permanent canonical name is 'user_partial_1' so the zero-gap migration can build
// it alongside the legacy 'user_1' index without triggering IndexOptionsConflict
// (MongoDB error code 85). MongoDB query plans use key patterns, not index names,
// so this rename has zero query-planner impact.
studentSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
    name: 'user_partial_1',
  }
);

// Text index for search
studentSchema.index({ fullName: 'text', rollNumber: 'text', email: 'text', phone: 'text' });

// Standard lookup indexes
studentSchema.index({ phone: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ fullName: 1 });
studentSchema.index({ branch: 1, semester: 1 });
studentSchema.index({ branch: 1, semester: 1, section: 1 });
studentSchema.index({ rollNumber: 1, fullName: 1 });
studentSchema.index({ admissionApplicationNumber: 1 });
studentSchema.index({ accountStatus: 1 });
studentSchema.index({ sourceBatchId: 1 });
studentSchema.index({ hasUnresolvedConflicts: 1 });

module.exports = mongoose.model('Student', studentSchema);
