/**
 * server/models/Hostel.js
 * Configurable residential building / hostel model for CampusSphere AI ERP.
 */
'use strict';

const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hostel name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Hostel code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['boys', 'girls', 'international', 'postgraduate', 'staff', 'general'],
      required: [true, 'Hostel type is required'],
      index: true,
    },
    genderEligibility: {
      type: String,
      enum: ['male', 'female', 'co-ed', 'any'],
      default: 'any',
      index: true,
    },
    building: {
      type: String,
      default: '',
      trim: true,
    },
    campusLocation: {
      type: String,
      default: 'Main Campus',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    wardens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    contactNumber: {
      type: String,
      default: '',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
    },
    applicablePrograms: [
      {
        type: String,
        trim: true,
      },
    ],
    applicableBatches: [
      {
        type: String,
        trim: true,
      },
    ],
    totalRooms: {
      type: Number,
      default: 0,
      min: 0,
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
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for occupancy percentage
hostelSchema.virtual('occupancyRate').get(function () {
  if (!this.totalBeds || this.totalBeds === 0) return 0;
  return Math.round(((this.occupiedBeds || 0) / this.totalBeds) * 100);
});

module.exports = mongoose.model('Hostel', hostelSchema);

