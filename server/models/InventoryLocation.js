/**
 * server/models/InventoryLocation.js
 * Physical locations, stores, warehouses, departments, and laboratory facilities.
 */
'use strict';

const mongoose = require('mongoose');

const inventoryLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    code: {
      type: String,
      required: [true, 'Location code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'store',
        'warehouse',
        'department',
        'laboratory',
        'office',
        'classroom',
        'library',
        'hostel',
        'other',
      ],
      default: 'department',
      index: true,
    },
    department: {
      type: String,
      default: 'Central Stores',
      trim: true,
      index: true,
    },
    building: {
      type: String,
      default: '',
      trim: true,
    },
    roomNumber: {
      type: String,
      default: '',
      trim: true,
    },
    custodian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryLocation', inventoryLocationSchema);
