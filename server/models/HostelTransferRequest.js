/**
 * server/models/HostelTransferRequest.js
 * Student room/bed transfer workflow.
 */
'use strict';

const mongoose = require('mongoose');

const hostelTransferRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: [true, 'Request number is required'],
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
    currentAllocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelAllocation',
      required: [true, 'Current allocation is required'],
    },
    currentHostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
    },
    currentRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelRoom',
      required: true,
    },
    currentBed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelBed',
      required: true,
    },
    requestedHostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
    },
    requestedRoomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad', 'dormitory', 'any'],
      default: 'any',
    },
    reason: {
      type: String,
      required: [true, 'Transfer reason is required'],
      minlength: [5, 'Reason must be at least 5 characters'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    review: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      comments: {
        type: String,
        default: '',
        trim: true,
      },
      newAllocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HostelAllocation',
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('HostelTransferRequest', hostelTransferRequestSchema);

