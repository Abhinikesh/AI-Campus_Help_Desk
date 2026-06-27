const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, admissionLogin, admissionInquiry } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/admission-login (legacy — returns 410)
router.post('/admission-login', admissionLogin);

// POST /api/auth/admission-inquiry (public — no auth)
router.post('/admission-inquiry', admissionInquiry);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me  (protected)
router.get('/me', authMiddleware, getMe);

module.exports = router;
