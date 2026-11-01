/**
 * server/models/BookCopy.js
 * Physical Copy Inventory Entity.
 * Distinguishes bibliographic book titles from distinct physical barcoded copies.
 */
'use strict';

const mongoose = require('mongoose');

const copyStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const bookCopySchema = new mongoose.Schema(
  {
    copyId: {
      type: String,
      required: [true, 'Copy ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
      index: true,
    },
    accessionNumber: {
      type: String,
      required: [true, 'Accession number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    shelfLocation: {
      type: String,
      default: '',
      trim: true,
    },
    acquisitionDate: {
      type: Date,
      default: Date.now,
    },
    acquisitionSource: {
      type: String,
      default: 'Institutional Purchase',
      trim: true,
    },
    priceInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    condition: {
      type: String,
      enum: ['new', 'good', 'fair', 'damaged', 'lost'],
      default: 'good',
    },
    status: {
      type: String,
      enum: ['available', 'issued', 'reserved', 'maintenance', 'lost', 'damaged', 'withdrawn'],
      default: 'available',
      index: true,
    },
    currentLoan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LibraryLoan',
      default: null,
    },
    currentReservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookReservation',
      default: null,
    },
    statusHistory: [copyStatusHistorySchema],
  },
  { timestamps: true }
);

bookCopySchema.virtual('priceInRupees').get(function () {
  return (this.priceInPaise || 0) / 100;
});

bookCopySchema.set('toJSON', { virtuals: true });
bookCopySchema.set('toObject', { virtuals: true });

bookCopySchema.index({ book: 1, status: 1 });

module.exports = mongoose.model('BookCopy', bookCopySchema);
