/**
 * server/models/LibraryFine.js
 * Tracks fines for overdue book loans, damaged copies, and lost books.
 * Enforces safe integer paise currency representation.
 */
'use strict';

const mongoose = require('mongoose');

const libraryFineSchema = new mongoose.Schema(
  {
    fineNumber: {
      type: String,
      required: [true, 'Fine number is required'],
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
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LibraryLoan',
      default: null,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    copy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookCopy',
      default: null,
    },
    fineType: {
      type: String,
      enum: ['overdue', 'lost', 'lost_book', 'damaged', 'damaged_book', 'other_penalty'],
      required: true,
      index: true,
    },
    amountInPaise: {
      type: Number,
      required: [true, 'Fine amount in paise is required'],
      min: [1, 'Fine amount must be greater than zero'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    calculationDetails: {
      overdueDays: { type: Number, default: 0 },
      graceDays: { type: Number, default: 0 },
      ratePerDayInPaise: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'waived', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentReference: {
      type: String,
      default: '',
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'online', 'waived', 'other'],
      default: 'cash',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    waivedAt: {
      type: Date,
      default: null,
    },
    waiverReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

libraryFineSchema.virtual('amountInRupees').get(function () {
  return (this.amountInPaise || 0) / 100;
});

libraryFineSchema.set('toJSON', { virtuals: true });
libraryFineSchema.set('toObject', { virtuals: true });

libraryFineSchema.index({ student: 1, status: 1 });
libraryFineSchema.index({ loan: 1, status: 1 });

module.exports = mongoose.model('LibraryFine', libraryFineSchema);
