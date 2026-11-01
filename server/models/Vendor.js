/**
 * server/models/Vendor.js
 * Commercial suppliers, manufacturers, contractors, and maintenance providers.
 */
'use strict';

const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    vendorCode: {
      type: String,
      required: [true, 'Vendor code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Business email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    gstNumber: {
      type: String,
      default: '',
      uppercase: true,
      trim: true,
    },
    panNumber: {
      type: String,
      default: '',
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General Supplies',
      trim: true,
    },
    productsSupplied: {
      type: [String],
      default: [],
    },
    internalRemarks: {
      type: String,
      default: '',
      select: false, // confidential to procurement officers
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);

