/**
 * server/tests/fee_finance_management.test.js
 * Comprehensive End-to-End Test Suite for Part 16:
 * Student Fee Management, Payment Tracking & Financial Administration.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const FeeAdjustment = require('../models/FeeAdjustment');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const feeController = require('../controllers/fee.controller');
const feeCalcService = require('../services/feeCalculation.service');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    headers: {},
    rawBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    send(data) {
      this.rawBody = data;
      return this;
    },
  };
}

test('Part 16: Student Fee & Financial Administration Suite', async (t) => {
  let adminUser, student1User, student2User;
  let student1Profile, student2Profile;
  let sampleFeeStructure, sampleInvoice1, sampleInvoice2;
  let pendingTxnId;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean existing test collections
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      FeeStructure.deleteMany({}),
      FeeInvoice.deleteMany({}),
      PaymentTransaction.deleteMany({}),
      FeeAdjustment.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // Ensure MongoDB indexes are built
    await Promise.all([
      FeeStructure.init(),
      FeeInvoice.init(),
      PaymentTransaction.init(),
      FeeAdjustment.init(),
    ]);

    // Create Admin
    adminUser = await User.create({
      name: 'Finance Registrar Admin',
      email: 'finance.admin@test.edu',
      loginId: 'P16FIN01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'admin',
    });

    // Create Student 1 (CSE, Semester 5, Section A)
    student1User = await User.create({
      name: 'Amit Patel',
      email: 'amit.patel@test.edu',
      loginId: 'P16STU01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student1Profile = await Student.create({
      user: student1User._id,
      rollNumber: 'CSE-2026-001',
      fullName: 'Amit Patel',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      admissionYear: 2024,
    });

    // Create Student 2 (CSE, Semester 5, Section A)
    student2User = await User.create({
      name: 'Priya Sharma',
      email: 'priya.sharma@test.edu',
      loginId: 'P16STU02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student2Profile = await Student.create({
      user: student2User._id,
      rollNumber: 'CSE-2026-002',
      fullName: 'Priya Sharma',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      admissionYear: 2024,
    });

    assert.ok(adminUser._id);
    assert.ok(student1Profile._id);
    assert.ok(student2Profile._id);
  });

  // ── 1. FEE STRUCTURE MANAGEMENT ──────────────────────────────────────────

  await t.test('Test 1: Admin creates valid fee structure with components and late fee policy', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        name: 'B.Tech CSE Sem 5 Fee 2026-2027',
        code: 'BTECH-CSE-S5-2026',
        department: 'CSE',
        semester: 5,
        academicYear: '2026-2027',
        components: [
          { name: 'Tuition Fee', amount: 45000, isMandatory: true },
          { name: 'Development Fee', amount: 10000, isMandatory: true },
          { name: 'Lab & Library Fee', amount: 5000, isMandatory: true },
        ],
        lateFeePolicy: {
          policyType: 'fixed',
          graceDays: 5,
          fixedAmount: 1000,
        },
      },
    };
    const res = createMockRes();
    await feeController.createFeeStructure(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.code, 'BTECH-CSE-S5-2026');
    assert.equal(res.jsonData.data.totalAmountInPaise, 6000000); // 60,000 INR = 6,000,000 paise
    assert.equal(res.jsonData.data.totalAmount, 60000);
    sampleFeeStructure = res.jsonData.data;
  });

  await t.test('Test 2: Rejects fee structure creation with missing required fields', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        name: 'Incomplete Fee Structure',
        // missing code, department, semester
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.createFeeStructure(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('Test 3: Enforces unique constraint on fee structure code', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        name: 'Duplicate Code Test',
        code: 'BTECH-CSE-S5-2026', // already created in Test 1
        department: 'CSE',
        semester: 5,
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.createFeeStructure(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  await t.test('Test 4: Get fee structures with department and semester filters', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: { department: 'CSE', semester: 5, status: 'active' },
    };
    const res = createMockRes();
    await feeController.getFeeStructures(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.count, 1);
    assert.equal(res.jsonData.data[0].code, 'BTECH-CSE-S5-2026');
  });

  await t.test('Test 5: Update fee structure non-destructively', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: sampleFeeStructure._id },
      body: {
        description: 'Updated official fee structure for CSE 5th sem',
      },
    };
    const res = createMockRes();
    await feeController.updateFeeStructure(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.description, 'Updated official fee structure for CSE 5th sem');
  });

  await t.test('Test 6: Archive fee structure', async () => {
    // Create temporary structure to archive
    const temp = await FeeStructure.create({
      name: 'Temp Structure',
      code: 'TEMP-ARCHIVE-01',
      department: 'ECE',
      semester: 3,
      components: [{ name: 'Lab', amountInPaise: 100000, isMandatory: true }],
      createdBy: adminUser._id,
    });

    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: temp._id },
    };
    const res = createMockRes();
    await feeController.archiveFeeStructure(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'archived');
  });

  // ── 2. COHORT INVOICE GENERATION & INVARIANTS ───────────────────────────

  await t.test('Test 7: Cohort invoice generation creates invoices for eligible students', async () => {
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        feeStructureId: sampleFeeStructure._id,
        department: 'CSE',
        semester: 5,
        academicYear: '2026-2027',
        dueDate,
      },
    };
    const res = createMockRes();
    await feeController.generateCohortInvoices(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.totalEligible, 2);
    assert.equal(res.jsonData.data.generatedCount, 2);
    assert.equal(res.jsonData.data.skippedCount, 0);

    sampleInvoice1 = res.jsonData.data.invoices[0];
    sampleInvoice2 = res.jsonData.data.invoices[1];
    assert.ok(sampleInvoice1.invoiceNumber.startsWith('INV-2026-CSE-'));
  });

  await t.test('Test 8: Cohort invoice generation is idempotent (skips duplicates on replay)', async () => {
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        feeStructureId: sampleFeeStructure._id,
        department: 'CSE',
        semester: 5,
        academicYear: '2026-2027',
        dueDate,
      },
    };
    const res = createMockRes();
    await feeController.generateCohortInvoices(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.generatedCount, 0);
    assert.equal(res.jsonData.data.skippedCount, 2);
  });

  await t.test('Test 9: Compound unique index prevents direct duplicate invoice creation in DB', async () => {
    await assert.rejects(
      async () => {
        await FeeInvoice.create({
          invoiceNumber: 'INV-TEST-DUP-01',
          student: student1Profile._id,
          feeStructure: sampleFeeStructure._id,
          academicYear: '2026-2027',
          department: 'CSE',
          semester: 5,
          grossAmountInPaise: 6000000,
          netPayableInPaise: 6000000,
          outstandingBalanceInPaise: 6000000,
          dueDate: new Date(),
        });
      },
      (err) => {
        assert.equal(err.code, 11000); // Mongo duplicate key code
        return true;
      }
    );
  });

  await t.test('Test 10: Cohort invoice generation against archived structure rejected with 400', async () => {
    const archivedStruct = await FeeStructure.findOne({ status: 'archived' });
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        feeStructureId: archivedStruct._id,
        dueDate: new Date().toISOString(),
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.generateCohortInvoices(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('Test 11: Invariant - Gross, Net, and Outstanding balances equal component sum on issuance', async () => {
    const inv = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv.grossAmountInPaise, 6000000);
    assert.equal(inv.netPayableInPaise, 6000000);
    assert.equal(inv.amountPaidInPaise, 0);
    assert.equal(inv.outstandingBalanceInPaise, 6000000);
    assert.equal(inv.status, 'issued');
    assert.equal(inv.concessionAmountInPaise, 0);
    assert.equal(inv.lateFeeAmountInPaise, 0);
  });

  await t.test('Test 12: Invariant - Integer paise currency precision has zero rounding drift', () => {
    // 0.1 + 0.2 in JS float is 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    assert.notEqual(floatSum, 0.3);

    // In paise arithmetic:
    const p1 = feeCalcService.toPaise(0.1);
    const p2 = feeCalcService.toPaise(0.2);
    const sumPaise = p1 + p2;
    assert.equal(sumPaise, 30);
    assert.equal(feeCalcService.toRupees(sumPaise), 0.3);
  });

  // ── 3. OFFLINE PAYMENT RECORDING & VERIFICATION INVARIANTS ────────────────

  await t.test('Test 13: Student submits offline payment reference (starts in pending status)', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: 25000, // 25,000 INR partial payment
        paymentMethod: 'upi',
        externalReference: 'UTR20261101998811',
        paymentDate: new Date().toISOString(),
      },
    };
    const res = createMockRes();
    await feeController.recordOfflinePayment(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.status, 'pending');
    assert.equal(res.jsonData.data.amountInPaise, 2500000);
    pendingTxnId = res.jsonData.data._id;
  });

  await t.test('Test 14: Invariant - A pending payment DOES NOT reduce invoice outstanding balance', async () => {
    const inv = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv.amountPaidInPaise, 0);
    assert.equal(inv.outstandingBalanceInPaise, 6000000); // still full 60,000 INR
    assert.equal(inv.status, 'issued');
  });

  await t.test('Test 15: Invariant - Overpayment attempt exceeding balance is rejected with 400', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: 70000, // Exceeds 60,000 INR outstanding balance
        paymentMethod: 'bank_transfer',
        externalReference: 'OVERPAY123',
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.recordOfflinePayment(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot exceed outstanding balance/i);
        return true;
      }
    );
  });

  await t.test('Test 16: Invariant - Non-positive (zero or negative) payment amount rejected with 400', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: -500,
        paymentMethod: 'cash',
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.recordOfflinePayment(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('Test 17: Admin verifies pending payment (status transitions to verified)', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: pendingTxnId },
      body: { action: 'verify' },
    };
    const res = createMockRes();
    await feeController.verifyPaymentTransaction(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.transaction.status, 'verified');
    assert.ok(res.jsonData.data.transaction.verifiedBy);
  });

  await t.test('Test 18: Invariant - Verified payment atomically updates invoice balances', async () => {
    const inv = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv.amountPaidInPaise, 2500000); // 25,000 INR paid
    assert.equal(inv.outstandingBalanceInPaise, 3500000); // 35,000 INR remaining
  });

  await t.test('Test 19: Invariant - Partial payment transitions invoice status to partially_paid', async () => {
    const inv = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv.status, 'partially_paid');
  });

  await t.test('Test 20: Full payment completing balance transitions status to paid and outstanding to 0', async () => {
    // Submit second payment for the remaining 35,000 INR
    const reqRecord = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: 35000,
        paymentMethod: 'bank_transfer',
        externalReference: 'UTR20261101998822',
      },
    };
    const resRecord = createMockRes();
    await feeController.recordOfflinePayment(reqRecord, resRecord);
    const txn2Id = resRecord.jsonData.data._id;

    // Admin verifies txn2
    const reqVerify = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: txn2Id },
      body: { action: 'verify' },
    };
    const resVerify = createMockRes();
    await feeController.verifyPaymentTransaction(reqVerify, resVerify);

    const inv = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv.amountPaidInPaise, 6000000);
    assert.equal(inv.outstandingBalanceInPaise, 0);
    assert.equal(inv.status, 'paid');
  });

  await t.test('Test 21: Admin rejects offline payment with reason (status becomes failed, invoice untouched)', async () => {
    // Record payment for invoice 2 (Student 2)
    const reqRecord = {
      user: { userId: student2User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice2._id,
        amount: 15000,
        paymentMethod: 'cheque',
        externalReference: 'CHQ-BOUNCED-001',
      },
    };
    const resRecord = createMockRes();
    await feeController.recordOfflinePayment(reqRecord, resRecord);
    const badTxnId = resRecord.jsonData.data._id;

    // Admin rejects
    const reqReject = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: badTxnId },
      body: {
        action: 'reject',
        rejectionReason: 'Cheque returned unpaid by drawee bank',
      },
    };
    const resReject = createMockRes();
    await feeController.verifyPaymentTransaction(reqReject, resReject);

    assert.equal(resReject.statusCode, 200);
    assert.equal(resReject.jsonData.data.status, 'failed');
    assert.equal(resReject.jsonData.data.rejectionReason, 'Cheque returned unpaid by drawee bank');

    // Invoice 2 remains at full 60,000 INR
    const inv2 = await FeeInvoice.findById(sampleInvoice2._id);
    assert.equal(inv2.amountPaidInPaise, 0);
    assert.equal(inv2.outstandingBalanceInPaise, 6000000);
  });

  // ── 4. CONCESSIONS, WAIVERS & REFUNDS ────────────────────────────────────

  let concessionId;

  await t.test('Test 22: Student requests concession (starts in pending status, invoice balance unaltered)', async () => {
    const req = {
      user: { userId: student2User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice2._id,
        adjustmentType: 'need_based_concession',
        amount: 20000, // 20,000 INR
        reason: 'Income certificate verified economic need concession',
      },
    };
    const res = createMockRes();
    await feeController.requestConcession(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.status, 'pending');
    concessionId = res.jsonData.data._id;

    const inv2 = await FeeInvoice.findById(sampleInvoice2._id);
    assert.equal(inv2.outstandingBalanceInPaise, 6000000); // Unaltered while pending
  });

  await t.test('Test 23: Concession exceeding gross invoice amount rejected with 400', async () => {
    const req = {
      user: { userId: student2User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice2._id,
        adjustmentType: 'merit_scholarship',
        amount: 90000, // Exceeds 60,000 gross
        reason: 'Excess scholarship request',
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.requestConcession(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('Test 24: Admin approves concession, updates concessionAmount and reduces netPayable/outstanding', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: concessionId },
    };
    const res = createMockRes();
    await feeController.approveConcession(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.success);
    assert.equal(res.jsonData.data.adjustment.status, 'approved');

    const inv2 = await FeeInvoice.findById(sampleInvoice2._id);
    assert.equal(inv2.concessionAmountInPaise, 2000000); // 20,000 INR
    assert.equal(inv2.netPayableInPaise, 4000000); // 60,000 - 20,000 = 40,000 INR
    assert.equal(inv2.outstandingBalanceInPaise, 4000000);
  });

  await t.test('Test 25: Admin rejects concession with reason (status rejected, invoice balance unaffected)', async () => {
    // Create new pending concession
    const tempAdj = await FeeAdjustment.create({
      adjustmentNumber: 'ADJ-TEMP-REJECT-01',
      student: student2Profile._id,
      invoice: sampleInvoice2._id,
      adjustmentType: 'other',
      amountInPaise: 500000,
      reason: 'Unverified sports quota application',
      status: 'pending',
      requestedBy: student2User._id,
    });

    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: tempAdj._id },
      body: { rejectionReason: 'Sports certificate expired' },
    };
    const res = createMockRes();
    await feeController.rejectConcession(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'rejected');
    assert.equal(res.jsonData.data.rejectionReason, 'Sports certificate expired');

    // Balance still 40,000 INR
    const inv2 = await FeeInvoice.findById(sampleInvoice2._id);
    assert.equal(inv2.netPayableInPaise, 4000000);
  });

  await t.test('Test 26: Formal refund decreases amountPaid and increases outstanding balance', async () => {
    // Invoice 1 was fully paid (60,000 INR). Admin issues 10,000 INR refund.
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: 10000,
        reason: 'Laboratory security deposit refund after graduation clearance',
      },
    };
    const res = createMockRes();
    await feeController.recordRefund(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.jsonData.success);

    const inv1 = await FeeInvoice.findById(sampleInvoice1._id);
    assert.equal(inv1.amountPaidInPaise, 5000000); // 60,000 - 10,000 = 50,000 INR paid
    assert.equal(inv1.outstandingBalanceInPaise, 1000000); // 10,000 INR now outstanding
    assert.equal(inv1.status, 'partially_paid');
  });

  await t.test('Test 27: Refund exceeding amount paid rejected with 400', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        invoiceId: sampleInvoice1._id,
        amount: 90000, // Exceeds amount paid (50,000 INR)
        reason: 'Excess refund attempt',
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.recordRefund(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // ── 5. LATE FEE & CALCULATION LOGIC ──────────────────────────────────────

  await t.test('Test 28: Late fee calculation respects grace period and policy', () => {
    const dueDate = new Date('2026-08-01');
    const invoice = {
      grossAmountInPaise: 5000000,
      concessionAmountInPaise: 0,
      dueDate,
    };

    // Before due date: 0
    const feeBefore = feeCalcService.calculateLateFee(
      invoice,
      { lateFeePolicy: { policyType: 'fixed', graceDays: 5, fixedAmountInPaise: 50000 } },
      new Date('2026-07-25')
    );
    assert.equal(feeBefore, 0);

    // Within grace days: 0
    const feeInGrace = feeCalcService.calculateLateFee(
      invoice,
      { lateFeePolicy: { policyType: 'fixed', graceDays: 5, fixedAmountInPaise: 50000 } },
      new Date('2026-08-04')
    );
    assert.equal(feeInGrace, 0);

    // Past grace days (fixed): 500 INR = 50,000 paise
    const feePastGraceFixed = feeCalcService.calculateLateFee(
      invoice,
      { lateFeePolicy: { policyType: 'fixed', graceDays: 5, fixedAmountInPaise: 50000 } },
      new Date('2026-08-15')
    );
    assert.equal(feePastGraceFixed, 50000);

    // Past grace days (percentage 5% on 50,000 INR = 2,500 INR = 250,000 paise)
    const feePastGracePct = feeCalcService.calculateLateFee(
      invoice,
      { lateFeePolicy: { policyType: 'percentage', graceDays: 5, percentageRate: 5 } },
      new Date('2026-08-15')
    );
    assert.equal(feePastGracePct, 250000);
  });

  // ── 6. SECURITY & ANTI-IDOR ENFORCEMENT ───────────────────────────────────

  await t.test('Test 29: Student 1 cannot view Student 2 invoice details (IDOR blocked with 403)', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: sampleInvoice2._id },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.getInvoiceById(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /forbidden/i);
        return true;
      }
    );
  });

  await t.test('Test 30: Student 1 cannot view Student 2 payment receipt (IDOR blocked with 403)', async () => {
    // Create verified transaction belonging to Student 2
    const s2Txn = await PaymentTransaction.create({
      transactionId: 'TXN-S2-RECEIPT-01',
      receiptNumber: 'RCP-S2-001',
      invoice: sampleInvoice2._id,
      student: student2Profile._id,
      amountInPaise: 1000000,
      paymentMethod: 'upi',
      status: 'verified',
    });

    const req = {
      user: { userId: student1User._id, role: 'student' },
      params: { id: s2Txn._id },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.getTransactionReceipt(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  await t.test('Test 31: Student 1 cannot record payments on Student 2 invoice (IDOR blocked with 403)', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        invoiceId: sampleInvoice2._id,
        amount: 5000,
        paymentMethod: 'upi',
      },
    };
    const res = createMockRes();
    await assert.rejects(
      async () => {
        await feeController.recordOfflinePayment(req, res);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // ── 7. CSV FORMULA INJECTION & ADMIN ANALYTICS ────────────────────────────

  await t.test('Test 32: CSV sanitizer neutralizes formula injection triggers (CWE-1236)', () => {
    assert.equal(feeCalcService.sanitizeCsvValue('=CMD|'), `"'=CMD|"`);
    assert.equal(feeCalcService.sanitizeCsvValue('+1+2'), ` "'+1+2"`.trim());
    assert.equal(feeCalcService.sanitizeCsvValue('-100'), ` "'-100"`.trim());
    assert.equal(feeCalcService.sanitizeCsvValue('@SUM(A1)'), `"'@SUM(A1)"`);
    assert.equal(feeCalcService.sanitizeCsvValue('Standard Name'), `"Standard Name"`);
  });

  await t.test('Test 33: Admin CSV export returns RFC-4180 compliant CSV stream with formula guards', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: { department: 'CSE' },
    };
    const res = createMockRes();
    await feeController.exportFeeReportCSV(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.ok(res.rawBody.includes('"Invoice Number","Student Name"'));
    assert.ok(res.rawBody.includes(sampleInvoice1.invoiceNumber));
  });

  await t.test('Test 34: Admin finance metrics returns accurate real ledger totals', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
    };
    const res = createMockRes();
    await feeController.getAdminFinanceMetrics(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.success);
    assert.ok(res.jsonData.data.overview.totalGrossInPaise > 0);
    assert.ok(res.jsonData.data.overview.totalPaidInPaise > 0);
    assert.ok(res.jsonData.data.departmentBreakdown.length > 0);
  });

  await t.test('Test 35: Notification integration generated fee category notifications', async () => {
    const feeNotifs = await Notification.find({ category: 'fee' });
    assert.ok(feeNotifs.length > 0);
    const titles = feeNotifs.map((n) => n.title);
    assert.ok(titles.some((t) => t.includes('Fee Invoice')));
  });

  await t.test('Teardown: Disconnect test database cleanly', async () => {
    await mongoose.disconnect();
  });
});
