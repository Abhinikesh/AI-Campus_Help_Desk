/**
 * server/models/TransportRoute.js
 * Configurable Campus Transport Routes.
 */
'use strict';

const mongoose = require('mongoose');

const transportRouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true,
      maxlength: [150, 'Route name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Unique route code is required (e.g. TR-01)'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    startLocation: {
      type: String,
      required: [true, 'Start location is required'],
      trim: true,
    },
    endLocation: {
      type: String,
      required: [true, 'End destination location is required'],
      trim: true,
    },
    estimatedDurationMinutes: {
      type: Number,
      default: 45,
      min: [5, 'Duration must be at least 5 minutes'],
    },
    operationalDays: [
      {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    ],
    schedule: {
      morningDepartureTime: { type: String, default: '07:30', trim: true },
      morningArrivalTime: { type: String, default: '08:45', trim: true },
      eveningDepartureTime: { type: String, default: '17:15', trim: true },
      eveningArrivalTime: { type: String, default: '18:30', trim: true },
    },
    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      default: null,
      index: true,
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAttendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    maxCapacity: {
      type: Number,
      required: [true, 'Maximum route capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    allocatedStudentsCount: {
      type: Number,
      default: 0,
      min: [0, 'Allocated count cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled'],
      default: 'active',
      index: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

transportRouteSchema.index({ status: 1, academicYear: 1 });

module.exports = mongoose.model('TransportRoute', transportRouteSchema);

