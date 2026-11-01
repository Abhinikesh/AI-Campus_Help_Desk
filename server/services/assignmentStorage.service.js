/**
 * server/services/assignmentStorage.service.js
 * Dedicated, secure file upload and authorized download pipeline for assignments and submissions.
 */
'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const BASE_UPLOAD_DIR = path.resolve(__dirname, '../uploads/assignments');
const ATTACHMENTS_DIR = path.join(BASE_UPLOAD_DIR, 'attachments');
const SUBMISSIONS_DIR = path.join(BASE_UPLOAD_DIR, 'submissions');

// Ensure storage directories exist
[ATTACHMENTS_DIR, SUBMISSIONS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'image/jpeg',
  'image/png',
  'application/octet-stream',
]);

// Custom storage engine for attachments
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

// Custom storage engine for submissions
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SUBMISSIONS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new ApiError(
        400,
        `File extension '${ext}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`
      ),
      false
    );
  }

  // Basic MIME check
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new ApiError(400, `File MIME type '${file.mimetype}' is not permitted.`), false);
  }

  cb(null, true);
};

// Multer upload instances
const uploadAttachment = multer({
  storage: attachmentStorage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

const uploadSubmission = multer({
  storage: submissionStorage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

/**
 * Validates that an absolute file path is safely contained within the allowed base upload directory.
 * Prevents Directory Traversal attacks (e.g. ../../etc/passwd).
 */
function verifySafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(BASE_UPLOAD_DIR)) {
    throw new ApiError(403, 'Path traversal detected: Access denied to outside storage directory');
  }
  return resolved;
}

module.exports = {
  uploadAttachment,
  uploadSubmission,
  verifySafePath,
  ATTACHMENTS_DIR,
  SUBMISSIONS_DIR,
  BASE_UPLOAD_DIR,
  ALLOWED_EXTENSIONS,
};

