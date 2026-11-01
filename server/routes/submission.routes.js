/**
 * server/routes/submission.routes.js
 * Dedicated routing alias for submissions: evaluations, grade publishing, and file downloads.
 */
'use strict';

const express = require('express');
const router = express.Router();

const {
  evaluateSubmission,
  publishSubmissionResult,
  downloadSubmissionFile,
} = require('../controllers/assignment.controller');

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

router.use(authMiddleware);

router.post('/:id/evaluate', allowRoles('faculty', 'admin'), evaluateSubmission);
router.post('/:id/publish-result', allowRoles('faculty', 'admin'), publishSubmissionResult);
router.get('/:submissionId/files/:fileId', downloadSubmissionFile);
router.get('/:id/files/:fileId', downloadSubmissionFile);

module.exports = router;

