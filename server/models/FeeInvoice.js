/**
 * server/models/FeeInvoice.js
 * Student Fee Billing Invoice.
 * Uses integer paise for all calculations to eliminate floating point rounding errors.
 */
'use strict';

const mongoose = require('mongoose');

const invoiceComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const feeInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: [true, 'Fee structure reference is required'],
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    components: [invoiceComponentSchema],
    grossAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    concessionAmountInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    lateFeeAmountInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPayableInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaidInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingBalanceInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'archived'],
      default: 'issued',
      index: true,
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentTransaction',
      },
    ],
    concessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeAdjustment',
      },
    ],
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Virtuals for Rupee displays
feeInvoiceSchema.virtual('grossAmount').get(function () {
  return (this.grossAmountInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('concessionAmount').get(function () {
  return (this.concessionAmountInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('lateFeeAmount').get(function () {
  return (this.lateFeeAmountInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('netPayable').get(function () {
  return (this.netPayableInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('amountPaid').get(function () {
  return (this.amountPaidInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('outstandingBalance').get(function () {
  return (this.outstandingBalanceInPaise || 0) / 100;
});

feeInvoiceSchema.virtual('isOverdue').get(function () {
  return this.dueDate && new Date() > this.dueDate && this.outstandingBalanceInPaise > 0;
});

feeInvoiceSchema.set('toJSON', { virtuals: true });
feeInvoiceSchema.set('toObject', { virtuals: true });

// Prevent duplicate invoices for the same student, feeStructure, academicYear, and semester
feeInvoiceSchema.index(
  { student: 1, feeStructure: 1, academicYear: 1, semester: 1 },
  { unique: true }
);

feeInvoiceSchema.index({ student: 1, status: 1 });
feeInvoiceSchema.index({ academicYear: 1, department: 1, semester: 1 });

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
