/**
 * server/services/feeCalculation.service.js
 * High-precision, integer-paise financial calculation and reconciliation service.
 * Eliminates floating point errors (1 INR = 100 paise).
 * Sanitizes CSV data to prevent CSV/Formula injection attacks.
 */
'use strict';

const mongoose = require('mongoose');

/**
 * Converts a rupee value (number or numeric string) into integer paise.
 * @param {number|string} rupees
 * @returns {number} integer paise
 */
function toPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(rupees)) {
    return 0;
  }
  return Math.round(Number(rupees) * 100);
}

/**
 * Converts integer paise into standard floating-point rupees.
 * @param {number} paise
 * @returns {number} rupees
 */
function toRupees(paise) {
  if (!paise || isNaN(paise)) {
    return 0;
  }
  return paise / 100;
}

/**
 * Sums the components in a fee structure or invoice to calculate gross paise.
 * @param {Array<{ amountInPaise: number }>} components
 * @returns {number} sum in paise
 */
function calculateComponentsTotal(components = []) {
  if (!Array.isArray(components)) return 0;
  return components.reduce((sum, comp) => sum + (Number(comp.amountInPaise) || 0), 0);
}

/**
 * Calculates late fee in paise based on fee structure policy and due date.
 * @param {Object} invoice
 * @param {Object} feeStructure
 * @param {Date} [asOfDate=new Date()]
 * @returns {number} lateFeeInPaise
 */
function calculateLateFee(invoice, feeStructure, asOfDate = new Date()) {
  if (!invoice || !invoice.dueDate) return 0;
  const policy = feeStructure && feeStructure.lateFeePolicy ? feeStructure.lateFeePolicy : null;
  if (!policy || policy.policyType === 'none') {
    return 0;
  }

  const currentDate = new Date(asOfDate);
  const dueDate = new Date(invoice.dueDate);

  if (currentDate <= dueDate) {
    return 0;
  }

  const diffTime = currentDate.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const graceDays = policy.graceDays || 0;

  if (diffDays <= graceDays) {
    return 0;
  }

  if (policy.policyType === 'fixed') {
    return Number(policy.fixedAmountInPaise) || 0;
  }

  if (policy.policyType === 'percentage') {
    const baseNet = invoice.grossAmountInPaise - (invoice.concessionAmountInPaise || 0);
    const rate = Number(policy.percentageRate) || 0;
    return Math.round((Math.max(0, baseNet) * rate) / 100);
  }

  return 0;
}

/**
 * Reconciles invoice financial state against approved adjustments and verified transactions.
 * Enforces strict financial invariants:
 * - Net Payable = Gross - Concessions + Late Fee
 * - Amount Paid = Sum(Verified Transactions) - Sum(Approved Refunds)
 * - Outstanding Balance = Max(0, Net Payable - Amount Paid)
 * - Status transition: paid, partially_paid, overdue, issued
 *
 * @param {Object} invoiceDoc - Mongoose FeeInvoice document
 * @param {Object} [options]
 * @param {boolean} [options.save=false] - Whether to call .save() on the invoice
 * @returns {Promise<Object>} reconciled invoice document
 */
async function reconcileInvoiceBalances(invoiceDoc, options = {}) {
  const PaymentTransaction = mongoose.model('PaymentTransaction');
  const FeeAdjustment = mongoose.model('FeeAdjustment');

  // Sum verified payments
  const verifiedPayments = await PaymentTransaction.aggregate([
    {
      $match: {
        invoice: invoiceDoc._id,
        status: 'verified',
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$amountInPaise' },
      },
    },
  ]);
  const rawPaidInPaise = verifiedPayments.length > 0 ? verifiedPayments[0].totalPaid : 0;

  // Sum approved adjustments (concessions vs refunds)
  const approvedAdjustments = await FeeAdjustment.find({
    invoice: invoiceDoc._id,
    status: 'approved',
  });

  let totalConcessionsInPaise = 0;
  let totalRefundsInPaise = 0;

  for (const adj of approvedAdjustments) {
    if (adj.adjustmentType === 'refund') {
      totalRefundsInPaise += adj.amountInPaise || 0;
    } else {
      totalConcessionsInPaise += adj.amountInPaise || 0;
    }
  }

  // Ensure concession does not exceed gross amount
  const grossInPaise = invoiceDoc.grossAmountInPaise || 0;
  const effectiveConcessionInPaise = Math.min(grossInPaise, totalConcessionsInPaise);

  // Calculate late fee if overdue and not previously locked
  const lateFeeInPaise = invoiceDoc.lateFeeAmountInPaise || 0;

  // Net payable calculation
  const netPayableInPaise = Math.max(0, grossInPaise - effectiveConcessionInPaise + lateFeeInPaise);

  // Effective amount paid (net of refunds)
  const amountPaidInPaise = Math.max(0, rawPaidInPaise - totalRefundsInPaise);

  // Outstanding balance
  const outstandingBalanceInPaise = Math.max(0, netPayableInPaise - amountPaidInPaise);

  // Update invoice document fields
  invoiceDoc.concessionAmountInPaise = effectiveConcessionInPaise;
  invoiceDoc.netPayableInPaise = netPayableInPaise;
  invoiceDoc.amountPaidInPaise = amountPaidInPaise;
  invoiceDoc.outstandingBalanceInPaise = outstandingBalanceInPaise;

  // Recompute status unless invoice is explicitly cancelled or archived
  if (invoiceDoc.status !== 'cancelled' && invoiceDoc.status !== 'archived') {
    if (outstandingBalanceInPaise === 0 && netPayableInPaise >= 0) {
      invoiceDoc.status = 'paid';
    } else if (amountPaidInPaise > 0) {
      invoiceDoc.status = 'partially_paid';
    } else if (new Date() > new Date(invoiceDoc.dueDate)) {
      invoiceDoc.status = 'overdue';
    } else {
      invoiceDoc.status = 'issued';
    }
  }

  if (options.save) {
    await invoiceDoc.save();
  }

  return invoiceDoc;
}

/**
 * Sanitizes input string to prevent CSV / Formula Injection attacks (CWE-1236).
 * Any cell starting with =, +, -, @, \t, or \r is prefixed with a single quote.
 *
 * @param {string|number|null|undefined} cell
 * @returns {string} Safe CSV cell string
 */
function sanitizeCsvValue(cell) {
  if (cell === null || cell === undefined) return '""';
  let str = String(cell).trim();

  // Guard against spreadsheet formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes inside cell
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

module.exports = {
  toPaise,
  toRupees,
  calculateComponentsTotal,
  calculateLateFee,
  reconcileInvoiceBalances,
  sanitizeCsvValue,
};

