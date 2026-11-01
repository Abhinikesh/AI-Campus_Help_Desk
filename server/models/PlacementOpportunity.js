/**
 * server/models/PlacementOpportunity.js
 * Career and recruitment vacancies (Full-time, Internship, etc.) offered by registered companies.
 */
'use strict';

const mongoose = require('mongoose');

const opportunityHistorySchema = new mongoose.Schema(
  {
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changeSummary: { type: String, required: true },
  },
  { _id: true }
);

const placementOpportunitySchema = new mongoose.Schema(
  {
    opportunityCode: {
      type: String,
      required: [true, 'Opportunity code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
    },
    opportunityType: {
      type: String,
      enum: ['full_time', 'internship', 'apprenticeship', 'graduate_trainee'],
      default: 'full_time',
      index: true,
    },
    requiredSkills: [{ type: String, trim: true }],
    preferredQualifications: {
      type: String,
      default: '',
      trim: true,
    },
    eligibleDepartments: [{ type: String, uppercase: true, trim: true }],
    eligibleBranches: [{ type: String, uppercase: true, trim: true }],
    eligibleBatches: [{ type: Number }],
    minimumCgpa: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    maximumBacklogs: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherEligibilityCriteria: {
      type: String,
      default: '',
      trim: true,
    },
    workLocation: {
      type: String,
      required: [true, 'Work location is required'],
      trim: true,
    },
    workMode: {
      type: String,
      enum: ['on_site', 'hybrid', 'remote'],
      default: 'on_site',
    },
    // Compensation represented in Integer Paise (e.g. 120000000 = 12 LPA)
    compensationPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    stipendPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    compensationDisplay: {
      type: String,
      default: '',
      trim: true,
    },
    applicationOpeningDate: {
      type: Date,
      required: [true, 'Application opening date is required'],
    },
    applicationDeadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
      index: true,
    },
    selectionProcessOverview: {
      type: String,
      default: '',
      trim: true,
    },
    openingsCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'published',
        'applications_closed',
        'in_progress',
        'completed',
        'cancelled',
        'archived',
      ],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    history: [opportunityHistorySchema],
  },
  {
    timestamps: true,
  }
);

placementOpportunitySchema.index({ company: 1, status: 1 });
placementOpportunitySchema.index({ applicationDeadline: 1, status: 1 });

module.exports = mongoose.model('PlacementOpportunity', placementOpportunitySchema);

