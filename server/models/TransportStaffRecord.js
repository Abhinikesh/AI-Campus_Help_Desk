/**
 * server/models/TransportStaffRecord.js
 * Dedicated Driver and Attendant Staff Profile Information.
 */
'use strict';

const mongoose = require('mongoose');

const transportStaffRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    staffRole: {
      type: String,
      enum: ['driver', 'attendant'],
      required: [true, 'Staff role is required (driver or attendant)'],
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    // Driver-specific fields
    licenseNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    licenseCategory: {
      type: String,
      enum: ['heavy_passenger', 'commercial', 'light_motor', 'other', 'none'],
      default: 'heavy_passenger',
    },
    licenseExpiryDate: {
      type: Date,
      default: null,
    },
    badgeNumber: {
      type: String,
      trim: true,
      default: '',
    },
    employmentType: {
      type: String,
      enum: ['permanent', 'contractual', 'vendor_deputed'],
      default: 'permanent',
    },
    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      default: null,
    },
    assignedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      default: null,
    },
    availabilityStatus: {
      type: String,
      enum: ['available', 'on_duty', 'on_leave', 'suspended', 'terminated'],
      default: 'available',
      index: true,
    },
    emergencyContact: {
      name: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      relation: { type: String, default: '', trim: true },
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

transportStaffRecordSchema.index({ staffRole: 1, availabilityStatus: 1 });

module.exports = mongoose.model('TransportStaffRecord', transportStaffRecordSchema);

