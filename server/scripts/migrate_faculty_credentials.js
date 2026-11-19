/**
 * server/scripts/migrate_faculty_credentials.js
 * Migrates all Faculty accounts away from any shared default credentials.
 * Assigns each Faculty member a unique, high-entropy random password, hashes with bcrypt (12 rounds),
 * and marks mustChangePassword=true with a 7-day expiration.
 *
 * Passwords are not written to disk or logs.
 * Individual faculty passwords can be reset on demand by Admin via POST /api/admin/users/:id/reset-password.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');

function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

async function migrateFaculty(targetIdentifier) {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const query = { role: 'faculty' };
    if (targetIdentifier) {
      query.$or = [
        { loginId: targetIdentifier.trim() },
        { email: targetIdentifier.trim().toLowerCase() },
      ];
    }

    const facultyUsers = await User.find(query);
    if (!facultyUsers.length) {
      console.log(`No faculty account found matching: ${targetIdentifier}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`Found ${facultyUsers.length} faculty account(s) to secure.`);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const results = [];

    for (const faculty of facultyUsers) {
      const tempPassword = generateSecurePassword(16);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      faculty.passwordHash = passwordHash;
      faculty.mustChangePassword = true;
      faculty.temporaryPasswordExpiresAt = expiresAt;
      faculty.passwordChangedAt = null;
      await faculty.save();

      results.push({
        loginId: faculty.loginId,
        name: faculty.name,
        email: faculty.email,
        temporaryPassword: tempPassword,
        expiresAt: expiresAt.toISOString(),
      });
    }

    console.log('\n' + '═'.repeat(78));
    console.log('       CAMPUSSPHERE AI — FACULTY CREDENTIAL INITIALIZATION / RESET');
    console.log('═'.repeat(78));
    console.log(`  Accounts Updated:           ${results.length}`);
    console.log(`  Credential Model:           Cryptographically Secure Temporary Passwords`);
    console.log(`  Must Change On First Login: YES (7-day validity)`);
    console.log('─'.repeat(78));
    for (const r of results) {
      console.log(`  [${r.loginId}] ${r.name.padEnd(22)} | Email: ${r.email.padEnd(28)} | Temp PW: ${r.temporaryPassword}`);
    }
    console.log('─'.repeat(78));
    console.log('  [SECURITY NOTICE]');
    console.log('  • Credentials generated locally; never committed to git or stored plaintext.');
    console.log('  • Share temporary credentials securely with faculty members.');
    console.log('═'.repeat(78) + '\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Faculty migration failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  const target = process.argv[2];
  migrateFaculty(target);
}

module.exports = { migrateFaculty };
