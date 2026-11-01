/**
 * server/models/BookReservation.js
 * Tracks queue reservations for books with 0 currently available physical copies.
 */
'use strict';

const mongoose = require('mongoose');

const bookReservationSchema = new mongoose.Schema(
  {
    reservationNumber: {
      type: String,
      required: [true, 'Reservation number is required'],
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
    reservedCopy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookCopy',
      default: null,
    },
    requestDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    pickupDeadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'available_for_pickup', 'fulfilled', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

bookReservationSchema.virtual('allocatedCopy').get(function () {
  return this.reservedCopy;
});

// Compound index to prevent duplicate active reservations by the same student for the same book
bookReservationSchema.index(
  { student: 1, book: 1, status: 1 }
);

// Fair FIFO queue ordering index
bookReservationSchema.index({ book: 1, status: 1, requestDate: 1 });

module.exports = mongoose.model('BookReservation', bookReservationSchema);
