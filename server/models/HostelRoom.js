/**
 * server/models/HostelRoom.js
 * Room-level inventory within a specific hostel.
 */
'use strict';

const mongoose = require('mongoose');

const hostelRoomSchema = new mongoose.Schema(
  {
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      uppercase: true,
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
      default: 0,
    },
    block: {
      type: String,
      default: '',
      trim: true,
    },
    roomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad', 'dormitory'],
      required: [true, 'Room type is required'],
      index: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Room capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    facilities: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['available', 'full', 'maintenance', 'inactive'],
      default: 'available',
      index: true,
    },
    totalBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    occupiedBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: a roomNumber must be unique within a hostel
hostelRoomSchema.index({ hostel: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('HostelRoom', hostelRoomSchema);

