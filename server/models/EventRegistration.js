/**
 * server/models/EventRegistration.js
 * Student registration and waitlist tracking for campus events.
 */
'use strict';

const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
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
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted', 'confirmed', 'cancelled', 'attended', 'absent', 'rejected'],
      default: 'registered',
      index: true,
    },
    waitlistNumber: {
      type: Number,
      default: null,
      index: true,
    },
    teamName: {
      type: String,
      default: '',
      trim: true,
    },
    teamMembers: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        rollNumber: { type: String, default: '' },
        name: { type: String, default: '' },
      },
    ],
    eligibilitySnapshot: {
      branch: { type: String, default: '' },
      semester: { type: Number, default: 0 },
      isClubMember: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: Date.now },
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    promotedFromWaitlistAt: {
      type: Date,
      default: null,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for uniqueness, lookup, and deterministic waitlist ordering
eventRegistrationSchema.index({ event: 1, student: 1 });
eventRegistrationSchema.index({ event: 1, status: 1, waitlistNumber: 1 });
eventRegistrationSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
