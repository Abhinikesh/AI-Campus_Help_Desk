/**
 * server/models/HostelBed.js
 * Physical bed-level inventory within a room.
 */
'use strict';

const mongoose = require('mongoose');

const hostelBedSchema = new mongoose.Schema(
  {
    bedId: {
      type: String,
      required: [true, 'Bed ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelRoom',
      required: [true, 'Room reference is required'],
      index: true,
    },
    bedNumber: {
      type: String,
      required: [true, 'Bed number or label is required'],
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['available', 'allocated', 'occupied', 'maintenance', 'inactive'],
      default: 'available',
      index: true,
    },
    currentAllocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelAllocation',
      default: null,
      index: true,
    },
    currentStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: bedNumber within a room must be unique
hostelBedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });

module.exports = mongoose.model('HostelBed', hostelBedSchema);

