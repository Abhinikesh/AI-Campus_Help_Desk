/**
 * server/models/AssetAllocation.js
 * Tracks the custody, assignment, and return of institutional assets.
 */
'use strict';

const mongoose = require('mongoose');

const assetAllocationSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    allocationDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expectedReturnDate: {
      type: Date,
      default: null,
    },
    issuedCondition: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor'],
      default: 'good',
    },
    accessoriesIssued: {
      type: [String],
      default: [],
    },
    acknowledgementStatus: {
      type: String,
      enum: ['pending', 'acknowledged', 'disputed'],
      default: 'acknowledged',
    },
    returnedDate: {
      type: Date,
      default: null,
    },
    returnedCondition: {
      type: String,
      enum: ['good', 'fair', 'poor', 'damaged', 'missing_parts'],
      default: null,
    },
    returnedRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'returned', 'overdue'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

assetAllocationSchema.index({ asset: 1, status: 1 });

module.exports = mongoose.model('AssetAllocation', assetAllocationSchema);
