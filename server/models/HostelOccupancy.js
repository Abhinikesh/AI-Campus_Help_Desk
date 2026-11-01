/**
 * server/models/HostelOccupancy.js
 * Operational physical stay lifecycle: check-in, key records, inspection, check-out, and clearance.
 */
'use strict';

const mongoose = require('mongoose');

const hostelOccupancySchema = new mongoose.Schema(
  {
    allocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelAllocation',
      required: [true, 'Allocation reference is required'],
      unique: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
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
    },
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelBed',
      required: [true, 'Bed reference is required'],
    },
    checkIn: {
      date: {
        type: Date,
        default: Date.now,
        required: true,
      },
      staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      inventoryCondition: {
        type: String,
        default: 'Pristine condition',
        trim: true,
      },
      keysIssued: {
        type: Number,
        default: 1,
        min: 0,
      },
      notes: {
        type: String,
        default: '',
        trim: true,
      },
    },
    checkOut: {
      date: {
        type: Date,
        default: null,
      },
      staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      roomCondition: {
        type: String,
        default: '',
        trim: true,
      },
      keysReturned: {
        type: Boolean,
        default: true,
      },
      damageAssessmentInPaise: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingDuesInPaise: {
        type: Number,
        default: 0,
        min: 0,
      },
      clearanceStatus: {
        type: String,
        enum: ['pending', 'cleared', 'withheld'],
        default: 'pending',
      },
      clearanceNotes: {
        type: String,
        default: '',
        trim: true,
      },
    },
    status: {
      type: String,
      enum: ['checked_in', 'checked_out'],
      default: 'checked_in',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('HostelOccupancy', hostelOccupancySchema);

