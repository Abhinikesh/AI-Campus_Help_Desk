/**
 * server/models/LibraryLoan.js
 * Tracks student book loans, issue dates, due dates, renewals, and returns.
 */
'use strict';

const mongoose = require('mongoose');

const renewalHistorySchema = new mongoose.Schema(
  {
    previousDueDate: {
      type: Date,
      required: true,
    },
    newDueDate: {
      type: Date,
      required: true,
    },
    renewedAt: {
      type: Date,
      default: Date.now,
    },
    renewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      default: 'Standard loan extension',
      trim: true,
    },
  },
  { _id: false }
);

const libraryLoanSchema = new mongoose.Schema(
  {
    issueId: {
      type: String,
      required: [true, 'Issue ID is required'],
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
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book is required'],
      index: true,
    },
    copy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookCopy',
      required: [true, 'Physical copy is required'],
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    actualReturnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'returned', 'overdue', 'lost'],
      default: 'active',
      index: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Issuing librarian/admin is required'],
    },
    returnedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    returnCondition: {
      type: String,
      enum: ['new', 'good', 'fair', 'damaged', 'lost', ''],
      default: '',
    },
    renewalCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    renewalHistory: [renewalHistorySchema],
    policySnapshot: {
      loanDurationDays: { type: Number, default: 14 },
      finePerOverdueDayInPaise: { type: Number, default: 500 },
      gracePeriodDays: { type: Number, default: 1 },
      maxRenewals: { type: Number, default: 2 },
      maxFinePerBookInPaise: { type: Number, default: 100000 },
    },
    fine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LibraryFine',
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Virtual for overdue check
libraryLoanSchema.virtual('isCurrentlyOverdue').get(function () {
  return this.status === 'active' && new Date() > this.dueDate;
});

libraryLoanSchema.set('toJSON', { virtuals: true });
libraryLoanSchema.set('toObject', { virtuals: true });

libraryLoanSchema.index({ student: 1, status: 1 });
libraryLoanSchema.index({ copy: 1, status: 1 });
libraryLoanSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('LibraryLoan', libraryLoanSchema);

