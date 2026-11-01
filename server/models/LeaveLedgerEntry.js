/**
 * server/models/LeaveLedgerEntry.js
 * Immutable audit ledger for every leave debit, credit, accrual, and adjustment.
 */
'use strict';

const mongoose = require('mongoose');

const leaveLedgerEntrySchema = new mongoose.Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true,
    },
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy',
      default: null,
    },
    leaveCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'LEAVE',
    },
    year: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'opening_balance',
        'accrual',
        'approved_deduction',
        'cancellation_credit',
        'manual_adjustment',
        'carry_forward',
        'expiry',
        'CREDIT',
        'DEBIT',
      ],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Ledger entry reason is required'],
      trim: true,
    },
    days: {
      type: Number,
      required: true,
    },
    previousBalance: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeLeaveApplication',
      default: null,
    },
    referenceApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeLeaveApplication',
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leaveLedgerEntrySchema.index({ employee: 1, leaveCode: 1, createdAt: -1 });

leaveLedgerEntrySchema.pre('validate', async function (next) {
  if (this.referenceApplication && !this.application) {
    this.application = this.referenceApplication;
  }
  if (this.application && !this.referenceApplication) {
    this.referenceApplication = this.application;
  }
  if ((!this.leaveCode || this.leaveCode === 'LEAVE') && this.policy) {
    try {
      const LeavePolicy = mongoose.model('LeavePolicy');
      const pol = await LeavePolicy.findById(this.policy);
      if (pol && pol.code) {
        this.leaveCode = pol.code;
      }
    } catch (_) {}
  }
  next();
});

module.exports = mongoose.model('LeaveLedgerEntry', leaveLedgerEntrySchema);
