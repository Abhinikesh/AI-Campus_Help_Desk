/**
 * server/models/FaceEmbedding.js (FaceProfile)
 * Biometric enrollment metadata model.
 * Stores encrypted template references and explicit consent records.
 * NEVER exposed directly through student or admin client APIs.
 */
'use strict';

const mongoose = require('mongoose');

const faceProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true,
    },
    enrollmentStatus: {
      type: String,
      enum: [
        'not_enrolled',
        'consent_pending',
        'consent_granted',
        'enrolling',
        'enrolled',
        'enrollment_failed',
        'consent_withdrawn',
        'revoked',
        'deleted',
        're_enrollment_required',
      ],
      default: 'not_enrolled',
    },
    status: {
      type: String,
      enum: [
        'not_enrolled',
        'consent_pending',
        'consent_granted',
        'enrolling',
        'enrolled',
        'enrollment_failed',
        'consent_withdrawn',
        'revoked',
        'deleted',
        're_enrollment_required',
      ],
      default: 'not_enrolled',
    },
    consentStatus: {
      type: String,
      enum: ['active', 'withdrawn', 'revoked', 'pending', 'none'],
      default: 'none',
    },
    consentGiven: {
      type: Boolean,
      default: false,
    },
    consentVersion: {
      type: String,
      default: 'v1.0',
    },
    consentTimestamp: {
      type: Date,
      default: null,
    },
    consentDate: {
      type: Date,
      default: null,
    },
    enrollmentTimestamp: {
      type: Date,
      default: null,
    },
    enrolledAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    templateReference: {
      type: String,
      select: false, // excluded by default from queries for security
    },
    encryptedData: {
      type: String,
      select: false, // never exposed to browser
    },
    encryptionKeyVersion: {
      type: String,
      default: 'v1.0',
    },
    algorithm: {
      type: String,
      default: 'AES-256-GCM',
    },
    samplesCaptured: {
      type: Number,
      default: 0,
    },
    imageQualityScore: {
      type: Number,
      default: null,
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    deletionCompletedAt: {
      type: Date,
      default: null,
    },
    enrolledBy: {
      type: String,
      enum: ['self', 'admin'],
      default: 'self',
    },
  },
  { timestamps: true }
);

// Synchronize status aliases
faceProfileSchema.pre('save', function (next) {
  if (this.enrollmentStatus && !this.status) {
    this.status = this.enrollmentStatus;
  }
  if (!this.enrollmentStatus && this.status) {
    this.enrollmentStatus = this.status;
  }
  if (this.consentTimestamp && !this.consentDate) {
    this.consentDate = this.consentTimestamp;
  }
  if (!this.consentTimestamp && this.consentDate) {
    this.consentTimestamp = this.consentDate;
  }
  if (this.enrollmentTimestamp && !this.enrolledAt) {
    this.enrolledAt = this.enrollmentTimestamp;
  }
  if (!this.enrollmentTimestamp && this.enrolledAt) {
    this.enrollmentTimestamp = this.enrolledAt;
  }
  next();
});

faceProfileSchema.index({ student: 1, enrollmentStatus: 1 });

module.exports = mongoose.model('FaceEmbedding', faceProfileSchema);
