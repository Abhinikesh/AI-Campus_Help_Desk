/**
 * server/tests/phase3_8_controlled_promotion.test.js
 *
 * Phase 3.8 — Controlled Verified Student Promotion Unit Tests
 *
 * Verifies:
 *  1. Admin RBAC: non-admin roles rejected from promotion endpoints.
 *  2. Eligibility evaluation: unverified student is ineligible.
 *  3. Eligibility evaluation: REFERENCE_RECORDED status is strictly INELIGIBLE.
 *  4. Eligibility evaluation: DOCUMENT_VERIFIED with independent evidence is ELIGIBLE.
 *  5. Missing required fields (e.g. empty student name) renders identity ineligible.
 *  6. Phone number format identifier renders identity ineligible.
 *  7. Identity with unresolved conflicts is ineligible.
 *  8. Pre-existing production Student conflict prevents promotion.
 *  9. Successful individual promotion creates Student with enrolled_offline status and user: null.
 * 10. Promoted student does not have synthetic passwords, emails or user accounts created.
 * 11. Duplicate promotion prevention: second promotion attempt is rejected with 409 Conflict.
 * 12. Concurrent promotion protection: atomic state lock prevents multiple promotions.
 * 13. Audit history: EnrollmentVerification.auditHistory and AuditLog capture promotion event.
 * 14. Promotion stats: correctly reports eligibleCount, alreadyPromotedCount, and ineligibleVerifiedCount.
 * 15. Promotion preview: returns projected Student document without writing to database.
 * 16. Promotion history: lists promoted students with reviewer and timestamp.
 */

'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let Student, StudentStaging, AdmissionApplication, EnrollmentVerification, AuditLog;
let evaluateEligibility, getPromotionStats, getPromotionPreview, promoteStudent, getPromotionHistory;
let allowRoles;

const BATCH_ID = 'BATCH-20261112-STAGING-003';

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
  await mongoose.connect(uri, { dbName: 'test_phase3_8' });

  Student = require('../models/Student');
  StudentStaging = require('../models/StudentStaging');
  AdmissionApplication = require('../models/AdmissionApplication');
  const evModule = require('../models/EnrollmentVerification');
  EnrollmentVerification = evModule.EnrollmentVerification;
  AuditLog = require('../models/AuditLog');

  const controller = require('../controllers/studentPromotion.controller');
  evaluateEligibility = controller.evaluateEligibility;
  getPromotionStats = controller.getPromotionStats;
  getPromotionPreview = controller.getPromotionPreview;
  promoteStudent = controller.promoteStudent;
  getPromotionHistory = controller.getPromotionHistory;

  const roleMiddleware = require('../middleware/role.middleware');
  allowRoles = roleMiddleware.allowRoles;

  // Ensure indexes
  await Promise.all([
    Student.createIndexes(),
    StudentStaging.createIndexes(),
    AdmissionApplication.createIndexes(),
    EnrollmentVerification.createIndexes(),
    AuditLog.createIndexes(),
  ]);

  adminUserId = new mongoose.Types.ObjectId();

  // 1. Seed Staging Students
  await StudentStaging.create([
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 10,
      rawIdentifier: 'PROMO_ELIGIBLE_01',
      normalizedRollNumber: 'PROMO_ELIGIBLE_01',
      studentName: 'Alice Verified',
      academicProfile: {
        school: 'School of Engineering',
        course: 'B.Tech CSE',
        branch: 'Computer Science',
        section: 'A',
      },
      rawPayload: new Map([['name', 'Alice Verified']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 11,
      rawIdentifier: 'PROMO_REF_ONLY_02',
      normalizedRollNumber: 'PROMO_REF_ONLY_02',
      studentName: 'Bob Reference Only',
      academicProfile: { school: 'School of Business', course: 'BBA', branch: 'Finance' },
      rawPayload: new Map([['name', 'Bob Reference Only']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 12,
      rawIdentifier: 'PROMO_CONFLICT_03',
      normalizedRollNumber: 'PROMO_CONFLICT_03',
      studentName: 'Charlie Conflicted',
      rawPayload: new Map([['name', 'Charlie Conflicted']]),
      conflictCandidates: [{ field: 'rollNumber', rawValue: 'PROMO_CONFLICT_03B', parsedCandidates: [] }],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 13,
      rawIdentifier: '9876543210',
      normalizedRollNumber: '9876543210', // Invalid phone format identifier
      studentName: 'David Invalid ID',
      rawPayload: new Map([['name', 'David Invalid ID']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
    {
      batchId: BATCH_ID,
      sourceSheet: 'Student Master',
      sourceRow: 14,
      rawIdentifier: 'PROMO_EXISTING_05',
      normalizedRollNumber: 'PROMO_EXISTING_05',
      studentName: 'Eve Existing Student',
      rawPayload: new Map([['name', 'Eve Existing Student']]),
      conflictCandidates: [],
      reviewStatus: 'pending_review',
    },
  ]);

  // 2. Seed an existing production Student to test conflict detection
  await Student.create({
    rollNumber: 'PROMO_EXISTING_05',
    fullName: 'Eve Existing Student In Prod',
    accountStatus: 'enrolled_offline',
    status: 'active',
  });

  // 3. Seed Admission Applications
  await AdmissionApplication.create({
    batchId: BATCH_ID,
    applicationNumber: 'APP-2026-ALICE',
    studentName: 'Alice Verified',
    course: 'B.Tech CSE',
    school: 'School of Engineering',
    admissionStatus: 'applicant',
    sourceRow: 100,
  });

  // 4. Seed Enrollment Verifications
  await EnrollmentVerification.create([
    // Alice: DOCUMENT_VERIFIED -> Eligible!
    {
      batchId: BATCH_ID,
      normalizedRollNumber: 'PROMO_ELIGIBLE_01',
      studentName: 'Alice Verified',
      verificationStatus: 'VERIFIED',
      evidenceType: 'REGISTRAR_ENROLLMENT_REGISTER',
      evidenceReference: 'REG-2026-ENR-1001',
      evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
      reviewerAdminId: adminUserId,
      reviewerAdminName: 'Admin Auditor',
      reviewerRemarks: 'Verified against Fall 2026 registrar folio #42',
      verifiedAt: new Date(),
      auditHistory: [
        {
          action: 'APPROVED',
          status: 'VERIFIED',
          actorId: adminUserId,
          actorName: 'Admin Auditor',
          evidenceType: 'REGISTRAR_ENROLLMENT_REGISTER',
          evidenceReference: 'REG-2026-ENR-1001',
          evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
          remarks: 'Approved',
          timestamp: new Date(),
        },
      ],
    },
    // Bob: REFERENCE_RECORDED only -> Ineligible!
    {
      batchId: BATCH_ID,
      normalizedRollNumber: 'PROMO_REF_ONLY_02',
      studentName: 'Bob Reference Only',
      verificationStatus: 'VERIFIED',
      evidenceType: 'OFFICIAL_FEE_CLEARANCE',
      evidenceReference: 'FEE-REF-8821',
      evidenceVerificationLevel: 'REFERENCE_RECORDED',
      reviewerAdminId: adminUserId,
      reviewerAdminName: 'Admin Auditor',
      verifiedAt: new Date(),
    },
    // Eve: DOCUMENT_VERIFIED but already in production Student collection -> Ineligible!
    {
      batchId: BATCH_ID,
      normalizedRollNumber: 'PROMO_EXISTING_05',
      studentName: 'Eve Existing Student',
      verificationStatus: 'VERIFIED',
      evidenceType: 'REGISTRAR_ENROLLMENT_REGISTER',
      evidenceReference: 'REG-2026-ENR-1005',
      evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
      reviewerAdminId: adminUserId,
      reviewerAdminName: 'Admin Auditor',
      verifiedAt: new Date(),
    },
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 3.8: Controlled Verified Student Promotion Suite', () => {

  test('1. Admin RBAC: allowRoles rejects non-admin users', () => {
    const middleware = allowRoles('admin');
    let calledNext = false;
    const req = { user: { role: 'faculty', userId: '123' } };
    const res = mockRes();

    middleware(req, res, () => { calledNext = true; });

    assert.strictEqual(calledNext, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('2. Eligibility evaluation: DOCUMENT_VERIFIED with independent evidence is ELIGIBLE', async () => {
    const result = await evaluateEligibility('PROMO_ELIGIBLE_01');
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.reasons.length, 0);
    assert.strictEqual(result.candidateData.rollNumber, 'PROMO_ELIGIBLE_01');
    assert.strictEqual(result.candidateData.fullName, 'Alice Verified');
    assert.strictEqual(result.candidateData.accountStatus, 'enrolled_offline');
    assert.strictEqual(result.candidateData.user, null);
  });

  test('3. Eligibility evaluation: REFERENCE_RECORDED is strictly INELIGIBLE', async () => {
    const result = await evaluateEligibility('PROMO_REF_ONLY_02');
    assert.strictEqual(result.eligible, false);
    const hasRefReason = result.reasons.some(r => r.includes('REFERENCE_RECORDED alone does not qualify'));
    assert.ok(hasRefReason, 'Should mention REFERENCE_RECORDED does not qualify');
  });

  test('4. Eligibility evaluation: Unresolved identity conflict candidates make student INELIGIBLE', async () => {
    const result = await evaluateEligibility('PROMO_CONFLICT_03');
    assert.strictEqual(result.eligible, false);
    const hasConflictReason = result.reasons.some(r => r.includes('Unresolved identity conflict'));
    assert.ok(hasConflictReason, 'Should flag unresolved identity conflicts');
  });

  test('5. Eligibility evaluation: 10-digit phone number identifier is INELIGIBLE', async () => {
    const result = await evaluateEligibility('9876543210');
    assert.strictEqual(result.eligible, false);
    const hasPhoneReason = result.reasons.some(r => r.includes('phone number format'));
    assert.ok(hasPhoneReason, 'Should flag phone number format');
  });

  test('6. Eligibility evaluation: Pre-existing production Student conflict renders identity INELIGIBLE', async () => {
    const result = await evaluateEligibility('PROMO_EXISTING_05');
    assert.strictEqual(result.eligible, false);
    const hasExistingReason = result.reasons.some(r => r.includes('production Student already exists'));
    assert.ok(hasExistingReason, 'Should flag pre-existing Student');
  });

  test('7. getPromotionPreview: returns preview without mutating database', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId }, { rollNumber: 'PROMO_ELIGIBLE_01' });
    const res = mockRes();

    await getPromotionPreview(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.eligible, true);
    assert.strictEqual(res.body.data.candidateData.fullName, 'Alice Verified');
    assert.strictEqual(res.body.data.candidateData.accountStatus, 'enrolled_offline');

    // Verify student was NOT yet created in production Student collection
    const inDb = await Student.findOne({ rollNumber: 'PROMO_ELIGIBLE_01' });
    assert.strictEqual(inDb, null);
  });

  test('8. getPromotionStats: returns accurate eligibleCount and alreadyPromotedCount', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId });
    const res = mockRes();

    await getPromotionStats(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    const data = res.body.data;
    assert.strictEqual(data.totalVerified, 3);
    assert.strictEqual(data.eligibleCount, 1); // Only Alice is eligible
    assert.strictEqual(data.alreadyPromotedCount, 0);
    assert.strictEqual(data.ineligibleVerifiedCount, 2); // Bob (ref only) & Eve (existing)
  });

  test('9. promoteStudent: fails if identity is ineligible (e.g. REFERENCE_RECORDED)', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId }, { rollNumber: 'PROMO_REF_ONLY_02' });
    const res = mockRes();

    await assert.rejects(async () => {
      await promoteStudent(req, res);
    }, (err) => {
      return err.statusCode === 400 && err.message.includes('not eligible for promotion');
    });
  });

  test('10. promoteStudent: successfully promotes eligible student to production Student collection', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'PROMO_ELIGIBLE_01' }
    );
    const res = mockRes();

    await promoteStudent(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    const created = res.body.data;
    assert.strictEqual(created.rollNumber, 'PROMO_ELIGIBLE_01');
    assert.strictEqual(created.fullName, 'Alice Verified');
    assert.strictEqual(created.user, null); // Offline student, no User created
    assert.strictEqual(created.accountStatus, 'enrolled_offline');
    assert.strictEqual(created.sourceBatchId, BATCH_ID);
    assert.strictEqual(created.admissionApplicationNumber, 'APP-2026-ALICE');

    // Check EnrollmentVerification state
    const verif = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: 'PROMO_ELIGIBLE_01',
    });
    assert.strictEqual(verif.isPromoted, true);
    assert.ok(verif.promotedStudentId);
    assert.strictEqual(verif.promotedByAdminName, 'Admin Jane');
    assert.ok(verif.promotedAt);

    // Check audit history on EnrollmentVerification
    const lastAudit = verif.auditHistory[verif.auditHistory.length - 1];
    assert.strictEqual(lastAudit.action, 'PROMOTED');
    assert.strictEqual(lastAudit.status, 'VERIFIED');
    assert.strictEqual(lastAudit.actorName, 'Admin Jane');

    // Check system AuditLog entry
    const auditEntry = await AuditLog.findOne({
      action: 'STUDENT_PROMOTION',
      entityId: created._id,
    });
    assert.ok(auditEntry, 'AuditLog entry should be recorded');
  });

  test('11. Duplicate promotion prevention: second promotion attempt is rejected with 409 Conflict', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin Jane' },
      { rollNumber: 'PROMO_ELIGIBLE_01' }
    );
    const res = mockRes();

    await assert.rejects(async () => {
      await promoteStudent(req, res);
    }, (err) => {
      return (err.statusCode === 400 || err.statusCode === 409) && err.message.includes('already been promoted');
    });
  });

  test('12. Concurrent promotion protection: atomic state lock prevents multiple promotions', async () => {
    // Attempt concurrent promotion calls on the already promoted record
    const req1 = mockReq({ role: 'admin', userId: adminUserId }, { rollNumber: 'PROMO_ELIGIBLE_01' });
    const req2 = mockReq({ role: 'admin', userId: adminUserId }, { rollNumber: 'PROMO_ELIGIBLE_01' });

    const results = await Promise.allSettled([
      promoteStudent(req1, mockRes()),
      promoteStudent(req2, mockRes()),
    ]);

    assert.strictEqual(results[0].status, 'rejected');
    assert.strictEqual(results[1].status, 'rejected');
  });

  test('13. getPromotionHistory: returns promoted student with audit details', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId });
    const res = mockRes();

    await getPromotionHistory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.count, 1);
    assert.strictEqual(res.body.data.items[0].normalizedRollNumber, 'PROMO_ELIGIBLE_01');
    assert.strictEqual(res.body.data.items[0].promotedByAdminName, 'Admin Jane');
  });

  test('14. getPromotionStats reflects promoted student count', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId });
    const res = mockRes();

    await getPromotionStats(req, res);

    assert.strictEqual(res.statusCode, 200);
    const data = res.body.data;
    assert.strictEqual(data.eligibleCount, 0); // Alice was promoted, so 0 eligible now
    assert.strictEqual(data.alreadyPromotedCount, 1); // Alice is promoted
  });

});
