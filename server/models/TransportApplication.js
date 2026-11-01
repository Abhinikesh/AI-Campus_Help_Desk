/**
 * server/models/TransportApplication.js
 * Student application for campus transport accommodation.
 */
'use strict';

const mongoose = require('mongoose');

const transportApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: [true, 'Application number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required (e.g. 2026-2027)'],
      trim: true,
      index: true,
    },
    preferredRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      required: [true, 'Preferred route is required'],
      index: true,
    },
    preferredPickupStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportStop',
      required: [true, 'Preferred pickup stop is required'],
    },
    preferredDropStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportStop',
      default: null,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContact: {
      name: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      relation: { type: String, default: '', trim: true },
    },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'pending',
        'under_review',
        'approved',
        'rejected',
        'waitlisted',
        'allocated',
        'withdrawn',
        'cancelled',
      ],
      default: 'submitted',
      index: true,
    },
    reviewDetails: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      comments: {
        type: String,
        default: '',
        trim: true,
      },
      rejectionReason: {
        type: String,
        default: '',
        trim: true,
      },
      waitlistNumber: {
        type: Number,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find active applications for student
transportApplicationSchema.index({ student: 1, academicYear: 1, status: 1 });

module.exports = mongoose.model('TransportApplication', transportApplicationSchema);

