'use strict';

const mongoose = require('mongoose');

const DEFAULT_ISOLATED_URI = 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || DEFAULT_ISOLATED_URI;

/**
 * Ensures the given MongoDB connection URI targets an isolated test database
 * and NEVER targets development or production databases.
 * Throws a fatal Error if any forbidden database name is detected.
 */
function verifyTestDatabaseIsolation(uri = TEST_DB_URI) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('TEST SAFETY VIOLATION: Database URI must be a non-empty string.');
  }

  // Extract database name from URI
  // Example: mongodb://127.0.0.1:27018/campus-erp-test-isolated?retryWrites=true
  const parsed = uri.split('?')[0];
  const dbName = parsed.split('/').pop();

  if (!dbName) {
    throw new Error('TEST SAFETY VIOLATION: Database name could not be parsed from URI.');
  }

  const forbiddenNames = ['campus-erp', 'test', 'production', 'prod', 'development', 'admin', 'local', 'config'];
  const lowerName = dbName.toLowerCase();

  if (forbiddenNames.includes(lowerName)) {
    throw new Error(
      `TEST SAFETY VIOLATION: Refusing to run tests against '${dbName}'. Tests must use an isolated test database containing 'test' or 'isolated' (e.g. campus-erp-test-isolated).`
    );
  }

  if (!lowerName.includes('test') && !lowerName.includes('isolated')) {
    throw new Error(
      `TEST SAFETY VIOLATION: Database name '${dbName}' must include 'test' or 'isolated' to guarantee isolation.`
    );
  }

  return true;
}

module.exports = {
  TEST_DB_URI,
  verifyTestDatabaseIsolation,
};
