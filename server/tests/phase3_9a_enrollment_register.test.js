/**
 * server/tests/phase3_9a_enrollment_register.test.js
 *
 * Phase 3.9A — Official Enrollment Register Import & Reconciliation
 *
 * Test scenarios:
 *  1.  RBAC: non-admin roles are rejected from all register endpoints.
 *  2.  File parsing: CSV file is parsed and returns headers + row count.
 *  3.  File parsing: XLSX file is parsed and returns headers + row count.
 *  4.  Column mapping validation: missing rollNumber column rejected.
 *  5.  Preview: returns first ≤5 rows in canonical form.
 *  6.  Import: CONFIRMED_MATCH for exact roll + name match.
 *  7.  Import: NAME_MISMATCH_REQUIRES_REVIEW when names differ significantly.
 *  8.  Import: DUPLICATE_IN_REGISTER for second occurrence of same roll number.
 *  9.  Import: INVALID_IDENTIFIER for 10-digit phone number as roll.
 * 10.  Import: MISSING_ROLL for empty roll number field.
 * 11.  Import: UNMATCHED_REGISTER_ENTRY when roll not in Batch 003 staging.
 * 12.  Idempotency: second executeImport on same importId is rejected with 409.
 * 13.  Evidence review: CONFIRMED creates/updates EnrollmentVerification with DOCUMENT_VERIFIED.
 * 14.  Evidence review: does NOT auto-set verificationStatus to VERIFIED.
 * 15.  Evidence review: REJECTED decision recorded with remarks.
 * 16.  Evidence review: auditHistory entry added with reviewer identity and timestamp.
 * 17.  Invariance: no production Student or User records are created or modified.
 */

'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ── Models ────────────────────────────────────────────────────────────────────

let EnrollmentRegisterImport, EnrollmentRegisterRow, EnrollmentVerification;
let StudentStaging, Student, User;

// ── Controllers ───────────────────────────────────────────────────────────────

let uploadRegisterFile, previewColumnMapping, executeImport;
let getImportList, getImportDetail, getImportRows, getRowDetail;
let reviewRowEvidence, deleteImport;

// ── Infra ─────────────────────────────────────────────────────────────────────

let mongod;
let adminUserId;

const BATCH_ID    = 'BATCH-20261112-STAGING-003';
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const CSV_PATH    = path.join(FIXTURE_DIR, 'synthetic_enrollment_register.csv');
const XLSX_PATH   = path.join(FIXTURE_DIR, 'synthetic_enrollment_register.xlsx');

// Roll numbers that EXIST in Batch 003 staging (seeded in before())
const MATCH_ROLLS = ['REG_MATCH_01', 'REG_MATCH_02', 'REG_MATCH_03', 'REG_MISMATCH_04'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReq(user, params = {}, query = {}, body = {}, file = null) {
  return {
    user,
    params,
    query,
    body,
    file,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data)   { this.body = data;       return this; },
  };
  return res;
}

/** Wrap a controller call to capture thrown ApiErrors as a response object. */
async function callCtrl(fn, req, res) {
  try {
    await fn(req, res, (err) => { if (err) throw err; });
  } catch (err) {
    res.statusCode = err.statusCode || 500;
    res.body = { success: false, message: err.message };
  }
  return res;
}

/** Build a fake multer file object from a path. */
function fakeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const originalname = path.basename(filePath);
  return { originalname, buffer, size: buffer.length };
}

/** Seed a minimal StudentStaging record. */
async function seedStaging(normalizedRollNumber, studentName) {
  return StudentStaging.findOneAndUpdate(
    { batchId: BATCH_ID, normalizedRollNumber },
    {
      $setOnInsert: {
        batchId,
        normalizedRollNumber,
        studentName,
        sourceSheet: 'Student Master',
        sourceRow: Math.floor(Math.random() * 9000) + 1000,
        rawPayload: { name: studentName, roll: normalizedRollNumber },
        reviewStatus: 'pending_review',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const batchId = BATCH_ID; // alias used in seedStaging

// ── Standard column mapping matching the CSV fixture headers ──────────────────

const STANDARD_MAPPING = {
  rollNumber:     'Roll No',
  studentName:    'Student Name',
  program:        'Program',
  branch:         'Branch',
  semester:       'Semester',
  section:        'Section',
  academicYear:   'Academic Year',
  registrationId: 'Registration ID',
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_phase3_9a' });

  // Load models
  const eriModule = require('../models/EnrollmentRegisterImport');
  EnrollmentRegisterImport = eriModule.EnrollmentRegisterImport;

  const errModule = require('../models/EnrollmentRegisterRow');
  EnrollmentRegisterRow = errModule.EnrollmentRegisterRow;

  const evModule = require('../models/EnrollmentVerification');
  EnrollmentVerification = evModule.EnrollmentVerification;

  StudentStaging = require('../models/StudentStaging');
  Student        = require('../models/Student');
  User           = require('../models/User');

  // Load controller functions
  const ctrl = require('../controllers/enrollmentRegisterImport.controller');
  uploadRegisterFile   = ctrl.uploadRegisterFile;
  previewColumnMapping = ctrl.previewColumnMapping;
  executeImport        = ctrl.executeImport;
  getImportList        = ctrl.getImportList;
  getImportDetail      = ctrl.getImportDetail;
  getImportRows        = ctrl.getImportRows;
  getRowDetail         = ctrl.getRowDetail;
  reviewRowEvidence    = ctrl.reviewRowEvidence;
  deleteImport         = ctrl.deleteImport;

  // Create a fake admin user ID
  adminUserId = new mongoose.Types.ObjectId();

  // Seed Batch 003 staging records
  // REG_MATCH_01 → "Alpha Student"  (name matches fixture)
  // REG_MATCH_02 → "Beta Student"   (name matches fixture)
  // REG_MATCH_03 → "Gamma Student"  (name matches fixture)
  // REG_MISMATCH_04 → "Real Name"   (fixture has "COMPLETELY WRONG NAME" → mismatch)
  await seedStaging('REG_MATCH_01', 'Alpha Student');
  await seedStaging('REG_MATCH_02', 'Beta Student');
  await seedStaging('REG_MATCH_03', 'Gamma Student');
  await seedStaging('REG_MISMATCH_04', 'Real Name For Student Four');
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 3.9A — Enrollment Register Import & Reconciliation', () => {

  // ── 1. RBAC ────────────────────────────────────────────────────────────────

  test('1. RBAC: non-admin role is rejected from uploadRegisterFile', async () => {
    const { allowRoles } = require('../middleware/role.middleware');
    const allow = allowRoles('admin');
    let blocked = false;
    const req = { user: { role: 'student' } };
    // role.middleware calls res.status(403).json(...) directly
    const res = {
      _status: null,
      _body:   null,
      status(code) { this._status = code; return this; },
      json(data)   { this._body = data; blocked = true; return this; },
    };
    allow(req, res, () => { /* should not be called */ });
    assert.ok(blocked, 'Expected the middleware to send a 403 response');
    assert.strictEqual(res._status, 403, 'Expected HTTP 403 status');
  });

  // ── 2. CSV parsing ─────────────────────────────────────────────────────────

  test('2. File parsing: CSV file returns headers and correct row count', async () => {
    const file = fakeFile(CSV_PATH);
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      {}, {}, {}, file
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 201, 'Expected 201 Created');
    assert.ok(res.body.success, 'Expected success: true');
    assert.ok(res.body.importId, 'Expected importId');
    assert.ok(Array.isArray(res.body.headers), 'Expected headers array');
    assert.ok(res.body.headers.includes('Roll No'), 'Expected "Roll No" header');
    assert.ok(res.body.headers.includes('Student Name'), 'Expected "Student Name" header');
    // Fixture has 10 data rows
    assert.strictEqual(res.body.rowCount, 10, 'Expected 10 data rows');
  });

  // ── 3. XLSX parsing ────────────────────────────────────────────────────────

  test('3. File parsing: XLSX file returns headers and correct row count', async () => {
    const file = fakeFile(XLSX_PATH);
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      {}, {}, {}, file
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.headers.includes('Roll No'));
    assert.strictEqual(res.body.rowCount, 10);
  });

  // ── 4. Column mapping validation ───────────────────────────────────────────

  test('4. Column mapping: missing rollNumber is rejected with 400', async () => {
    // First upload a file to get an importId
    const file = fakeFile(CSV_PATH);
    const uploadReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      {}, {}, {}, file
    );
    const uploadRes = mockRes();
    await callCtrl(uploadRegisterFile, uploadReq, uploadRes);
    const { importId } = uploadRes.body;

    // Preview without rollNumber mapping
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { importId }, {}, { columnMapping: { studentName: 'Student Name' } }
    );
    const res = mockRes();
    await callCtrl(previewColumnMapping, req, res);

    assert.strictEqual(res.statusCode, 400, 'Expected 400 for missing rollNumber');
    assert.ok(res.body.message.toLowerCase().includes('rollnumber') ||
              res.body.message.toLowerCase().includes('roll number'),
              'Error message should mention rollNumber');
  });

  // ── 5. Preview ─────────────────────────────────────────────────────────────

  test('5. Preview: returns at most 5 rows in canonical form', async () => {
    const file = fakeFile(CSV_PATH);
    const uploadReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      {}, {}, {}, file
    );
    const uploadRes = mockRes();
    await callCtrl(uploadRegisterFile, uploadReq, uploadRes);
    const { importId } = uploadRes.body;

    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { importId }, {}, { columnMapping: STANDARD_MAPPING }
    );
    const res = mockRes();
    await callCtrl(previewColumnMapping, req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.previewRows));
    assert.ok(res.body.previewRows.length <= 5, 'At most 5 preview rows');
    // First row should have roll number from fixture
    assert.strictEqual(res.body.previewRows[0].rollNumber, 'REG_MATCH_01');
    assert.strictEqual(res.body.previewRows[0].studentName, 'Alpha Student');
  });

  // ── 6. CONFIRMED_MATCH ─────────────────────────────────────────────────────

  let globalImportId; // shared across tests 6–17

  test('6. Import: CONFIRMED_MATCH for exact roll + name match', async () => {
    const file = fakeFile(CSV_PATH);
    const uploadReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      {}, {}, {}, file
    );
    const uploadRes = mockRes();
    await callCtrl(uploadRegisterFile, uploadReq, uploadRes);
    globalImportId = uploadRes.body.importId;

    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { importId: globalImportId }, {}, { columnMapping: STANDARD_MAPPING }
    );
    const res = mockRes();
    await callCtrl(executeImport, req, res);

    assert.strictEqual(res.statusCode, 200, `Import failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.success);

    // Check REG_MATCH_01, REG_MATCH_02, REG_MATCH_03 first occurrences are CONFIRMED_MATCH
    const matched = await EnrollmentRegisterRow.find({
      importId: globalImportId,
      normalizedRollNumber: { $in: ['REG_MATCH_01', 'REG_MATCH_02', 'REG_MATCH_03'] },
      reconciliationStatus: 'CONFIRMED_MATCH',
    }).lean();
    assert.strictEqual(matched.length, 3, `Expected 3 CONFIRMED_MATCH rows, got ${matched.length}`);
    for (const row of matched) {
      assert.strictEqual(row.reconciliationStatus, 'CONFIRMED_MATCH',
        `${row.normalizedRollNumber} should be CONFIRMED_MATCH, got ${row.reconciliationStatus}`);
      assert.ok(row.matchedStagingId, 'Expected matchedStagingId to be set');
    }
  });

  // ── 7. NAME_MISMATCH_REQUIRES_REVIEW ──────────────────────────────────────

  test('7. Import: NAME_MISMATCH_REQUIRES_REVIEW when names differ', async () => {
    const mismatchRow = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      normalizedRollNumber: 'REG_MISMATCH_04',
    }).lean();
    assert.ok(mismatchRow, 'Expected a row for REG_MISMATCH_04');
    assert.strictEqual(mismatchRow.reconciliationStatus, 'NAME_MISMATCH_REQUIRES_REVIEW');
  });

  // ── 8. DUPLICATE_IN_REGISTER ───────────────────────────────────────────────

  test('8. Import: DUPLICATE_IN_REGISTER for second occurrence of same roll', async () => {
    // REG_MATCH_01 appears twice in fixture (rows 1 and 8)
    const rows = await EnrollmentRegisterRow.find({
      importId: globalImportId,
      rawRollNumber: 'REG_MATCH_01',
    }).lean();
    assert.ok(rows.length >= 2, 'Expected at least 2 rows with REG_MATCH_01');
    const dupe = rows.find((r) => r.rowStatus === 'DUPLICATE_IN_REGISTER');
    assert.ok(dupe, 'Expected one row to have rowStatus DUPLICATE_IN_REGISTER');
  });

  // ── 9. INVALID_IDENTIFIER ─────────────────────────────────────────────────

  test('9. Import: INVALID_IDENTIFIER for phone-number-looking roll', async () => {
    const phoneRow = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      rawRollNumber: '9876543210',
    }).lean();
    assert.ok(phoneRow, 'Expected row for phone number');
    assert.strictEqual(phoneRow.rowStatus, 'INVALID_IDENTIFIER');
  });

  // ── 10. MISSING_ROLL ──────────────────────────────────────────────────────

  test('10. Import: MISSING_ROLL for empty roll number field', async () => {
    const noRollRow = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      rawStudentName: 'Eta NoRoll',
    }).lean();
    assert.ok(noRollRow, 'Expected row for empty-roll student');
    assert.strictEqual(noRollRow.rowStatus, 'MISSING_ROLL');
  });

  // ── 11. UNMATCHED_REGISTER_ENTRY ─────────────────────────────────────────

  test('11. Import: UNMATCHED_REGISTER_ENTRY when roll not in Batch 003 staging', async () => {
    const unmatched = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      normalizedRollNumber: 'REG_UNMATCHED_05',
    }).lean();
    assert.ok(unmatched, 'Expected row for REG_UNMATCHED_05');
    assert.strictEqual(unmatched.reconciliationStatus, 'UNMATCHED_REGISTER_ENTRY');
  });

  // ── 12. Idempotency ───────────────────────────────────────────────────────

  test('12. Idempotency: second executeImport on same importId is rejected', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { importId: globalImportId }, {}, { columnMapping: STANDARD_MAPPING }
    );
    const res = mockRes();
    await callCtrl(executeImport, req, res);
    assert.strictEqual(res.statusCode, 409, 'Expected 409 Conflict');
  });

  // ── 13. Evidence review: CONFIRMED ────────────────────────────────────────

  let confirmedRowId;

  test('13. Evidence review: CONFIRMED creates EnrollmentVerification with DOCUMENT_VERIFIED', async () => {
    // Find a CONFIRMED_MATCH row
    const matchRow = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      reconciliationStatus: 'CONFIRMED_MATCH',
      normalizedRollNumber: 'REG_MATCH_02',
    }).lean();
    assert.ok(matchRow, 'Expected a CONFIRMED_MATCH row for REG_MATCH_02');
    confirmedRowId = matchRow._id.toString();

    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { rowId: confirmedRowId },
      {},
      { decision: 'CONFIRMED', remarks: 'Verified against official register' }
    );
    const res = mockRes();
    await callCtrl(reviewRowEvidence, req, res);

    assert.strictEqual(res.statusCode, 200, `Evidence review failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.success);
    assert.strictEqual(res.body.decision, 'CONFIRMED');

    // Check EnrollmentVerification was created/updated
    const ev = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: 'REG_MATCH_02',
    }).lean();
    assert.ok(ev, 'Expected EnrollmentVerification to be created for REG_MATCH_02');
    assert.strictEqual(ev.evidenceType, 'REGISTRAR_ENROLLMENT_REGISTER');
    assert.strictEqual(ev.evidenceVerificationLevel, 'DOCUMENT_VERIFIED');
    assert.ok(ev.evidenceReference, 'Expected evidenceReference to be set');
  });

  // ── 14. CONFIRMED does NOT auto-set verificationStatus to VERIFIED ────────

  test('14. Evidence review: CONFIRMED does NOT auto-set verificationStatus to VERIFIED', async () => {
    const ev = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: 'REG_MATCH_02',
    }).lean();
    assert.ok(ev, 'EnrollmentVerification must exist');
    assert.strictEqual(ev.verificationStatus, 'PENDING',
      'verificationStatus must remain PENDING after evidence review — only the Phase 3.7 approve action may set it to VERIFIED');
  });

  // ── 15. Evidence review: REJECTED ─────────────────────────────────────────

  test('15. Evidence review: REJECTED records decision with remarks', async () => {
    // Find a NAME_MISMATCH row
    const mismatchRow = await EnrollmentRegisterRow.findOne({
      importId: globalImportId,
      reconciliationStatus: 'NAME_MISMATCH_REQUIRES_REVIEW',
    }).lean();
    assert.ok(mismatchRow, 'Expected a NAME_MISMATCH_REQUIRES_REVIEW row');

    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Test Admin' },
      { rowId: mismatchRow._id.toString() },
      {},
      { decision: 'REJECTED', remarks: 'Name does not match registrar record' }
    );
    const res = mockRes();
    await callCtrl(reviewRowEvidence, req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.decision, 'REJECTED');

    // Verify row is updated
    const updated = await EnrollmentRegisterRow.findById(mismatchRow._id).lean();
    assert.strictEqual(updated.evidenceReviewStatus, 'REJECTED');
    assert.strictEqual(updated.reviewRemarks, 'Name does not match registrar record');
  });

  // ── 16. Audit history ─────────────────────────────────────────────────────

  test('16. Evidence review: auditHistory entry added with reviewer identity and timestamp', async () => {
    const ev = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: 'REG_MATCH_02',
    }).lean();
    assert.ok(ev, 'EnrollmentVerification must exist');
    assert.ok(ev.auditHistory && ev.auditHistory.length > 0, 'Expected at least one audit entry');

    const evidenceEntry = ev.auditHistory.find((e) => e.action === 'EVIDENCE_RECORDED');
    assert.ok(evidenceEntry, 'Expected an EVIDENCE_RECORDED audit entry');
    assert.strictEqual(evidenceEntry.evidenceType, 'REGISTRAR_ENROLLMENT_REGISTER');
    assert.strictEqual(evidenceEntry.evidenceVerificationLevel, 'DOCUMENT_VERIFIED');
    assert.ok(evidenceEntry.actorId, 'Expected actorId in audit entry');
    assert.ok(evidenceEntry.timestamp, 'Expected timestamp in audit entry');
  });

  // ── 17. Invariance: no production Student or User writes ─────────────────

  test('17. Invariance: no production Student or User records created', async () => {
    const studentCount = await Student.countDocuments();
    const userCount    = await User.countDocuments();
    // Both must be 0 because the in-memory test DB starts empty
    assert.strictEqual(studentCount, 0, 'No Student documents should exist in the test database');
    assert.strictEqual(userCount,    0, 'No User documents should exist in the test database');
  });

});
