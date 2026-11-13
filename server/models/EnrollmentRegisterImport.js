/**
 * server/models/EnrollmentRegisterImport.js
 *
 * Phase 3.9A — Official Enrollment Register Import & Reconciliation
 *
 * Records one file-import session for an official enrollment register uploaded
 * by an Administrator.  The file buffer is kept temporarily so that the
 * column-mapping preview can re-read it without requiring a second upload.
 * Once the import is executed (status → IMPORTED) the buffer may be cleared.
 *
 * This collection never touches the production Student or User collections.
 */
'use strict';

const mongoose = require('mongoose');

const BATCH_ID = 'BATCH-20261112-STAGING-003';

const IMPORT_STATUSES = ['PENDING_MAPPING', 'MAPPED', 'IMPORTED', 'CANCELLED'];
const FILE_TYPES      = ['csv', 'xlsx'];

/**
 * Column-mapping sub-document.
 * Keys are canonical field names; values are the original spreadsheet column
 * headers chosen by the administrator.
 */
const columnMappingSchema = new mongoose.Schema(
  {
    rollNumber:     { type: String, default: null },  // required before import
    studentName:    { type: String, default: null },
    program:        { type: String, default: null },
    branch:         { type: String, default: null },
    semester:       { type: String, default: null },
    section:        { type: String, default: null },
    academicYear:   { type: String, default: null },
    registrationId: { type: String, default: null },  // any extra identifier column
  },
  { _id: false }
);

const enrollmentRegisterImportSchema = new mongoose.Schema(
  {
    // ── Identification ────────────────────────────────────────────────────────
    batchId: {
      type: String,
      required: true,
      default: BATCH_ID,
      enum: [BATCH_ID],
    },
    /** Unique opaque identifier generated at upload time. */
    importId: {
      type: String,
      required: true,
      unique: true,
    },

    // ── Source file metadata ───────────────────────────────────────────────────
    sourceFilename:  { type: String, required: true },
    sourceFileType:  { type: String, enum: FILE_TYPES, required: true },

    /**
     * Detected column headers from the first row of the uploaded file.
     * Stored so the UI can populate the mapping dropdowns without re-upload.
     */
    detectedHeaders: { type: [String], default: [] },

    /**
     * Raw file buffer — stored temporarily to support column-mapping preview.
     * Cleared after the import is executed to avoid long-term PII storage.
     */
    fileBuffer: { type: Buffer, default: null },

    // ── Admin who uploaded the file ───────────────────────────────────────────
    importedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    importedByAdminName: { type: String, default: '' },
    importedAt: { type: Date, default: () => new Date() },

    // ── Workflow status ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: IMPORT_STATUSES,
      default: 'PENDING_MAPPING',
    },

    /** Column mapping chosen by the administrator. */
    columnMapping: { type: columnMappingSchema, default: () => ({}) },

    // ── Summary counts (populated after executeImport) ────────────────────────
    totalRows:          { type: Number, default: 0 },
    acceptedRows:       { type: Number, default: 0 },
    rejectedRows:       { type: Number, default: 0 },
    duplicateRows:      { type: Number, default: 0 },
    unmatchedRows:      { type: Number, default: 0 },
    confirmedMatchRows: { type: Number, default: 0 },
    reviewRows:         { type: Number, default: 0 },

    summaryNotes: { type: String, default: '' },
  },
  {
    timestamps: true,
    autoIndex: false,
    autoCreate: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

enrollmentRegisterImportSchema.index(
  { importId: 1 },
  { unique: true, name: 'eri_importId_unique' }
);
enrollmentRegisterImportSchema.index({ batchId: 1 },        { name: 'eri_batchId' });
enrollmentRegisterImportSchema.index({ importedAt: -1 },    { name: 'eri_importedAt' });
enrollmentRegisterImportSchema.index({ status: 1 },         { name: 'eri_status' });
enrollmentRegisterImportSchema.index({ importedByAdminId: 1 }, { name: 'eri_admin' });

// ── Export ────────────────────────────────────────────────────────────────────

const EnrollmentRegisterImport = mongoose.model(
  'EnrollmentRegisterImport',
  enrollmentRegisterImportSchema
);

module.exports = { EnrollmentRegisterImport, BATCH_ID, IMPORT_STATUSES, FILE_TYPES };

