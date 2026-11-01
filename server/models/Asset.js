/**
 * server/models/Asset.js
 * Centralized register for individually tracked equipment and institutional assets.
 */
'use strict';

const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: [true, 'Asset identifier is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: [true, 'Asset category is required'],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    manufacturer: {
      type: String,
      default: '',
      trim: true,
    },
    model: {
      type: String,
      default: '',
      trim: true,
    },
    serialNumber: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
      index: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    goodsReceipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      default: null,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
      index: true,
    },
    acquisitionCost: {
      type: Number,
      default: 0,
      min: [0, 'Acquisition cost must be positive'], // in integer Indian paise (1 INR = 100 paise)
    },
    currentLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      default: null,
      index: true,
    },
    department: {
      type: String,
      default: 'Central Stores',
      trim: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedDate: {
      type: Date,
      default: null,
    },
    condition: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor', 'damaged', 'unusable'],
      default: 'new',
    },
    status: {
      type: String,
      enum: [
        'in_stock',
        'available',
        'assigned',
        'under_maintenance',
        'damaged',
        'lost',
        'retired',
        'disposed',
      ],
      default: 'in_stock',
      index: true,
    },
    qrCode: {
      type: String,
      default: '',
      trim: true,
    },
    depreciation: {
      usefulLifeYears: { type: Number, default: 5, min: 1 },
      residualValue: { type: Number, default: 0, min: 0 }, // in integer paise
      depreciationMethod: {
        type: String,
        enum: ['straight_line', 'written_down'],
        default: 'straight_line',
      },
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

assetSchema.index({ status: 1, department: 1 });
assetSchema.index({ name: 'text', model: 'text', manufacturer: 'text', description: 'text' });

module.exports = mongoose.model('Asset', assetSchema);
