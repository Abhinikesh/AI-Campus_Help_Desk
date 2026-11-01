/**
 * server/models/PlacementProfile.js
 * Dedicated student career profile linked to existing Student and User records.
 */
'use strict';

const mongoose = require('mongoose');

const projectSubSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    technologies: [{ type: String, trim: true }],
    projectUrl: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { _id: true }
);

const internshipSubSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isCurrent: { type: Boolean, default: false },
  },
  { _id: true }
);

const certificationSubSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    issuingOrganization: { type: String, required: true, trim: true },
    issueDate: { type: Date, default: null },
    credentialUrl: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const placementProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    registrationStatus: {
      type: String,
      enum: ['registered', 'not_registered', 'opted_out', 'debarred'],
      default: 'registered',
      index: true,
    },
    resumeUrl: {
      type: String,
      default: null,
    },
    resumeOriginalName: {
      type: String,
      default: null,
    },
    resumeUploadedAt: {
      type: Date,
      default: null,
    },
    careerInterests: [{ type: String, trim: true }],
    preferredJobRoles: [{ type: String, trim: true }],
    technicalSkills: [{ type: String, trim: true }],
    frameworksAndTools: [{ type: String, trim: true }],
    projects: [projectSubSchema],
    internships: [internshipSubSchema],
    certifications: [certificationSubSchema],
    achievements: [{ type: String, trim: true }],
    workExperienceMonths: {
      type: Number,
      default: 0,
      min: 0,
    },
    preferredLocation: [{ type: String, trim: true }],
    preferredEmploymentType: [
      {
        type: String,
        enum: ['full_time', 'internship', 'apprenticeship', 'graduate_trainee'],
      },
    ],
    profileCompletionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    profileStatus: {
      type: String,
      enum: ['incomplete', 'complete', 'verified', 'needs_update'],
      default: 'incomplete',
      index: true,
    },
    isProfileVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate profile completion score
placementProfileSchema.methods.calculateCompletionScore = function () {
  let score = 20; // Base score for having an account
  if (this.resumeUrl) score += 25;
  if (this.technicalSkills && this.technicalSkills.length >= 3) score += 15;
  if (this.careerInterests && this.careerInterests.length >= 1) score += 10;
  if (this.projects && this.projects.length >= 1) score += 15;
  if (this.certifications && this.certifications.length >= 1) score += 10;
  if (this.internships && this.internships.length >= 1) score += 5;

  this.profileCompletionScore = Math.min(score, 100);
  this.profileStatus = this.profileCompletionScore >= 70 ? 'complete' : 'incomplete';
  return this.profileCompletionScore;
};

module.exports = mongoose.model('PlacementProfile', placementProfileSchema);

