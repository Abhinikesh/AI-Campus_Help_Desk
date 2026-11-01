/**
 * server/models/PlacementOffer.js
 * Verified corporate employment offers, compensation in integer paise, and student acceptance tracking.
 */
'use strict';

const mongoose = require('mongoose');

const placementOfferSchema = new mongoose.Schema(
  {
    offerNumber: {
      type: String,
      required: [true, 'Offer number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementApplication',
      required: [true, 'Application reference is required'],
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
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
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
    offerDate: {
      type: Date,
      default: Date.now,
    },
    employmentType: {
      type: String,
      enum: ['full_time', 'internship', 'apprenticeship', 'graduate_trainee'],
      default: 'full_time',
    },
    // Annual CTC in Integer Paise (e.g. 145000000 = 14.5 LPA)
    compensationPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyStipendPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    compensationDisplay: {
      type: String,
      default: '',
      trim: true,
    },
    joiningDate: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    offerLetterUrl: {
      type: String,
      default: null,
    },
    offerLetterOriginalName: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'accepted', 'declined', 'withdrawn', 'expired', 'revoked'],
      default: 'draft',
      index: true,
    },
    studentResponse: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      index: true,
    },
    studentResponseAt: {
      type: Date,
      default: null,
    },
    studentDeclineReason: {
      type: String,
      default: null,
      trim: true,
    },
    isPlacementVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active offers for same student and opportunity
placementOfferSchema.index({ student: 1, opportunity: 1 }, { unique: true });
placementOfferSchema.index({ company: 1, status: 1 });
placementOfferSchema.index({ isPlacementVerified: 1, status: 1 });

module.exports = mongoose.model('PlacementOffer', placementOfferSchema);

