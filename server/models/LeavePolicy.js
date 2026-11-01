/**
 * server/models/LeavePolicy.js
 * Configurable institutional leave policies and entitlement rules.
 */
'use strict';

const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Leave policy code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Leave name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    applicableCategory: {
      type: String,
      default: 'all',
    },
    applicableCategories: [
      {
        type: String,
        enum: [
          'all',
          'teaching_faculty',
          'non_teaching_staff',
          'administrative_staff',
          'technical_staff',
          'support_staff',
          'contract_employee',
          'visiting_faculty',
        ],
      },
    ],
    annualEntitlement: {
      type: Number,
      required: [true, 'Annual entitlement days is required'],
      min: [0, 'Entitlement cannot be negative'],
    },
    accrualFrequency: {
      type: String,
      enum: ['annual', 'monthly', 'quarterly', 'none'],
      default: 'annual',
    },
    maxConsecutiveDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    minNoticeDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowHalfDay: {
      type: Boolean,
      default: true,
    },
    requiresSupportingDocument: {
      type: Boolean,
      default: false,
    },
    documentRequiredAfterDays: {
      type: Number,
      default: 2,
    },
    allowNegativeBalance: {
      type: Boolean,
      default: false,
    },
    maxNegativeLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowCarryForward: {
      type: Boolean,
      default: false,
    },
    maxCarryForwardDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

leavePolicySchema.pre('validate', function (next) {
  if (this.applicableCategory && (!this.applicableCategories || this.applicableCategories.length === 0)) {
    this.applicableCategories = [this.applicableCategory];
  }
  next();
});

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
