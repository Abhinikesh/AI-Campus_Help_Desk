/**
 * server/tests/student_complaints_lifecycle_integrity.test.js
 * Comprehensive automated verification for Part 10.9:
 * Complete Student Complaints Lifecycle, RBAC Boundaries, IDOR Protection,
 * Canonical Status Enforcement, and Resolution Response Integrity.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { verifyTestDatabaseIsolation, assertConnectionIsolated } = require('./helpers/testDatabase');
const studentRoutes = require('../routes/student.routes');
const adminRoutes = require('../routes/admin.routes');
const User = require('../models/User');
const Student = require('../models/Student');
const Complaint = require('../models/Complaint');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'complaint_lifecycle_test_secret_key_12345';
}
const JWT_SECRET = process.env.JWT_SECRET;

test('Part 10.9: Student Complaints Lifecycle Integrity Suite', async (t) => {
  let mongod;
  let server;
  let baseUrl;
  let studentUserA, studentDocA, studentTokenA;
  let studentUserB, studentDocB, studentTokenB;
  let adminUser, adminToken;
  let staffUser, staffToken;
  let complaintIdA;
  let complaintIdB;

  // ── Setup ──────────────────────────────────────────────────────────────────
  await t.test('Setup: Spin up isolated MongoMemoryServer and Express test server', async () => {
    mongod = await MongoMemoryServer.create({
      instance: { dbName: 'test_student_complaints_lifecycle_isolated' }
    });
    const testUri = mongod.getUri() + 'test_student_complaints_lifecycle_isolated';
    assert.ok(!testUri.includes('27018'), 'Must not connect to canonical port 27018');
    verifyTestDatabaseIsolation(testUri, { disallowPort27018: true });

    await mongoose.connect(testUri);
    assertConnectionIsolated(mongoose.connection);

    await Complaint.init();
    await User.init();
    await Student.init();

    // Create Express test app
    const app = express();
    app.use(express.json());
    app.use('/api/student', studentRoutes);
    app.use('/api/admin', adminRoutes);

    // Global error handler
    app.use((err, req, res, next) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error'
      });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    // 1. Student A
    studentUserA = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@campus.test',
      role: 'student',
      loginId: 'STU_2024_001',
      passwordHash: 'dummyhash'
    });
    studentDocA = await Student.create({
      user: studentUserA._id,
      rollNumber: 'CS2024001',
      fullName: studentUserA.name,
      name: studentUserA.name,
      email: studentUserA.email,
      department: 'Computer Science',
      year: 2,
      semester: 4,
      program: 'B.Tech'
    });
    studentTokenA = jwt.sign({ userId: studentUserA._id, id: studentUserA._id, role: studentUserA.role }, JWT_SECRET);

    // 2. Student B
    studentUserB = await User.create({
      name: 'Pooja Nair',
      email: 'pooja.nair@campus.test',
      role: 'student',
      loginId: 'STU_2024_002',
      passwordHash: 'dummyhash'
    });
    studentDocB = await Student.create({
      user: studentUserB._id,
      rollNumber: 'CS2024002',
      fullName: studentUserB.name,
      name: studentUserB.name,
      email: studentUserB.email,
      department: 'Computer Science',
      year: 2,
      semester: 4,
      program: 'B.Tech'
    });
    studentTokenB = jwt.sign({ userId: studentUserB._id, id: studentUserB._id, role: studentUserB.role }, JWT_SECRET);

    // 3. Admin User
    adminUser = await User.create({
      name: 'Campus Administrator',
      email: 'admin@campus.test',
      role: 'admin',
      loginId: 'ADMIN_001',
      passwordHash: 'dummyhash'
    });
    adminToken = jwt.sign({ userId: adminUser._id, id: adminUser._id, role: adminUser.role }, JWT_SECRET);

    // 4. Non-Admin Staff User (e.g. Warden)
    staffUser = await User.create({
      name: 'Hostel Warden',
      email: 'warden@campus.test',
      role: 'warden',
      loginId: 'WARDEN_001',
      passwordHash: 'dummyhash'
    });
    staffToken = jwt.sign({ userId: staffUser._id, id: staffUser._id, role: staffUser.role }, JWT_SECRET);
  });

  // ── 1. Student A submits a valid complaint ─────────────────────────────────
  await t.test('1. Student A submits a valid complaint', async () => {
    const res = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({
        title: 'Library Wi-Fi Connectivity Issue',
        description: 'Unable to connect to eduroam on 2nd floor library reading room',
        category: 'infrastructure'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.adminResponse, '');
    assert.equal(String(body.data.raisedBy), String(studentUserA._id));

    complaintIdA = body.data._id;

    // Database verification
    const dbRecord = await Complaint.findById(complaintIdA);
    assert.ok(dbRecord);
    assert.equal(dbRecord.title, 'Library Wi-Fi Connectivity Issue');
    assert.equal(dbRecord.status, 'pending');
    assert.equal(dbRecord.adminResponse, '');
  });

  // ── 2. Student B submits a separate complaint ─────────────────────────────
  await t.test('2. Student B submits a separate complaint', async () => {
    const res = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenB}`
      },
      body: JSON.stringify({
        title: 'Hostel Hot Water Heater Damaged',
        description: 'Water heater in Block C 3rd floor bathroom is tripping circuit breaker',
        category: 'hostel'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(String(body.data.raisedBy), String(studentUserB._id));

    complaintIdB = body.data._id;

    const dbRecord = await Complaint.findById(complaintIdB);
    assert.ok(dbRecord);
    assert.equal(dbRecord.category, 'hostel');
  });

  // ── 3. Student A can retrieve their own complaint ─────────────────────────
  await t.test('3. Student A can retrieve their own complaint (list & detail)', async () => {
    // 3a. List
    const listRes = await fetch(`${baseUrl}/student/complaints`, {
      headers: { Authorization: `Bearer ${studentTokenA}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.success, true);
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.data[0]._id, complaintIdA);

    // 3b. Detail by ID
    const detailRes = await fetch(`${baseUrl}/student/complaints/${complaintIdA}`, {
      headers: { Authorization: `Bearer ${studentTokenA}` }
    });
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert.equal(detailBody.success, true);
    assert.equal(detailBody.data._id, complaintIdA);
    assert.equal(detailBody.data.title, 'Library Wi-Fi Connectivity Issue');
  });

  // ── 4. Student A cannot retrieve Student B's complaint (IDOR Protection) ───
  await t.test("4. Student A cannot retrieve Student B's complaint (IDOR Protection)", async () => {
    const res = await fetch(`${baseUrl}/student/complaints/${complaintIdB}`, {
      headers: { Authorization: `Bearer ${studentTokenA}` }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Forbidden: You do not have permission to view this complaint/i);
  });

  // ── 5. Student A cannot modify Student B's complaint ──────────────────────
  await t.test("5. Student A cannot modify Student B's complaint", async () => {
    // Attempting via admin route as student
    const resAdminRoute = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({ status: 'resolved', adminResponse: 'Tampered by student' })
    });
    assert.equal(resAdminRoute.status, 403);

    // Verify database record remains pristine
    const dbRecord = await Complaint.findById(complaintIdB);
    assert.equal(dbRecord.status, 'pending');
    assert.equal(dbRecord.adminResponse, '');
  });

  // ── 6. Student cannot spoof raisedBy during submission ─────────────────────
  await t.test('6. Student cannot spoof raisedBy during submission', async () => {
    const res = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({
        title: 'Spoofed Academic Issue',
        description: 'Impersonating Student B to register complaint',
        category: 'academic',
        raisedBy: studentUserB._id
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Forbidden: You cannot submit a complaint on behalf of another user/i);

    const checkSpoofed = await Complaint.findOne({ title: 'Spoofed Academic Issue' });
    assert.equal(checkSpoofed, null, 'No spoofed complaint should be created in database');
  });

  // ── 7. Student cannot update complaint status ──────────────────────────────
  await t.test('7. Student cannot update complaint status', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({ status: 'resolved', adminResponse: 'Self-resolved' })
    });

    assert.equal(res.status, 403);
    const dbRecord = await Complaint.findById(complaintIdA);
    assert.equal(dbRecord.status, 'pending');
  });

  // ── 8. Student cannot submit an admin resolution response ──────────────────
  await t.test('8. Student cannot submit an admin resolution response', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({ adminResponse: 'Malicious response' })
    });

    assert.equal(res.status, 403);
    const dbRecord = await Complaint.findById(complaintIdA);
    assert.equal(dbRecord.adminResponse, '');
  });

  // ── 9. Admin can list complaints ───────────────────────────────────────────
  await t.test('9. Admin can list all complaints across institution', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);

    const ids = body.data.map((c) => String(c._id));
    assert.ok(ids.includes(String(complaintIdA)));
    assert.ok(ids.includes(String(complaintIdB)));
    assert.ok(body.data[0].raisedBy?.name, 'Raiser details must be populated');
  });

  // ── 10. Admin can filter complaints by supported statuses ──────────────────
  await t.test('10. Admin can filter complaints by supported statuses', async () => {
    const resPending = await fetch(`${baseUrl}/admin/complaints?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resPending.status, 200);
    const bodyPending = await resPending.json();
    assert.equal(bodyPending.data.length, 2);

    const resResolved = await fetch(`${baseUrl}/admin/complaints?status=resolved`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resResolved.status, 200);
    const bodyResolved = await resResolved.json();
    assert.equal(bodyResolved.data.length, 0);
  });

  // ── 11. Admin can update a complaint to in-progress ────────────────────────
  await t.test('11. Admin can update a complaint to in-progress', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'in-progress',
        adminResponse: 'Assigned to IT network maintenance team for on-site inspection'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'in-progress');
    assert.equal(body.data.adminResponse, 'Assigned to IT network maintenance team for on-site inspection');

    const dbRecord = await Complaint.findById(complaintIdA);
    assert.equal(dbRecord.status, 'in-progress');
    assert.equal(dbRecord.resolvedAt, null, 'resolvedAt must remain null for in-progress');
  });

  // ── 12. Admin can resolve a complaint with a valid response ────────────────
  await t.test('12. Admin can resolve a complaint with a valid response', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'resolved',
        adminResponse: 'IT department replaced the faulty Cisco access point on the 2nd floor library. Connection verified at 100 Mbps.'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'resolved');
    assert.ok(body.data.resolvedAt);

    const dbRecord = await Complaint.findById(complaintIdA);
    assert.equal(dbRecord.status, 'resolved');
    assert.ok(dbRecord.resolvedAt);
    assert.equal(dbRecord.adminResponse, 'IT department replaced the faulty Cisco access point on the 2nd floor library. Connection verified at 100 Mbps.');
  });

  // ── 13. Student A can see the updated status and resolution response ───────
  await t.test('13. Student A can see the updated status and resolution response', async () => {
    // 13a. List endpoint
    const listRes = await fetch(`${baseUrl}/student/complaints`, {
      headers: { Authorization: `Bearer ${studentTokenA}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    const myComp = listBody.data.find((c) => String(c._id) === String(complaintIdA));
    assert.ok(myComp);
    assert.equal(myComp.status, 'resolved');
    assert.equal(myComp.adminResponse, 'IT department replaced the faulty Cisco access point on the 2nd floor library. Connection verified at 100 Mbps.');

    // 13b. Detail endpoint
    const detailRes = await fetch(`${baseUrl}/student/complaints/${complaintIdA}`, {
      headers: { Authorization: `Bearer ${studentTokenA}` }
    });
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert.equal(detailBody.data.status, 'resolved');
    assert.equal(detailBody.data.adminResponse, 'IT department replaced the faulty Cisco access point on the 2nd floor library. Connection verified at 100 Mbps.');
  });

  // ── 14. Student B cannot see Student A's complaint or response ─────────────
  await t.test("14. Student B cannot see Student A's complaint or response", async () => {
    // Student B list should NOT contain Student A's complaint
    const listRes = await fetch(`${baseUrl}/student/complaints`, {
      headers: { Authorization: `Bearer ${studentTokenB}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.data.length, 1);
    assert.equal(String(listBody.data[0]._id), String(complaintIdB));

    // Direct detail lookup for Student A's complaint must return 403
    const detailRes = await fetch(`${baseUrl}/student/complaints/${complaintIdA}`, {
      headers: { Authorization: `Bearer ${studentTokenB}` }
    });
    assert.equal(detailRes.status, 403);
  });

  // ── 15. Non-admin staff cannot access Admin complaint APIs ─────────────────
  await t.test('15. Non-admin staff cannot access Admin complaint APIs', async () => {
    const listRes = await fetch(`${baseUrl}/admin/complaints`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.equal(listRes.status, 403);

    const updateRes = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({ status: 'in-progress' })
    });
    assert.equal(updateRes.status, 403);
  });

  // ── 16. Unauthenticated requests are rejected ──────────────────────────────
  await t.test('16. Unauthenticated requests are rejected across all complaint endpoints', async () => {
    const r1 = await fetch(`${baseUrl}/student/complaints`);
    assert.equal(r1.status, 401);

    const r2 = await fetch(`${baseUrl}/student/complaints/${complaintIdA}`);
    assert.equal(r2.status, 401);

    const r3 = await fetch(`${baseUrl}/admin/complaints`);
    assert.equal(r3.status, 401);

    const r4 = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' })
    });
    assert.equal(r4.status, 401);
  });

  // ── 17. Invalid status values are rejected ──────────────────────────────────
  await t.test('17. Invalid status values are rejected in update and query operations', async () => {
    // 17a. Updating with non-canonical status 'closed'
    const resClosed = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'closed', adminResponse: 'Closing without resolve' })
    });
    assert.equal(resClosed.status, 400);
    const bodyClosed = await resClosed.json();
    assert.match(bodyClosed.message, /Invalid status. Must be one of: pending, in-progress, resolved/i);

    // 17b. Updating with arbitrary status
    const resArbitrary = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'arbitrary_status' })
    });
    assert.equal(resArbitrary.status, 400);

    // 17c. Querying with invalid status filter
    const resFilter = await fetch(`${baseUrl}/admin/complaints?status=invalid_filter`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resFilter.status, 400);
  });

  // ── 18. Empty resolution responses are rejected when resolving ─────────────
  await t.test('18. Empty or whitespace-only resolution responses are rejected when resolving', async () => {
    // 18a. Missing adminResponse
    const resMissing = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    assert.equal(resMissing.status, 400);
    const bodyMissing = await resMissing.json();
    assert.match(bodyMissing.message, /non-empty resolution response is required/i);

    // 18b. Whitespace-only adminResponse
    const resWhitespace = await fetch(`${baseUrl}/admin/complaints/${complaintIdB}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'resolved', adminResponse: '    \n   ' })
    });
    assert.equal(resWhitespace.status, 400);

    // Verify status was NOT changed in database
    const dbRecord = await Complaint.findById(complaintIdB);
    assert.equal(dbRecord.status, 'pending');
    assert.equal(dbRecord.adminResponse, '');
  });

  // ── 19. Complaint submission validates required fields ─────────────────────
  await t.test('19. Complaint submission validates required fields and disallows whitespace-only content', async () => {
    // Missing title
    const resNoTitle = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({
        title: '',
        description: 'Valid description with sufficient details',
        category: 'academic'
      })
    });
    assert.equal(resNoTitle.status, 400);

    // Whitespace description
    const resWhiteDesc = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({
        title: 'Valid Title',
        description: '    \t   ',
        category: 'academic'
      })
    });
    assert.equal(resWhiteDesc.status, 400);

    // Invalid category
    const resInvalidCat = await fetch(`${baseUrl}/student/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentTokenA}`
      },
      body: JSON.stringify({
        title: 'Valid Title',
        description: 'Valid description',
        category: 'unapproved_category_xyz'
      })
    });
    assert.equal(resInvalidCat.status, 400);
  });

  // ── 20. Repeated requests do not corrupt or overwrite complaint data ────────
  await t.test('20. Repeated updates preserve original complaint submission data', async () => {
    const originalComplaintA = await Complaint.findById(complaintIdA).lean();

    // Re-resolve with updated response text
    const reUpdateRes = await fetch(`${baseUrl}/admin/complaints/${complaintIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'resolved',
        adminResponse: 'Confirmed network signal strength is 100% across all library floors.'
      })
    });

    assert.equal(reUpdateRes.status, 200);

    const freshComplaintA = await Complaint.findById(complaintIdA).lean();
    assert.equal(freshComplaintA.title, originalComplaintA.title);
    assert.equal(freshComplaintA.description, originalComplaintA.description);
    assert.equal(freshComplaintA.category, originalComplaintA.category);
    assert.equal(String(freshComplaintA.raisedBy), String(originalComplaintA.raisedBy));
    assert.equal(freshComplaintA.createdAt.toISOString(), originalComplaintA.createdAt.toISOString());
    assert.equal(freshComplaintA.status, 'resolved');
    assert.equal(freshComplaintA.adminResponse, 'Confirmed network signal strength is 100% across all library floors.');
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect and stop isolated MongoMemoryServer', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
    assert.equal(mongoose.connection.readyState, 0);
  });
});
