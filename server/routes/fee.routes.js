/**
 * server/routes/fee.routes.js
 * API routes for Fee Structures, Invoices, Payments, Concessions, and Admin Analytics.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const {
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
} = require('../controllers/fee.controller');

// All fee routes require authentication
router.use(authMiddleware);

// ── 1. Student Dedicated Endpoints ──────────────────────────────────────────
router.get('/student/overview', allowRoles('student'), getStudentFeeOverview);
router.get('/student/receipts', allowRoles('student'), getStudentReceipts);

// ── 2. Admin Analytics & Reporting ──────────────────────────────────────────
router.get('/admin/metrics', allowRoles('admin'), getAdminFinanceMetrics);
router.get('/admin/export-csv', allowRoles('admin'), exportFeeReportCSV);

// ── 3. Fee Structures ───────────────────────────────────────────────────────
router.post('/structures', allowRoles('admin'), createFeeStructure);
router.get('/structures', allowRoles('admin', 'faculty'), getFeeStructures);
router.get('/structures/:id', allowRoles('admin', 'faculty'), getFeeStructureById);
router.put('/structures/:id', allowRoles('admin'), updateFeeStructure);
router.delete('/structures/:id', allowRoles('admin'), archiveFeeStructure);

// ── 4. Invoices ─────────────────────────────────────────────────────────────
router.post('/invoices/generate-cohort', allowRoles('admin'), generateCohortInvoices);
router.get('/invoices', allowRoles('admin', 'student'), getInvoices);
router.get('/invoices/:id', allowRoles('admin', 'student'), getInvoiceById);
router.post('/invoices/:id/cancel', allowRoles('admin'), cancelInvoice);

// ── 5. Payment Transactions & Verification ─────────────────────────────────
router.post('/payments', allowRoles('student', 'admin'), recordOfflinePayment);
router.patch('/payments/:id/verify', allowRoles('admin'), verifyPaymentTransaction);
router.get('/payments', allowRoles('student', 'admin'), getTransactions);
router.get('/payments/:id/receipt', allowRoles('student', 'admin'), getTransactionReceipt);

// ── 6. Adjustments, Concessions & Refunds ────────────────────────────────────
router.post('/adjustments', allowRoles('student', 'admin'), requestConcession);
router.patch('/adjustments/:id/approve', allowRoles('admin'), approveConcession);
router.patch('/adjustments/:id/reject', allowRoles('admin'), rejectConcession);
router.post('/adjustments/refund', allowRoles('admin'), recordRefund);
router.get('/adjustments', allowRoles('student', 'admin'), getAdjustments);

module.exports = router;

