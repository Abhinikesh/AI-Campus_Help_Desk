/**
 * server/scripts/bootstrap_admin.js
 * One-time local bootstrap CLI script for CampusSphere AI ERP Administrator.
 *
 * Generates a unique, cryptographically random temporary password for the initial
 * Admin account, hashes it with bcrypt (12 rounds), marks mustChangePassword=true,
 * and displays the credential only once on stdout.
 *
 * Usage:
 *   node server/scripts/bootstrap_admin.js
 *   npm run bootstrap:admin
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
  // 16 chars with at least one uppercase, lowercase, digit, and symbol
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = uppercase + lowercase + digits + symbols;

  let pwd = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  for (let i = 4; i < length; i++) {
    pwd.push(all[crypto.randomInt(all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

async function bootstrap() {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    let admin = await User.findOne({ role: 'admin' });
    const tempPassword = generateSecurePassword(16);
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

    if (admin) {
      admin.passwordHash = passwordHash;
      admin.mustChangePassword = true;
      admin.temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      admin.passwordChangedAt = null;
      admin.isActive = true;
      await admin.save();
    } else {
      admin = await User.create({
        name: 'Campus Admin',
        email: 'admin@campus.edu',
        loginId: 'ADMIN001',
        passwordHash,
        role: 'admin',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true,
      });
    }

    console.log('\n' + '═'.repeat(72));
    console.log('       CAMPUSSPHERE AI — ONE-TIME INITIAL ADMIN BOOTSTRAP');
    console.log('═'.repeat(72));
    console.log(`  Login ID:            ${admin.loginId}`);
    console.log(`  Email:               ${admin.email}`);
    console.log(`  Role:                ${admin.role}`);
    console.log(`  Temporary Password:  ${tempPassword}`);
    console.log(`  Validity:            24 hours (Expires: ${admin.temporaryPasswordExpiresAt.toISOString()})`);
    console.log(`  Must Change On Login: YES`);
    console.log('─'.repeat(72));
    console.log('  [SECURITY NOTICE]');
    console.log('  • This credential was generated locally using cryptographically secure PRNG.');
    console.log('  • It has NOT been written to any files, commit history, or logs.');
    console.log('  • Save this credential now. You will be prompted to change it immediately.');
    console.log('═'.repeat(72) + '\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Admin bootstrap failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

module.exports = { bootstrap, generateSecurePassword };
