/**
 * server/models/EventCertificate.js
 * Verifiable event participation, achievement, and volunteering certificates.
 */
'use strict';

const mongoose = require('mongoose');

const eventCertificateSchema = new mongoose.Schema(
  {
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
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
      index: true,
    },
    participantName: {
      type: String,
      required: true,
      trim: true,
    },
    studentRollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    eventTitle: {
      type: String,
      required: true,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    certificateType: {
      type: String,
      enum: ['participation', 'completion', 'winner', 'runner_up', 'volunteer', 'organizer'],
      default: 'participation',
      index: true,
    },
    position: {
      type: String,
      default: '',
      trim: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    issuerName: {
      type: String,
      default: 'Dean of Student Welfare',
      trim: true,
    },
    issuerDesignation: {
      type: String,
      default: 'Dean, Student Affairs & Extra-Curriculars',
      trim: true,
    },
    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['issued', 'revoked'],
      default: 'issued',
      index: true,
    },
    revocationReason: {
      type: String,
      default: '',
      trim: true,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique compound index preventing duplicate active certificates of the same type for a student in an event
eventCertificateSchema.index({ event: 1, student: 1, certificateType: 1 }, { unique: true });

module.exports = mongoose.model('EventCertificate', eventCertificateSchema);

