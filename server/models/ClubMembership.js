/**
 * server/models/ClubMembership.js
 * Student club membership application and lifecycle records.
 */
'use strict';

const mongoose = require('mongoose');

const clubMembershipSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentClub',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    role: {
      type: String,
      enum: ['member', 'core_team', 'lead', 'coordinator', 'president'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'expired'],
      default: 'submitted',
      index: true,
    },
    statementOfPurpose: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Statement of purpose cannot exceed 1000 characters'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Compound index to facilitate unique membership querying
clubMembershipSchema.index({ club: 1, student: 1, academicYear: 1 });
clubMembershipSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('ClubMembership', clubMembershipSchema);

