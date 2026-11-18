/**
 * server/tests/test_database_safety.test.js
 * Comprehensive automated verification for test database isolation guards.
 * Proves that operational databases (campus-erp) and ports cannot be accessed by tests.
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
  TEST_DB_URI
} = require('./helpers/testDatabase');

describe('Test Database Isolation Safety Suite', () => {

  // 1. Rejection of canonical database name 'campus-erp'
  test('1. Rejection of canonical database name campus-erp in all URI formats', () => {
    const canonicalUris = [
      'mongodb://localhost:27018/campus-erp',
      'mongodb://127.0.0.1:27018/campus-erp',
      'mongodb://localhost:27018/campus-erp?retryWrites=true',
      'mongodb://10.0.0.1:27017/campus-erp',
      'mongodb://production-cluster.internal:27017/campus-erp'
    ];

    for (const uri of canonicalUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /TEST SAFETY VIOLATION/,
        `Guard must reject canonical operational URI: ${uri}`
      );
    }
  });

  // 2. The canonical port 27018 is rejected when strict isolation is required
  test('2. The canonical port 27018 is rejected under strict port isolation', () => {
    const port27018Uris = [
      'mongodb://localhost:27018/campus-erp-test-isolated',
      'mongodb://127.0.0.1:27018/ci-test-db',
      'mongodb://127.0.0.1:27018/test_isolated'
    ];

    for (const uri of port27018Uris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri, { disallowPort27018: true }),
        /Refusing connection to operational port 27018/,
        `Guard must reject port 27018 in strict mode: ${uri}`
      );
    }
  });

  // 3. Missing or invalid test database configuration fails safely (fail closed)
  test('3. Missing or invalid test database configuration fails safely', () => {
    const invalidInputs = [null, undefined, '', '   ', '\t\n'];

    for (const input of invalidInputs) {
      assert.throws(
        () => verifyTestDatabaseIsolation(input),
        /Database URI must be a non-empty string/,
        `Guard must fail closed on invalid input: ${input}`
      );
    }

    // URI without database name fails
    assert.throws(
      () => verifyTestDatabaseIsolation('mongodb://localhost:27018/'),
      /Database name could not be parsed/,
      'Guard must reject URI lacking a database path'
    );
  });

  // 4. MongoMemoryServer connections are accepted
  test('4. MongoMemoryServer connection URIs are accepted and validated', async () => {
    const mongod = await MongoMemoryServer.create();
    try {
      const uri = mongod.getUri();
      assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
      assert.ok(!uri.includes('27018'), 'MongoMemoryServer must use an ephemeral port, never 27018');

      // Default database generated or custom test db name
      const testDbUri = `${uri}test_memory_db`;
      assert.equal(verifyTestDatabaseIsolation(testDbUri), true);
      assert.equal(verifyTestDatabaseIsolation(testDbUri, { disallowPort27018: true }), true);
    } finally {
      await mongod.stop();
    }
  });

  // 5. Explicitly isolated test databases are accepted
  test('5. Explicitly isolated test databases are accepted under standard testing', () => {
    const safeTestUris = [
      'mongodb://127.0.0.1:27018/campus-erp-test-isolated',
      'mongodb://localhost:27018/ci-test-isolated-db',
      'mongodb://127.0.0.1:55432/test_unit_isolated',
      'mongodb://127.0.0.1:55432/campus-erp-staging-isolated'
    ];

    for (const uri of safeTestUris) {
      assert.equal(
        verifyTestDatabaseIsolation(uri),
        true,
        `Guard must accept isolated test URI: ${uri}`
      );
    }
  });

  // 6. Test cleanup cannot delete records outside its isolated database
  test('6. Test cleanup and connection guard block non-isolated and operational databases', () => {
    // Simulated connection to operational database
    const mockCampusErpConn = {
      readyState: 1,
      db: { databaseName: 'campus-erp' }
    };

    assert.throws(
      () => assertConnectionIsolated(mockCampusErpConn),
      /Active connection targets forbidden database 'campus-erp'/,
      'Guard must block connection to campus-erp'
    );

    assert.throws(
      () => guardCleanup(mockCampusErpConn),
      /Active connection targets forbidden database 'campus-erp'/,
      'Cleanup guard must refuse to clean canonical campus-erp'
    );

    // Simulated connection to production
    const mockProdConn = {
      readyState: 1,
      db: { databaseName: 'production' }
    };

    assert.throws(
      () => guardCleanup(mockProdConn),
      /forbidden database 'production'/,
      'Cleanup guard must refuse to clean production'
    );

    // Simulated connection to disconnected instance
    const mockDisconnected = {
      readyState: 0,
      db: null
    };

    assert.throws(
      () => guardCleanup(mockDisconnected),
      /Database connection is not established/,
      'Cleanup guard must refuse disconnected instances'
    );

    // Valid isolated connection succeeds
    const mockIsolatedConn = {
      readyState: 1,
      db: { databaseName: 'test_attendance_isolated' }
    };

    assert.equal(assertConnectionIsolated(mockIsolatedConn), true);
    assert.equal(guardCleanup(mockIsolatedConn), true);
  });

});
