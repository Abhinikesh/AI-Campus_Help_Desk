/**
 * server/models/EmployeeLeaveBalance.js
 * Tracks annual and periodic employee leave quota balances.
 */
'use strict';

const mongoose = require('mongoose');

const employeeLeaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true,
    },
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy',
      required: true,
      index: true,
    },
    leaveCode: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    accrued: {
      type: Number,
      default: 0,
      min: 0,
    },
    used: {
      type: Number,
      default: 0,
      min: 0,
    },
    adjusted: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

employeeLeaveBalanceSchema.index({ employee: 1, policy: 1, year: 1 }, { unique: true });

employeeLeaveBalanceSchema.pre('validate', async function (next) {
  if (!this.leaveCode && this.policy) {
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

module.exports = mongoose.model('EmployeeLeaveBalance', employeeLeaveBalanceSchema);
