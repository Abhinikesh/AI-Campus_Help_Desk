/**
 * server/models/CareerResource.js
 * Official institutional career development guides, aptitude banks, and interview prep materials.
 */
'use strict';

const mongoose = require('mongoose');

const careerResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'resume_guide',
        'interview_prep',
        'aptitude',
        'technical',
        'gd_prep',
        'soft_skills',
        'company_intel',
        'other',
      ],
      required: [true, 'Resource category is required'],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    resourceType: {
      type: String,
      enum: ['internal_document', 'external_link', 'article', 'video'],
      default: 'article',
    },
    fileUrl: {
      type: String,
      default: null,
    },
    externalUrl: {
      type: String,
      default: null,
      trim: true,
    },
    tags: [{ type: String, trim: true }],
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    targetBatches: [{ type: Number }],
    targetDepartments: [{ type: String, uppercase: true, trim: true }],
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

careerResourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('CareerResource', careerResourceSchema);
