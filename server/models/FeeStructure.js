/**
 * server/models/FeeStructure.js
 * Configurable academic cohort fee structures.
 * Uses integer paise for currency safety (1 INR = 100 paise).
 */
'use strict';

const mongoose = require('mongoose');

const feeComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Component name is required'],
      trim: true,
    },
    amountInPaise: {
      type: Number,
      required: [true, 'Amount in paise is required'],
      min: [0, 'Amount cannot be negative'],
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const lateFeePolicySchema = new mongoose.Schema(
  {
    policyType: {
      type: String,
      enum: ['none', 'fixed', 'percentage'],
      default: 'none',
    },
    graceDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    fixedAmountInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentageRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const feeStructureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Fee structure name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Fee structure code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      required: true,
      trim: true,
    },
    program: {
      type: String,
      default: 'B.Tech',
      trim: true,
    },
    department: {
      type: String,
      default: 'CSE',
      trim: true,
      required: true,
    },
    branch: {
      type: String,
      default: 'CSE',
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
    },
    studentCategory: {
      type: String,
      enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management', 'All'],
      default: 'All',
    },
    components: [feeComponentSchema],
    totalAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    lateFeePolicy: {
      type: lateFeePolicySchema,
      default: () => ({ policyType: 'none', graceDays: 0, fixedAmountInPaise: 0, percentageRate: 0 }),
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-sum total amount from mandatory components
feeStructureSchema.pre('save', function () {
  if (this.components && this.components.length > 0) {
    this.totalAmountInPaise = this.components
      .filter((c) => c.isMandatory)
      .reduce((sum, c) => sum + (c.amountInPaise || 0), 0);
  }
});

// Virtual for Rupees formatting
feeStructureSchema.virtual('totalAmountInRupees').get(function () {
  return (this.totalAmountInPaise || 0) / 100;
});

feeStructureSchema.virtual('totalAmount').get(function () {
  return (this.totalAmountInPaise || 0) / 100;
});

feeStructureSchema.set('toJSON', { virtuals: true });
feeStructureSchema.set('toObject', { virtuals: true });

feeStructureSchema.index({ academicYear: 1, department: 1, semester: 1, status: 1 });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
