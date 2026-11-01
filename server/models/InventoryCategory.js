/**
 * server/models/InventoryCategory.js
 * Configurable categories for physical assets and consumable stock.
 */
'use strict';

const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Category code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    classification: {
      type: String,
      enum: ['asset', 'consumable'],
      required: [true, 'Classification must be asset or consumable'],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
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

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);

