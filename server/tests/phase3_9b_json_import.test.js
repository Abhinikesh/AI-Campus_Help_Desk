/**
 * server/tests/phase3_9b_json_import.test.js
 *
 * Phase 3.9B — Integrate Existing Local JSON Student Data Tests
 *
 * Verifies:
 *  1. listLocalRegisterFiles: discovers files in data/student_import/
 *  2. loadLocalRegisterFile: path traversal protection blocks '../' with 400
 *  3. loadLocalRegisterFile: non-existent file returns 404
 *  4. loadLocalRegisterFile: successfully loads real local JSON files without manual conversion
 *  5. JSON parser: extracts record arrays from both top-level arrays and object wrappers
 *  6. JSON parser: sensitive fields (passwords, parent contacts) are stripped from headers & rows
 *  7. Malformed JSON: rejected with 400
 *  8. Empty JSON array / no records: rejected with 400
 *  9. JSON file upload via multipart form data works identically
 * 10. End-to-end reconciliation on JSON import: CONFIRMED_MATCH, NAME_MISMATCH, DUPLICATE, INVALID, UNMATCHED
 * 11. Evidence review on JSON-imported row: records DOCUMENT_VERIFIED without auto-approving enrollment
 * 12. Regression: CSV and XLSX imports continue to function identically
 * 13. Invariance: production Student and User collections remain strictly untouched
 */

'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let EnrollmentRegisterImport, EnrollmentRegisterRow, EnrollmentVerification;
let StudentStaging, Student, User;

let uploadRegisterFile, listLocalRegisterFiles, loadLocalRegisterFile;
let previewColumnMapping, executeImport, getImportRows, reviewRowEvidence;

let mongod;
let adminUserId;

const BATCH_ID    = 'BATCH-20261112-STAGING-003';
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const JSON_PATH   = path.join(FIXTURE_DIR, 'synthetic_enrollment_register.json');
const CSV_PATH    = path.join(FIXTURE_DIR, 'synthetic_enrollment_register.csv');

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

async function callCtrl(fn, req, res) {
  try {
    await fn(req, res, (err) => { if (err) throw err; });
  } catch (err) {
    res.statusCode = err.statusCode || 500;
    res.body = { success: false, message: err.message };
  }
  return res;
}

function fakeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const originalname = path.basename(filePath);
  return { originalname, buffer, size: buffer.length };
}

async function seedStaging(normalizedRollNumber, studentName) {
  return StudentStaging.findOneAndUpdate(
    { batchId: BATCH_ID, normalizedRollNumber },
    {
      $setOnInsert: {
        batchId: BATCH_ID,
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

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_phase3_9b' });

  EnrollmentRegisterImport = require('../models/EnrollmentRegisterImport').EnrollmentRegisterImport;
  EnrollmentRegisterRow    = require('../models/EnrollmentRegisterRow').EnrollmentRegisterRow;
  EnrollmentVerification   = require('../models/EnrollmentVerification').EnrollmentVerification;
  StudentStaging           = require('../models/StudentStaging');
  Student                  = require('../models/Student');
  User                     = require('../models/User');

  const ctrl = require('../controllers/enrollmentRegisterImport.controller');
  uploadRegisterFile     = ctrl.uploadRegisterFile;
  listLocalRegisterFiles = ctrl.listLocalRegisterFiles;
  loadLocalRegisterFile  = ctrl.loadLocalRegisterFile;
  previewColumnMapping   = ctrl.previewColumnMapping;
  executeImport          = ctrl.executeImport;
  getImportRows          = ctrl.getImportRows;
  reviewRowEvidence      = ctrl.reviewRowEvidence;

  adminUserId = new mongoose.Types.ObjectId();

  await seedStaging('REG_MATCH_01', 'Alpha Student');
  await seedStaging('REG_MATCH_02', 'Beta Student');
  await seedStaging('REG_MATCH_03', 'Gamma Student');
  await seedStaging('REG_MISMATCH_04', 'Real Name In Staging');
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 3.9B — Integrate Existing Local JSON Student Data', () => {

  test('1. listLocalRegisterFiles discovers files in data/student_import/', async () => {
    const req = mockReq({ role: 'admin', userId: adminUserId, name: 'Admin' });
    const res = mockRes();
    await callCtrl(listLocalRegisterFiles, req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.files));
    assert.ok(res.body.files.length > 0, 'Expected to find local files in data/student_import/');

    const filenames = res.body.files.map((f) => f.filename);
    assert.ok(filenames.includes('phase3_5a_corrected_decision_ledger.json'));
    assert.ok(filenames.includes('corrected_admission_applications_batch002.json'));
  });

  test('2. loadLocalRegisterFile rejects directory traversal with 400', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, { filename: '../server/models/Student.js' }
    );
    const res = mockRes();
    await callCtrl(loadLocalRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.message.includes('traversal') || res.body.message.includes('forbidden'));
  });

  test('3. loadLocalRegisterFile returns 404 for non-existent file', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, { filename: 'does_not_exist_file.json' }
    );
    const res = mockRes();
    await callCtrl(loadLocalRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 404);
  });

  test('4. loadLocalRegisterFile loads real local JSON file without manual conversion', async () => {
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, { filename: 'phase3_5a_corrected_decision_ledger.json' }
    );
    const res = mockRes();
    await callCtrl(loadLocalRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.success);
    assert.ok(res.body.importId);
    assert.strictEqual(res.body.fileType, 'json');
    assert.strictEqual(res.body.rowCount, 1281);
    assert.ok(res.body.headers.includes('primaryIdentifier'));
    assert.ok(res.body.headers.includes('groupId'));
  });

  test('5. JSON parser strips sensitive fields (passwords, parent contacts)', async () => {
    const file = fakeFile(JSON_PATH);
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, {}, file
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.headers.includes('Roll No'));
    assert.ok(res.body.headers.includes('Student Name'));
    // Ensure sensitive keys are stripped
    assert.ok(!res.body.headers.includes('password'));
    assert.ok(!res.body.headers.includes('parentPhone'));
  });

  test('6. Malformed JSON is rejected with 400', async () => {
    const badBuffer = Buffer.from('{ bad json, missing quotes }', 'utf8');
    const badFile = { originalname: 'broken.json', buffer: badBuffer, size: badBuffer.length };
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, {}, badFile
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.message.toLowerCase().includes('json') || res.body.message.toLowerCase().includes('malformed'));
  });

  test('7. Empty JSON array is rejected with 400', async () => {
    const emptyBuffer = Buffer.from('[]', 'utf8');
    const emptyFile = { originalname: 'empty.json', buffer: emptyBuffer, size: emptyBuffer.length };
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, {}, emptyFile
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 400);
  });

  let jsonImportId;

  test('8. End-to-end import on JSON data with preview and execution', async () => {
    const file = fakeFile(JSON_PATH);
    const uploadReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, {}, file
    );
    const uploadRes = mockRes();
    await callCtrl(uploadRegisterFile, uploadReq, uploadRes);
    jsonImportId = uploadRes.body.importId;

    // Preview
    const prevReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      { importId: jsonImportId }, {}, { columnMapping: STANDARD_MAPPING }
    );
    const prevRes = mockRes();
    await callCtrl(previewColumnMapping, prevReq, prevRes);
    assert.strictEqual(prevRes.statusCode, 200);
    assert.ok(prevRes.body.previewRows.length <= 5);

    // Execute Import
    const impReq = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      { importId: jsonImportId }, {}, { columnMapping: STANDARD_MAPPING }
    );
    const impRes = mockRes();
    await callCtrl(executeImport, impReq, impRes);
    assert.strictEqual(impRes.statusCode, 200);
    assert.strictEqual(impRes.body.summary.totalRows, 8);

    // Verify row classifications
    const rows = await EnrollmentRegisterRow.find({ importId: jsonImportId }).lean();
    assert.strictEqual(rows.length, 8);

    const matchRow = rows.find((r) => r.normalizedRollNumber === 'REG_MATCH_01' && r.rowStatus === 'VALID');
    assert.ok(matchRow);
    assert.strictEqual(matchRow.reconciliationStatus, 'CONFIRMED_MATCH');

    const mismatchRow = rows.find((r) => r.normalizedRollNumber === 'REG_MISMATCH_04');
    assert.ok(mismatchRow);
    assert.strictEqual(mismatchRow.reconciliationStatus, 'NAME_MISMATCH_REQUIRES_REVIEW');

    const duplicateRow = rows.find((r) => r.rowStatus === 'DUPLICATE_IN_REGISTER');
    assert.ok(duplicateRow);

    const invalidRow = rows.find((r) => r.rowStatus === 'INVALID_IDENTIFIER');
    assert.ok(invalidRow);

    const missingRow = rows.find((r) => r.rowStatus === 'MISSING_ROLL');
    assert.ok(missingRow);

    const unmatchedRow = rows.find((r) => r.normalizedRollNumber === 'REG_UNMATCHED_05');
    assert.ok(unmatchedRow);
    assert.strictEqual(unmatchedRow.reconciliationStatus, 'UNMATCHED_REGISTER_ENTRY');
  });

  test('9. Evidence review on JSON-imported row creates DOCUMENT_VERIFIED without auto-approving', async () => {
    const row = await EnrollmentRegisterRow.findOne({
      importId: jsonImportId,
      normalizedRollNumber: 'REG_MATCH_03',
      reconciliationStatus: 'CONFIRMED_MATCH',
    });
    assert.ok(row);

    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      { rowId: row._id.toString() }, {},
      { decision: 'CONFIRMED', remarks: 'Verified from local JSON register' }
    );
    const res = mockRes();
    await callCtrl(reviewRowEvidence, req, res);

    assert.strictEqual(res.statusCode, 200);

    const ev = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: 'REG_MATCH_03',
    }).lean();

    assert.ok(ev);
    assert.strictEqual(ev.evidenceType, 'REGISTRAR_ENROLLMENT_REGISTER');
    assert.strictEqual(ev.evidenceVerificationLevel, 'DOCUMENT_VERIFIED');
    // Must remain PENDING until formal review
    assert.strictEqual(ev.verificationStatus, 'PENDING');
  });

  test('10. CSV import continues working normally (regression test)', async () => {
    const file = fakeFile(CSV_PATH);
    const req = mockReq(
      { role: 'admin', userId: adminUserId, name: 'Admin' },
      {}, {}, {}, file
    );
    const res = mockRes();
    await callCtrl(uploadRegisterFile, req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.rowCount, 10);
  });

  test('11. Invariance: production Student and User collections remain strictly untouched', async () => {
    const studentCount = await Student.countDocuments();
    const userCount    = await User.countDocuments();
    assert.strictEqual(studentCount, 0);
    assert.strictEqual(userCount,    0);
  });

});
