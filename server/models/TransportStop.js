/**
 * server/models/TransportStop.js
 * Ordered Stops for Campus Transport Routes.
 */
'use strict';

const mongoose = require('mongoose');

const transportStopSchema = new mongoose.Schema(
  {
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      required: [true, 'Route reference is required'],
      index: true,
    },
    stopName: {
      type: String,
      required: [true, 'Stop name is required'],
      trim: true,
      maxlength: [120, 'Stop name cannot exceed 120 characters'],
    },
    stopCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    sequence: {
      type: Number,
      required: [true, 'Stop sequence order is required'],
      min: [1, 'Sequence must be at least 1'],
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    scheduledMorningPickupTime: {
      type: String,
      default: '',
      trim: true,
    },
    scheduledEveningDropTime: {
      type: String,
      default: '',
      trim: true,
    },
    coordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    fareMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring stop sequence order is unique per route
transportStopSchema.index({ route: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('TransportStop', transportStopSchema);

