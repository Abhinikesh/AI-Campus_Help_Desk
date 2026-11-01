/**
 * server/models/StockItem.js
 * Tracks consumable inventory, stationary, office supplies, and lab chemicals by quantity.
 */
'use strict';

const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Stock item name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU/Stock code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: [true, 'Stock category is required'],
      index: true,
    },
    unit: {
      type: String,
      enum: [
        'pieces',
        'boxes',
        'packs',
        'kilograms',
        'litres',
        'metres',
        'rolls',
        'sets',
        'other',
      ],
      default: 'pieces',
    },
    currentQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock balance cannot be negative'], // strictly non-negative!
    },
    minStockLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    reorderThreshold: {
      type: Number,
      default: 20,
      min: 0,
      index: true,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0, // in integer Indian paise
    },
    location: {
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

stockItemSchema.index({ currentQuantity: 1, reorderThreshold: 1 });
stockItemSchema.index({ name: 'text', sku: 'text' });

module.exports = mongoose.model('StockItem', stockItemSchema);
