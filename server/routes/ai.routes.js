/**
 * server/routes/ai.routes.js
 * Secured AI Chat Endpoints.
 * Enforces mandatory authentication, role-based access control, and rate limiting.
 */
'use strict';

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const aiLimiter = require('../middleware/aiLimiter');

// Supported roles authorized to use the campus AI assistant
const SUPPORTED_AI_ROLES = ['student', 'faculty', 'admin'];

/**
 * POST /api/ai/chat
 * Secured AI assistant chat endpoint.
 * Pipeline:
 *  1. authMiddleware: validates JWT bearer token / cookie; populates req.user.
 *  2. allowRoles: ensures req.user.role is authorized (student, faculty, admin).
 *  3. aiLimiter: enforces per-user / per-IP request frequency caps (HTTP 429).
 *  4. aiController.chat: validates message payload and communicates with configured AI provider.
 */
router.post(
  '/chat',
  authMiddleware,
  allowRoles(...SUPPORTED_AI_ROLES),
  aiLimiter,
  aiController.chat
);

module.exports = router;
