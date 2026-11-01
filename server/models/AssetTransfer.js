/**
 * server/models/AssetTransfer.js
 * Manages physical and departmental transfers of institutional equipment.
 */
'use strict';

const mongoose = require('mongoose');

const assetTransferSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    fromLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      required: true,
    },
    toLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      required: true,
    },
    fromDepartment: {
      type: String,
      default: '',
      trim: true,
    },
    toDepartment: {
      type: String,
      default: '',
      trim: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    transferDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Transfer reason is required'],
      trim: true,
    },
    handoverNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssetTransfer', assetTransferSchema);

