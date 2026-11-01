/**
 * server/models/TransportAllocation.js
 * Approved student route and stop allocation with concurrency control.
 */
'use strict';

const mongoose = require('mongoose');

const transportAllocationSchema = new mongoose.Schema(
  {
    allocationNumber: {
      type: String,
      required: [true, 'Allocation number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportApplication',
      default: null,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      required: [true, 'Allocated route is required'],
      index: true,
    },
    pickupStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportStop',
      required: [true, 'Allocated pickup stop is required'],
    },
    dropStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportStop',
      default: null,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      default: null,
    },
    seatNumber: {
      type: String,
      default: null,
      trim: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Allocation start date is required'],
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, 'Allocation end date is required'],
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Allocating staff reference is required'],
    },
    feeAmountInPaise: {
      type: Number,
      required: true,
      default: 1800000, // Rs. 18,000.00
      min: 0,
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },
    status: {
      type: String,
      enum: ['allocated', 'active', 'transferred', 'cancelled', 'expired'],
      default: 'allocated',
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

transportAllocationSchema.index({ student: 1, status: 1 });
transportAllocationSchema.index({ route: 1, status: 1 });

module.exports = mongoose.model('TransportAllocation', transportAllocationSchema);

