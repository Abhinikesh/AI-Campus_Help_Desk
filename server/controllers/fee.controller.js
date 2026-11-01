/**
 * server/controllers/fee.controller.js
 * Comprehensive Student Fee Management, Payment Tracking & Financial Administration.
 * Enforces integer paise arithmetic, idempotent batch invoice generation,
 * multi-tier offline payment verification, audit logging, formula injection prevention, and anti-IDOR.
 */
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const FeeAdjustment = require('../models/FeeAdjustment');
const Student = require('../models/Student');
const User = require('../models/User');
const feeCalcService = require('../services/feeCalculation.service');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Resolves current student profile for authenticated user
 * @param {Object} req
 * @returns {Promise<Object|null>}
 */
async function resolveCurrentStudent(req) {
  const userId = req.user?.userId || req.user?._id || req.user?.id;
  if (!userId) return null;
  return await Student.findOne({ user: userId });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FEE STRUCTURES (Admin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/fees/structures
 * Create a new cohort fee structure template.
 */
const createFeeStructure = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    academicYear,
    program,
    department,
    branch,
    semester,
    components,
    lateFeePolicy,
    description,
  } = req.body;

  if (!name || !code || !department || !semester) {
    throw new ApiError(400, 'Name, code, department, and semester are required');
  }

  const existing = await FeeStructure.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    throw new ApiError(409, `Fee structure code '${code}' already exists`);
  }

  let formattedComponents = [];
  if (Array.isArray(components) && components.length > 0) {
    formattedComponents = components.map((c) => ({
      name: c.name?.trim(),
      amountInPaise:
        c.amountInPaise !== undefined
          ? Math.round(Number(c.amountInPaise))
          : feeCalcService.toPaise(c.amount || 0),
      isMandatory: c.isMandatory !== false,
      description: c.description || '',
    }));
  }

  const feeStructure = await FeeStructure.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    academicYear: academicYear || '2026-2027',
    program: program || 'B.Tech',
    department: department.trim(),
    branch: branch || department.trim(),
    semester: Number(semester),
    components: formattedComponents,
    lateFeePolicy: lateFeePolicy || { policyType: 'none', graceDays: 0, fixedAmountInPaise: 0, percentageRate: 0 },
    description: description || '',
    createdBy: req.user?.userId || req.user?._id,
  });

  return res.status(201).json({
    success: true,
    data: feeStructure,
    message: 'Fee structure created successfully',
  });
});

/**
 * GET /api/fees/structures
 * List fee structures with optional filters.
 */
const getFeeStructures = asyncHandler(async (req, res) => {
  const { department, academicYear, semester, status } = req.query;
  const filter = {};

  if (department && department !== 'all') filter.department = department;
  if (academicYear && academicYear !== 'all') filter.academicYear = academicYear;
  if (semester && semester !== 'all') filter.semester = Number(semester);
  if (status && status !== 'all') filter.status = status;

  const structures = await FeeStructure.find(filter)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: structures,
    count: structures.length,
    message: 'Fee structures fetched successfully',
  });
});

/**
 * GET /api/fees/structures/:id
 * Get single fee structure details.
 */
const getFeeStructureById = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findById(req.params.id).populate('createdBy', 'name email');
  if (!structure) {
    throw new ApiError(404, 'Fee structure not found');
  }

  return res.status(200).json({
    success: true,
    data: structure,
    message: 'Fee structure details fetched',
  });
});

/**
 * PUT /api/fees/structures/:id
 * Update an existing fee structure.
 */
const updateFeeStructure = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findById(req.params.id);
  if (!structure) {
    throw new ApiError(404, 'Fee structure not found');
  }

  const { name, components, lateFeePolicy, status, description } = req.body;

  if (name) structure.name = name.trim();
  if (description !== undefined) structure.description = description;
  if (status) structure.status = status;

  if (Array.isArray(components)) {
    structure.components = components.map((c) => ({
      name: c.name?.trim(),
      amountInPaise:
        c.amountInPaise !== undefined
          ? Math.round(Number(c.amountInPaise))
          : feeCalcService.toPaise(c.amount || 0),
      isMandatory: c.isMandatory !== false,
      description: c.description || '',
    }));
  }

  if (lateFeePolicy) {
    structure.lateFeePolicy = {
      policyType: lateFeePolicy.policyType || structure.lateFeePolicy.policyType,
      graceDays: Number(lateFeePolicy.graceDays ?? structure.lateFeePolicy.graceDays),
      fixedAmountInPaise:
        lateFeePolicy.fixedAmountInPaise !== undefined
          ? Math.round(Number(lateFeePolicy.fixedAmountInPaise))
          : lateFeePolicy.fixedAmount !== undefined
          ? feeCalcService.toPaise(lateFeePolicy.fixedAmount)
          : structure.lateFeePolicy.fixedAmountInPaise,
      percentageRate: Number(lateFeePolicy.percentageRate ?? structure.lateFeePolicy.percentageRate),
    };
  }

  await structure.save();

  return res.status(200).json({
    success: true,
    data: structure,
    message: 'Fee structure updated successfully',
  });
});

/**
 * DELETE /api/fees/structures/:id
 * Archive a fee structure.
 */
const archiveFeeStructure = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findById(req.params.id);
  if (!structure) {
    throw new ApiError(404, 'Fee structure not found');
  }

  structure.status = 'archived';
  await structure.save();

  return res.status(200).json({
    success: true,
    data: structure,
    message: 'Fee structure archived successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INVOICE GENERATION & MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/fees/invoices/generate-cohort
 * Generates fee invoices for an entire student cohort with idempotency and duplicate prevention.
 */
const generateCohortInvoices = asyncHandler(async (req, res) => {
  const { feeStructureId, academicYear, department, semester, section, dueDate } = req.body;

  if (!feeStructureId || !dueDate) {
    throw new ApiError(400, 'Fee structure ID and due date are required');
  }

  const structure = await FeeStructure.findById(feeStructureId);
  if (!structure) {
    throw new ApiError(404, 'Fee structure not found');
  }
  if (structure.status === 'archived') {
    throw new ApiError(400, 'Cannot issue invoices against an archived fee structure');
  }

  const targetDept = department || structure.department;
  const targetYear = academicYear || structure.academicYear;
  const targetSem = semester !== undefined ? Number(semester) : structure.semester;

  const studentQuery = {
    $and: [
      {
        $or: [
          { branch: targetDept },
          { department: targetDept },
          { branch: new RegExp(`^${targetDept}$`, 'i') },
        ],
      },
      {
        $or: [
          { semester: targetSem },
          { currentSemester: targetSem },
        ],
      },
    ],
  };
  if (section && section !== 'all') {
    studentQuery.$and.push({ section });
  }

  const eligibleStudents = await Student.find(studentQuery).populate('user', 'name email');
  if (eligibleStudents.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        totalEligible: 0,
        generatedCount: 0,
        skippedCount: 0,
        invoices: [],
      },
      message: 'No eligible students found for this cohort',
    });
  }

  const grossInPaise = feeCalcService.calculateComponentsTotal(structure.components);
  const invoiceComponents = structure.components.map((c) => ({
    name: c.name,
    amountInPaise: c.amountInPaise,
    isMandatory: c.isMandatory,
  }));

  const createdInvoices = [];
  let skippedCount = 0;

  for (const student of eligibleStudents) {
    // Check duplicate by compound unique constraint
    const existing = await FeeInvoice.findOne({
      student: student._id,
      feeStructure: structure._id,
      academicYear: targetYear,
      semester: targetSem,
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const yearNum = targetYear.replace(/[^0-9]/g, '').slice(0, 4) || '2026';
    const deptPrefix = (targetDept || 'GEN').slice(0, 3).toUpperCase();
    const uniqueSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const invoiceNumber = `INV-${yearNum}-${deptPrefix}-${uniqueSuffix}`;

    const newInvoice = await FeeInvoice.create({
      invoiceNumber,
      student: student._id,
      feeStructure: structure._id,
      academicYear: targetYear,
      department: targetDept,
      semester: targetSem,
      section: student.section || 'A',
      components: invoiceComponents,
      grossAmountInPaise: grossInPaise,
      concessionAmountInPaise: 0,
      lateFeeAmountInPaise: 0,
      netPayableInPaise: grossInPaise,
      amountPaidInPaise: 0,
      outstandingBalanceInPaise: grossInPaise,
      dueDate: new Date(dueDate),
      status: 'issued',
      issuedBy: req.user?.userId || req.user?._id,
      notes: `Batch issued from template: ${structure.name}`,
    });

    createdInvoices.push(newInvoice);

    // Send in-app notification to student
    if (student.user?._id || student.user) {
      const recipientId = student.user._id || student.user;
      try {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'Fee Invoice Issued',
          message: `Invoice ${invoiceNumber} for ₹${newInvoice.netPayable} (${targetDept} Sem ${targetSem}) is issued. Due: ${new Date(dueDate).toLocaleDateString()}.`,
          category: 'fee',
          priority: 'normal',
          relatedEntityType: 'fee_invoice',
          relatedEntityId: newInvoice._id,
          targetRoute: '/student/fees',
          actorName: 'Campus Finance Office',
          actorRole: 'admin',
          eventId: `fee_inv_issued_${newInvoice._id}`,
        });
      } catch (notifErr) {
        console.warn('⚠️ Notification creation skipped:', notifErr.message);
      }
    }
  }

  return res.status(201).json({
    success: true,
    data: {
      totalEligible: eligibleStudents.length,
      generatedCount: createdInvoices.length,
      skippedCount,
      invoices: createdInvoices,
    },
    message: `Generated ${createdInvoices.length} invoices (${skippedCount} skipped as already existing)`,
  });
});

/**
 * GET /api/fees/invoices
 * Query invoices with role-based scoping (students see only their own).
 */
const getInvoices = asyncHandler(async (req, res) => {
  const { department, semester, academicYear, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    // Admin filtering
    if (department && department !== 'all') filter.department = department;
    if (semester && semester !== 'all') filter.semester = Number(semester);
    if (academicYear && academicYear !== 'all') filter.academicYear = academicYear;
    if (status && status !== 'all') filter.status = status;
  }

  if (search) {
    filter.$or = [
      { invoiceNumber: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await FeeInvoice.countDocuments(filter);
  const invoices = await FeeInvoice.find(filter)
    .populate('student', 'rollNumber user department currentSemester')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('feeStructure', 'name code lateFeePolicy')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: invoices,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Invoices fetched successfully',
  });
});

/**
 * GET /api/fees/invoices/:id
 * Retrieve single invoice with full ledger history (adjustments, payments).
 */
const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoice.findById(req.params.id)
    .populate('student')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('feeStructure');

  if (!invoice) {
    throw new ApiError(404, 'Fee invoice not found');
  }

  // IDOR security check
  if (req.user?.role === 'student') {
    const currentStudent = await resolveCurrentStudent(req);
    if (!currentStudent || String(invoice.student?._id) !== String(currentStudent._id)) {
      throw new ApiError(403, 'Forbidden: You do not have permission to view this invoice');
    }
  }

  // Dynamically calculate late fee if overdue and not previously locked
  if (invoice.feeStructure && invoice.status !== 'paid' && invoice.status !== 'cancelled') {
    const computedLateFee = feeCalcService.calculateLateFee(invoice, invoice.feeStructure);
    if (computedLateFee !== invoice.lateFeeAmountInPaise) {
      invoice.lateFeeAmountInPaise = computedLateFee;
      await feeCalcService.reconcileInvoiceBalances(invoice, { save: true });
    }
  }

  const transactions = await PaymentTransaction.find({ invoice: invoice._id }).sort({ createdAt: -1 });
  const adjustments = await FeeAdjustment.find({ invoice: invoice._id }).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: {
      invoice,
      transactions,
      adjustments,
    },
    message: 'Invoice details fetched successfully',
  });
});

/**
 * POST /api/fees/invoices/:id/cancel
 * Cancel an invoice (Admin only).
 */
const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoice.findById(req.params.id);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (invoice.amountPaidInPaise > 0) {
    throw new ApiError(400, 'Cannot cancel an invoice with verified payments recorded. Refund or adjust first.');
  }

  invoice.status = 'cancelled';
  await invoice.save();

  return res.status(200).json({
    success: true,
    data: invoice,
    message: 'Invoice cancelled successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAYMENT TRANSACTIONS & OFFLINE VERIFICATION WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/fees/payments
 * Record an offline payment reference (UTR, Cheque, DD, Cash, Bank Transfer).
 * Note: Starts in 'pending' status unless an Admin records it as immediately verified.
 * A pending payment does NOT reduce the invoice balance.
 */
const recordOfflinePayment = asyncHandler(async (req, res) => {
  const {
    invoiceId,
    amountInPaise,
    amount,
    paymentMethod,
    externalReference,
    paymentDate,
    notes,
    idempotencyKey,
    verifiedImmediately,
  } = req.body;

  if (!invoiceId || !paymentMethod) {
    throw new ApiError(400, 'Invoice ID and payment method are required');
  }

  const invoice = await FeeInvoice.findById(invoiceId).populate('student');
  if (!invoice) {
    throw new ApiError(404, 'Fee invoice not found');
  }

  if (invoice.status === 'cancelled') {
    throw new ApiError(400, 'Cannot make a payment on a cancelled invoice');
  }
  if (invoice.status === 'paid' || invoice.outstandingBalanceInPaise <= 0) {
    throw new ApiError(400, 'This invoice has already been fully paid');
  }

  // IDOR Check
  if (req.user?.role === 'student') {
    const currentStudent = await resolveCurrentStudent(req);
    if (!currentStudent || String(invoice.student?._id) !== String(currentStudent._id)) {
      throw new ApiError(403, 'Forbidden: You cannot submit payments for another student invoice');
    }
  }

  // Idempotency check if key provided
  if (idempotencyKey && idempotencyKey.trim()) {
    const existingTxn = await PaymentTransaction.findOne({ idempotencyKey: idempotencyKey.trim() });
    if (existingTxn) {
      return res.status(200).json({
        success: true,
        data: existingTxn,
        message: 'Payment already recorded (idempotent replay)',
      });
    }
  }

  const rawAmountInPaise =
    amountInPaise !== undefined ? Math.round(Number(amountInPaise)) : feeCalcService.toPaise(amount);

  if (isNaN(rawAmountInPaise) || rawAmountInPaise <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero');
  }

  // Overpayment prevention invariant
  if (rawAmountInPaise > invoice.outstandingBalanceInPaise) {
    throw new ApiError(
      400,
      `Payment amount (₹${rawAmountInPaise / 100}) cannot exceed outstanding balance (₹${invoice.outstandingBalanceInPaise / 100})`
    );
  }

  const isVerifiedImmediately =
    req.user?.role === 'admin' && (verifiedImmediately === true || paymentMethod === 'cash');

  const txnTimestamp = Date.now();
  const hexSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const transactionId = `TXN-${txnTimestamp}-${hexSuffix}`;
  const receiptNumber = `RCP-${txnTimestamp}-${hexSuffix}`;

  const transaction = await PaymentTransaction.create({
    transactionId,
    receiptNumber,
    invoice: invoice._id,
    student: invoice.student._id,
    amountInPaise: rawAmountInPaise,
    paymentMethod,
    paymentType: 'offline_verified',
    externalReference: (externalReference || '').trim(),
    status: isVerifiedImmediately ? 'verified' : 'pending',
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    recordedBy: req.user?.userId || req.user?._id,
    verifiedBy: isVerifiedImmediately ? req.user?.userId || req.user?._id : null,
    verifiedAt: isVerifiedImmediately ? new Date() : null,
    notes: (notes || '').trim(),
    idempotencyKey: (idempotencyKey || '').trim() || null,
  });

  // If verified immediately by admin, update invoice balance
  if (isVerifiedImmediately) {
    await feeCalcService.reconcileInvoiceBalances(invoice, { save: true });
  }

  return res.status(201).json({
    success: true,
    data: transaction,
    message: isVerifiedImmediately
      ? 'Payment recorded and verified immediately'
      : 'Offline payment reference submitted. Balance will update once verified by Finance Administration.',
  });
});

/**
 * PATCH /api/fees/payments/:id/verify
 * Administrator verification or rejection of an offline payment reference.
 */
const verifyPaymentTransaction = asyncHandler(async (req, res) => {
  const { action, rejectionReason } = req.body;
  if (!['verify', 'reject'].includes(action)) {
    throw new ApiError(400, "Action must be either 'verify' or 'reject'");
  }

  const transaction = await PaymentTransaction.findById(req.params.id)
    .populate('invoice')
    .populate('student');

  if (!transaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  if (transaction.status !== 'pending') {
    throw new ApiError(400, `Cannot ${action} a transaction that is already '${transaction.status}'`);
  }

  const adminUserId = req.user?.userId || req.user?._id;
  const invoice = await FeeInvoice.findById(transaction.invoice._id || transaction.invoice);
  const student = await Student.findById(transaction.student._id || transaction.student).populate('user');

  if (action === 'verify') {
    // Re-verify that invoice won't be overpaid
    if (transaction.amountInPaise > invoice.outstandingBalanceInPaise) {
      throw new ApiError(
        400,
        `Cannot verify: payment of ₹${transaction.amountInRupees} exceeds current invoice balance ₹${invoice.outstandingBalance}`
      );
    }

    transaction.status = 'verified';
    transaction.verifiedBy = adminUserId;
    transaction.verifiedAt = new Date();
    await transaction.save();

    // Reconcile and save invoice
    await feeCalcService.reconcileInvoiceBalances(invoice, { save: true });

    // Notify student of successful verification
    if (student?.user?._id || student?.user) {
      const recipientId = student.user._id || student.user;
      try {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'Fee Payment Verified',
          message: `Your payment of ₹${transaction.amountInRupees} (Receipt: ${transaction.receiptNumber}) has been verified. Remaining balance: ₹${invoice.outstandingBalance}.`,
          category: 'fee',
          priority: 'normal',
          relatedEntityType: 'fee_payment',
          relatedEntityId: transaction._id,
          targetRoute: '/student/fees',
          actorName: 'Finance Office',
          actorRole: 'admin',
          eventId: `fee_pay_verified_${transaction._id}`,
        });
      } catch (err) {
        console.warn('⚠️ Notification error:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        invoice,
      },
      message: 'Payment verified successfully and invoice balance updated',
    });
  } else {
    // Reject
    transaction.status = 'failed';
    transaction.rejectionReason = (rejectionReason || 'Rejected by finance administrator').trim();
    transaction.verifiedBy = adminUserId;
    transaction.verifiedAt = new Date();
    await transaction.save();

    // Notify student of rejection
    if (student?.user?._id || student?.user) {
      const recipientId = student.user._id || student.user;
      try {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'Fee Payment Reference Rejected',
          message: `Your payment submission ${transaction.transactionId} was rejected. Reason: ${transaction.rejectionReason}`,
          category: 'fee',
          priority: 'high',
          relatedEntityType: 'fee_payment',
          relatedEntityId: transaction._id,
          targetRoute: '/student/fees',
          actorName: 'Finance Office',
          actorRole: 'admin',
          eventId: `fee_pay_rejected_${transaction._id}`,
        });
      } catch (err) {
        console.warn('⚠️ Notification error:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: transaction,
      message: 'Payment reference rejected',
    });
  }
});

/**
 * GET /api/fees/payments
 * List payment transactions with filtering and role scoping.
 */
const getTransactions = asyncHandler(async (req, res) => {
  const { status, paymentMethod, invoiceId, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (invoiceId) filter.invoice = invoiceId;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await PaymentTransaction.countDocuments(filter);
  const transactions = await PaymentTransaction.find(filter)
    .populate('invoice', 'invoiceNumber grossAmountInPaise netPayableInPaise outstandingBalanceInPaise')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('verifiedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: transactions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Transactions fetched successfully',
  });
});

/**
 * GET /api/fees/payments/:id/receipt
 * Retrieve formatted receipt for printing or display.
 */
const getTransactionReceipt = asyncHandler(async (req, res) => {
  const transaction = await PaymentTransaction.findById(req.params.id)
    .populate({
      path: 'invoice',
      populate: { path: 'feeStructure', select: 'name code' },
    })
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('verifiedBy', 'name email');

  if (!transaction) {
    throw new ApiError(404, 'Payment transaction not found');
  }

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student || String(transaction.student?._id) !== String(student._id)) {
      throw new ApiError(403, 'Forbidden: You cannot view receipts belonging to another student');
    }
  }

  return res.status(200).json({
    success: true,
    data: transaction,
    message: 'Receipt loaded successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONCESSIONS, WAIVERS & REFUNDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/fees/adjustments
 * Request or register a fee concession / scholarship.
 */
const requestConcession = asyncHandler(async (req, res) => {
  const { invoiceId, adjustmentType, amountInPaise, amount, reason, supportingDocReference } = req.body;

  if (!invoiceId || !adjustmentType || !reason) {
    throw new ApiError(400, 'Invoice ID, adjustment type, and reason are required');
  }

  const invoice = await FeeInvoice.findById(invoiceId).populate('student');
  if (!invoice) {
    throw new ApiError(404, 'Fee invoice not found');
  }

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student || String(invoice.student?._id) !== String(student._id)) {
      throw new ApiError(403, 'Forbidden: You cannot apply for a concession on another student invoice');
    }
  }

  const valInPaise =
    amountInPaise !== undefined ? Math.round(Number(amountInPaise)) : feeCalcService.toPaise(amount);

  if (isNaN(valInPaise) || valInPaise <= 0) {
    throw new ApiError(400, 'Adjustment amount must be positive');
  }

  if (valInPaise > invoice.grossAmountInPaise) {
    throw new ApiError(400, 'Concession cannot exceed total gross invoice amount');
  }

  const adjNumber = `ADJ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const adjustment = await FeeAdjustment.create({
    adjustmentNumber: adjNumber,
    student: invoice.student._id,
    invoice: invoice._id,
    adjustmentType,
    amountInPaise: valInPaise,
    reason: reason.trim(),
    supportingDocReference: (supportingDocReference || '').trim(),
    status: 'pending',
    requestedBy: req.user?.userId || req.user?._id,
  });

  return res.status(201).json({
    success: true,
    data: adjustment,
    message: 'Fee adjustment request submitted for administrative review',
  });
});

/**
 * PATCH /api/fees/adjustments/:id/approve
 * Admin approves concession/scholarship and updates invoice balances.
 */
const approveConcession = asyncHandler(async (req, res) => {
  const adjustment = await FeeAdjustment.findById(req.params.id)
    .populate('invoice')
    .populate('student');

  if (!adjustment) {
    throw new ApiError(404, 'Fee adjustment request not found');
  }

  if (adjustment.status !== 'pending') {
    throw new ApiError(400, `Cannot approve adjustment with status '${adjustment.status}'`);
  }

  const adminUserId = req.user?.userId || req.user?._id;
  adjustment.status = 'approved';
  adjustment.approvedBy = adminUserId;
  adjustment.approvedAt = new Date();
  await adjustment.save();

  const invoice = await FeeInvoice.findById(adjustment.invoice._id || adjustment.invoice);
  await feeCalcService.reconcileInvoiceBalances(invoice, { save: true });

  const student = await Student.findById(adjustment.student._id || adjustment.student).populate('user');
  if (student?.user?._id || student?.user) {
    const recipientId = student.user._id || student.user;
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Fee Concession Approved',
        message: `Your fee adjustment of ₹${adjustment.amountInRupees} has been approved. New net balance: ₹${invoice.outstandingBalance}.`,
        category: 'fee',
        priority: 'normal',
        relatedEntityType: 'fee_adjustment',
        relatedEntityId: adjustment._id,
        targetRoute: '/student/fees',
        actorName: 'Finance Office',
        actorRole: 'admin',
        eventId: `fee_adj_approved_${adjustment._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Notification error:', err.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      adjustment,
      invoice,
    },
    message: 'Fee adjustment approved and invoice updated successfully',
  });
});

/**
 * PATCH /api/fees/adjustments/:id/reject
 * Admin rejects concession request.
 */
const rejectConcession = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;
  const adjustment = await FeeAdjustment.findById(req.params.id).populate('student');

  if (!adjustment) {
    throw new ApiError(404, 'Fee adjustment request not found');
  }

  if (adjustment.status !== 'pending') {
    throw new ApiError(400, `Cannot reject adjustment with status '${adjustment.status}'`);
  }

  const adminUserId = req.user?.userId || req.user?._id;
  adjustment.status = 'rejected';
  adjustment.rejectionReason = (rejectionReason || 'Rejected by finance administration').trim();
  adjustment.approvedBy = adminUserId;
  await adjustment.save();

  const student = await Student.findById(adjustment.student._id || adjustment.student).populate('user');
  if (student?.user?._id || student?.user) {
    const recipientId = student.user._id || student.user;
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Fee Concession Rejected',
        message: `Your fee adjustment request ${adjustment.adjustmentNumber} was rejected. Reason: ${adjustment.rejectionReason}`,
        category: 'fee',
        priority: 'normal',
        relatedEntityType: 'fee_adjustment',
        relatedEntityId: adjustment._id,
        targetRoute: '/student/fees',
        actorName: 'Finance Office',
        actorRole: 'admin',
        eventId: `fee_adj_rejected_${adjustment._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Notification error:', err.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: adjustment,
    message: 'Fee adjustment request rejected',
  });
});

/**
 * POST /api/fees/adjustments/refund
 * Admin records an official fee refund.
 */
const recordRefund = asyncHandler(async (req, res) => {
  const { invoiceId, amountInPaise, amount, reason, supportingDocReference } = req.body;

  if (!invoiceId || !reason) {
    throw new ApiError(400, 'Invoice ID and reason are required for processing a refund');
  }

  const invoice = await FeeInvoice.findById(invoiceId).populate('student');
  if (!invoice) {
    throw new ApiError(404, 'Fee invoice not found');
  }

  const refundPaise =
    amountInPaise !== undefined ? Math.round(Number(amountInPaise)) : feeCalcService.toPaise(amount);

  if (isNaN(refundPaise) || refundPaise <= 0) {
    throw new ApiError(400, 'Refund amount must be greater than zero');
  }

  if (refundPaise > invoice.amountPaidInPaise) {
    throw new ApiError(
      400,
      `Refund amount (₹${refundPaise / 100}) cannot exceed total verified payments (₹${invoice.amountPaidInPaise / 100})`
    );
  }

  const adjNumber = `RFD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const adminUserId = req.user?.userId || req.user?._id;

  const refundAdj = await FeeAdjustment.create({
    adjustmentNumber: adjNumber,
    student: invoice.student._id,
    invoice: invoice._id,
    adjustmentType: 'refund',
    amountInPaise: refundPaise,
    reason: reason.trim(),
    supportingDocReference: (supportingDocReference || '').trim(),
    status: 'approved',
    requestedBy: adminUserId,
    approvedBy: adminUserId,
    approvedAt: new Date(),
  });

  await feeCalcService.reconcileInvoiceBalances(invoice, { save: true });

  const student = await Student.findById(invoice.student._id).populate('user');
  if (student?.user?._id || student?.user) {
    const recipientId = student.user._id || student.user;
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Fee Refund Processed',
        message: `A fee refund of ₹${refundAdj.amountInRupees} has been processed for invoice ${invoice.invoiceNumber}.`,
        category: 'fee',
        priority: 'high',
        relatedEntityType: 'fee_adjustment',
        relatedEntityId: refundAdj._id,
        targetRoute: '/student/fees',
        actorName: 'Finance Office',
        actorRole: 'admin',
        eventId: `fee_rfd_processed_${refundAdj._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Notification error:', err.message);
    }
  }

  return res.status(201).json({
    success: true,
    data: {
      refund: refundAdj,
      invoice,
    },
    message: 'Fee refund processed successfully and invoice balance adjusted',
  });
});

/**
 * GET /api/fees/adjustments
 * List adjustments with role scoping.
 */
const getAdjustments = asyncHandler(async (req, res) => {
  const { invoiceId, status, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (invoiceId) filter.invoice = invoiceId;
    if (status && status !== 'all') filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await FeeAdjustment.countDocuments(filter);
  const adjustments = await FeeAdjustment.find(filter)
    .populate('invoice', 'invoiceNumber')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: adjustments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Adjustments fetched successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. STUDENT PORTAL DEDICATED ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/fees/student/overview
 * Complete financial summary for the logged-in student.
 */
const getStudentFeeOverview = asyncHandler(async (req, res) => {
  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const invoices = await FeeInvoice.find({ student: student._id })
    .populate('feeStructure', 'name code lateFeePolicy')
    .sort({ dueDate: 1 });

  let totalBilledInPaise = 0;
  let totalPaidInPaise = 0;
  let totalOutstandingInPaise = 0;
  let overdueInvoicesCount = 0;

  for (const inv of invoices) {
    // Dynamically calculate late fee if overdue
    if (inv.feeStructure && inv.status !== 'paid' && inv.status !== 'cancelled') {
      const lateFee = feeCalcService.calculateLateFee(inv, inv.feeStructure);
      if (lateFee !== inv.lateFeeAmountInPaise) {
        inv.lateFeeAmountInPaise = lateFee;
        await feeCalcService.reconcileInvoiceBalances(inv, { save: true });
      }
    }

    if (inv.status !== 'cancelled') {
      totalBilledInPaise += inv.netPayableInPaise || 0;
      totalPaidInPaise += inv.amountPaidInPaise || 0;
      totalOutstandingInPaise += inv.outstandingBalanceInPaise || 0;
      if (inv.status === 'overdue') overdueInvoicesCount++;
    }
  }

  const pendingPaymentsCount = await PaymentTransaction.countDocuments({
    student: student._id,
    status: 'pending',
  });

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalBilledInPaise,
        totalPaidInPaise,
        totalOutstandingInPaise,
        totalBilledInRupees: totalBilledInPaise / 100,
        totalPaidInRupees: totalPaidInPaise / 100,
        totalOutstandingInRupees: totalOutstandingInPaise / 100,
        overdueInvoicesCount,
        pendingPaymentsCount,
      },
      invoices,
    },
    message: 'Student financial overview loaded successfully',
  });
});

/**
 * GET /api/fees/student/receipts
 * Verified payment receipts for the logged-in student.
 */
const getStudentReceipts = asyncHandler(async (req, res) => {
  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const receipts = await PaymentTransaction.find({
    student: student._id,
    status: 'verified',
  })
    .populate('invoice', 'invoiceNumber academicYear semester department')
    .sort({ paymentDate: -1 });

  return res.status(200).json({
    success: true,
    data: receipts,
    count: receipts.length,
    message: 'Student verified receipts fetched successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADMIN ANALYTICS & CSV AUDIT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/fees/admin/metrics
 * Comprehensive real financial statistics across cohorts and departments.
 */
const getAdminFinanceMetrics = asyncHandler(async (req, res) => {
  const [invoiceAgg] = await FeeInvoice.aggregate([
    {
      $match: { status: { $ne: 'cancelled' } },
    },
    {
      $group: {
        _id: null,
        totalGrossInPaise: { $sum: '$grossAmountInPaise' },
        totalConcessionsInPaise: { $sum: '$concessionAmountInPaise' },
        totalLateFeesInPaise: { $sum: '$lateFeeAmountInPaise' },
        totalNetPayableInPaise: { $sum: '$netPayableInPaise' },
        totalPaidInPaise: { $sum: '$amountPaidInPaise' },
        totalOutstandingInPaise: { $sum: '$outstandingBalanceInPaise' },
        count: { $sum: 1 },
      },
    },
  ]) || [{}];

  const statusCounts = await FeeInvoice.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalOutstanding: { $sum: '$outstandingBalanceInPaise' },
      },
    },
  ]);

  const [pendingTxnAgg] = await PaymentTransaction.aggregate([
    {
      $match: { status: 'pending' },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmountInPaise: { $sum: '$amountInPaise' },
      },
    },
  ]) || [{}];

  const deptBreakdown = await FeeInvoice.aggregate([
    {
      $match: { status: { $ne: 'cancelled' } },
    },
    {
      $group: {
        _id: '$department',
        totalNetPayable: { $sum: '$netPayableInPaise' },
        totalPaid: { $sum: '$amountPaidInPaise' },
        totalOutstanding: { $sum: '$outstandingBalanceInPaise' },
        invoicesCount: { $sum: 1 },
      },
    },
    { $sort: { totalNetPayable: -1 } },
  ]);

  return res.status(200).json({
    success: true,
    data: {
      overview: {
        totalGrossInPaise: invoiceAgg?.totalGrossInPaise || 0,
        totalConcessionsInPaise: invoiceAgg?.totalConcessionsInPaise || 0,
        totalLateFeesInPaise: invoiceAgg?.totalLateFeesInPaise || 0,
        totalNetPayableInPaise: invoiceAgg?.totalNetPayableInPaise || 0,
        totalPaidInPaise: invoiceAgg?.totalPaidInPaise || 0,
        totalOutstandingInPaise: invoiceAgg?.totalOutstandingInPaise || 0,
        totalGrossInRupees: (invoiceAgg?.totalGrossInPaise || 0) / 100,
        totalConcessionsInRupees: (invoiceAgg?.totalConcessionsInPaise || 0) / 100,
        totalLateFeesInRupees: (invoiceAgg?.totalLateFeesInPaise || 0) / 100,
        totalNetPayableInRupees: (invoiceAgg?.totalNetPayableInPaise || 0) / 100,
        totalPaidInRupees: (invoiceAgg?.totalPaidInPaise || 0) / 100,
        totalOutstandingInRupees: (invoiceAgg?.totalOutstandingInPaise || 0) / 100,
        totalInvoicesCount: invoiceAgg?.count || 0,
        collectionRatePercent:
          invoiceAgg?.totalNetPayableInPaise > 0
            ? Math.round((invoiceAgg.totalPaidInPaise / invoiceAgg.totalNetPayableInPaise) * 100)
            : 0,
      },
      pendingApprovals: {
        count: pendingTxnAgg?.count || 0,
        totalAmountInPaise: pendingTxnAgg?.totalAmountInPaise || 0,
        totalAmountInRupees: (pendingTxnAgg?.totalAmountInPaise || 0) / 100,
      },
      statusBreakdown: statusCounts,
      departmentBreakdown: deptBreakdown.map((d) => ({
        department: d._id,
        netPayableInRupees: d.totalNetPayable / 100,
        paidInRupees: d.totalPaid / 100,
        outstandingInRupees: d.totalOutstanding / 100,
        invoicesCount: d.invoicesCount,
      })),
    },
    message: 'Admin finance metrics loaded',
  });
});

/**
 * GET /api/fees/admin/export-csv
 * Export comprehensive invoice and payment audit report to CSV.
 * Sanitizes against CSV formula injection (CWE-1236).
 */
const exportFeeReportCSV = asyncHandler(async (req, res) => {
  const { department, academicYear, semester, status } = req.query;
  const filter = {};

  if (department && department !== 'all') filter.department = department;
  if (academicYear && academicYear !== 'all') filter.academicYear = academicYear;
  if (semester && semester !== 'all') filter.semester = Number(semester);
  if (status && status !== 'all') filter.status = status;

  const invoices = await FeeInvoice.find(filter)
    .populate('student')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .sort({ createdAt: -1 });

  const headers = [
    'Invoice Number',
    'Student Name',
    'Roll Number',
    'Login ID',
    'Department',
    'Semester',
    'Academic Year',
    'Gross Amount (INR)',
    'Concession (INR)',
    'Late Fee (INR)',
    'Net Payable (INR)',
    'Amount Paid (INR)',
    'Outstanding Balance (INR)',
    'Status',
    'Due Date',
    'Created At',
  ];

  const rows = invoices.map((inv) => {
    const studentUser = inv.student?.user || {};
    return [
      feeCalcService.sanitizeCsvValue(inv.invoiceNumber),
      feeCalcService.sanitizeCsvValue(studentUser.name || 'Unknown'),
      feeCalcService.sanitizeCsvValue(inv.student?.rollNumber || ''),
      feeCalcService.sanitizeCsvValue(studentUser.loginId || ''),
      feeCalcService.sanitizeCsvValue(inv.department),
      feeCalcService.sanitizeCsvValue(inv.semester),
      feeCalcService.sanitizeCsvValue(inv.academicYear),
      feeCalcService.sanitizeCsvValue(inv.grossAmount),
      feeCalcService.sanitizeCsvValue(inv.concessionAmount),
      feeCalcService.sanitizeCsvValue(inv.lateFeeAmount),
      feeCalcService.sanitizeCsvValue(inv.netPayable),
      feeCalcService.sanitizeCsvValue(inv.amountPaid),
      feeCalcService.sanitizeCsvValue(inv.outstandingBalance),
      feeCalcService.sanitizeCsvValue(inv.status),
      feeCalcService.sanitizeCsvValue(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : ''),
      feeCalcService.sanitizeCsvValue(new Date(inv.createdAt).toISOString().slice(0, 10)),
    ].join(',');
  });

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=campussphere_fee_report_${Date.now()}.csv`);

  return res.status(200).send(csvContent);
});

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureById,
  updateFeeStructure,
  archiveFeeStructure,
  generateCohortInvoices,
  getInvoices,
  getInvoiceById,
  cancelInvoice,
  recordOfflinePayment,
  verifyPaymentTransaction,
  getTransactions,
  getTransactionReceipt,
  requestConcession,
  approveConcession,
  rejectConcession,
  recordRefund,
  getAdjustments,
  getStudentFeeOverview,
  getStudentReceipts,
  getAdminFinanceMetrics,
  exportFeeReportCSV,
};
