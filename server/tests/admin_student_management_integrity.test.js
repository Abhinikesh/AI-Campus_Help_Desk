/**
 * server/tests/admin_student_management_integrity.test.js
 * Comprehensive Automated Test Suite for Part 11.2:
 * Minimal Student Management Functionality Fixes.
 *
 * Verifies:
 * 1. Listing & searching canonical students with filters and pagination.
 * 2. Individual student creation via POST /api/admin/students.
 * 3. Required field validation (rollNumber, fullName) returning HTTP 400.
 * 4. Duplicate rollNumber and email rejection returning HTTP 409 Conflict.
 * 5. Server-side RBAC: unauthenticated (401) and non-admin (403) rejection.
 * 6. Absence of unintended side-effects (no automatic User, biometric, or attendance records).
 * 7. Student status management via PATCH /api/admin/students/:id/status.
 * 8. Status enum validation (active, inactive, suspended, graduated, withdrawn).
 * 9. Preservation of existing profile editing invariants (rollNumber immutable, status rejected on standard PATCH).
 * 10. Audit logging on student creation and status transitions with zero PII leaks.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  verifyTestDatabaseIsolation,
  assertConnectionIsolated,
} = require('./helpers/testDatabase');

const adminRoutes = require('../routes/admin.routes');
const User = require('../models/User');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const Attendance = require('../models/Attendance');
const FaceEmbedding = require('../models/FaceEmbedding');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'admin_student_mgmt_test_jwt_secret_key_112233';
}
const JWT_SECRET = process.env.JWT_SECRET;

test('Part 11.2: Admin Student Management Integrity Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;

  let adminUser, adminToken;
  let facultyUser, facultyToken;
  let studentUser, studentToken;

  let existingStudent1, existingStudent2;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_admin_student_mgmt_isolated' },
    });
    const testUri = mongod.getUri() + 'test_admin_student_mgmt_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    await User.init();
    await Student.init();
    await AuditLog.init();

    // Create Express application
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    // Global error handler
    app.use((err, req, res, next) => {
      const status = err.statusCode || 500;
      res.status(status).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed Users
    adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin.mgmt@campussphere.edu',
      loginId: 'ADM_MGMT_001',
      passwordHash: 'ValidHashedPassword123!',
      role: 'admin',
    });

    facultyUser = await User.create({
      name: 'Prof. Robert Langdon',
      email: 'robert.langdon@campussphere.edu',
      loginId: 'FAC_MGMT_001',
      passwordHash: 'ValidHashedPassword123!',
      role: 'faculty',
    });

    studentUser = await User.create({
      name: 'Pooja Hegde',
      email: 'pooja.hegde@campussphere.edu',
      loginId: 'STU_MGMT_001',
      passwordHash: 'ValidHashedPassword123!',
      role: 'student',
    });

    // Mint JWT tokens
    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    facultyToken = jwt.sign(
      { userId: facultyUser._id.toString(), role: 'faculty' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    studentToken = jwt.sign(
      { userId: studentUser._id.toString(), role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Seed existing canonical students
    existingStudent1 = await Student.create({
      rollNumber: '2024CS001',
      fullName: 'Aarav Patel',
      email: 'aarav.patel@gmail.com',
      phone: '9876543210',
      branch: 'CSE',
      program: 'B.Tech',
      course: 'CSE',
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      status: 'active',
      accountStatus: 'enrolled_offline',
      user: null,
    });

    existingStudent2 = await Student.create({
      rollNumber: '2024EC002',
      fullName: 'Bhavna Sharma',
      email: 'bhavna.sharma@gmail.com',
      phone: '9876543211',
      branch: 'ECE',
      program: 'B.Tech',
      course: 'ECE',
      semester: 6,
      section: 'B',
      admissionYear: 2024,
      status: 'suspended',
      accountStatus: 'enrolled_offline',
      user: null,
    });
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  // ── Test 1: List & Search Canonical Students ───────────────────────────────
  await t.test('1. Admin can list, search, filter and paginate canonical students', async () => {
    // 1a. List all
    const resAll = await fetch(`${baseUrl}/api/admin/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.success, true);
    assert.ok(Array.isArray(bodyAll.data));
    assert.equal(bodyAll.pagination.total, 2);
    assert.equal(bodyAll.pagination.totalPages, 1);
    assert.equal(bodyAll.pagination.pages, 1);

    // 1b. Filter by branch
    const resBranch = await fetch(`${baseUrl}/api/admin/students?branch=CSE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resBranch.status, 200);
    const bodyBranch = await resBranch.json();
    assert.equal(bodyBranch.data.length, 1);
    assert.equal(bodyBranch.data[0].rollNumber, '2024CS001');

    // 1c. Filter by status
    const resStatus = await fetch(`${baseUrl}/api/admin/students?status=suspended`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resStatus.status, 200);
    const bodyStatus = await resStatus.json();
    assert.equal(bodyStatus.data.length, 1);
    assert.equal(bodyStatus.data[0].rollNumber, '2024EC002');

    // 1d. Search by text (roll number)
    const resSearch = await fetch(`${baseUrl}/api/admin/students?search=2024CS001`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resSearch.status, 200);
    const bodySearch = await resSearch.json();
    assert.equal(bodySearch.data.length, 1);
    assert.equal(bodySearch.data[0].fullName, 'Aarav Patel');
  });

  // ── Test 2: Detail View Retrieval ──────────────────────────────────────────
  await t.test('2. Admin can retrieve full student detail with audit history', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.student.rollNumber, '2024CS001');
    assert.ok(Array.isArray(body.data.auditHistory));
  });

  // ── Test 3: Successful Individual Student Creation ─────────────────────────
  await t.test('3. Admin can create an individual canonical student via POST /api/admin/students', async () => {
    const studentPayload = {
      rollNumber: '2024me003', // will be uppercased to 2024ME003
      fullName: 'Chirag Sethi',
      email: 'chirag.sethi@gmail.com',
      phone: '9876543222',
      branch: 'MECH',
      program: 'B.Tech',
      course: 'MECH',
      batch: '2024/1st',
      semester: 1,
      section: 'A',
      admissionYear: 2024,
      school: 'School of Engineering',
      gender: 'male',
      status: 'active',
    };

    const res = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(studentPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.rollNumber, '2024ME003');
    assert.equal(body.data.fullName, 'Chirag Sethi');
    assert.equal(body.data.status, 'active');
    assert.equal(body.data.accountStatus, 'enrolled_offline');
    assert.equal(body.data.user, null);

    // Verify DB persistence
    const saved = await Student.findOne({ rollNumber: '2024ME003' });
    assert.ok(saved);
    assert.equal(saved.fullName, 'Chirag Sethi');
    assert.equal(saved.email, 'chirag.sethi@gmail.com');

    // Verify NO User account was automatically created
    const userCount = await User.countDocuments({ email: 'chirag.sethi@gmail.com' });
    assert.equal(userCount, 0, 'No User account should be created on individual student creation');

    // Verify NO Attendance records created
    const attCount = await Attendance.countDocuments({ student: saved._id });
    assert.equal(attCount, 0, 'No attendance records should be created on student creation');

    // Verify NO FaceEmbedding records created
    const bioCount = await FaceEmbedding.countDocuments({ student: saved._id });
    assert.equal(bioCount, 0, 'No biometric records should be created on student creation');

    // Verify AuditLog creation
    const audit = await AuditLog.findOne({
      action: 'ADMIN_STUDENT_CREATE',
      entityId: saved._id,
    });
    assert.ok(audit, 'AuditLog entry must be recorded');
    assert.match(audit.summary, /2024ME003/);
  });

  // ── Test 4: Validation of Required & Formatted Fields ──────────────────────
  await t.test('4. POST /api/admin/students rejects missing or malformed fields with 400', async () => {
    // 4a. Missing rollNumber
    const resNoRoll = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: 'Divya Sen' }),
    });
    assert.equal(resNoRoll.status, 400);
    const bodyNoRoll = await resNoRoll.json();
    assert.match(bodyNoRoll.message, /roll number is required/i);

    // 4b. Missing/short fullName
    const resShortName = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rollNumber: '2024CS099', fullName: 'D' }),
    });
    assert.equal(resShortName.status, 400);
    const bodyShortName = await resShortName.json();
    assert.match(bodyShortName.message, /full name is required/i);

    // 4c. Invalid email format
    const resBadEmail = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        email: 'invalid-email-address',
      }),
    });
    assert.equal(resBadEmail.status, 400);

    // 4d. Invalid phone format
    const resBadPhone = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        phone: '123',
      }),
    });
    assert.equal(resBadPhone.status, 400);

    // 4e. Invalid semester (> 10)
    const resBadSemHigh = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        semester: 11,
      }),
    });
    assert.equal(resBadSemHigh.status, 400);

    // 4f. Invalid semester (< 1)
    const resBadSemLow = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        semester: 0,
      }),
    });
    assert.equal(resBadSemLow.status, 400);

    // 4g. Non-integer semester (1.5)
    const resBadSemFloat = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        semester: 1.5,
      }),
    });
    assert.equal(resBadSemFloat.status, 400);

    // 4h. Invalid status value
    const resBadStatus = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Divya Sen',
        status: 'expelled',
      }),
    });
    assert.equal(resBadStatus.status, 400);

    // 4i. Valid boundary: semester = 1 (minimum valid)
    const resSemMin = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024BND001',
        fullName: 'Boundary Student Min',
        semester: 1,
      }),
    });
    assert.equal(resSemMin.status, 201);
    const bodySemMin = await resSemMin.json();
    assert.equal(bodySemMin.data.semester, 1);

    // 4j. Valid boundary: semester = 10 (maximum valid)
    const resSemMax = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024BND010',
        fullName: 'Boundary Student Max',
        semester: 10,
      }),
    });
    assert.equal(resSemMax.status, 201);
    const bodySemMax = await resSemMax.json();
    assert.equal(bodySemMax.data.semester, 10);

    // 4k. Valid missing semester & missing admissionYear (stored as null without fake defaults)
    const resMissingOptional = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024BNDNULL',
        fullName: 'Missing Optional Fields Student',
      }),
    });
    assert.equal(resMissingOptional.status, 201);
    const bodyMissing = await resMissingOptional.json();
    assert.equal(bodyMissing.data.semester, null);
    assert.equal(bodyMissing.data.admissionYear, null);
    assert.equal(bodyMissing.data.branch, null);
    assert.equal(bodyMissing.data.batch, null);
    assert.equal(bodyMissing.data.program, null);

    // 4l. Valid status: alumni is accepted
    const resAlumni = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024ALUM001',
        fullName: 'Alumni Student',
        status: 'alumni',
      }),
    });
    assert.equal(resAlumni.status, 201);
    const bodyAlumni = await resAlumni.json();
    assert.equal(bodyAlumni.data.status, 'alumni');
  });

  // ── Test 5: Duplicate Rejection (409 Conflict) ─────────────────────────────
  await t.test('5. POST /api/admin/students rejects duplicate rollNumber and email with 409', async () => {
    // 5a. Duplicate rollNumber (2024CS001 exists)
    const resDupRoll = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS001',
        fullName: 'Imposter Patel',
      }),
    });
    assert.equal(resDupRoll.status, 409);
    const bodyDupRoll = await resDupRoll.json();
    assert.match(bodyDupRoll.message, /already exists/i);

    // 5b. Duplicate email (aarav.patel@gmail.com exists)
    const resDupEmail = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '2024CS099',
        fullName: 'Aarav Twin',
        email: 'aarav.patel@gmail.com',
      }),
    });
    assert.equal(resDupEmail.status, 409);
    const bodyDupEmail = await resDupEmail.json();
    assert.match(bodyDupEmail.message, /already in use/i);
  });

  // ── Test 6: RBAC Authorization Guards on Student Creation ──────────────────
  await t.test('6. POST /api/admin/students blocks unauthenticated and non-admin requests', async () => {
    const payload = {
      rollNumber: '2024SEC001',
      fullName: 'Security Test Student',
    };

    // 6a. Unauthenticated request (401)
    const resUnauth = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(resUnauth.status, 401);

    // 6b. Faculty role (403)
    const resFaculty = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${facultyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    assert.equal(resFaculty.status, 403);

    // 6c. Student role (403)
    const resStudent = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    assert.equal(resStudent.status, 403);
  });

  // ── Test 7: Student Status Management via PATCH /api/admin/students/:id/status
  await t.test('7. Admin can update student status via PATCH /api/admin/students/:id/status', async () => {
    // 7a. Update to 'suspended'
    const resSuspended = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(resSuspended.status, 200);
    const bodySusp = await resSuspended.json();
    assert.equal(bodySusp.success, true);
    assert.equal(bodySusp.newStatus, 'suspended');
    assert.equal(bodySusp.data.status, 'suspended');

    // Verify in DB
    const studentInDb = await Student.findById(existingStudent1._id);
    assert.equal(studentInDb.status, 'suspended');

    // 7b. Update to 'withdrawn'
    const resWithdrawn = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'withdrawn' }),
    });
    assert.equal(resWithdrawn.status, 200);
    const bodyWith = await resWithdrawn.json();
    assert.equal(bodyWith.newStatus, 'withdrawn');

    // 7c. Update to 'graduated'
    const resGrad = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'graduated' }),
    });
    assert.equal(resGrad.status, 200);
    const bodyGrad = await resGrad.json();
    assert.equal(bodyGrad.newStatus, 'graduated');

    // 7d. Update to 'inactive'
    const resInact = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(resInact.status, 200);

    // 7e. Reactivate
    const resAct = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(resAct.status, 200);
    const bodyAct = await resAct.json();
    assert.equal(bodyAct.newStatus, 'active');

    // Verify AuditLog for status update
    const statusAudit = await AuditLog.findOne({
      action: 'ADMIN_STUDENT_STATUS_UPDATE',
      entityId: existingStudent1._id,
    });
    assert.ok(statusAudit);
    assert.match(statusAudit.summary, /status from/i);
  });

  // ── Test 8: Status Validation & Authorization Guards ──────────────────────
  await t.test('8. PATCH /api/admin/students/:id/status enforces validation and RBAC', async () => {
    // 8a. Invalid status enum
    const resBadStatus = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'unknown_status' }),
    });
    assert.equal(resBadStatus.status, 400);

    // 8b. Missing status field
    const resNoStatus = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(resNoStatus.status, 400);

    // 8c. Non-existent student ID (404)
    const fakeId = new mongoose.Types.ObjectId();
    const res404 = await fetch(`${baseUrl}/api/admin/students/${fakeId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(res404.status, 404);

    // 8d. Faculty role (403)
    const resFac = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${facultyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(resFac.status, 403);

    // 8e. Student role (403)
    const resStu = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(resStu.status, 403);
  });

  // ── Test 9: Profile Editing Invariants Maintained ──────────────────────────
  await t.test('9. Standard profile PATCH /api/admin/students/:id preserves immutability invariants', async () => {
    // 9a. Normal update of permitted fields succeeds
    const resPermitted = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Aarav K. Patel',
        phone: '9876543299',
        semester: 5,
      }),
    });
    assert.equal(resPermitted.status, 200);
    const bodyPermitted = await resPermitted.json();
    assert.equal(bodyPermitted.data.fullName, 'Aarav K. Patel');
    assert.equal(bodyPermitted.data.phone, '9876543299');
    assert.equal(bodyPermitted.data.semester, 5);

    // 9b. Attempting to change rollNumber returns 400
    const resRollLocked = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rollNumber: 'NEW_ROLL_999' }),
    });
    assert.equal(resRollLocked.status, 400);
    const bodyRollLocked = await resRollLocked.json();
    assert.match(bodyRollLocked.message, /immutable/i);

    // 9c. Attempting to modify status via standard profile PATCH returns 400
    const resStatusLocked = await fetch(`${baseUrl}/api/admin/students/${existingStudent1._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(resStatusLocked.status, 400);
    const bodyStatusLocked = await resStatusLocked.json();
    assert.match(bodyStatusLocked.message, /status cannot be modified via profile editing/i);
  });

  // ── Test 10: Audit Log Privacy Verification ────────────────────────────────
  await t.test('10. Audit logs never log sensitive student PII (phone numbers, passwords)', async () => {
    const logs = await AuditLog.find({ entityType: 'Student' }).lean();
    assert.ok(logs.length > 0);
    for (const log of logs) {
      assert.ok(!log.summary.includes('98765432'), 'Phone numbers must not be logged in audit summaries');
      assert.ok(!log.summary.includes('password'), 'Passwords must never be mentioned in audit summaries');
    }
  });

  // ── Test 11: 10-digit mobile phone numbers rejected as roll numbers ────────
  await t.test('11. POST /api/admin/students rejects 10-digit mobile phone numbers as roll numbers', async () => {
    const res = await fetch(`${baseUrl}/api/admin/students`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rollNumber: '9876543210',
        fullName: 'Phone As Roll',
        branch: 'CSE',
        semester: 3,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /10-digit mobile phone numbers? cannot be used as/i);
  });

  // ── Test 12: Status updates synchronize linked User.isActive ───────────────
  await t.test('12. PATCH /api/admin/students/:id/status synchronizes linked User.isActive', async () => {
    const linkedUser = await User.create({
      name: 'Linked Student User',
      email: 'linked.student@campus.edu',
      loginId: 'TEST_LINKED_001',
      passwordHash: 'hashed_pw_dummy_123',
      role: 'student',
      isActive: true,
    });
    const linkedStudent = await Student.create({
      rollNumber: 'TEST_LINKED_ROLL',
      fullName: 'Linked Student User',
      user: linkedUser._id,
      branch: 'CSE',
      semester: 3,
      status: 'active',
      accountStatus: 'active_user',
    });

    // Deactivate student
    const resDeact = await fetch(`${baseUrl}/api/admin/students/${linkedStudent._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(resDeact.status, 200);

    const updatedUserDeact = await User.findById(linkedUser._id);
    assert.equal(updatedUserDeact.isActive, false);

    // Reactivate student
    const resReact = await fetch(`${baseUrl}/api/admin/students/${linkedStudent._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(resReact.status, 200);

    const updatedUserReact = await User.findById(linkedUser._id);
    assert.equal(updatedUserReact.isActive, true);
  });

  // ── Test 13: DELETE blocks deletion when dependencies exist ────────────────
  await t.test('13. DELETE /api/admin/students/:id rejects deletion when dependencies exist with 400', async () => {
    const studentWithAtt = await Student.create({
      rollNumber: 'ROLL_WITH_ATT',
      fullName: 'Student With Attendance',
      branch: 'CSE',
      semester: 3,
      status: 'active',
    });
    // Create attendance record
    await Attendance.create({
      student: studentWithAtt._id,
      session: new mongoose.Types.ObjectId(),
      subject: new mongoose.Types.ObjectId(),
      status: 'present',
      date: '2026-11-19',
    });

    const res = await fetch(`${baseUrl}/api/admin/students/${studentWithAtt._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /cannot permanently delete/i);
    assert.match(body.message, /attendance record/i);

    // Verify student still exists
    const stillExists = await Student.findById(studentWithAtt._id);
    assert.ok(stillExists);
  });

  // ── Test 14: DELETE successfully deletes student with zero dependencies ────
  await t.test('14. DELETE /api/admin/students/:id deletes student with 0 dependencies and linked user', async () => {
    const userToDelete = await User.create({
      name: 'User To Delete',
      email: 'delete.user@campus.edu',
      loginId: 'TEST_DEL_001',
      passwordHash: 'hashed_pw_dummy_123',
      role: 'student',
      isActive: true,
    });
    const studentToDelete = await Student.create({
      rollNumber: 'ROLL_TO_DELETE',
      fullName: 'Student To Delete',
      user: userToDelete._id,
      branch: 'CSE',
      semester: 3,
      status: 'active',
    });

    const res = await fetch(`${baseUrl}/api/admin/students/${studentToDelete._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // Verify student is removed
    const deletedStudent = await Student.findById(studentToDelete._id);
    assert.equal(deletedStudent, null);

    // Verify user is removed
    const deletedUser = await User.findById(userToDelete._id);
    assert.equal(deletedUser, null);

    // Verify audit log
    const auditLog = await AuditLog.findOne({
      entityId: studentToDelete._id,
      action: 'ADMIN_STUDENT_DELETE',
    });
    assert.ok(auditLog);
  });

  // ── Test 15: DELETE RBAC enforces admin only ───────────────────────────────
  await t.test('15. DELETE /api/admin/students/:id blocks unauthenticated and non-admin requests', async () => {
    const tempStudent = await Student.create({
      rollNumber: 'ROLL_RBAC_TEST',
      fullName: 'RBAC Test Student',
      branch: 'CSE',
      semester: 3,
      status: 'active',
    });

    // Unauthenticated
    const resNoAuth = await fetch(`${baseUrl}/api/admin/students/${tempStudent._id}`, {
      method: 'DELETE',
    });
    assert.equal(resNoAuth.status, 401);

    // Faculty token
    const facultyToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), role: 'faculty' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const resFaculty = await fetch(`${baseUrl}/api/admin/students/${tempStudent._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${facultyToken}`,
      },
    });
    assert.equal(resFaculty.status, 403);
  });
});
