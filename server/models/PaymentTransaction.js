/**
 * server/models/PaymentTransaction.js
 * Financial Payment Transaction Ledger.
 * Tracks payments, offline verification, receipt generation, and transaction references.
 */
'use strict';

const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeInvoice',
      required: [true, 'Fee invoice reference is required'],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    amountInPaise: {
      type: Number,
      required: [true, 'Payment amount in paise is required'],
      min: [1, 'Payment amount must be greater than zero'],
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'bank_transfer', 'neft_rtgs', 'cheque', 'dd', 'cash', 'online_gateway'],
      required: true,
    },
    paymentType: {
      type: String,
      enum: ['offline_verified', 'online_gateway'],
      default: 'offline_verified',
    },
    externalReference: {
      type: String,
      default: '',
      trim: true, // UTR number, Cheque number, Bank challan or Gateway reference
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // User who recorded the transaction
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Finance Administrator who verified the transaction
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

paymentTransactionSchema.virtual('amountInRupees').get(function () {
  return (this.amountInPaise || 0) / 100;
});

paymentTransactionSchema.set('toJSON', { virtuals: true });
paymentTransactionSchema.set('toObject', { virtuals: true });

paymentTransactionSchema.index({ student: 1, paymentDate: -1 });
paymentTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);

