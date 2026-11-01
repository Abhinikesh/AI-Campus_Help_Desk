/**
 * server/models/TransportTrip.js
 * Daily Route Trip Schedules and Operational Logging.
 */
'use strict';

const mongoose = require('mongoose');

const transportTripSchema = new mongoose.Schema(
  {
    tripDate: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      required: [true, 'Route reference is required'],
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      required: [true, 'Vehicle reference is required'],
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver reference is required'],
      index: true,
    },
    attendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tripType: {
      type: String,
      enum: ['morning_pickup', 'evening_drop', 'special_shuttle'],
      default: 'morning_pickup',
      index: true,
    },
    scheduledDeparture: {
      type: Date,
      required: true,
    },
    scheduledArrival: {
      type: Date,
      required: true,
    },
    actualDeparture: {
      type: Date,
      default: null,
    },
    actualArrival: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'delayed'],
      default: 'scheduled',
      index: true,
    },
    delayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    delayReason: {
      type: String,
      default: '',
      trim: true,
    },
    incidentReported: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

transportTripSchema.index({ tripDate: 1, route: 1, tripType: 1 });

module.exports = mongoose.model('TransportTrip', transportTripSchema);

