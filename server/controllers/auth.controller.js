/**
 * server/controllers/auth.controller.js
 * All authentication for the CampusSphere ERP.
 * Every user must come from MongoDB — no demo/hardcoded accounts.
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
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

// In-memory throttling map: `${ip}:${normalizedRoll}` => { attempts: number, blockedUntil: number }
const studentFailedAttempts = new Map();
const MAX_STUDENT_FAILED_ATTEMPTS = 5;
const THROTTLE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const resetStudentLoginThrottler = () => {
  studentFailedAttempts.clear();
};

/**
 * POST /api/auth/student-login
 * Body: { rollNumber, gmail, email }
 * Authenticates an enrolled student using Roll Number + Registered personal Gmail.
 * Confirmed Part 7 Policy: Exactly two inputs, matching the same eligible Student in MongoDB.
 * No password, no OTP, no institutional email required.
 */
const studentLogin = asyncHandler(async (req, res) => {
  const { rollNumber, gmail, email } = req.body || {};
  const rawEmail = gmail !== undefined ? gmail : email;

  // 1. Validate inputs are non-empty strings
  if (
    rollNumber === undefined ||
    rollNumber === null ||
    rawEmail === undefined ||
    rawEmail === null ||
    typeof rollNumber !== 'string' ||
    typeof rawEmail !== 'string'
  ) {
    throw new ApiError(400, 'Roll number and personal Gmail address are required');
  }

  // 2. Normalize inputs
  const normalizedRoll = rollNumber.trim().toUpperCase();
  const normalizedEmail = rawEmail.trim().toLowerCase();

  if (!normalizedRoll || !normalizedEmail) {
    throw new ApiError(400, 'Roll number and personal Gmail address are required');
  }

  // 3. Validate Gmail address format (must end with @gmail.com)
  const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!normalizedEmail.endsWith('@gmail.com')) {
    throw new ApiError(400, 'Personal Gmail address must end with @gmail.com');
  }
  if (!GMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, 'Invalid email format');
  }

  // 4. Rate-limiting / Throttling check
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const throttleKey = `${clientIp}:${normalizedRoll}`;
  const now = Date.now();
  const throttleRecord = studentFailedAttempts.get(throttleKey);

  if (throttleRecord && throttleRecord.blockedUntil && throttleRecord.blockedUntil > now) {
    throw new ApiError(429, 'Too many failed login attempts. Please try again later.');
  }

  const recordFailure = () => {
    const existing = studentFailedAttempts.get(throttleKey) || { attempts: 0, blockedUntil: 0 };
    existing.attempts += 1;
    if (existing.attempts >= MAX_STUDENT_FAILED_ATTEMPTS) {
      existing.blockedUntil = now + THROTTLE_DURATION_MS;
    }
    studentFailedAttempts.set(throttleKey, existing);
  };

  // 5. Find eligible Student record matching BOTH rollNumber and registered email
  const student = await Student.findOne({
    rollNumber: normalizedRoll,
    email: normalizedEmail,
  });

  if (!student) {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }

  // 6. Verify account eligibility using enrollment/account-status rules
  if (student.status !== 'active') {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }
  if (student.accountStatus && ['suspended', 'withdrawn'].includes(student.accountStatus)) {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }

  // 7. Resolve linked User identity
  if (!student.user) {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }

  const user = await User.findById(student.user);
  if (!user || user.role !== 'student') {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }

  // Prevent account access if user is deactivated
  if (!user.isActive) {
    recordFailure();
    throw new ApiError(403, 'Your account has been deactivated. Please contact admin.');
  }

  // 8. Prevent mismatched student-user links (fail safely)
  if (user.loginId && user.loginId.toUpperCase() !== normalizedRoll) {
    recordFailure();
    throw new ApiError(401, 'Invalid roll number or registered Gmail address');
  }

  // 9. Login success: clear throttling
  studentFailedAttempts.delete(throttleKey);

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Generate standard JWT token and set HTTP-only cookie
  const token = generateToken(user);
  setCookieToken(res, token);

  return res.status(200).json({
    success: true,
    data: {
      token,
      role: user.role,
      name: user.name,
      rollNumber: student.rollNumber,
      studentId: student._id,
      redirectTo: ROLE_REDIRECTS[user.role] || '/student/dashboard',
    },
    message: 'Login successful',
  });
});

/**
 * POST /api/auth/login
 * Body: { loginId, password, role }
 *   - Students:  loginId = roll number
 *   - Faculty:   loginId = employee ID
 *   - Admin:     loginId = admin login ID (e.g. "ADMIN001")
 */
const login = asyncHandler(async (req, res) => {
  const { loginId, password, role } = req.body;

  if (!loginId || !password || !role) {
    throw new ApiError(400, 'loginId, password, and role are required');
  }

  const userRole = role.toLowerCase();
  if (!ROLE_REDIRECTS[userRole]) {
    throw new ApiError(400, 'Invalid role');
  }

  // Find user by loginId AND role (prevents cross-role login)
  const user = await User.findOne({ loginId: loginId.trim(), role: userRole }).select('+passwordHash');

  if (!user) {
    console.log(`❌ Login failed: Invalid credentials for role="${role}"`);
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    console.log(`❌ Login failed: Account deactivated for role="${role}"`);
    throw new ApiError(403, 'Your account has been deactivated. Please contact admin.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    // Check if trimmed password matches (common autocomplete/paste issue)
    const isTrimmedMatch = await bcrypt.compare(password.trim(), user.passwordHash);
    if (!isTrimmedMatch) {
      console.log(`❌ Login failed: Invalid credentials for role="${role}"`);
      throw new ApiError(401, 'Invalid credentials');
    }
  }

  // Check if temporary credential has expired
  if (user.mustChangePassword && user.temporaryPasswordExpiresAt && new Date() > user.temporaryPasswordExpiresAt) {
    console.log(`❌ Login failed: Temporary password expired for role="${role}"`);
    throw new ApiError(401, 'Temporary password has expired. Please contact administrator.');
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user);
  setCookieToken(res, token);

  console.log(`✅ Login: ${user.loginId} [${role}]`);

  return res.status(200).json({
    success: true,
    data: {
      token,
      role:       user.role,
      name:       user.name,
      redirectTo: ROLE_REDIRECTS[user.role],
      mustChangePassword: Boolean(user.mustChangePassword),
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
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from current password');
  }

  const user = await User.findById(req.user.userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.temporaryPasswordExpiresAt = null;
  user.passwordChangedAt = new Date();
  await user.save();

  // Invalidate existing session token by issuing fresh authenticated token
  const token = generateToken(user);
  setCookieToken(res, token);

  return res.status(200).json({
    success: true,
    data: {
      token,
      mustChangePassword: false,
    },
    message: 'Password changed successfully',
  });
});

module.exports = { login, studentLogin, logout, getMe, changePassword, resetStudentLoginThrottler };
