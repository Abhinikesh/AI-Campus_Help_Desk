/**
 * server/models/Fee.js
 * Fee record per student per fee item (tuition, hostel, etc.)
 * Payments are subdocuments so the history is preserved.
 */
'use strict';

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    paidOn: {
      type: Date,
      default: Date.now,
    },
    mode: {
      type: String,
      enum: ['online', 'cash', 'dd', 'cheque'],
      default: 'online',
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    receiptNo: {
      type: String,
      default: '',
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    title: {
      type: String,
      required: [true, 'Fee title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Fee amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    payments: [paymentSchema],
  },
  { timestamps: true }
);

/** Virtual: total paid so far */
feeSchema.virtual('totalPaid').get(function () {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});

/** Virtual: remaining balance */
feeSchema.virtual('balance').get(function () {
  return this.amount - this.totalPaid;
});

feeSchema.set('toJSON', { virtuals: true });
feeSchema.set('toObject', { virtuals: true });

feeSchema.index({ student: 1 });

module.exports = mongoose.model('Fee', feeSchema);
