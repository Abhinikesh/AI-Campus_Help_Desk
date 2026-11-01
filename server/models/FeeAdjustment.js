/**
 * server/models/FeeAdjustment.js
 * Tracks Scholarships, Need-based Concessions, Institutional Fee Waivers, and Refunds.
 */
'use strict';

const mongoose = require('mongoose');

const feeAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: {
      type: String,
      required: [true, 'Adjustment number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeInvoice',
      required: [true, 'Invoice is required'],
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: [
        'merit_scholarship',
        'need_based_concession',
        'government_scholarship',
        'institutional_waiver',
        'refund',
        'other',
      ],
      required: true,
      index: true,
    },
    amountInPaise: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [1, 'Adjustment amount must be positive'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters long'],
    },
    supportingDocReference: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

feeAdjustmentSchema.virtual('amountInRupees').get(function () {
  return (this.amountInPaise || 0) / 100;
});

feeAdjustmentSchema.set('toJSON', { virtuals: true });
feeAdjustmentSchema.set('toObject', { virtuals: true });

feeAdjustmentSchema.index({ student: 1, status: 1 });
feeAdjustmentSchema.index({ invoice: 1, status: 1 });

module.exports = mongoose.model('FeeAdjustment', feeAdjustmentSchema);

