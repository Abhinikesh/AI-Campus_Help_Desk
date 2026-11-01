/**
 * server/routes/library.routes.js
 * API routes for Library Management, Catalog, Physical Copies, Issue/Return, Reservations & Fines.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  archiveBook,
  addBookCopy,
  getCopies,
  updateCopyStatus,
  issueBook,
  returnBook,
  renewLoan,
  createReservation,
  cancelReservation,
  getReservations,
  getFines,
  waiveFine,
  recordFinePayment,
  getStudentLibraryOverview,
  getAdminLibraryMetrics,
  exportLibraryReportCSV,
  getPolicy,
  updatePolicy,
} = require('../controllers/library.controller');

// All library routes require authentication
router.use(authMiddleware);

// ── 1. Student Dedicated Portal Endpoints ────────────────────────────────────
router.get('/student/overview', allowRoles('student'), getStudentLibraryOverview);

// ── 2. Admin & Librarian Metrics & Reporting ─────────────────────────────────
router.get('/admin/metrics', allowRoles('admin', 'librarian'), getAdminLibraryMetrics);
router.get('/admin/export-csv', allowRoles('admin', 'librarian'), exportLibraryReportCSV);

// ── 3. Policy Configuration ──────────────────────────────────────────────────
router.get('/policies', allowRoles('admin', 'librarian', 'student'), getPolicy);
router.patch('/policies', allowRoles('admin', 'librarian'), updatePolicy);

// ── 4. Book Catalog ──────────────────────────────────────────────────────────
router.post('/books', allowRoles('admin', 'librarian'), createBook);
router.get('/books', allowRoles('admin', 'librarian', 'student', 'faculty'), getBooks);
router.get('/books/:id', allowRoles('admin', 'librarian', 'student', 'faculty'), getBookById);
router.put('/books/:id', allowRoles('admin', 'librarian'), updateBook);
router.delete('/books/:id', allowRoles('admin', 'librarian'), archiveBook);

// ── 5. Physical Copies Inventory ─────────────────────────────────────────────
router.post('/copies', allowRoles('admin', 'librarian'), addBookCopy);
router.get('/copies', allowRoles('admin', 'librarian', 'student', 'faculty'), getCopies);
router.patch('/copies/:id/status', allowRoles('admin', 'librarian'), updateCopyStatus);

// ── 6. Circulation (Issue & Return Desk) ─────────────────────────────────────
router.post('/loans/issue', allowRoles('admin', 'librarian'), issueBook);
router.post('/loans/:id/return', allowRoles('admin', 'librarian'), returnBook);
router.post('/loans/:id/renew', allowRoles('admin', 'librarian', 'student'), renewLoan);

// ── 7. Book Reservations Queue ───────────────────────────────────────────────
router.post('/reservations', allowRoles('admin', 'librarian', 'student'), createReservation);
router.get('/reservations', allowRoles('admin', 'librarian', 'student'), getReservations);
router.patch('/reservations/:id/cancel', allowRoles('admin', 'librarian', 'student'), cancelReservation);

// ── 8. Fines & Penalty Management ────────────────────────────────────────────
router.get('/fines', allowRoles('admin', 'librarian', 'student'), getFines);
router.patch('/fines/:id/waive', allowRoles('admin', 'librarian'), waiveFine);
router.patch('/fines/:id/pay', allowRoles('admin', 'librarian'), recordFinePayment);

module.exports = router;

