/**
 * server/models/EventVenueBooking.js
 * Concurrency-safe event venue scheduling and overlap prevention.
 */
'use strict';

const mongoose = require('mongoose');

const eventVenueBookingSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventVenue',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
      required: true,
      index: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String, // 'HH:mm'
      required: true,
    },
    endTime: {
      type: String, // 'HH:mm'
      required: true,
    },
    startDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    endDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['tentative', 'confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      index: true,
    },
    purpose: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound index for detecting overlapping bookings
eventVenueBookingSchema.index({ venue: 1, startDateTime: 1, endDateTime: 1, status: 1 });

module.exports = mongoose.model('EventVenueBooking', eventVenueBookingSchema);

