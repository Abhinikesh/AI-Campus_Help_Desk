'use strict';

const mongoose = require('mongoose');

const DEFAULT_ISOLATED_URI = 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || DEFAULT_ISOLATED_URI;

/**
 * Ensures the given MongoDB connection URI targets an isolated test database
 * and NEVER targets development or production databases.
 * Throws a fatal Error if any forbidden database name is detected.
 *
 * @param {string} uri - MongoDB connection string
 * @param {Object} [options]
 * @param {boolean} [options.disallowPort27018=false] - When true, rejects any URI on canonical port 27018
 * @returns {boolean} true if safe
 */
function verifyTestDatabaseIsolation(uri, options = {}) {
  // If called with no arguments at all, default to TEST_DB_URI for backwards compatibility
  const targetUri = arguments.length === 0 ? TEST_DB_URI : uri;

  if (!targetUri || typeof targetUri !== 'string' || targetUri.trim().length === 0) {
    throw new Error('TEST SAFETY VIOLATION: Database URI must be a non-empty string.');
  }

  const cleanUri = targetUri.trim();

  // Strict port 27018 check if explicitly requested
  if (options.disallowPort27018 && (cleanUri.includes(':27018') || cleanUri.includes('/27018'))) {
    throw new Error('TEST SAFETY VIOLATION: Refusing connection to operational port 27018 in strict isolation mode.');
  }

  // Extract database name from URI, ignoring query strings and trailing slashes
  // Example: mongodb://127.0.0.1:27018/campus-erp-test-isolated?retryWrites=true
  const urlWithoutQuery = cleanUri.split('?')[0];
  const segments = urlWithoutQuery.split('/').filter(Boolean);
  // In mongodb://host:port/dbname, segments are ['mongodb:', 'host:port', 'dbname']
  const dbName = segments.length > 2 ? segments[segments.length - 1] : (segments.length === 2 && !segments[1].includes(':') ? segments[1] : '');

  if (!dbName) {
    throw new Error('TEST SAFETY VIOLATION: Database name could not be parsed from URI.');
  }

  const forbiddenNames = ['campus-erp', 'test', 'production', 'prod', 'development', 'admin', 'local', 'config'];
  const lowerName = dbName.toLowerCase();

  if (forbiddenNames.includes(lowerName) || lowerName === 'campus-erp') {
    throw new Error(
      `TEST SAFETY VIOLATION: Refusing to run tests against '${dbName}'. Tests must use an isolated test database containing 'test' or 'isolated' (e.g. campus-erp-test-isolated).`
    );
  }

  if (!lowerName.includes('test') && !lowerName.includes('isolated') && !lowerName.includes('staging')) {
    throw new Error(
      `TEST SAFETY VIOLATION: Database name '${dbName}' must include 'test' or 'isolated' to guarantee isolation.`
    );
  }

  return true;
}

/**
 * Validates that an active Mongoose connection is strictly connected to an isolated test database.
 * Throws a fatal Error if connected to campus-erp or any non-isolated database.
 *
 * @param {mongoose.Connection} [connection=mongoose.connection]
 * @returns {boolean} true if active connection is isolated
 */
function assertConnectionIsolated(connection = mongoose.connection) {
  if (!connection || connection.readyState === 0) {
    throw new Error('TEST SAFETY VIOLATION: Database connection is not established.');
  }

  const dbName = connection.db?.databaseName;
  if (!dbName) {
    throw new Error('TEST SAFETY VIOLATION: Database name is undefined on connection.');
  }

  const lowerName = dbName.toLowerCase();
  const forbiddenNames = ['campus-erp', 'production', 'prod', 'development', 'admin', 'local', 'config'];

  if (forbiddenNames.includes(lowerName) || lowerName === 'campus-erp') {
    throw new Error(`TEST SAFETY VIOLATION: Active connection targets forbidden database '${dbName}'.`);
  }

  if (!lowerName.includes('test') && !lowerName.includes('isolated') && !lowerName.includes('staging')) {
    throw new Error(`TEST SAFETY VIOLATION: Active database '${dbName}' must include 'test' or 'isolated'.`);
  }

  return true;
}

/**
 * Guard that must be called prior to dropping or performing bulk deletion in tests.
 * Ensures the target database is verified safe and not the canonical database.
 *
 * @param {mongoose.Connection} [connection=mongoose.connection]
 */
function guardCleanup(connection = mongoose.connection) {
  assertConnectionIsolated(connection);
  return true;
}

module.exports = {
  TEST_DB_URI,
  verifyTestDatabaseIsolation,
  assertConnectionIsolated,
  guardCleanup,
};

