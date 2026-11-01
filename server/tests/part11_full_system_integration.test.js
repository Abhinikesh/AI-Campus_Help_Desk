/**
 * server/tests/part11_full_system_integration.test.js
 * Comprehensive Part 11 Full-System Integration & Regression Test Suite.
 * 
 * Verifies:
 * 1. Test database isolation invariants across environment configs.
 * 2. Controller exports and syntax safety (no stray tokens or broken returns).
 * 3. Cross-role RBAC enforcement (Student -> Faculty, Faculty -> Admin, Public -> Protected).
 * 4. Microservice runtime health and responsiveness (Node 5001, Python 5002).
 * 5. Academic zero-class edge case handling and data consistency.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const studentController = require('../controllers/student.controller');
const attendanceCalculationService = require('../services/attendanceCalculation.service');
const Student = require('../models/Student');

const NODE_API_BASE = 'http://localhost:5001/api';
const PYTHON_API_BASE = 'http://localhost:5002';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function createMockToken(role, userId = new mongoose.Types.ObjectId().toString()) {
  return jwt.sign(
    { userId, role, name: `Mock ${role}` },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

test('Part 11 Full-System Integration & Regression Suite', async (t) => {

  // ── 1. Test Database Isolation Guard ─────────────────────────────────────────
  await t.test('1. Test database isolation guard blocks dangerous database targets', () => {
    const dangerousUris = [
      'mongodb://127.0.0.1:27018/campus-erp',
      'mongodb://localhost:27018/campus-erp',
      'mongodb://localhost:27018/production',
      'mongodb://cluster0.net/prod',
      'mongodb://localhost:27018/development',
      'mongodb://localhost:27018/test',
      'mongodb://localhost:27018/admin',
      'mongodb://localhost:27018/local',
      'mongodb://localhost:27018/arbitrary_college_db'
    ];

    for (const uri of dangerousUris) {
      assert.throws(
        () => verifyTestDatabaseIsolation(uri),
        /TEST SAFETY VIOLATION/,
        `Should have blocked target: ${uri}`
      );
    }

    // Must allow properly isolated databases
    assert.equal(verifyTestDatabaseIsolation(TEST_DB_URI), true);
    assert.equal(verifyTestDatabaseIsolation('mongodb://127.0.0.1:27018/campus-erp-test-isolated'), true);
    assert.equal(verifyTestDatabaseIsolation('mongodb://localhost:27018/ci_test_isolated_db'), true);
  });

  // ── 2. Controller Export & Syntax Integrity ─────────────────────────────────
  await t.test('2. Student controller exports all required route handlers cleanly', () => {
    const expectedHandlers = [
      'getProfile',
      'getAnnouncements',
      'raiseComplaint',
      'getMyComplaints',
      'getFees',
      'getAttendance',
      'getAttendanceHistory',
      'getActiveSessions',
      'joinAttendanceSession',
      'getFaceStatus',
      'grantConsent',
      'enrollFace',
      'requestReEnrollment',
      'revokeFace',
      'getExams',
      'getResults',
    ];

    for (const handler of expectedHandlers) {
      assert.equal(
        typeof studentController[handler],
        'function',
        `studentController.${handler} must be an exported middleware function`
      );
    }
  });

  // ── 3. Cross-Role Access Control (RBAC) Enforcement ─────────────────────────
  await t.test('3. Unauthenticated requests are rejected with 401', async () => {
    const res = await fetch(`${NODE_API_BASE}/attendance/student/overview`);
    assert.equal(res.status, 401, 'Unauthenticated request must return HTTP 401');
  });

  await t.test('4. Student token cannot access Faculty session creation (HTTP 403)', async () => {
    const studentToken = createMockToken('student');
    const res = await fetch(`${NODE_API_BASE}/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ subject: 'CS101' })
    });
    assert.equal(res.status, 403, 'Student must be forbidden from creating attendance sessions');
  });

  await t.test('5. Student token cannot access Admin Risk Register (HTTP 403)', async () => {
    const studentToken = createMockToken('student');
    const res = await fetch(`${NODE_API_BASE}/attendance/admin/risk-register`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.status, 403, 'Student must be forbidden from accessing Admin Risk Register');
  });

  await t.test('6. Faculty token cannot access Admin Audit Logs (HTTP 403)', async () => {
    const facultyToken = createMockToken('faculty');
    const res = await fetch(`${NODE_API_BASE}/attendance/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert.equal(res.status, 403, 'Faculty must be forbidden from accessing Admin Audit Logs');
  });

  // ── 4. Microservice Runtime Health Smoke Tests ──────────────────────────────
  await t.test('7. Node.js ERP backend health endpoint returns HTTP 200 OK', async () => {
    const res = await fetch(`${NODE_API_BASE}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'OK');
    assert.ok(body.data.timestamp);
  });

  await t.test('8. Python AI microservice health endpoint returns HTTP 200 healthy', async () => {
    const res = await fetch(`${PYTHON_API_BASE}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'campussphere-ai-service');
  });

  // ── 5. Academic Zero-Class Edge Case Invariant ───────────────────────────────
  await t.test('9. Attendance calculation safely returns No Data when zero classes are held', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    const testStudent = await Student.create({
      user: new mongoose.Types.ObjectId(),
      rollNumber: `P11-${Date.now()}`,
      fullName: 'Part 11 Test Student',
      branch: 'AERO',
      semester: 7
    });

    try {
      const result = await attendanceCalculationService.calculateStudentOverview({
        studentId: testStudent._id,
        semester: 7,
        branch: 'AERO'
      });

      assert.equal(result.hasData, false);
      assert.equal(result.summary.totalHeldUnits, 0);
      assert.equal(result.summary.totalAttendedUnits, 0);
      assert.equal(result.summary.overall, null);
      assert.equal(result.summary.overallPercentage, null);
      assert.equal(result.summary.status, 'No Data');
      assert.equal(result.summary.meetsRequirement, false);
    } finally {
      await Student.deleteOne({ _id: testStudent._id });
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });
});
