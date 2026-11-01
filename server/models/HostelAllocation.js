/**
 * server/models/HostelAllocation.js
 * Tracks the official assignment of a student to a specific hostel, room, and bed.
 */
'use strict';

const mongoose = require('mongoose');

const hostelAllocationSchema = new mongoose.Schema(
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
      ref: 'HostelApplication',
      default: null,
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
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelBed',
      required: [true, 'Bed reference is required'],
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    semester: {
      type: Number,
      default: 1,
    },
    startDate: {
      type: Date,
      required: [true, 'Allocation start date is required'],
      default: Date.now,
    },
    expectedEndDate: {
      type: Date,
      required: [true, 'Expected allocation end date is required'],
    },
    actualEndDate: {
      type: Date,
      default: null,
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Allocating staff member is required'],
    },
    status: {
      type: String,
      enum: ['allocated', 'active', 'transferred', 'checked_out', 'cancelled'],
      default: 'allocated',
      index: true,
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },
    feeInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeInvoice',
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes to prevent conflicting allocations
hostelAllocationSchema.index({ student: 1, status: 1 });
hostelAllocationSchema.index({ bed: 1, status: 1 });

module.exports = mongoose.model('HostelAllocation', hostelAllocationSchema);

