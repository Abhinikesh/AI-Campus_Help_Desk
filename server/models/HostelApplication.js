/**
 * server/models/HostelApplication.js
 * Student application for college hostel accommodation.
 */
'use strict';

const mongoose = require('mongoose');

const hostelApplicationSchema = new mongoose.Schema(
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
    semester: {
      type: Number,
      default: 1,
      min: 1,
    },
    preferredHostels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel',
      },
    ],
    requestedRoomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad', 'dormitory', 'any'],
      default: 'any',
    },
    distanceFromCollegeKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    medicalConditions: {
      type: String,
      default: '',
      trim: true,
    },
    emergencyContact: {
      name: { type: String, default: '', trim: true },
      relation: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
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
    supportingDocuments: [
      {
        title: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index to help query active applications
hostelApplicationSchema.index({ student: 1, academicYear: 1, status: 1 });

module.exports = mongoose.model('HostelApplication', hostelApplicationSchema);
