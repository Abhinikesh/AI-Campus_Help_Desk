/**
 * server/models/Company.js
 * Master enterprise and recruiter registry for campus placements.
 */
'use strict';

const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      index: true,
    },
    companyCode: {
      type: String,
      required: [true, 'Company code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    industry: {
      type: String,
      required: [true, 'Industry classification is required'],
      trim: true,
      index: true,
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    recruiterName: {
      type: String,
      trim: true,
      default: '',
    },
    recruiterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    recruiterPhone: {
      type: String,
      trim: true,
      default: '',
    },
    logoUrl: {
      type: String,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending', 'rejected'],
      default: 'verified',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    tier: {
      type: String,
      enum: ['tier_1', 'tier_2', 'tier_3', 'mass_recruiter', 'dream', 'super_dream'],
      default: 'tier_1',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 'text', industry: 'text', location: 'text' });

module.exports = mongoose.model('Company', companySchema);
