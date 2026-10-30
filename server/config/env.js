/**
 * server/config/env.js
 * Validates required environment variables on startup.
 * Exits with a clear message if anything is missing or invalid.
 */
'use strict';

const required = ['JWT_SECRET', 'JWT_EXPIRES_IN', 'CLIENT_URL'];

// In production, MONGODB_URI is mandatory
if (process.env.NODE_ENV === 'production') {
  required.push('MONGODB_URI');
}

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('❌  Missing required environment variables:');
  missing.forEach((key) => console.error(`     - ${key}`));
  console.error('\n👉  Copy server/.env.example → server/.env and fill in the values.');
  process.exit(1);
}

// JWT_SECRET must be at least 32 characters
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌  JWT_SECRET is too short (minimum 32 characters).');
  console.error('    Run `npm run setup` to auto-generate a secure secret.');
  process.exit(1);
}

module.exports = {
  PORT:          parseInt(process.env.PORT || '5001', 10),
  NODE_ENV:      process.env.NODE_ENV || 'development',
  MONGODB_URI:   process.env.MONGODB_URI || '',
  JWT_SECRET:    process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL:    process.env.CLIENT_URL || 'http://localhost:5173',
  GROQ_API_KEY:    process.env.GROQ_API_KEY || '',
  AI_SERVICE_URL:  process.env.AI_SERVICE_URL || 'http://localhost:5002',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'campussphere-internal-secret-2026',
};
