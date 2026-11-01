/**
 * server/models/EmployeeDocument.js
 * Secure storage record for institutional employee documents.
 */
'use strict';

const mongoose = require('mongoose');

const employeeDocumentSchema = new mongoose.Schema(
  {
    documentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true
    },
    documentType: {
      type: String,
      enum: [
        'identity_proof',
        'qualification',
        'offer_letter',
        'joining_letter',
        'contract',
        'experience_cert',
        'background_check',
        'tax_form',
        'appraisal',
        'relieving_letter',
        'other'
      ],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    fileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    isConfidential: {
      type: Boolean,
      default: false
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

employeeDocumentSchema.index({ employee: 1, documentType: 1 });

module.exports = mongoose.models.EmployeeDocument || mongoose.model('EmployeeDocument', employeeDocumentSchema);
