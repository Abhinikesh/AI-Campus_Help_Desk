/**
 * server/controllers/enrollmentRegisterImport.controller.js
 *
 * Phase 3.9A — Official Enrollment Register Import & Reconciliation
 *
 * Implements the full admin-facing enrollment-register import workflow:
 *
 *   uploadRegisterFile      POST /staging/register/upload
 *   previewColumnMapping    POST /staging/register/preview/:importId
 *   executeImport           POST /staging/register/import/:importId
 *   getImportList           GET  /staging/register/imports
 *   getImportDetail         GET  /staging/register/imports/:importId
 *   getImportRows           GET  /staging/register/imports/:importId/rows
 *   getRowDetail            GET  /staging/register/rows/:rowId
 *   reviewRowEvidence       PATCH /staging/register/rows/:rowId/review
 *   deleteImport            DELETE /staging/register/imports/:importId
 *
 * Authorization: all endpoints require auth + admin role (enforced at router level).
 *
 * This controller NEVER writes to the production Student or User collections.
 * File contents are processed locally.  PII is never forwarded to external services.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');

const { EnrollmentRegisterImport, BATCH_ID: _BATCH_ID }
  = require('../models/EnrollmentRegisterImport');
const { EnrollmentRegisterRow }
  = require('../models/EnrollmentRegisterRow');
const { EnrollmentVerification }
  = require('../models/EnrollmentVerification');
const StudentStaging = require('../models/StudentStaging');

const BATCH_ID = 'BATCH-20261112-STAGING-003';
const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data/student_import');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a lightweight unique import identifier.
 * @returns {string}
 */
function generateImportId() {
  return `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Derive file type from the original filename extension.
 * @param {string} filename
 * @returns {'csv'|'xlsx'|'json'}
 */
function detectFileType(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.json')) return 'json';
  return 'csv';
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /credentials/i,
  /parent.*phone/i,
  /parent.*email/i,
  /parent.*name/i,
  /father.*name/i,
  /mother.*name/i,
  /marksheet.*url/i,
];

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function extractJsonRecords(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const candidateKeys = [
      'records',
      'candidateIdentityGroups',
      'students',
      'enrollment',
      'items',
      'data',
    ];
    for (const key of candidateKeys) {
      if (Array.isArray(data[key])) return data[key];
    }
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
        return data[key];
      }
    }
  }
  return [];
}

function extractJsonRowsAndHeaders(parsedJson) {
  const records = extractJsonRecords(parsedJson);
  if (!records || records.length === 0) {
    throw new ApiError(400, 'JSON file contains no student records array.');
  }

  const headerSet = new Set();
  const rawRows = [];

  for (const item of records) {
    if (!item || typeof item !== 'object') continue;
    const row = {};
    for (const [k, v] of Object.entries(item)) {
      if (isSensitiveKey(k)) continue;
      if (v === null || v === undefined) {
        row[k] = '';
        headerSet.add(k);
      } else if (typeof v !== 'object') {
        row[k] = String(v).trim();
        headerSet.add(k);
      }
    }
    rawRows.push(row);
  }

  const headers = Array.from(headerSet);
  if (headers.length === 0) {
    throw new ApiError(400, 'Could not detect any valid column headers in JSON records.');
  }

  const rows = rawRows.map((r) => {
    const fullRow = {};
    let hasValue = false;
    for (const h of headers) {
      const val = r[h] !== undefined && r[h] !== null ? String(r[h]).trim() : '';
      fullRow[h] = val;
      if (val !== '') hasValue = true;
    }
    return hasValue ? fullRow : null;
  }).filter(Boolean);

  if (rows.length === 0) {
    throw new ApiError(400, 'JSON file contains no populated data rows.');
  }

  return { headers, rows };
}

/**
 * Parse a file buffer (CSV, XLSX, or JSON).
 * Returns { headers: string[], rows: Object[] }
 *
 * Each row object is keyed by header value.
 * Empty rows are discarded.
 *
 * @param {Buffer} buffer
 * @param {'csv'|'xlsx'|'json'} fileType
 * @returns {{ headers: string[], rows: Object[] }}
 */
function parseFileBuffer(buffer, fileType) {
  if (fileType === 'json') {
    let parsedJson;
    try {
      parsedJson = JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      throw new ApiError(400, `Malformed JSON: ${err.message}`);
    }
    return extractJsonRowsAndHeaders(parsedJson);
  }

  const opts = fileType === 'csv'
    ? { type: 'buffer', raw: false, codepage: 65001 }
    : { type: 'buffer', raw: false };

  const workbook = XLSX.read(buffer, opts);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ApiError(400, 'Uploaded file contains no sheets.');

  const sheet = workbook.Sheets[sheetName];

  // sheet_to_json with header:1 gives arrays of raw values
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) throw new ApiError(400, 'Uploaded file is empty.');

  // First row is the header
  const headers = rawRows[0].map((h) => String(h).trim()).filter((h) => h !== '');
  if (headers.length === 0) throw new ApiError(400, 'Could not detect column headers in the uploaded file.');

  // Build rows as objects keyed by header
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row = {};
    let hasValue = false;
    headers.forEach((h, idx) => {
      const v = raw[idx] !== undefined && raw[idx] !== null ? String(raw[idx]).trim() : '';
      row[h] = v;
      if (v !== '') hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return { headers, rows };
}

/**
 * Normalize a roll number string: uppercase + trim whitespace.
 * @param {string} raw
 * @returns {string}
 */
function normalizeRollNumber(raw) {
  return (raw || '').toUpperCase().trim();
}

/**
 * Normalize a student name: lowercase + trim + collapse internal spaces.
 * @param {string} raw
 * @returns {string}
 */
function normalizeName(raw) {
  return (raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Heuristic: does this string look like a 10-digit phone number?
 * Used to detect accidentally mapped phone numbers as roll identifiers.
 * @param {string} val
 * @returns {boolean}
 */
function looksLikePhoneNumber(val) {
  return /^\+?[\d\s\-().]{10,15}$/.test(val) && /\d{10}/.test(val.replace(/\D/g, ''));
}

/**
 * Simple name-match heuristic.
 * Returns 'match', 'mismatch', or 'unknown' (when either name is absent).
 * @param {string} registerName
 * @param {string} stagingName
 * @returns {'match'|'mismatch'|'unknown'}
 */
function nameMatchResult(registerName, stagingName) {
  const a = normalizeName(registerName);
  const b = normalizeName(stagingName);
  if (!a || !b) return 'unknown';

  // If the full normalized strings match, it's a match
  if (a === b) return 'match';

  // Compare first words (first names)
  const aFirst = a.split(' ')[0];
  const bFirst = b.split(' ')[0];
  if (aFirst && bFirst && aFirst === bFirst) return 'match';

  return 'mismatch';
}

/**
 * Extract the acting admin's ID from req.user.
 * @param {object} user
 * @returns {string|null}
 */
function actorId(user) {
  return (user && (user.userId || user._id || user.id)) || null;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /staging/register/upload
 *
 * Receives a CSV or XLSX file (via multer memory storage, field name "file"),
 * extracts column headers, and creates a PENDING_MAPPING import session.
 *
 * Returns: { importId, headers, rowCount, filename }
 */
const uploadRegisterFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Send the file as multipart/form-data field "file".');
  }

  const { originalname, buffer, size } = req.file;
  if (size > 10 * 1024 * 1024) {
    throw new ApiError(400, 'File exceeds the 10 MB size limit.');
  }

  const fileType = detectFileType(originalname);

  let parsed;
  try {
    parsed = parseFileBuffer(buffer, fileType);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, `Could not parse uploaded file: ${err.message}`);
  }

  const { headers, rows } = parsed;
  const importId = generateImportId();

  const adminId   = actorId(req.user);
  const adminName = req.user.name || req.user.email || '';

  const importRecord = new EnrollmentRegisterImport({
    batchId:             BATCH_ID,
    importId,
    sourceFilename:      originalname,
    sourceFileType:      fileType,
    detectedHeaders:     headers,
    fileBuffer:          buffer,           // stored for preview; cleared after import
    importedByAdminId:   adminId,
    importedByAdminName: adminName,
    status:              'PENDING_MAPPING',
  });

  await importRecord.save();

  res.status(201).json({
    success: true,
    importId,
    headers,
    rowCount: rows.length,
    filename: originalname,
  });
});

/**
 * POST /staging/register/preview/:importId
 *
 * Body: { columnMapping: { rollNumber, studentName, program, branch, semester, section, academicYear, registrationId } }
 *
 * Re-reads the stored buffer and applies the column mapping to return
 * the first 5 data rows in canonical form for admin review before committing.
 *
 * Returns: { previewRows: [...], headers, columnMapping }
 */
const previewColumnMapping = asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const { columnMapping } = req.body || {};

  if (!columnMapping || !columnMapping.rollNumber) {
    throw new ApiError(400, 'columnMapping.rollNumber is required for preview.');
  }

  const importRecord = await EnrollmentRegisterImport.findOne({ importId });
  if (!importRecord) throw new ApiError(404, 'Import session not found.');
  if (importRecord.status === 'CANCELLED') throw new ApiError(409, 'Import session is cancelled.');
  if (!importRecord.fileBuffer) {
    throw new ApiError(409, 'File buffer has been cleared. Please upload the file again.');
  }

  let parsed;
  try {
    parsed = parseFileBuffer(importRecord.fileBuffer, importRecord.sourceFileType);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, `Could not re-parse file: ${err.message}`);
  }

  const { rows } = parsed;
  const preview = rows.slice(0, 5).map((row, idx) => ({
    row: idx + 1,
    rollNumber:     (row[columnMapping.rollNumber]     || '').trim(),
    studentName:    (row[columnMapping.studentName]    || '').trim(),
    program:        (row[columnMapping.program]        || '').trim(),
    branch:         (row[columnMapping.branch]         || '').trim(),
    semester:       (row[columnMapping.semester]       || '').trim(),
    section:        (row[columnMapping.section]        || '').trim(),
    academicYear:   (row[columnMapping.academicYear]   || '').trim(),
    registrationId: (row[columnMapping.registrationId] || '').trim(),
  }));

  res.json({
    success: true,
    previewRows: preview,
    headers: importRecord.detectedHeaders,
    columnMapping,
    totalRows: rows.length,
  });
});

/**
 * POST /staging/register/import/:importId
 *
 * Body: { columnMapping: { rollNumber, studentName, ... } }
 *
 * Parses all rows using the given column mapping, validates each row,
 * detects intra-register duplicates, inserts EnrollmentRegisterRow documents,
 * runs reconciliation against Batch 003 staging, and updates the import summary.
 *
 * Idempotency: once status is IMPORTED the endpoint rejects subsequent calls.
 *
 * Returns: import summary object.
 */
const executeImport = asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const { columnMapping } = req.body || {};

  if (!columnMapping || !columnMapping.rollNumber) {
    throw new ApiError(400, 'columnMapping.rollNumber is required.');
  }

  const importRecord = await EnrollmentRegisterImport.findOne({ importId });
  if (!importRecord) throw new ApiError(404, 'Import session not found.');
  if (importRecord.status === 'IMPORTED') {
    throw new ApiError(409, 'This import has already been executed. Create a new upload to re-import.');
  }
  if (importRecord.status === 'CANCELLED') {
    throw new ApiError(409, 'Import session is cancelled.');
  }
  if (!importRecord.fileBuffer) {
    throw new ApiError(409, 'File buffer unavailable. Please upload the file again.');
  }

  let parsed;
  try {
    parsed = parseFileBuffer(importRecord.fileBuffer, importRecord.sourceFileType);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, `Could not parse file: ${err.message}`);
  }

  const { rows } = parsed;

  // ── Pass 1: validate rows and detect intra-register duplicates ────────────
  const seenRolls = new Map(); // normalizedRoll → sourceRow (1-based)
  const processedRows = rows.map((row, idx) => {
    const sourceRow = idx + 1;
    const rawRoll   = (row[columnMapping.rollNumber]     || '').trim();
    const rawName   = (row[columnMapping.studentName]    || '').trim();
    const normRoll  = normalizeRollNumber(rawRoll);
    const normName  = normalizeName(rawName);

    let rowStatus       = 'VALID';
    let rowStatusReason = '';

    if (!normRoll) {
      rowStatus       = 'MISSING_ROLL';
      rowStatusReason = 'Roll number column is empty.';
    } else if (looksLikePhoneNumber(normRoll)) {
      rowStatus       = 'INVALID_IDENTIFIER';
      rowStatusReason = 'Identifier appears to be a phone number, not a roll number.';
    } else if (seenRolls.has(normRoll)) {
      rowStatus       = 'DUPLICATE_IN_REGISTER';
      rowStatusReason = `Duplicate roll number; first seen at row ${seenRolls.get(normRoll)}.`;
    }

    if (rowStatus === 'VALID') seenRolls.set(normRoll, sourceRow);

    return {
      importId,
      batchId:          BATCH_ID,
      sourceRow,
      rawRollNumber:    rawRoll,
      rawStudentName:   rawName,
      rawProgram:       (row[columnMapping.program]        || '').trim(),
      rawBranch:        (row[columnMapping.branch]         || '').trim(),
      rawSemester:      (row[columnMapping.semester]       || '').trim(),
      rawSection:       (row[columnMapping.section]        || '').trim(),
      rawAcademicYear:  (row[columnMapping.academicYear]   || '').trim(),
      rawRegistrationId:(row[columnMapping.registrationId] || '').trim(),
      normalizedRollNumber:  normRoll,
      normalizedStudentName: normName,
      rowStatus,
      rowStatusReason,
      reconciliationStatus: rowStatus !== 'VALID' ? 'INVALID_IDENTIFIER' : 'PENDING',
    };
  });

  // ── Pass 2: reconcile VALID rows against Batch 003 staging ───────────────
  const validRows = processedRows.filter((r) => r.rowStatus === 'VALID');
  const rollNumbers = [...new Set(validRows.map((r) => r.normalizedRollNumber).filter(Boolean))];

  // Bulk-fetch staging records for the detected roll numbers
  const stagingRecords = await StudentStaging.find(
    { batchId: BATCH_ID, normalizedRollNumber: { $in: rollNumbers } },
    { normalizedRollNumber: 1, studentName: 1, _id: 1 }
  ).lean();

  // Index by normalizedRollNumber (take first match per roll, prefer Student Master)
  const stagingByRoll = new Map();
  for (const s of stagingRecords) {
    if (s.normalizedRollNumber && !stagingByRoll.has(s.normalizedRollNumber)) {
      stagingByRoll.set(s.normalizedRollNumber, s);
    }
  }

  for (const r of processedRows) {
    if (r.rowStatus !== 'VALID') continue;
    const staging = stagingByRoll.get(r.normalizedRollNumber);
    if (!staging) {
      r.reconciliationStatus = 'UNMATCHED_REGISTER_ENTRY';
    } else {
      const matchResult = nameMatchResult(r.rawStudentName, staging.studentName || '');
      if (matchResult === 'mismatch') {
        r.reconciliationStatus      = 'NAME_MISMATCH_REQUIRES_REVIEW';
        r.matchedStagingId          = staging._id;
        r.matchedStagingRollNumber  = staging.normalizedRollNumber;
        r.matchedStagingName        = staging.studentName;
      } else {
        // 'match' or 'unknown' (name absent in register or staging → treat as match)
        r.reconciliationStatus      = 'CONFIRMED_MATCH';
        r.matchedStagingId          = staging._id;
        r.matchedStagingRollNumber  = staging.normalizedRollNumber;
        r.matchedStagingName        = staging.studentName;
      }
    }
  }

  // ── Insert all rows ────────────────────────────────────────────────────────
  // Delete any stale rows from a previous partial run (safety measure)
  await EnrollmentRegisterRow.deleteMany({ importId });
  await EnrollmentRegisterRow.insertMany(processedRows, { ordered: false });

  // ── Compute summary counts ─────────────────────────────────────────────────
  const totalRows          = processedRows.length;
  const acceptedRows       = processedRows.filter((r) => r.rowStatus === 'VALID').length;
  const rejectedRows       = processedRows.filter((r) => ['MISSING_ROLL', 'INVALID_IDENTIFIER'].includes(r.rowStatus)).length;
  const duplicateRows      = processedRows.filter((r) => r.rowStatus === 'DUPLICATE_IN_REGISTER').length;
  const confirmedMatchRows = processedRows.filter((r) => r.reconciliationStatus === 'CONFIRMED_MATCH').length;
  const reviewRows         = processedRows.filter((r) => r.reconciliationStatus === 'NAME_MISMATCH_REQUIRES_REVIEW').length;
  const unmatchedRows      = processedRows.filter((r) => r.reconciliationStatus === 'UNMATCHED_REGISTER_ENTRY').length;

  // ── Update import record ───────────────────────────────────────────────────
  importRecord.status         = 'IMPORTED';
  importRecord.columnMapping  = columnMapping;
  importRecord.totalRows      = totalRows;
  importRecord.acceptedRows   = acceptedRows;
  importRecord.rejectedRows   = rejectedRows;
  importRecord.duplicateRows  = duplicateRows;
  importRecord.confirmedMatchRows = confirmedMatchRows;
  importRecord.reviewRows     = reviewRows;
  importRecord.unmatchedRows  = unmatchedRows;
  // Clear the file buffer — no longer needed and avoids long-term PII storage
  importRecord.fileBuffer     = undefined;
  await importRecord.save();

  res.json({
    success: true,
    importId,
    summary: {
      totalRows,
      acceptedRows,
      rejectedRows,
      duplicateRows,
      confirmedMatchRows,
      reviewRows,
      unmatchedRows,
    },
  });
});

/**
 * GET /staging/register/imports
 *
 * Paginated list of all enrollment register imports for Batch 003.
 * Query params: page (default 1), limit (default 20).
 */
const getImportList = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip  = (page - 1) * limit;

  const [imports, total] = await Promise.all([
    EnrollmentRegisterImport.find({ batchId: BATCH_ID }, { fileBuffer: 0 })
      .sort({ importedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EnrollmentRegisterImport.countDocuments({ batchId: BATCH_ID }),
  ]);

  res.json({
    success: true,
    imports,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /staging/register/imports/:importId
 *
 * Returns the import session header record (without fileBuffer).
 */
const getImportDetail = asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const record = await EnrollmentRegisterImport.findOne({ importId }, { fileBuffer: 0 }).lean();
  if (!record) throw new ApiError(404, 'Import session not found.');
  res.json({ success: true, import: record });
});

/**
 * GET /staging/register/imports/:importId/rows
 *
 * Paginated list of EnrollmentRegisterRow records for a given import.
 * Query params: status (reconciliationStatus filter), page, limit.
 */
const getImportRows = asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip   = (page - 1) * limit;
  const status = req.query.status || null;

  // Verify the import exists
  const importRecord = await EnrollmentRegisterImport.findOne({ importId }, { _id: 1 }).lean();
  if (!importRecord) throw new ApiError(404, 'Import session not found.');

  const filter = { importId };
  if (status) filter.reconciliationStatus = status;

  const [rows, total] = await Promise.all([
    EnrollmentRegisterRow.find(filter)
      .sort({ sourceRow: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EnrollmentRegisterRow.countDocuments(filter),
  ]);

  res.json({
    success: true,
    rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /staging/register/rows/:rowId
 *
 * Returns a single EnrollmentRegisterRow with matched staging record detail.
 */
const getRowDetail = asyncHandler(async (req, res) => {
  const { rowId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(rowId)) {
    throw new ApiError(400, 'Invalid row ID.');
  }

  const row = await EnrollmentRegisterRow.findById(rowId).lean();
  if (!row) throw new ApiError(404, 'Row not found.');

  let stagingDetail = null;
  if (row.matchedStagingId) {
    stagingDetail = await StudentStaging.findById(row.matchedStagingId, {
      normalizedRollNumber: 1, studentName: 1, sourceSheet: 1, reviewStatus: 1, _id: 1,
    }).lean();
  }

  res.json({ success: true, row, stagingDetail });
});

/**
 * PATCH /staging/register/rows/:rowId/review
 *
 * Body: { decision: 'CONFIRMED' | 'REJECTED', remarks: string }
 *
 * Records an admin evidence-review decision on a register row.
 *
 * When decision is CONFIRMED:
 *  - Creates or updates an EnrollmentVerification record for the student
 *    with evidenceType REGISTRAR_ENROLLMENT_REGISTER and
 *    evidenceVerificationLevel DOCUMENT_VERIFIED.
 *  - Does NOT automatically set verificationStatus to VERIFIED —
 *    that remains a separate Phase 3.7 admin action.
 *
 * When decision is REJECTED:
 *  - Records the rejection with remarks.
 *
 * Only rows with reconciliationStatus CONFIRMED_MATCH or
 * NAME_MISMATCH_REQUIRES_REVIEW may be reviewed.
 */
const reviewRowEvidence = asyncHandler(async (req, res) => {
  const { rowId } = req.params;
  const { decision, remarks } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(rowId)) {
    throw new ApiError(400, 'Invalid row ID.');
  }
  if (!['CONFIRMED', 'REJECTED'].includes(decision)) {
    throw new ApiError(400, 'decision must be "CONFIRMED" or "REJECTED".');
  }

  const row = await EnrollmentRegisterRow.findById(rowId);
  if (!row) throw new ApiError(404, 'Row not found.');

  if (!['CONFIRMED_MATCH', 'NAME_MISMATCH_REQUIRES_REVIEW'].includes(row.reconciliationStatus)) {
    throw new ApiError(
      409,
      `Row reconciliation status is "${row.reconciliationStatus}". Only CONFIRMED_MATCH and NAME_MISMATCH_REQUIRES_REVIEW rows can be reviewed.`
    );
  }

  const adminId   = actorId(req.user);
  const adminName = req.user.name || req.user.email || '';
  const now = new Date();

  row.evidenceReviewStatus  = decision;
  row.reviewedByAdminId     = adminId;
  row.reviewedByAdminName   = adminName;
  row.reviewedAt            = now;
  row.reviewRemarks         = remarks || '';

  if (decision === 'CONFIRMED') {
    // Upsert an EnrollmentVerification for this roll number
    const normalizedRoll = row.normalizedRollNumber;
    const evidenceRef = row.rawRegistrationId
      ? row.rawRegistrationId
      : `REG-ROW-${row.sourceRow}-${row.importId}`;

    const auditEntry = {
      action:                   'EVIDENCE_RECORDED',
      actorId:                  adminId,
      actorName:                adminName,
      actorRole:                'admin',
      evidenceType:             'REGISTRAR_ENROLLMENT_REGISTER',
      evidenceReference:        evidenceRef,
      evidenceVerificationLevel:'DOCUMENT_VERIFIED',
      remarks: remarks || `Confirmed via enrollment register import ${row.importId}, row ${row.sourceRow}.`,
      timestamp: now,
    };

    const ev = await EnrollmentVerification.findOneAndUpdate(
      { batchId: BATCH_ID, normalizedRollNumber: normalizedRoll },
      {
        $setOnInsert: {
          batchId:              BATCH_ID,
          normalizedRollNumber: normalizedRoll,
          studentName:          row.rawStudentName || null,
          stagingId:            row.matchedStagingId || null,
          verificationStatus:   'PENDING',   // NOT auto-approved
        },
        $set: {
          evidenceType:              'REGISTRAR_ENROLLMENT_REGISTER',
          evidenceReference:         evidenceRef,
          evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
          reviewerAdminId:           adminId,
          reviewerAdminName:         adminName,
          reviewerRemarks:           remarks || '',
        },
        $push: { auditHistory: auditEntry },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    row.linkedVerificationId = ev._id;
  }

  await row.save();

  res.json({
    success: true,
    rowId,
    decision,
    evidenceReviewStatus: row.evidenceReviewStatus,
    linkedVerificationId: row.linkedVerificationId || null,
    message: decision === 'CONFIRMED'
      ? 'Evidence confirmed. EnrollmentVerification updated with DOCUMENT_VERIFIED evidence. Run the Enrollment Verification workflow to set status to VERIFIED.'
      : 'Row evidence rejected.',
  });
});

/**
 * DELETE /staging/register/imports/:importId
 *
 * Cancels an import session that is still in PENDING_MAPPING status.
 * Deletes the import record and any associated rows.
 * Once an import is IMPORTED it cannot be deleted (data integrity).
 */
const deleteImport = asyncHandler(async (req, res) => {
  const { importId } = req.params;

  const importRecord = await EnrollmentRegisterImport.findOne({ importId });
  if (!importRecord) throw new ApiError(404, 'Import session not found.');

  if (importRecord.status === 'IMPORTED') {
    throw new ApiError(
      409,
      'Cannot delete an import that has already been executed. Mark it as cancelled instead.'
    );
  }

  await EnrollmentRegisterRow.deleteMany({ importId });
  await EnrollmentRegisterImport.deleteOne({ importId });

  res.json({ success: true, message: `Import session ${importId} deleted.` });
});

/**
 * GET /staging/register/local-files
 *
 * Lists available data files in data/student_import/ for direct import.
 */
const listLocalRegisterFiles = asyncHandler(async (req, res) => {
  let entries = [];
  try {
    entries = await fs.promises.readdir(LOCAL_DATA_DIR, { withFileTypes: true });
  } catch {
    return res.json({ success: true, files: [] });
  }

  const allowedExts = new Set(['.json', '.csv', '.xlsx', '.xls']);
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExts.has(ext)) continue;
    if (entry.name.startsWith('.')) continue;

    try {
      const stats = await fs.promises.stat(path.join(LOCAL_DATA_DIR, entry.name));
      files.push({
        filename: entry.name,
        size: stats.size,
        fileType: detectFileType(entry.name),
        modifiedAt: stats.mtime,
      });
    } catch {
      // skip
    }
  }

  res.json({ success: true, files });
});

/**
 * POST /staging/register/load-local
 *
 * Body: { filename: string }
 *
 * Loads an existing file directly from data/student_import/ without requiring user upload.
 * Validates against directory traversal and creates an EnrollmentRegisterImport session.
 */
const loadLocalRegisterFile = asyncHandler(async (req, res) => {
  const { filename } = req.body || {};
  if (!filename || typeof filename !== 'string') {
    throw new ApiError(400, 'filename is required.');
  }

  const cleanFilename = path.basename(filename.trim());
  if (cleanFilename !== filename.trim()) {
    throw new ApiError(400, 'Invalid filename: directory traversal is forbidden.');
  }

  const allowedExts = new Set(['.json', '.csv', '.xlsx', '.xls']);
  const ext = path.extname(cleanFilename).toLowerCase();
  if (!allowedExts.has(ext)) {
    throw new ApiError(400, `Unsupported file extension: ${ext}`);
  }

  const fullPath = path.join(LOCAL_DATA_DIR, cleanFilename);
  if (!fs.existsSync(fullPath)) {
    throw new ApiError(404, `File "${cleanFilename}" not found in local student_import directory.`);
  }

  const buffer = await fs.promises.readFile(fullPath);
  if (buffer.length > 15 * 1024 * 1024) {
    throw new ApiError(400, 'File exceeds size limit of 15 MB.');
  }

  const fileType = detectFileType(cleanFilename);
  let parsed;
  try {
    parsed = parseFileBuffer(buffer, fileType);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, `Could not parse local file: ${err.message}`);
  }

  const { headers, rows } = parsed;
  const importId = generateImportId();
  const adminId   = actorId(req.user);
  const adminName = req.user.name || req.user.email || '';

  const importRecord = new EnrollmentRegisterImport({
    batchId:             BATCH_ID,
    importId,
    sourceFilename:      cleanFilename,
    sourceFileType:      fileType,
    detectedHeaders:     headers,
    fileBuffer:          buffer,
    importedByAdminId:   adminId,
    importedByAdminName: adminName,
    status:              'PENDING_MAPPING',
    summaryNotes:        `Loaded from local student_import: ${cleanFilename}`,
  });

  await importRecord.save();

  res.status(201).json({
    success: true,
    importId,
    headers,
    rowCount: rows.length,
    filename: cleanFilename,
    fileType,
    isLocal: true,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  uploadRegisterFile,
  listLocalRegisterFiles,
  loadLocalRegisterFile,
  previewColumnMapping,
  executeImport,
  getImportList,
  getImportDetail,
  getImportRows,
  getRowDetail,
  reviewRowEvidence,
  deleteImport,
};

