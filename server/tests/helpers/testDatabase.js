'use strict';

const mongoose = require('mongoose');

const DEFAULT_ISOLATED_URI = 'mongodb://127.0.0.1:27018/campus-erp-test-isolated';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || DEFAULT_ISOLATED_URI;

/**
 * Explicit, strictly audited allowlist of approved test databases.
 * No database is accepted merely because its name contains 'test', 'isolated', or 'staging'.
 * Every database in this set has been audited and verified safe for automated test fixtures.
 */
const APPROVED_TEST_DATABASES = new Set([
  // Core test fixtures & isolated database targets
  'campus-erp-test-isolated',
  'campus-erp-test-search360',
  'ci-test-db',
  'ci-test-isolated-db',
  'ci_test_isolated_db',
  'test_attendance_isolated',
  'test_smart_attendance_isolated',
  'test_smart_attendance',
  'test_unit_isolated',
  'test_memory_db',

  // Feature-specific & phase-specific test suites
  'test_student_complaints_lifecycle_isolated',
  'test_hr_profile_provisioning_isolated',
  'test_hr_policy_seed_migration_isolated',
  'test_hr_leave_policy_isolated',
  'test_phase3_5_isolated',
  'test_admin_profile_mgmt',
  'test_student_auth',
  'test_student_hardening',
  'test_phase3_9a',
  'test_phase3_9b',
  'test_phase3_8',
  'test_phase3_7',
  'test_phase3_6',
  'test_phase3_3a_isolated',
  'campus-erp-test-phase3-3a-isolated',
  'campus-erp-test-phase3-1-2-isolated',
  'campus-erp-test-phase3-1-isolated',
  'campus-erp-test-phase3-2-2-isolated',
  'test_uploads_security_part10_2',
  'test_faculty_phone_privacy',
  'test_redos_security',
  'test_security_part10',
  'test_isolated',
]);

/**
 * Explicitly forbidden databases that must NEVER be accessed under any testing scenario.
 */
const FORBIDDEN_DATABASES = new Set([
  'campus-erp',
  'production',
  'prod',
  'development',
  'admin',
  'local',
  'config',
  'test',
]);

/**
 * Ensures the given MongoDB connection URI targets an explicitly approved test database
 * and NEVER targets operational, development, or production databases.
 * Broad substring matching is strictly prohibited; unknown databases fail closed.
 *
 * @param {string} uri - MongoDB connection string
 * @param {Object} [options]
 * @param {boolean} [options.disallowPort27018=false] - When true, rejects any URI on canonical port 27018
 * @param {boolean} [options.isMemoryServer=false] - When true, indicates an ephemeral in-memory server
 * @returns {boolean} true if safe
 */
function verifyTestDatabaseIsolation(uri, options = {}) {
  // If called with no arguments at all, default to TEST_DB_URI for backwards compatibility
  const targetUri = arguments.length === 0 ? TEST_DB_URI : uri;

  if (!targetUri || typeof targetUri !== 'string' || targetUri.trim().length === 0) {
    throw new Error('TEST SAFETY VIOLATION: Database URI must be a non-empty string.');
  }

  const cleanUri = targetUri.trim();

  // Basic URI format check
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    throw new Error('TEST SAFETY VIOLATION: Database URI must begin with mongodb:// or mongodb+srv://');
  }

  // Canonical port 27018 check
  const isPort27018 = cleanUri.includes(':27018') || cleanUri.includes('/27018');
  if (isPort27018 && options.disallowPort27018) {
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

  const lowerName = dbName.toLowerCase();

  // 1. Strict rejection of canonical operational database and forbidden system databases
  if (FORBIDDEN_DATABASES.has(lowerName) || lowerName === 'campus-erp') {
    throw new Error(
      `TEST SAFETY VIOLATION: Refusing to run tests against '${dbName}'. Operational and production databases are strictly forbidden.`
    );
  }

  // 2. If port 27018 is used without strict mode, ensure it only targets approved test databases
  if (isPort27018 && !APPROVED_TEST_DATABASES.has(lowerName)) {
    throw new Error(
      `TEST SAFETY VIOLATION: Refusing connection to port 27018 for unapproved database '${dbName}'.`
    );
  }

  // 3. Strict allowlist validation: approved database targets succeed immediately
  if (APPROVED_TEST_DATABASES.has(lowerName)) {
    return true;
  }

  // 4. Dynamic MongoMemoryServer databases validation:
  // Dynamically generated MongoMemoryServer connection strings are supported ONLY when:
  // - Host is strictly loopback (127.0.0.1 or localhost)
  // - Port is strictly an ephemeral high port (never operational port 27018 or 27017)
  // - Database name is strictly an authentic dynamic hex/UUID pattern generated by MongoMemoryServer
  // Note: A boolean option like { isMemoryServer: true } does NOT grant authorization to arbitrary database names.
  const hostPart = segments[1] || '';
  const isLoopback = hostPart.startsWith('127.0.0.1') || hostPart.startsWith('localhost');
  const isEphemeralPort = !hostPart.includes(':27018') && !hostPart.includes(':27017');
  const isDynamicHexOrUuid = /^[0-9a-f]{24,36}$/i.test(lowerName) || /^mongo-mem-[a-zA-Z0-9]+$/i.test(lowerName);

  if (isLoopback && isEphemeralPort && isDynamicHexOrUuid) {
    return true;
  }

  // 5. Fail closed: Reject all unknown database names by default
  throw new Error(
    `TEST SAFETY VIOLATION: Database name '${dbName}' is not in the approved test database allowlist. Unknown database names are rejected by default.`
  );
}

/**
 * Validates that an active Mongoose connection is strictly connected to an approved isolated test database.
 * Throws a fatal Error if connected to campus-erp, production, or any non-allowlisted database.
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

  // 1. Strict rejection of canonical operational database and forbidden system databases
  if (FORBIDDEN_DATABASES.has(lowerName) || lowerName === 'campus-erp') {
    throw new Error(`TEST SAFETY VIOLATION: Active connection targets forbidden database '${dbName}'.`);
  }

  // 2. Strict allowlist validation
  if (APPROVED_TEST_DATABASES.has(lowerName)) {
    return true;
  }

  // 3. Ephemeral MongoMemoryServer dynamic database validation
  const host = connection.host;
  const port = connection.port;
  const isLoopback = host === '127.0.0.1' || host === 'localhost';
  const isNotOperationalPort = port && port !== 27018 && port !== 27017;
  const isDynamicHexOrUuid = /^[0-9a-f]{24,36}$/i.test(lowerName) || /^mongo-mem-[a-zA-Z0-9]+$/i.test(lowerName);

  if (isLoopback && isNotOperationalPort && isDynamicHexOrUuid) {
    return true;
  }

  // 4. Fail closed: Reject unapproved active databases
  throw new Error(
    `TEST SAFETY VIOLATION: Active database '${dbName}' is not in the approved test database allowlist. Cleanup and operations aborted.`
  );
}

/**
 * Guard that must be called prior to dropping or performing bulk deletion in tests.
 * Ensures the target database is verified safe and strictly in the approved allowlist.
 *
 * @param {mongoose.Connection} [connection=mongoose.connection]
 * @returns {boolean} true if cleanup is permitted
 */
function guardCleanup(connection = mongoose.connection) {
  assertConnectionIsolated(connection);
  return true;
}

// Automatic fail-closed protection for destructive database operations in test environments
if (process.env.NODE_ENV === 'test' || !process.env.NODE_ENV) {
  const origDropDatabase = mongoose.Connection.prototype.dropDatabase;
  if (typeof origDropDatabase === 'function') {
    mongoose.Connection.prototype.dropDatabase = function(...args) {
      assertConnectionIsolated(this);
      return origDropDatabase.apply(this, args);
    };
  }

  const origDropCollection = mongoose.Connection.prototype.dropCollection;
  if (typeof origDropCollection === 'function') {
    mongoose.Connection.prototype.dropCollection = function(...args) {
      assertConnectionIsolated(this);
      return origDropCollection.apply(this, args);
    };
  }
}

module.exports = {
  DEFAULT_ISOLATED_URI,
  TEST_DB_URI,
  APPROVED_TEST_DATABASES,
  FORBIDDEN_DATABASES,
  verifyTestDatabaseIsolation,
  assertConnectionIsolated,
  guardCleanup,
};
