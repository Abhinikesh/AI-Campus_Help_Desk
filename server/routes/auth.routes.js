/**
 * server/routes/auth.routes.js
 */
'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, logout, getMe, changePassword } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Rate limit on login endpoint — allows testing in dev/test, strict 10 attempts in production
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me (protected)
router.get('/me', authMiddleware, getMe);

// POST /api/auth/change-password (protected)
router.post('/change-password', authMiddleware, changePassword);

module.exports = router;
