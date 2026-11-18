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

async function migrateFaculty() {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const facultyUsers = await User.find({ role: 'faculty' });
    console.log(`Found ${facultyUsers.length} faculty accounts to secure.`);

    let updatedCount = 0;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const faculty of facultyUsers) {
      const tempPassword = generateSecurePassword(16);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      faculty.passwordHash = passwordHash;
      faculty.mustChangePassword = true;
      faculty.temporaryPasswordExpiresAt = expiresAt;
      faculty.passwordChangedAt = null;
      await faculty.save();
      updatedCount++;
    }

    console.log('\n' + '═'.repeat(68));
    console.log('       FACULTY CREDENTIAL SECURITY MIGRATION COMPLETE');
    console.log('═'.repeat(68));
    console.log(`  Accounts Updated:           ${updatedCount}`);
    console.log(`  Credential Model:           100% Unique Random Cryptographic Passwords`);
    console.log(`  Shared Default Passwords:   ELIMINATED`);
    console.log(`  Must Change On First Login: YES (7-day validity)`);
    console.log('─'.repeat(68));
    console.log('  [MANAGEMENT NOTE]');
    console.log('  Admin can view users and securely trigger individual password resets');
    console.log('  at any time via: POST /api/admin/users/:id/reset-password');
    console.log('═'.repeat(68) + '\n');

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
  migrateFaculty();
}

module.exports = { migrateFaculty };
