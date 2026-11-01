/**
 * server/models/LibraryPolicy.js
 * Configurable Library Circulation, Loan Duration, and Fine Policy.
 */
'use strict';

const mongoose = require('mongoose');

const libraryPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Policy name is required'],
      trim: true,
      default: 'Standard Institutional Policy',
    },
    code: {
      type: String,
      required: [true, 'Policy code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      default: 'DEFAULT',
    },
    maxBooksPerStudent: {
      type: Number,
      required: true,
      default: 3,
      min: [1, 'Maximum books per student must be at least 1'],
    },
    loanDurationDays: {
      type: Number,
      required: true,
      default: 14,
      min: [1, 'Loan duration must be at least 1 day'],
    },
    maxRenewals: {
      type: Number,
      required: true,
      default: 2,
      min: [0, 'Max renewals cannot be negative'],
    },
    renewalDurationDays: {
      type: Number,
      required: true,
      default: 14,
      min: [1, 'Renewal duration must be at least 1 day'],
    },
    gracePeriodDays: {
      type: Number,
      required: true,
      default: 1,
      min: [0, 'Grace period cannot be negative'],
    },
    finePerOverdueDayInPaise: {
      type: Number,
      required: true,
      default: 500, // ₹5 per day = 500 paise
      min: [0, 'Fine per day cannot be negative'],
    },
    maxFinePerBookInPaise: {
      type: Number,
      required: true,
      default: 100000, // ₹1,000 maximum cap
      min: [0, 'Max fine cannot be negative'],
    },
    reservationExpiryDays: {
      type: Number,
      required: true,
      default: 3,
      min: [1, 'Reservation expiry window must be at least 1 day'],
    },
    allowRenewIfOverdue: {
      type: Boolean,
      default: false,
    },
    allowRenewIfReserved: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

libraryPolicySchema.virtual('finePerOverdueDayInRupees').get(function () {
  return (this.finePerOverdueDayInPaise || 0) / 100;
});

libraryPolicySchema.set('toJSON', { virtuals: true });
libraryPolicySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LibraryPolicy', libraryPolicySchema);

