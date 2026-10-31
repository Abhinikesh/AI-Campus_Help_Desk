/**
 * server/controllers/auth.controller.js
 * All authentication for the CampusSphere ERP.
 * Every user must come from MongoDB — no demo/hardcoded accounts.
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// ── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_REDIRECTS = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin:   '/admin/dashboard',
};

const generateToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const setCookieToken = (res, token) => {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  res.cookie('campus_token', token, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
};

// ── LOGIN ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { loginId, password, role }
 *   - Students:  loginId = roll number
 *   - Faculty:   loginId = employee ID
 *   - Admin:     loginId = admin login ID (e.g. "ADMIN001")
 */
const login = asyncHandler(async (req, res) => {
  const { loginId, password, role } = req.body;
  console.log(`👉 Login attempt received: loginId="${loginId}", role="${role}", passwordLength=${password?.length}`);

  if (!loginId || !password || !role) {
    throw new ApiError(400, 'loginId, password, and role are required');
  }

  if (!ROLE_REDIRECTS[role]) {
    throw new ApiError(400, 'Invalid role');
  }

  // Find user by loginId AND role (prevents cross-role login)
  const user = await User.findOne({ loginId: loginId.trim(), role }).select('+passwordHash');

  if (!user) {
    console.log(`❌ Login failed: User not found for loginId="${loginId}", role="${role}"`);
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    console.log(`❌ Login failed: Account deactivated for loginId="${loginId}"`);
    throw new ApiError(403, 'Your account has been deactivated. Please contact admin.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    // Check if trimmed password matches (common autocomplete/paste issue)
    const isTrimmedMatch = await bcrypt.compare(password.trim(), user.passwordHash);
    if (isTrimmedMatch) {
      console.log(`⚠️ Password matched after trimming trailing/leading whitespace!`);
    } else {
      console.log(`❌ Login failed: Password mismatch for user ${user.loginId}`);
      throw new ApiError(401, 'Invalid credentials');
    }
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user);
  setCookieToken(res, token);

  console.log(`✅ Login: ${loginId} [${role}]`);

  return res.status(200).json({
    success: true,
    data: {
      token,
      role:       user.role,
      name:       user.name,
      redirectTo: ROLE_REDIRECTS[user.role],
      mustChangePassword: user.mustChangePassword,
    },
    message: 'Login successful',
  });
});

// ── LOGOUT ───────────────────────────────────────────────────────────────────

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('campus_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production',
  });
  return res.status(200).json({ success: true, data: null, message: 'Logged out successfully' });
});

// ── GET ME ────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('-__v');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return res.status(200).json({
    success: true,
    data: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      loginId: user.loginId,
      role:  user.role,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
    },
    message: 'OK',
  });
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  const user = await User.findById(req.user.userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await user.save();

  return res.status(200).json({
    success: true,
    data: null,
    message: 'Password changed successfully',
  });
});

module.exports = { login, logout, getMe, changePassword };
