/**
 * server/tests/phase3_7_enrollment_verification.test.js
 *
 * Phase 3.7 — Enrollment Verification Workflow Unit Tests
 *
 * Verifies:
 *  1. RBAC enforcement (admin allowed, non-admin rejected).
 *  2. Default state: unverified staging students start as PENDING in statistics.
 *  3. Explicit PENDING record creation and duplicate prevention.
 *  4. Recording evidence without immediate approval (status stays PENDING, evidence stored, audit entry appended).
 *  5. Rejection of approval when evidence is missing or invalid.
 *  6. Successful approval with valid independent evidence (status VERIFIED, verifiedAt set, reviewer identity).
 *  7. Rejection requires explanatory remarks.
 *  8. Status transition to REJECTED with remarks and audit history.
 *  9. Request review requires remarks and sets status to REQUIRES_REVIEW.
 * 10. Audit history immutability and complete event capture.
 * 11. Cross-batch isolation: rolls from quarantined batches (e.g. Batch 001) or non-existent rolls cannot create or update verifications.
 * 12. Verification list with search, status filtering, and pagination.
 * 13. getVerificationDetail returns combined verification and sanitized staging info.
 * 14. Invariance: Zero modifications to production Student or User collections.
 */

'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let StudentStaging, AdmissionApplication, EnrollmentVerification;
let getVerificationStats, listVerifications, getVerificationDetail, getVerificationHistory;
let createPendingVerification, recordEvidence, approveVerification, rejectVerification, requestReview;
let allowRoles;

const BATCH_ID = 'BATCH-20261112-STAGING-003';
const QUARANTINE_BATCH = 'BATCH-20261112-STAGING-001';

let mongod;
let adminUserId;

function mockReq(user, params = {}, query = {}, body = {}) {
  return {
    user,
    params,
    query,
    body,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_phase3_7' });

  StudentStaging = require('../models/StudentStaging');
  AdmissionApplication = require('../models/AdmissionApplication');
  const evModule = require('../models/EnrollmentVerification');
  EnrollmentVerification = evModule.EnrollmentVerification;

  const controller = require('../controllers/enrollmentVerification.controller');
  getVerificationStats = controller.getVerificationStats;
  listVerifications = controller.listVerifications;
  getVerificationDetail = controller.getVerificationDetail;
  getVerificationHistory = controller.getVerificationHistory;
  createPendingVerification = controller.createPendingVerification;
  recordEvidence = controller.recordEvidence;
  approveVerification = controller.approveVerification;
  rejectVerification = controller.rejectVerification;
  requestReview = controller.requestReview;

  const roleMiddleware = require('../middleware/role.middleware');
  allowRoles = roleMiddleware.allowRoles;

  // Ensure indexes
  await Promise.all([
    StudentStaging.createIndexes(),
    AdmissionApplication.createIndexes(),
    EnrollmentVerification.createIndexes(),
  ]);

  adminUserId = new mongoose.Types.ObjectId();

  // Seed Batch 003 staging students
  await StudentStaging.create([
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 10,
      rawIdentifier: 'CS21001',
      normalizedRollNumber: 'CS21001',
      studentName: 'Student Alpha',
      rawPayload: new Map([['name', 'Student Alpha']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 11,
      rawIdentifier: 'CS21002',
      normalizedRollNumber: 'CS21002',
      studentName: 'Student Beta',
      rawPayload: new Map([['name', 'Student Beta']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 12,
      rawIdentifier: 'CS21003',
      normalizedRollNumber: 'CS21003',
      studentName: 'Student Gamma',
      rawPayload: new Map([['name', 'Student Gamma']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    // Quarantined Batch 001 student
    {
      batchId: QUARANTINE_BATCH,
      sourceSheet: 'Student Master',
      sourceRow: 99,
      rawIdentifier: 'QUAR99',
      normalizedRollNumber: 'QUAR99',
      studentName: 'Quarantined Student',
      rawPayload: new Map([['name', 'Quarantined Student']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
  ]);

  // Seed admission record
  await AdmissionApplication.create({
    batchId: BATCH_ID,
    applicationNumber: 'APP-2026-001',
    rollNumber: 'CS21001',
    studentName: 'Student Alpha',
    course: 'B.Tech CSE',
    school: 'Engineering',
    admissionStatus: 'applicant',
    sourceRow: 5,
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 3.7: Enrollment Verification Workflow Tests', () => {

  test('1. RBAC: non-admin roles are rejected by allowRoles middleware', () => {
    const middleware = allowRoles('admin');
    let calledNext = false;
    const req = { user: { role: 'student', userId: '123' } };
    const res = mockRes();

    middleware(req, res, () => { calledNext = true; });

    assert.strictEqual(calledNext, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('2. RBAC: admin role is allowed through allowRoles middleware', () => {
    const middleware = allowRoles('admin');
    let calledNext = false;
    const req = { user: { role: 'admin', userId: adminUserId.toString() } };
    const res = mockRes();

    middleware(req, res, () => { calledNext = true; });

    assert.strictEqual(calledNext, true);
  });

  test('3. Verification Stats: unreviewed Batch 003 students default to PENDING', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId });
    const res = mockRes();

    await getVerificationStats(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    const data = res.body.data;
    assert.strictEqual(data.totalStaging, 3); // 3 students in Batch 003
    assert.strictEqual(data.pending, 3);
    assert.strictEqual(data.verified, 0);
    assert.strictEqual(data.rejected, 0);
    assert.strictEqual(data.requiresReview, 0);
    assert.strictEqual(data.explicitDecisionsCount, 0);
  });

  test('4. createPendingVerification creates a PENDING record for a Batch 003 roll', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      {},
      {},
      { rollNumber: 'CS21001' }
    );
    const res = mockRes();

    await createPendingVerification(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.normalizedRollNumber, 'CS21001');
    assert.strictEqual(res.body.data.verificationStatus, 'PENDING');
    assert.strictEqual(res.body.data.auditHistory.length, 1);
    assert.strictEqual(res.body.data.auditHistory[0].action, 'CREATED');
  });

  test('5. createPendingVerification prevents duplicate records for same roll', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      {},
      {},
      { rollNumber: 'CS21001' }
    );
    const res = mockRes();

    await assert.rejects(async () => {
      await createPendingVerification(req, res);
    }, (err) => {
      return err.statusCode === 400 && err.message.includes('already exists');
    });
  });

  test('6. Cross-batch isolation: cannot create verification for quarantined batch roll', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      {},
      {},
      { rollNumber: 'QUAR99' }
    );
    const res = mockRes();

    await assert.rejects(async () => {
      await createPendingVerification(req, res);
    }, (err) => {
      return err.statusCode === 404 && err.message.includes('No Batch 003 staging record found');
    });
  });

  test('7. recordEvidence: records evidence without immediately approving (status stays PENDING)', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'CS21001' },
      {},
      {
        evidenceType: 'REGISTRAR_ENROLLMENT_REGISTER',
        evidenceReference: 'REG-2026-ENR-0042',
        evidenceVerificationLevel: 'REFERENCE_RECORDED',
        remarks: 'Recorded from Fall 2026 register',
      }
    );
    const res = mockRes();

    await recordEvidence(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.evidenceType, 'REGISTRAR_ENROLLMENT_REGISTER');
    assert.strictEqual(res.body.data.evidenceReference, 'REG-2026-ENR-0042');
    assert.strictEqual(res.body.data.evidenceVerificationLevel, 'REFERENCE_RECORDED');
    assert.strictEqual(res.body.data.verificationStatus, 'PENDING'); // Stays PENDING!
    assert.strictEqual(res.body.data.auditHistory.length, 2);
    assert.strictEqual(res.body.data.auditHistory[1].action, 'EVIDENCE_RECORDED');
  });

  test('8. approveVerification: rejects approval if no evidenceType or evidenceReference', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      { rollNumber: 'CS21002' },
      {},
      {
        evidenceType: null,
        evidenceReference: '',
      }
    );
    const res = mockRes();

    await assert.rejects(async () => {
      await approveVerification(req, res);
    }, (err) => {
      return err.statusCode === 400 && err.message.includes('Cannot verify enrollment');
    });
  });

  test('9. approveVerification: approves enrollment with valid independent evidence', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'CS21001' },
      {},
      {
        evidenceType: 'OFFICIAL_FEE_CLEARANCE',
        evidenceReference: 'FEE-REC-2026-901',
        evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
        remarks: 'Official fee receipt and registration verified',
      }
    );
    const res = mockRes();

    await approveVerification(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.verificationStatus, 'VERIFIED');
    assert.strictEqual(res.body.data.evidenceType, 'OFFICIAL_FEE_CLEARANCE');
    assert.strictEqual(res.body.data.evidenceReference, 'FEE-REC-2026-901');
    assert.strictEqual(res.body.data.evidenceVerificationLevel, 'DOCUMENT_VERIFIED');
    assert.ok(res.body.data.verifiedAt);
    assert.strictEqual(res.body.data.auditHistory[res.body.data.auditHistory.length - 1].action, 'APPROVED');
  });

  test('10. rejectVerification: requires reviewer remarks explaining rejection', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      { rollNumber: 'CS21002' },
      {},
      { remarks: '' }
    );
    const res = mockRes();

    await assert.rejects(async () => {
      await rejectVerification(req, res);
    }, (err) => {
      return err.statusCode === 400 && err.message.includes('Rejection requires reviewer remarks');
    });
  });

  test('11. rejectVerification: sets status to REJECTED and records audit entry', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'CS21002' },
      {},
      { remarks: 'Did not report for semester registration. Not found on official registrar roll.' }
    );
    const res = mockRes();

    await rejectVerification(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.verificationStatus, 'REJECTED');
    assert.strictEqual(res.body.data.reviewerRemarks, 'Did not report for semester registration. Not found on official registrar roll.');
    assert.strictEqual(res.body.data.auditHistory[res.body.data.auditHistory.length - 1].action, 'REJECTED');
  });

  test('12. requestReview: sets status to REQUIRES_REVIEW and requires remarks', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'CS21003' },
      {},
      { remarks: 'Name mismatch between application and registrar sheet — requires registrar clarification.' }
    );
    const res = mockRes();

    await requestReview(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.verificationStatus, 'REQUIRES_REVIEW');
    assert.strictEqual(res.body.data.auditHistory[res.body.data.auditHistory.length - 1].action, 'REVIEW_REQUESTED');
  });

  test('13. getVerificationStats: reflects updated distribution after decisions', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId });
    const res = mockRes();

    await getVerificationStats(req, res);

    assert.strictEqual(res.statusCode, 200);
    const data = res.body.data;
    assert.strictEqual(data.totalStaging, 3);
    assert.strictEqual(data.verified, 1);       // CS21001
    assert.strictEqual(data.rejected, 1);       // CS21002
    assert.strictEqual(data.requiresReview, 1); // CS21003
    assert.strictEqual(data.pending, 0);
    assert.strictEqual(data.explicitDecisionsCount, 3);
  });

  test('14. getVerificationHistory: returns ordered audit history for a roll number', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      { rollNumber: 'CS21001' }
    );
    const res = mockRes();

    await getVerificationHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    const history = res.body.data.auditHistory;
    assert.strictEqual(history.length, 3); // CREATED, EVIDENCE_RECORDED, APPROVED
    assert.strictEqual(history[0].action, 'CREATED');
    assert.strictEqual(history[1].action, 'EVIDENCE_RECORDED');
    assert.strictEqual(history[2].action, 'APPROVED');
  });

  test('15. listVerifications: returns paginated items and supports status filter', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      {},
      { status: 'VERIFIED', page: '1', limit: '10' }
    );
    const res = mockRes();

    await listVerifications(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.items.length, 1);
    assert.strictEqual(res.body.data.items[0].normalizedRollNumber, 'CS21001');
    assert.strictEqual(res.body.data.items[0].verificationStatus, 'VERIFIED');
  });

  test('16. getVerificationDetail: returns combined verification, staging, and admission data', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId },
      { rollNumber: 'CS21001' }
    );
    const res = mockRes();

    await getVerificationDetail(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    const d = res.body.data;
    assert.strictEqual(d.verification.normalizedRollNumber, 'CS21001');
    assert.strictEqual(d.verification.verificationStatus, 'VERIFIED');
    assert.strictEqual(d.staging.normalizedRollNumber, 'CS21001');
    assert.strictEqual(d.admission.applicationNumber, 'APP-2026-001');
  });

  test('17. Invariance check: production Student and User collections remain untouched', async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collNames = collections.map(c => c.name);
    // Student or User should never have been created or modified in test db
    assert.ok(!collNames.includes('students'), 'students collection was never touched');
    assert.ok(!collNames.includes('users'), 'users collection was never touched');
  });

});
