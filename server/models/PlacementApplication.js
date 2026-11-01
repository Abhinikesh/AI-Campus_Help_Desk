/**
 * server/models/PlacementApplication.js
 * Student candidate application for an opportunity, containing eligibility snapshots and status lifecycle.
 */
'use strict';

const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const placementApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: [true, 'Application number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementOpportunity',
      required: [true, 'Opportunity is required'],
      index: true,
    },
    drive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      default: null,
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    resumeUrl: {
      type: String,
      required: [true, 'Resume document is required'],
    },
    resumeOriginalName: {
      type: String,
      default: '',
    },
    eligibilitySnapshot: {
      isEligible: { type: Boolean, default: true },
      evaluationStatus: {
        type: String,
        enum: ['eligible', 'not_eligible', 'manual_review'],
        default: 'eligible',
      },
      evaluatedCgpa: { type: Number, default: 0 },
      evaluatedBacklogs: { type: Number, default: 0 },
      studentBranch: { type: String, default: '' },
      studentSemester: { type: Number, default: 1 },
      studentBatch: { type: Number, default: null },
      evaluatedAt: { type: Date, default: Date.now },
      reasons: [{ type: String }],
    },
    currentStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementSelectionStage',
      default: null,
    },
    status: {
      type: String,
      enum: [
        'submitted',
        'under_review',
        'shortlisted',
        'assessment_scheduled',
        'interview_scheduled',
        'selected',
        'offered',
        'offer_accepted',
        'offer_declined',
        'rejected',
        'withdrawn',
        'on_hold',
      ],
      default: 'submitted',
      index: true,
    },
    coordinatorRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    withdrawalReason: {
      type: String,
      default: null,
      trim: true,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    statusHistory: [statusHistorySchema],
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications by the same student for the same opportunity
placementApplicationSchema.index({ student: 1, opportunity: 1 }, { unique: true });
placementApplicationSchema.index({ opportunity: 1, status: 1 });
placementApplicationSchema.index({ drive: 1, status: 1 });

module.exports = mongoose.model('PlacementApplication', placementApplicationSchema);
