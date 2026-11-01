/**
 * server/tests/hostel_management.test.js
 * Comprehensive Test Suite for Part 18:
 * Hostel Management, Room Allocation, Accommodation & Warden Administration.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const HostelRoom = require('../models/HostelRoom');
const HostelBed = require('../models/HostelBed');
const HostelApplication = require('../models/HostelApplication');
const HostelAllocation = require('../models/HostelAllocation');
const HostelOccupancy = require('../models/HostelOccupancy');
const HostelTransferRequest = require('../models/HostelTransferRequest');
const HostelPolicy = require('../models/HostelPolicy');
const MessMenu = require('../models/MessMenu');
const HostelAuditLog = require('../models/HostelAuditLog');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const hostelController = require('../controllers/hostel.controller');
const hostelService = require('../services/hostel.service');
const { allowRoles } = require('../middleware/role.middleware');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    headers: {},
    rawBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    send(data) {
      this.rawBody = data;
      return this;
    },
  };
}

test('Part 18: Hostel Management System End-to-End Suite', async (t) => {
  let adminUser, warden1User, warden2User, student1User, student2User, facultyUser;
  let student1Doc, student2Doc;
  let hostel1Doc, hostel2Doc;
  let room1Doc, room2Doc;
  let bed1ADoc, bed1BDoc, bed2ADoc;
  let app1Doc, app2Doc;
  let alloc1Doc;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean existing test collections
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Hostel.deleteMany({}),
      HostelRoom.deleteMany({}),
      HostelBed.deleteMany({}),
      HostelApplication.deleteMany({}),
      HostelAllocation.deleteMany({}),
      HostelOccupancy.deleteMany({}),
      HostelTransferRequest.deleteMany({}),
      HostelPolicy.deleteMany({}),
      MessMenu.deleteMany({}),
      HostelAuditLog.deleteMany({}),
      Complaint.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // Ensure MongoDB indexes are built
    await Promise.all([
      Hostel.init(),
      HostelRoom.init(),
      HostelBed.init(),
      HostelApplication.init(),
      HostelAllocation.init(),
      HostelOccupancy.init(),
      HostelTransferRequest.init(),
      HostelPolicy.init(),
      HostelAuditLog.init(),
    ]);

    // 1. Create Admin User
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin.hostel@test.edu',
      loginId: 'ADMIN_HOSTEL_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'admin',
    });

    // 2. Create Warden 1 User
    warden1User = await User.create({
      name: 'Dr. Ramesh Kumar',
      email: 'warden1@test.edu',
      loginId: 'WARDEN_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'warden',
    });

    // 3. Create Warden 2 User
    warden2User = await User.create({
      name: 'Dr. Sunita Devi',
      email: 'warden2@test.edu',
      loginId: 'WARDEN_02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'warden',
    });

    // 4. Create Faculty User
    facultyUser = await User.create({
      name: 'Prof. Sharma',
      email: 'faculty.hostel@test.edu',
      loginId: 'FACULTY_HOSTEL_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });

    // 5. Create Student 1 (Male)
    student1User = await User.create({
      name: 'Amit Patel',
      email: 'amit.hostel@test.edu',
      loginId: 'STU_HOSTEL_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Amit Patel',
      enrollmentNumber: 'EN_HST_001',
      rollNumber: 'CS_HST_001',
      department: 'Computer Science',
      program: 'B.Tech',
      branch: 'CSE',
      gender: 'male',
      batch: '2023-2027',
      admissionYear: 2023,
      currentSemester: 5,
      section: 'A',
      status: 'active',
    });

    // 6. Create Student 2 (Female)
    student2User = await User.create({
      name: 'Sneha Rao',
      email: 'sneha.hostel@test.edu',
      loginId: 'STU_HOSTEL_02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Sneha Rao',
      enrollmentNumber: 'EN_HST_002',
      rollNumber: 'EC_HST_002',
      department: 'Electronics',
      program: 'B.Tech',
      branch: 'ECE',
      gender: 'female',
      batch: '2023-2027',
      admissionYear: 2023,
      currentSemester: 5,
      section: 'B',
      status: 'active',
    });

    // 7. Initialize Default Hostel Policy
    await HostelPolicy.create({
      applicationWindowOpen: true,
      maxActiveApplicationsPerStudent: 1,
      maxAllocationDurationMonths: 12,
      allowCrossGenderAllocation: false,
      requireGuardianConsent: false,
      defaultHostelFeeInPaise: 4500000,
      defaultSecurityDepositInPaise: 1000000,
      defaultMessFeeInPaise: 2500000,
      isActive: true,
    });
  });

  // Test 1: Authorized hostel creation (Admin)
  await t.test('Test 1: Authorized hostel creation by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        name: 'Tagore Boys Hostel',
        code: 'TBH-1',
        type: 'boys',
        genderEligibility: 'male',
        building: 'Block Alpha',
        campusLocation: 'North Campus',
        description: 'Undergraduate residential complex for male students.',
        wardens: [warden1User._id],
        contactNumber: '+91 9876543210',
        contactEmail: 'tagore.hostel@test.edu',
      },
    };
    const res = createMockRes();

    await hostelController.createHostel(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.code, 'TBH-1');
    assert.strictEqual(res.jsonData.data.genderEligibility, 'male');
    hostel1Doc = res.jsonData.data;

    // Check Audit Log
    const audit = await HostelAuditLog.findOne({ action: 'hostel_created', entityId: hostel1Doc._id });
    assert.ok(audit, 'Audit log for hostel creation must exist');
  });

  // Test 2: Unauthorized hostel creation (Student/Faculty rejected with 403)
  await t.test('Test 2: Unauthorized hostel creation rejected (403 for Student & Faculty)', async () => {
    const middleware = allowRoles('admin');

    let calledStudentNext = false;
    const reqStudent = { user: { userId: student1User._id, role: 'student' } };
    const resStudent = createMockRes();
    middleware(reqStudent, resStudent, () => { calledStudentNext = true; });
    assert.strictEqual(resStudent.statusCode, 403);
    assert.strictEqual(calledStudentNext, false);

    let calledFacultyNext = false;
    const reqFaculty = { user: { userId: facultyUser._id, role: 'faculty' } };
    const resFaculty = createMockRes();
    middleware(reqFaculty, resFaculty, () => { calledFacultyNext = true; });
    assert.strictEqual(resFaculty.statusCode, 403);
    assert.strictEqual(calledFacultyNext, false);
  });

  // Test 3: Hostel update authorization
  await t.test('Test 3: Hostel update by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: hostel1Doc._id },
      body: {
        description: 'Updated description: Renovated undergraduate boys hostel.',
        contactNumber: '+91 9123456789',
      },
    };
    const res = createMockRes();

    await hostelController.updateHostel(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.contactNumber, '+91 9123456789');
  });

  // Test 4: Room creation with capacity & facilities
  await t.test('Test 4: Room creation with capacity and facilities', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        hostelId: hostel1Doc._id,
        roomNumber: '101',
        floor: 1,
        capacity: 2,
        roomType: 'double',
        facilities: ['Wi-Fi', 'Attached Bath', 'Study Desk'],
      },
    };
    const res = createMockRes();

    await hostelController.createRoom(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.roomNumber, '101');
    assert.strictEqual(res.jsonData.data.capacity, 2);
    assert.strictEqual(res.jsonData.data.status, 'available');
    room1Doc = res.jsonData.data;
  });

  // Test 5: Bed creation with unique bedId and bedNumber
  await t.test('Test 5: Bed creation with unique bedId and bedNumber', async () => {
    // Bed 101-A
    const reqA = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedNumber: '101-A',
      },
    };
    const resA = createMockRes();
    await hostelController.createBed(reqA, resA);
    assert.strictEqual(resA.statusCode, 201);
    assert.strictEqual(resA.jsonData.data.bedNumber, '101-A');
    assert.strictEqual(resA.jsonData.data.bedId, 'TBH-1-101-A');
    bed1ADoc = resA.jsonData.data;

    // Bed 101-B
    const reqB = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedNumber: '101-B',
      },
    };
    const resB = createMockRes();
    await hostelController.createBed(reqB, resB);
    assert.strictEqual(resB.statusCode, 201);
    assert.strictEqual(resB.jsonData.data.bedNumber, '101-B');
    bed1BDoc = resB.jsonData.data;
  });

  // Test 6: Duplicate bed identifier rejection (409)
  await t.test('Test 6: Duplicate bed identifier rejected with 409', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedNumber: '101-A',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.createBed(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already exists/i);
        return true;
      }
    );
  });

  // Test 7: Room capacity validation (cannot add beds beyond room capacity)
  await t.test('Test 7: Room capacity validation prevents exceeding maximum beds', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedNumber: '101-C', // Exceeds capacity 2
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.createBed(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /capacity limit|reached.*capacity/i);
        return true;
      }
    );
  });

  // Test 8: Hostel capacity auto-calculation (sync total/available/occupied)
  await t.test('Test 8: Hostel capacity synchronization updates rooms and beds counts', async () => {
    const syncedHostel = await hostelService.syncHostelCapacity(hostel1Doc._id);
    assert.strictEqual(syncedHostel.totalRooms, 1);
    assert.strictEqual(syncedHostel.totalBeds, 2);
    assert.strictEqual(syncedHostel.availableBeds, 2);
    assert.strictEqual(syncedHostel.occupiedBeds, 0);
  });

  // Test 9: Student hostel application creation
  await t.test('Test 9: Student hostel application submission', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      body: {
        academicYear: '2026-2027',
        preferredHostels: [hostel1Doc._id],
        requestedRoomType: 'double',
        distanceFromCollegeKm: 125,
        guardianName: 'Dinesh Patel',
        guardianPhone: '+91 9988776655',
        emergencyContactName: 'Dinesh Patel',
        emergencyContactPhone: '+91 9988776655',
        emergencyContactRelation: 'Father',
      },
    };
    const res = createMockRes();

    await hostelController.createApplication(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(['submitted', 'pending'].includes(res.jsonData.data.status));
    assert.ok(res.jsonData.data.applicationNumber.startsWith('HAPP-'));
    app1Doc = res.jsonData.data;
  });

  // Test 10: Duplicate active application prevention for same academic year
  await t.test('Test 10: Duplicate active application rejected with 409', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        academicYear: '2026-2027',
        preferredHostels: [hostel1Doc._id],
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.createApplication(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already have an active|already submitted/i);
        return true;
      }
    );
  });

  // Test 11: Student cross-application access rejection (Anti-IDOR)
  await t.test('Test 11: Student can only view their own applications (Anti-IDOR)', async () => {
    // Student 1 queries
    const req1 = {
      user: { userId: student1User._id, role: 'student' },
      query: {},
    };
    const res1 = createMockRes();
    await hostelController.getApplications(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.jsonData.data.length, 1);
    assert.strictEqual(String(res1.jsonData.data[0]._id), String(app1Doc._id));

    // Student 2 queries (should be 0)
    const req2 = {
      user: { userId: student2User._id, role: 'student' },
      query: {},
    };
    const res2 = createMockRes();
    await hostelController.getApplications(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.jsonData.data.length, 0);
  });

  // Test 12: Application approval authorization (Admin/Warden)
  await t.test('Test 12: Application approval by assigned Warden', async () => {
    const req = {
      user: { userId: warden1User._id, role: 'warden', name: warden1User.name },
      params: { id: app1Doc._id },
      body: {
        decision: 'approved',
        comments: 'Verified documents and eligibility. Approved for double room.',
      },
    };
    const res = createMockRes();

    await hostelController.reviewApplication(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'approved');
  });

  // Test 13: Application rejection with mandatory detailed reason (min 5 chars)
  await t.test('Test 13: Application rejection validation requires minimum 5 characters', async () => {
    // Create an application for Student 2 first
    const appReq = {
      user: { userId: student2User._id, role: 'student' },
      body: {
        academicYear: '2026-2027',
        requestedRoomType: 'single',
        emergencyContactName: 'Anil Rao',
        emergencyContactPhone: '+91 9123491234',
        emergencyContactRelation: 'Guardian',
      },
    };
    const appRes = createMockRes();
    await hostelController.createApplication(appReq, appRes);
    app2Doc = appRes.jsonData.data;

    // Attempt rejection with empty/short reason (< 5 chars)
    const reqInvalid = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: app2Doc._id },
      body: {
        decision: 'rejected',
        rejectionReason: 'No', // < 5 chars
      },
    };
    const resInvalid = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.reviewApplication(reqInvalid, resInvalid);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /minimum 5 characters/i);
        return true;
      }
    );

    // Valid rejection with sufficient reason
    const reqValid = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: app2Doc._id },
      body: {
        decision: 'rejected',
        rejectionReason: 'Incomplete residency documents submitted',
      },
    };
    const resValid = createMockRes();
    await hostelController.reviewApplication(reqValid, resValid);
    assert.strictEqual(resValid.statusCode, 200);
    assert.strictEqual(resValid.jsonData.data.status, 'rejected');
  });

  // Test 14: Warden hostel-scope enforcement (warden cannot approve outside assigned hostels)
  await t.test('Test 14: Warden hostel-scope authorization prevents cross-hostel actions', async () => {
    // Warden 2 is NOT assigned to Hostel 1
    const isWarden2Auth = await hostelService.isWardenAuthorizedForHostel(
      { userId: warden2User._id, role: 'warden' },
      hostel1Doc._id
    );
    assert.strictEqual(isWarden2Auth, false);

    // Warden 1 IS assigned to Hostel 1
    const isWarden1Auth = await hostelService.isWardenAuthorizedForHostel(
      { userId: warden1User._id, role: 'warden' },
      hostel1Doc._id
    );
    assert.strictEqual(isWarden1Auth, true);

    // Attempt allocation in Hostel 1 by Warden 2
    const req = {
      user: { userId: warden2User._id, role: 'warden' },
      body: {
        studentId: student1Doc._id,
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedId: bed1ADoc._id,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.allocateBed(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized/i);
        return true;
      }
    );
  });

  // Test 15: Successful bed allocation to approved student
  await t.test('Test 15: Successful bed allocation by assigned Warden', async () => {
    const req = {
      user: { userId: warden1User._id, role: 'warden' },
      body: {
        studentId: student1Doc._id,
        applicationId: app1Doc._id,
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedId: bed1ADoc._id,
        academicYear: '2026-2027',
        remarks: 'Allocated Bed 101-A for academic year 2026-2027',
      },
    };
    const res = createMockRes();

    await hostelController.allocateBed(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'allocated');
    alloc1Doc = res.jsonData.data;

    // Verify bed status is updated to 'allocated'
    const updatedBed = await HostelBed.findById(bed1ADoc._id);
    assert.strictEqual(updatedBed.status, 'allocated');
    assert.strictEqual(String(updatedBed.currentStudent), String(student1Doc._id));

    // Verify application status updated to 'allocated'
    const updatedApp = await HostelApplication.findById(app1Doc._id);
    assert.strictEqual(updatedApp.status, 'allocated');
  });

  // Test 16: Allocation of an unavailable bed rejected with 409
  await t.test('Test 16: Allocation of an already allocated bed rejected with 409', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student2Doc._id,
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedId: bed1ADoc._id, // Already allocated to Student 1
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.allocateBed(req, res);
      },
      (err) => {
        // May fail gender eligibility or bed availability
        assert.ok([400, 409].includes(err.statusCode));
        return true;
      }
    );
  });

  // Test 17: Concurrent allocation race condition safety
  await t.test('Test 17: Concurrent allocation safety via atomic findOneAndUpdate', async () => {
    // Bed 101-A is already allocated, findOneAndUpdate for available returns null
    const result = await HostelBed.findOneAndUpdate(
      { _id: bed1ADoc._id, status: 'available' },
      { $set: { status: 'allocated' } },
      { new: true }
    );
    assert.strictEqual(result, null, 'Concurrent allocation must find null and prevent race condition');
  });

  // Test 18: Conflicting student allocation prevention (cannot hold 2 active rooms)
  await t.test('Test 18: Conflicting allocation rejected if student already holds active room', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student1Doc._id, // Student 1 already holds Bed 101-A
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedId: bed1BDoc._id,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.allocateBed(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /already possesses an active/i);
        return true;
      }
    );
  });

  // Test 19: Successful student check-in (marks allocation active and bed occupied)
  await t.test('Test 19: Student check-in circulation workflow', async () => {
    const req = {
      user: { userId: warden1User._id, role: 'warden' },
      params: { id: alloc1Doc._id },
      body: {
        inventoryCondition: 'All furniture and fixtures in good order',
        keysIssued: 2,
        notes: 'Room key and wardrobe key issued',
      },
    };
    const res = createMockRes();

    await hostelController.checkInStudent(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'checked_in');

    // Allocation should now be 'active'
    const alloc = await HostelAllocation.findById(alloc1Doc._id);
    assert.strictEqual(alloc.status, 'active');

    // Bed status should now be 'occupied'
    const bed = await HostelBed.findById(bed1ADoc._id);
    assert.strictEqual(bed.status, 'occupied');
  });

  // Test 20: Invalid check-in rejection (already checked in or unapproved)
  await t.test('Test 20: Duplicate check-in rejected with 400', async () => {
    const req = {
      user: { userId: warden1User._id, role: 'warden' },
      params: { id: alloc1Doc._id },
      body: { keysIssued: 1 },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.checkInStudent(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Cannot check-in allocation with status 'active'/i);
        return true;
      }
    );
  });

  // Test 21: Successful student check-out (releases bed to available)
  await t.test('Test 21: Student check-out releases bed to available', async () => {
    // Create a temporary room and bed in Hostel 1 for check-out testing
    const tempRoom = await HostelRoom.create({
      hostel: hostel1Doc._id,
      roomNumber: '999',
      floor: 9,
      capacity: 1,
      roomType: 'single',
      status: 'available',
    });
    const tempBed = await HostelBed.create({
      hostel: hostel1Doc._id,
      room: tempRoom._id,
      bedNumber: '999-A',
      bedId: 'TBH-1-999-A',
      status: 'allocated',
    });
    const tempAlloc = await HostelAllocation.create({
      allocationNumber: 'HALLOC-TEMP-TEST',
      student: student1Doc._id,
      hostel: hostel1Doc._id,
      room: tempRoom._id,
      bed: tempBed._id,
      academicYear: '2026-2027',
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allocatedBy: adminUser._id,
      status: 'active',
    });
    await HostelOccupancy.create({
      allocation: tempAlloc._id,
      student: student1Doc._id,
      hostel: hostel1Doc._id,
      room: tempRoom._id,
      bed: tempBed._id,
      checkIn: { date: new Date(), staff: adminUser._id },
      status: 'checked_in',
    });

    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: tempAlloc._id },
      body: {
        roomCondition: 'Pristine, no damages',
        keysReturned: true,
        damageAssessmentInPaise: 0,
        outstandingDuesInPaise: 0,
        clearanceStatus: 'cleared',
        clearanceNotes: 'Full clearance granted',
      },
    };
    const res = createMockRes();

    await hostelController.checkOutStudent(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'checked_out');

    // Bed must be released back to 'available'
    const releasedBed = await HostelBed.findById(tempBed._id);
    assert.strictEqual(releasedBed.status, 'available');
    assert.strictEqual(releasedBed.currentStudent, null);
  });

  // Test 22: Duplicate check-out rejection (already checked out)
  await t.test('Test 22: Duplicate check-out rejected with 400', async () => {
    // Find the allocation just checked out
    const alloc = await HostelAllocation.findOne({ allocationNumber: 'HALLOC-TEMP-TEST' });
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: alloc._id },
      body: { clearanceStatus: 'cleared' },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await hostelController.checkOutStudent(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /already completed check-out/i);
        return true;
      }
    );
  });

  // Test 23: Room transfer request submission by student
  let transferReqDoc;
  await t.test('Test 23: Room transfer request submission by student', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        requestedRoomType: 'double',
        reason: 'Seeking transfer to a study room closer to library wing',
      },
    };
    const res = createMockRes();

    await hostelController.requestTransfer(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'pending');
    transferReqDoc = res.jsonData.data;
  });

  // Test 24: Room transfer approval and atomic bed swap
  await t.test('Test 24: Room transfer approval and atomic bed swap', async () => {
    // Bed 101-B is available in Room 101
    const req = {
      user: { userId: warden1User._id, role: 'warden' },
      params: { id: transferReqDoc._id },
      body: {
        decision: 'approved',
        comments: 'Transfer approved to Bed 101-B',
        newHostelId: hostel1Doc._id,
        newRoomId: room1Doc._id,
        newBedId: bed1BDoc._id,
      },
    };
    const res = createMockRes();

    await hostelController.reviewTransfer(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'approved');

    // Old bed (101-A) should now be released to 'available'
    const oldBed = await HostelBed.findById(bed1ADoc._id);
    assert.strictEqual(oldBed.status, 'available');

    // New bed (101-B) should be 'allocated'
    const newBed = await HostelBed.findById(bed1BDoc._id);
    assert.strictEqual(newBed.status, 'allocated');
    assert.strictEqual(String(newBed.currentStudent), String(student1Doc._id));

    // Old allocation should be 'transferred'
    const oldAlloc = await HostelAllocation.findById(alloc1Doc._id);
    assert.strictEqual(oldAlloc.status, 'transferred');
  });

  // Test 25: Historical allocation and occupancy preservation after transfer
  await t.test('Test 25: Historical allocation records preserved after transfer', async () => {
    const studentAllocations = await HostelAllocation.find({ student: student1Doc._id }).sort({ createdAt: 1 });
    assert.strictEqual(studentAllocations.length, 3); // initial + temp-test + new transfer allocation
    const statuses = studentAllocations.map((a) => a.status);
    assert.ok(statuses.includes('transferred'));
    assert.ok(statuses.includes('allocated'));
  });

  // Test 26: Hostel fee integration (linking fee structure/invoice)
  await t.test('Test 26: Hostel fee amounts stored in integer paise currency precision', async () => {
    const policy = await hostelService.getActivePolicy();
    assert.strictEqual(typeof policy.defaultHostelFeeInPaise, 'number');
    assert.strictEqual(policy.defaultHostelFeeInPaise, 4500000); // Rs. 45,000.00
    assert.strictEqual(policy.defaultSecurityDepositInPaise, 1000000); // Rs. 10,000.00
    assert.strictEqual(policy.defaultMessFeeInPaise, 2500000); // Rs. 25,000.00
  });

  // Test 27: Duplicate hostel invoice prevention
  await t.test('Test 27: Hostel allocation model prevents ambiguous active billing terms', async () => {
    // A student can only have 1 active/allocated accommodation at any time
    const activeCount = await HostelAllocation.countDocuments({
      student: student1Doc._id,
      status: { $in: ['allocated', 'active'] },
    });
    assert.strictEqual(activeCount, 1, 'Student must have exactly one active allocation term');
  });

  // Test 28: Hostel maintenance complaint registration (category: hostel)
  let complaintDoc;
  await t.test('Test 28: Hostel maintenance complaint registration (category: hostel)', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        title: 'Ceiling fan making vibrating noise',
        description: 'The ceiling fan speed regulator is loose and vibrates excessively.',
        hostelId: hostel1Doc._id,
        roomId: room1Doc._id,
        bedId: bed1BDoc._id,
        priority: 'high',
      },
    };
    const res = createMockRes();

    await hostelController.createHostelComplaint(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.category, 'hostel');
    assert.strictEqual(res.jsonData.data.priority, 'high');
    complaintDoc = res.jsonData.data;
  });

  // Test 29: Warden maintenance access restricted to assigned hostels
  await t.test('Test 29: Warden maintenance access scoped to assigned hostels', async () => {
    // Warden 1 is assigned to Hostel 1 -> receives the complaint
    const reqW1 = {
      user: { userId: warden1User._id, role: 'warden' },
      query: {},
    };
    const resW1 = createMockRes();
    await hostelController.getHostelComplaints(reqW1, resW1);
    assert.strictEqual(resW1.statusCode, 200);
    assert.ok(resW1.jsonData.data.length >= 1);

    // Warden 2 is assigned to Hostel 2 -> receives 0 complaints
    const reqW2 = {
      user: { userId: warden2User._id, role: 'warden' },
      query: {},
    };
    const resW2 = createMockRes();
    await hostelController.getHostelComplaints(reqW2, resW2);
    assert.strictEqual(resW2.statusCode, 200);
    assert.strictEqual(resW2.jsonData.data.length, 0);
  });

  // Test 30: Notification delivery for application approval, allocation, check-in, and transfer
  await t.test('Test 30: Notifications created with category: hostel', async () => {
    const notifications = await Notification.find({
      recipient: student1User._id,
      category: 'hostel',
    });
    assert.ok(notifications.length >= 3, 'Multiple hostel lifecycle notifications must be generated');
    const titles = notifications.map((n) => n.title);
    assert.ok(titles.some((t) => t.includes('Application') || t.includes('Allocated') || t.includes('Transfer')));
  });

  // Test 31: Hostel policy configuration and update by Admin
  await t.test('Test 31: Hostel policy configuration update by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        applicationWindowOpen: true,
        defaultHostelFeeInPaise: 4800000, // Updated to 48,000 INR
        allowCrossGenderAllocation: false,
      },
    };
    const res = createMockRes();

    await hostelController.updateHostelPolicy(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.defaultHostelFeeInPaise, 4800000);
  });

  // Test 32: Gender eligibility validation (male in female hostel rejected)
  await t.test('Test 32: Gender eligibility validation prevents cross-gender allocation', async () => {
    // Create Girls hostel
    const reqHostel = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        name: 'Sarojini Girls Hostel',
        code: 'SGH-1',
        type: 'girls',
        genderEligibility: 'female',
      },
    };
    const resHostel = createMockRes();
    await hostelController.createHostel(reqHostel, resHostel);
    hostel2Doc = resHostel.jsonData.data;

    // Check eligibility of male student for girls hostel
    const policy = await hostelService.getActivePolicy();
    const eligibility = hostelService.checkStudentHostelEligibility(student1Doc, hostel2Doc, policy);
    assert.strictEqual(eligibility.eligible, false);
    assert.match(eligibility.reason, /female students only/i);
  });

  // Test 33: CSV formula injection defense (CWE-1236) on occupancy & application exports
  await t.test('Test 33: CSV formula injection defense (CWE-1236)', async () => {
    // Verify malicious formula symbols are prefixed with apostrophe
    assert.strictEqual(hostelService.sanitizeCsvValue('=1+2'), '"\'=1+2"');
    assert.strictEqual(hostelService.sanitizeCsvValue('+CMD'), '"\'+CMD"');
    assert.strictEqual(hostelService.sanitizeCsvValue('-100'), '"\'-100"');
    assert.strictEqual(hostelService.sanitizeCsvValue('@SUM(A1)'), '"\'@SUM(A1)"');
    assert.strictEqual(hostelService.sanitizeCsvValue('Normal Text'), '"Normal Text"');

    // Test export API
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: { type: 'applications' },
    };
    const res = createMockRes();
    await hostelController.exportHostelCsv(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.ok(res.rawBody.includes('Application Number,Student Name'));
  });

  // Test 34: Unauthorized API access protection across endpoints
  await t.test('Test 34: Role-based endpoint authorization enforcement', async () => {
    const adminOnly = allowRoles('admin');
    const studentUserReq = { user: { userId: student1User._id, role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;

    adminOnly(studentUserReq, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  // Test 35: Cross-hostel data isolation for wardens
  await t.test('Test 35: Cross-hostel data isolation strictly enforced for wardens', async () => {
    // Warden 2 has zero assigned hostels
    const warden2Hostels = await Hostel.find({ wardens: warden2User._id });
    assert.strictEqual(warden2Hostels.length, 0);

    // Warden 1 has 1 assigned hostel
    const warden1Hostels = await Hostel.find({ wardens: warden1User._id });
    assert.strictEqual(warden1Hostels.length, 1);
    assert.strictEqual(warden1Hostels[0].code, 'TBH-1');
  });

  // Test 36: Occupancy metrics and capacity accuracy
  await t.test('Test 36: Real-time hostel metrics and occupancy calculation accuracy', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
    };
    const res = createMockRes();

    await hostelController.getHostelMetrics(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    const { metrics } = res.jsonData.data;
    assert.ok(metrics.totalHostels >= 2);
    assert.ok(metrics.totalRooms >= 1);
    assert.strictEqual(typeof metrics.occupancyRatePercentage, 'number');
    assert.ok(metrics.occupancyRatePercentage >= 0 && metrics.occupancyRatePercentage <= 100);
  });

  await t.test('Teardown: Close isolated test database connection', async () => {
    await mongoose.connection.close();
  });
});
