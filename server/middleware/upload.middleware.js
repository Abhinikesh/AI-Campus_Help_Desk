/**
 * server/middleware/upload.middleware.js
 *
 * Phase 3.9A — Multer memory-storage configuration for enrollment register
 * file uploads.
 *
 * Files are kept in memory (never written to disk) and size is capped at 10 MB.
 * Only CSV and XLSX/XLS files are accepted.
 */
'use strict';

const multer = require('multer');
const path   = require('path');

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.json']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error('Only CSV, XLSX, and JSON files are allowed.'), { status: 400 }),
        false
      );
    }
  },
});

module.exports = upload;

