/**
 * server/models/TransportMaintenance.js
 * Vehicle maintenance and service records.
 */
'use strict';

const mongoose = require('mongoose');

const transportMaintenanceSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      required: [true, 'Vehicle reference is required'],
      index: true,
    },
    maintenanceType: {
      type: String,
      enum: [
        'routine_service',
        'engine_repair',
        'tire_replacement',
        'brake_overhaul',
        'electrical',
        'body_work',
        'inspection',
        'other',
      ],
      required: [true, 'Maintenance type is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Maintenance description is required'],
      trim: true,
    },
    serviceDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    nextServiceDate: {
      type: Date,
      default: null,
    },
    costInPaise: {
      type: Number,
      default: 0,
      min: [0, 'Cost in paise cannot be negative'],
    },
    serviceProvider: {
      type: String,
      required: [true, 'Service workshop or vendor is required'],
      trim: true,
    },
    odometerReadingKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    downtimeDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

module.exports = mongoose.model('TransportMaintenance', transportMaintenanceSchema);

