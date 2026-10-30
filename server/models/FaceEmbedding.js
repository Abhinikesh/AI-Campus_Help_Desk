/**
 * server/models/FaceEmbedding.js
 * Tracks face biometric enrollment status and consent.
 * NOTE: Raw embedding vectors or biometric data are handled through the internal service.
 * Never exposed directly to client UI.
 */
'use strict';

const mongoose = require('mongoose');

const faceEmbeddingSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true,
    },
    consentGiven: {
      type: Boolean,
      default: false,
      required: true,
    },
    consentDate: {
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
    status: {
      type: String,
      enum: ['not_enrolled', 'enrolled', 'revoked'],
      default: 'not_enrolled',
    },
    enrolledBy: {
      type: String,
      enum: ['self', 'admin'],
      default: 'self',
    },
    samplesCaptured: {
      type: Number,
      default: 0,
    },
    imageQualityScore: {
      type: Number,
      default: null, // 0-100
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FaceEmbedding', faceEmbeddingSchema);
