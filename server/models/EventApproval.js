/**
 * server/models/EventApproval.js
 * Configurable multi-tier event approval workflow records.
 */
'use strict';

const mongoose = require('mongoose');

const eventApprovalSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: [
        'faculty_coordinator',
        'department_head',
        'dean_admin',
        'final_publication',
      ],
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    decisionDate: {
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
  },
  { timestamps: true }
);

eventApprovalSchema.index({ event: 1, stage: 1 });

module.exports = mongoose.model('EventApproval', eventApprovalSchema);
