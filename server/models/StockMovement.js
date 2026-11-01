/**
 * server/models/StockMovement.js
 * Immutable transaction ledger for all consumable inventory receipts, issues, transfers, and adjustments.
 */
'use strict';

const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    movementNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    stockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: [
        'opening_balance',
        'purchase_receipt',
        'issue',
        'return',
        'transfer',
        'adjustment',
        'damaged',
        'expired',
        'write_off',
      ],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Quantity must be strictly positive'],
    },
    previousBalance: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
      min: [0, 'Resulting balance cannot be negative'],
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      default: null,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      default: null,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    purchaseRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseRequest',
      default: null,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    issuedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Movement reason is required'],
      trim: true,
    },
    referenceNumber: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ stockItem: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);

