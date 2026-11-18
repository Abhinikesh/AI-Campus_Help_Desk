/**
 * server/tests/test_database_safety.test.js
 * Comprehensive automated verification for test database isolation guards.
 * Proves that operational databases (campus-erp), unauthorized ports, and non-allowlisted databases
 * cannot be accessed or cleaned up by automated tests.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const {
  verifyTestDatabaseIsolation,
  assertConnectionIsolated,
  guardCleanup,
  APPROVED_TEST_DATABASES,
  FORBIDDEN_DATABASES,
  TEST_DB_URI
} = require('./helpers/testDatabase');

describe('Strict Test Database Allowlist & Safety Isolation Suite', () => {

  // 1. Canonical database name campus-erp is rejected across all connection styles
  test('1. Canonical database name campus-erp is rejected across all connection styles', () => {
    const canonicalUris = [
      'mongodb://localhost:27018/campus-erp',
      'mongodb://127.0.0.1:27018/campus-erp',
      'mongodb://localhost:27018/campus-erp?retryWrites=true',
      'mongodb://10.0.0.1:27017/campus-erp',
      'mongodb://production-cluster.internal:27017/campus-erp',
      'mongodb://127.0.0.1:55432/campus-erp',
      'mongodb+srv://admin:secret@cluster0.mongodb.net/campus-erp'
    ];

    for (const uri of canonicalUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /Refusing to run tests against 'campus-erp'|Refusing connection to forbidden database|Operational and production databases are strictly forbidden/,
        `Guard must reject canonical operational URI: ${uri}`
      );
    }
  });

  // 2. Canonical MongoDB port 27018 is rejected
  test('2. Canonical MongoDB port 27018 is rejected', () => {
    // 2a. Port 27018 is unconditionally rejected when targeting canonical database
    assert.throws(
      () => verifyTestDatabaseIsolation('mongodb://127.0.0.1:27018/campus-erp'),
      /TEST SAFETY VIOLATION/,
      'Must reject port 27018 when pointing to operational database'
    );

    // 2b. Port 27018 is rejected for unapproved/arbitrary database names
    assert.throws(
      () => verifyTestDatabaseIsolation('mongodb://127.0.0.1:27018/arbitrary_db'),
      /Refusing connection to port 27018 for unapproved database/,
      'Must reject port 27018 for unapproved database'
    );

    // 2c. Port 27018 is rejected across all database targets when strict port isolation is enabled
    const strictPort27018Uris = [
      'mongodb://localhost:27018/campus-erp-test-isolated',
      'mongodb://127.0.0.1:27018/ci-test-db',
      'mongodb://127.0.0.1:27018/test_isolated'
    ];

    for (const uri of strictPort27018Uris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri, { disallowPort27018: true }),
        /Refusing connection to operational port 27018 in strict isolation mode/,
        `Guard must reject port 27018 under strict port isolation: ${uri}`
      );
    }
  });

  // 3. Common production/system database names are rejected
  test('3. Common production and system database names are rejected', () => {
    const forbiddenDbs = ['production', 'prod', 'development', 'admin', 'local', 'config', 'test'];

    for (const name of forbiddenDbs) {
      const uri = `mongodb://127.0.0.1:55432/${name}`;
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /TEST SAFETY VIOLATION.*forbidden/i,
        `Guard must reject forbidden database name: ${name}`
      );
    }
  });

  // 4. Database names containing "staging" are rejected unless explicitly allowlisted
  test('4. Database names containing "staging" are rejected unless explicitly allowlisted', () => {
    const unapprovedStagingUris = [
      'mongodb://localhost:55432/arbitrary-staging-db',
      'mongodb://localhost:55432/preprod-staging',
      'mongodb://127.0.0.1:55432/staging_campus_erp',
      'mongodb://127.0.0.1:55432/my-staging',
      'mongodb://127.0.0.1:55432/campus-erp-staging-isolated'
    ];

    for (const uri of unapprovedStagingUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /not in the approved test database allowlist/,
        `Guard must reject unapproved staging database: ${uri}`
      );
    }
  });

  // 5. Arbitrary database names containing "test" are rejected unless explicitly allowlisted
  test('5. Arbitrary database names containing "test" are rejected unless explicitly allowlisted', () => {
    const unapprovedTestUris = [
      'mongodb://localhost:55432/my-test-db',
      'mongodb://127.0.0.1:55432/company-test',
      'mongodb://localhost:55432/user-test-database',
      'mongodb://127.0.0.1:55432/unapproved_test_suite'
    ];

    for (const uri of unapprovedTestUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /not in the approved test database allowlist/,
        `Guard must reject arbitrary unapproved database with 'test' in name: ${uri}`
      );
    }
  });

  // 6. Missing, undefined, empty, or malformed URIs fail closed
  test('6. Missing, undefined, empty, or malformed URIs fail closed', () => {
    const invalidInputs = [null, undefined, '', '   ', '\t\n', 123, {}, []];

    for (const input of invalidInputs) {
      assert.throws(
        () => verifyTestDatabaseIsolation(input),
        /Database URI must be a non-empty string/,
        `Guard must fail closed on invalid input: ${JSON.stringify(input)}`
      );
    }

    const malformedUris = [
      'http://localhost:55432/test_memory_db',
      'redis://localhost:6379/0',
      'not-a-mongo-uri',
      'mongodb://localhost:27018/',
      'mongodb://localhost:55432/?retryWrites=true'
    ];

    for (const uri of malformedUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /TEST SAFETY VIOLATION/,
        `Guard must reject malformed or non-mongodb URI: ${uri}`
      );
    }
  });

  // 7. Valid MongoMemoryServer URIs are accepted
  test('7. Valid MongoMemoryServer URIs are accepted', async () => {
    const mongod = await MongoMemoryServer.create();
    try {
      const uri = mongod.getUri();
      assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
      assert.ok(!uri.includes('27018'), 'MongoMemoryServer must use an ephemeral port, never 27018');

      // 7a. MongoMemoryServer with approved test database fixture
      const testDbUri = `${uri}test_memory_db`;
      assert.equal(verifyTestDatabaseIsolation(testDbUri), true);
      assert.equal(verifyTestDatabaseIsolation(testDbUri, { disallowPort27018: true }), true);

      // 7b. Attempted boolean bypass { isMemoryServer: true } with unapproved database name fails closed
      const unapprovedDynamicUri = `${uri}arbitrary_suite_name`;
      assert.throws(
        () => verifyTestDatabaseIsolation(unapprovedDynamicUri, { isMemoryServer: true }),
        /not in the approved test database allowlist/,
        'Boolean option { isMemoryServer: true } must not authorize unapproved database names'
      );

      // 7c. Authentic dynamic hex database generated by MongoMemoryServer is accepted
      const hexDbUri = `${uri}abcdef1234567890abcdef12`;
      assert.equal(verifyTestDatabaseIsolation(hexDbUri), true);
    } finally {
      await mongod.stop();
    }
  });

  // 8. Explicitly allowlisted test database names are accepted
  test('8. Explicitly allowlisted test database names are accepted', () => {
    const approvedTargets = [
      'campus-erp-test-isolated',
      'campus-erp-test-search360',
      'ci-test-db',
      'ci-test-isolated-db',
      'ci_test_isolated_db',
      'test_smart_attendance_isolated',
      'test_attendance_isolated',
      'test_unit_isolated',
      'test_student_auth',
      'test_faculty_phone_privacy',
      'test_redos_security'
    ];

    for (const target of approvedTargets) {
      const uri = `mongodb://127.0.0.1:55432/${target}`;
      assert.equal(
        verifyTestDatabaseIsolation(uri),
        true,
        `Explicitly allowlisted database must be accepted: ${target}`
      );
    }
  });

  // 9. Unknown database names are rejected by default
  test('9. Unknown database names are rejected by default', () => {
    const unknownDbs = [
      'unknown_random_db',
      'custom_app_database',
      'student_records_backup',
      'finance_audit_copy'
    ];

    for (const name of unknownDbs) {
      const uri = `mongodb://127.0.0.1:55432/${name}`;
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /not in the approved test database allowlist/,
        `Unknown database must be rejected by default: ${name}`
      );
    }
  });

  // 10. Cleanup operations against canonical, staging, or unknown databases are rejected
  test('10. Cleanup operations against canonical, staging, or unknown databases are rejected', () => {
    // Canonical operational database
    assert.throws(
      () => guardCleanup({ readyState: 1, db: { databaseName: 'campus-erp' } }),
      /Active connection targets forbidden database 'campus-erp'/,
      'Cleanup guard must refuse to clean canonical campus-erp'
    );

    // Production database
    assert.throws(
      () => guardCleanup({ readyState: 1, db: { databaseName: 'production' } }),
      /Active connection targets forbidden database 'production'/,
      'Cleanup guard must refuse to clean production'
    );

    // Arbitrary unapproved staging database
    assert.throws(
      () => guardCleanup({ readyState: 1, db: { databaseName: 'unapproved-staging-db' } }),
      /not in the approved test database allowlist/,
      'Cleanup guard must refuse unapproved staging database'
    );

    // Unknown database
    assert.throws(
      () => guardCleanup({ readyState: 1, db: { databaseName: 'unknown_db_target' } }),
      /not in the approved test database allowlist/,
      'Cleanup guard must refuse unknown database'
    );

    // Disconnected state
    assert.throws(
      () => guardCleanup({ readyState: 0, db: null }),
      /Database connection is not established/,
      'Cleanup guard must refuse disconnected instances'
    );
  });

  // 11. Cleanup operations against approved test databases remain functional
  test('11. Cleanup operations against approved test databases remain functional', () => {
    const validCleanups = [
      'campus-erp-test-isolated',
      'test_smart_attendance_isolated',
      'test_attendance_isolated',
      'test_memory_db'
    ];

    for (const dbName of validCleanups) {
      const mockConn = {
        readyState: 1,
        db: { databaseName: dbName }
      };
      assert.equal(assertConnectionIsolated(mockConn), true);
      assert.equal(guardCleanup(mockConn), true);
    }
  });

  // 12. Disallowed connections fail before opening a socket or modifying records
  test('12. Disallowed connections fail before opening a socket or modifying records', async () => {
    const disallowedUri = 'mongodb://127.0.0.1:27018/campus-erp';

    // Verify synchronous pre-connection failure: verifyTestDatabaseIsolation throws before any Mongoose/MongoClient call
    assert.throws(
      () => verifyTestDatabaseIsolation(disallowedUri),
      /Operational and production databases are strictly forbidden/,
      'Must reject disallowed URI synchronously before socket creation'
    );

    // Pre-connection check ensures readyState remains disconnected (0)
    assert.equal(
      mongoose.connection.readyState,
      0,
      'Mongoose connection readyState must remain 0 (disconnected) when pre-check fails'
    );
  });

});
