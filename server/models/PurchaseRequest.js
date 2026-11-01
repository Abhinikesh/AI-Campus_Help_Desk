/**
 * server/models/PurchaseRequest.js
 * Departmental requisitions for capital equipment and consumable supplies.
 */
'use strict';

const mongoose = require('mongoose');

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Requesting department is required'],
      trim: true,
      index: true,
    },
    requestingEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemDescription: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: [true, 'Category is required'],
      index: true,
    },
    itemType: {
      type: String,
      enum: ['asset', 'consumable'],
      default: 'asset',
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    estimatedUnitCost: {
      type: Number,
      required: true,
      min: [0, 'Cost must be positive'], // in integer Indian paise
    },
    estimatedTotalCost: {
      type: Number,
      required: true,
      min: [0, 'Total cost must be positive'], // in integer Indian paise
    },
    justification: {
      type: String,
      required: [true, 'Business justification is required'],
      trim: true,
      minlength: [5, 'Justification must be at least 5 characters'],
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    preferredVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    requiredByDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'converted_to_po',
        'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvalHistory: [
      {
        stage: { type: String, required: true },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['approved', 'rejected'], required: true },
        comments: { type: String, default: '' },
        decisionDate: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);
