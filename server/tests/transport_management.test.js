/**
 * server/tests/transport_management.test.js
 * Comprehensive Test Suite for Part 19:
 * Campus Transport Management, Routes, Vehicle Allocation & Transport Administration.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const TransportVehicle = require('../models/TransportVehicle');
const TransportRoute = require('../models/TransportRoute');
const TransportStop = require('../models/TransportStop');
const TransportStaffRecord = require('../models/TransportStaffRecord');
const TransportApplication = require('../models/TransportApplication');
const TransportAllocation = require('../models/TransportAllocation');
const TransportTrip = require('../models/TransportTrip');
const TransportMaintenance = require('../models/TransportMaintenance');
const TransportIncident = require('../models/TransportIncident');
const TransportPolicy = require('../models/TransportPolicy');
const TransportAuditLog = require('../models/TransportAuditLog');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const transportController = require('../controllers/transport.controller');
const transportService = require('../services/transport.service');
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

test('Part 19: Campus Transport Management System End-to-End Suite', async (t) => {
  let adminUser, managerUser, driver1User, driver2User, attendant1User, facultyUser;
  let student1User, student2User, student3User;
  let student1Doc, student2Doc, student3Doc;
  let driver1Staff, driver2Staff, attendant1Staff;
  let vehicle1Doc, vehicle2Doc, expiredVehicleDoc;
  let route1Doc, route2Doc;
  let stop1Doc, stop2Doc;
  let app1Doc, app2Doc;
  let alloc1Doc;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean existing test collections
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      TransportVehicle.deleteMany({}),
      TransportRoute.deleteMany({}),
      TransportStop.deleteMany({}),
      TransportStaffRecord.deleteMany({}),
      TransportApplication.deleteMany({}),
      TransportAllocation.deleteMany({}),
      TransportTrip.deleteMany({}),
      TransportMaintenance.deleteMany({}),
      TransportIncident.deleteMany({}),
      TransportPolicy.deleteMany({}),
      TransportAuditLog.deleteMany({}),
      Complaint.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // Ensure MongoDB indexes are built
    await Promise.all([
      TransportVehicle.init(),
      TransportRoute.init(),
      TransportStop.init(),
      TransportStaffRecord.init(),
      TransportApplication.init(),
      TransportAllocation.init(),
      TransportTrip.init(),
      TransportMaintenance.init(),
      TransportIncident.init(),
      TransportPolicy.init(),
      TransportAuditLog.init(),
    ]);

    // 1. Create Admin User
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin.transport@test.edu',
      loginId: 'ADMIN_TRANS_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'admin',
    });

    // 2. Create Transport Manager User
    managerUser = await User.create({
      name: 'Transit Manager',
      email: 'manager.transport@test.edu',
      loginId: 'TM_TRANS_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'transport_manager',
    });

    // 3. Create Driver 1 User
    driver1User = await User.create({
      name: 'Harish Singh',
      email: 'harish.driver@test.edu',
      loginId: 'DRV_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'driver',
    });
    driver1Staff = await TransportStaffRecord.create({
      user: driver1User._id,
      staffRole: 'driver',
      fullName: 'Harish Singh',
      phone: '+91 9811122334',
      licenseNumber: 'DL-DRIVER-2015-001',
      licenseCategory: 'heavy_passenger',
      licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
      availabilityStatus: 'available',
    });

    // 4. Create Driver 2 User (Expired License for tests)
    driver2User = await User.create({
      name: 'Balwant Verma',
      email: 'balwant.driver@test.edu',
      loginId: 'DRV_02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'driver',
    });
    driver2Staff = await TransportStaffRecord.create({
      user: driver2User._id,
      staffRole: 'driver',
      fullName: 'Balwant Verma',
      phone: '+91 9822233445',
      licenseNumber: 'DL-DRIVER-2010-099',
      licenseCategory: 'heavy_passenger',
      licenseExpiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago!
      availabilityStatus: 'available',
    });

    // 5. Create Attendant 1 User
    attendant1User = await User.create({
      name: 'Sunil Mehra',
      email: 'sunil.attendant@test.edu',
      loginId: 'ATT_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'attendant',
    });
    attendant1Staff = await TransportStaffRecord.create({
      user: attendant1User._id,
      staffRole: 'attendant',
      fullName: 'Sunil Mehra',
      phone: '+91 9833344556',
      availabilityStatus: 'available',
    });

    // 6. Create Faculty User
    facultyUser = await User.create({
      name: 'Prof. Ananya Sen',
      email: 'ananya.faculty@test.edu',
      loginId: 'FAC_TRANS_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });

    // 7. Create Student 1
    student1User = await User.create({
      name: 'Karan Mehra',
      email: 'karan.transport@test.edu',
      loginId: 'STU_TRANS_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Karan Mehra',
      enrollmentNumber: 'EN_TR_001',
      rollNumber: 'CS_TR_001',
      department: 'Computer Science',
      program: 'B.Tech',
      branch: 'CSE',
      gender: 'male',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'A',
      status: 'active',
    });

    // 8. Create Student 2
    student2User = await User.create({
      name: 'Divya Sharma',
      email: 'divya.transport@test.edu',
      loginId: 'STU_TRANS_02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Divya Sharma',
      enrollmentNumber: 'EN_TR_002',
      rollNumber: 'CS_TR_002',
      department: 'Computer Science',
      program: 'B.Tech',
      branch: 'CSE',
      gender: 'female',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'B',
      status: 'active',
    });

    // 9. Create Student 3
    student3User = await User.create({
      name: 'Rohan Gupta',
      email: 'rohan.transport@test.edu',
      loginId: 'STU_TRANS_03',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student3Doc = await Student.create({
      user: student3User._id,
      fullName: 'Rohan Gupta',
      enrollmentNumber: 'EN_TR_003',
      rollNumber: 'CS_TR_003',
      department: 'Computer Science',
      program: 'B.Tech',
      branch: 'CSE',
      gender: 'male',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'A',
      status: 'active',
    });

    // 10. Initialize Transport Policy
    await TransportPolicy.create({
      applicationWindowOpen: true,
      maxActiveApplicationsPerStudent: 1,
      defaultTransportFeeInPaise: 1800000, // Rs. 18,000.00
      allowRouteChanges: true,
      requireEmergencyContact: true,
      isActive: true,
    });
  });

  // Test 1: Authorized vehicle creation (Admin / Transport Manager)
  await t.test('Test 1: Authorized vehicle creation by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        registrationNumber: 'DL-01-AB-1234',
        vehicleCode: 'BUS-01',
        vehicleType: 'bus',
        makeAndModel: 'Tata Starbus Ultra 40-Seater',
        seatingCapacity: 40,
        ownershipType: 'institution_owned',
        documents: {
          insurance: {
            documentNumber: 'INS-2026-001',
            providerOrAuthority: 'National Insurance Co',
            expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
            verified: true,
          },
          fitnessCertificate: {
            documentNumber: 'FIT-2026-001',
            expiryDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
            verified: true,
          },
        },
      },
    };
    const res = createMockRes();

    await transportController.createVehicle(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.vehicleCode, 'BUS-01');
    assert.strictEqual(res.jsonData.data.registrationNumber, 'DL-01-AB-1234');
    vehicle1Doc = res.jsonData.data;

    // Check Audit Log
    const audit = await TransportAuditLog.findOne({ action: 'vehicle_created', entityId: vehicle1Doc._id });
    assert.ok(audit, 'Audit log for vehicle creation must exist');
  });

  // Test 2: Unauthorized vehicle creation rejected (403 for Student & Faculty)
  await t.test('Test 2: Unauthorized vehicle creation rejected (403 for Student & Faculty)', async () => {
    const middleware = allowRoles('admin', 'transport_manager');

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

  // Test 3: Duplicate registration rejection
  await t.test('Test 3: Duplicate vehicle registration rejected with 409', async () => {
    const req = {
      user: { userId: managerUser._id, role: 'transport_manager' },
      body: {
        registrationNumber: 'DL-01-AB-1234', // Same registration
        vehicleCode: 'BUS-99',
        makeAndModel: 'Ashok Leyland',
        seatingCapacity: 35,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.createVehicle(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already registered/i);
        return true;
      }
    );
  });

  // Test 4: Vehicle capacity validation
  await t.test('Test 4: Vehicle capacity validation rejects non-positive capacity', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        registrationNumber: 'DL-02-CD-5678',
        vehicleCode: 'BUS-02',
        makeAndModel: 'Eicher Skyline',
        seatingCapacity: -5, // Invalid negative capacity
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.createVehicle(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /positive integer/i);
        return true;
      }
    );
  });

  // Test 5: Vehicle document expiry validation
  await t.test('Test 5: Vehicle with expired mandatory insurance rejected from assignment', async () => {
    // Create vehicle with expired insurance
    expiredVehicleDoc = await TransportVehicle.create({
      registrationNumber: 'DL-03-EF-9999',
      vehicleCode: 'BUS-EXPIRED',
      makeAndModel: 'Old Transit Bus',
      seatingCapacity: 40,
      documents: {
        insurance: {
          documentNumber: 'INS-EXPIRED-001',
          expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired 10 days ago
        },
      },
      status: 'active',
    });

    const validation = await transportService.validateVehicleForAssignment(expiredVehicleDoc._id, 30);
    assert.strictEqual(validation.eligible, false);
    assert.match(validation.reason, /expired insurance/i);
  });

  // Test 6: Driver license expiry validation
  await t.test('Test 6: Driver with expired driving license rejected from assignment', async () => {
    const validation = await transportService.validateDriverForAssignment(driver2User._id);
    assert.strictEqual(validation.eligible, false);
    assert.match(validation.reason, /expired driving license/i);
  });

  // Test 7: Route creation
  await t.test('Test 7: Route creation with valid parameters', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        name: 'Route 1 — North Metro Express',
        code: 'TR-01',
        startLocation: 'North Metro Terminal',
        endLocation: 'Main Campus Gate 1',
        estimatedDurationMinutes: 45,
        maxCapacity: 2, // Configured capacity of 2 for testing allocation limits
        operationalDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        morningDepartureTime: '07:30',
        eveningDepartureTime: '17:15',
      },
    };
    const res = createMockRes();

    await transportController.createRoute(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.code, 'TR-01');
    assert.strictEqual(res.jsonData.data.maxCapacity, 2);
    route1Doc = res.jsonData.data;
  });

  // Test 8: Duplicate route code rejection
  await t.test('Test 8: Duplicate route code rejected with 409', async () => {
    const req = {
      user: { userId: managerUser._id, role: 'transport_manager' },
      body: {
        name: 'Route Duplicate',
        code: 'TR-01', // Duplicate code
        startLocation: 'Somewhere',
        endLocation: 'Campus',
        maxCapacity: 30,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.createRoute(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already in use/i);
        return true;
      }
    );
  });

  // Test 9: Stop ordering validation (unique sequence on route)
  await t.test('Test 9: Stop creation and sequence order uniqueness enforcement', async () => {
    // Add Stop 1
    const reqStop1 = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: {
        stopName: 'North Metro Terminal',
        sequence: 1,
        scheduledMorningPickupTime: '07:30',
        scheduledEveningDropTime: '18:15',
      },
    };
    const resStop1 = createMockRes();
    await transportController.createStop(reqStop1, resStop1);
    assert.strictEqual(resStop1.statusCode, 201);
    stop1Doc = resStop1.jsonData.data;

    // Attempt duplicate sequence 1 on same route -> 409
    const reqDupSeq = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: {
        stopName: 'Another Stop Same Sequence',
        sequence: 1,
      },
    };
    const resDupSeq = createMockRes();
    await assert.rejects(
      async () => {
        await transportController.createStop(reqDupSeq, resDupSeq);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already occupied/i);
        return true;
      }
    );

    // Add Stop 2
    const reqStop2 = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: {
        stopName: 'City Center Metro Hub',
        sequence: 2,
        scheduledMorningPickupTime: '07:50',
        scheduledEveningDropTime: '17:55',
      },
    };
    const resStop2 = createMockRes();
    await transportController.createStop(reqStop2, resStop2);
    assert.strictEqual(resStop2.statusCode, 201);
    stop2Doc = resStop2.jsonData.data;
  });

  // Test 10: Route capacity validation
  await t.test('Test 10: Route capacity validation prevents setting capacity below active allocations', async () => {
    // Update capacity from 2 to 3 is allowed
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: { maxCapacity: 2 },
    };
    const res = createMockRes();
    await transportController.updateRoute(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.maxCapacity, 2);
  });

  // Test 11: Invalid vehicle assignment rejection (inactive vehicle or expired docs)
  await t.test('Test 11: Ineligible vehicle assignment to route rejected with 400', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: { vehicleId: expiredVehicleDoc._id },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.assignVehicleAndStaffToRoute(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /expired insurance/i);
        return true;
      }
    );
  });

  // Test 12: Assign vehicle and staff to Route 1
  await t.test('Test 12: Successful assignment of valid vehicle, driver, and attendant to Route 1', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route1Doc._id },
      body: {
        vehicleId: vehicle1Doc._id,
        driverUserId: driver1User._id,
        attendantUserId: attendant1User._id,
      },
    };
    const res = createMockRes();

    await transportController.assignVehicleAndStaffToRoute(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(String(res.jsonData.data.assignedVehicle), String(vehicle1Doc._id));
    assert.strictEqual(String(res.jsonData.data.assignedDriver), String(driver1User._id));
  });

  // Test 13: Overlapping vehicle assignment rejection
  await t.test('Test 13: Overlapping vehicle assignment to another active route rejected with 409', async () => {
    // Create Route 2 operating on same days
    route2Doc = await TransportRoute.create({
      name: 'Route 2 — South Suburb Link',
      code: 'TR-02',
      startLocation: 'South Metro',
      endLocation: 'Main Campus Gate 2',
      maxCapacity: 30,
      operationalDays: ['Monday', 'Tuesday', 'Wednesday'],
      status: 'active',
    });

    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route2Doc._id },
      body: {
        vehicleId: vehicle1Doc._id, // BUS-01 already assigned to TR-01!
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.assignVehicleAndStaffToRoute(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already assigned to active route/i);
        return true;
      }
    );
  });

  // Test 14: Overlapping driver assignment rejection
  await t.test('Test 14: Overlapping driver assignment to another active route rejected with 409', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: route2Doc._id },
      body: {
        driverUserId: driver1User._id, // Driver 1 already assigned to TR-01!
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.assignVehicleAndStaffToRoute(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /Driver is already assigned to active route/i);
        return true;
      }
    );
  });

  // Test 15: Student transport application submission
  await t.test('Test 15: Student transport application submission', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      body: {
        preferredRouteId: route1Doc._id,
        preferredPickupStopId: stop1Doc._id,
        academicYear: '2026-2027',
        emergencyContact: {
          name: 'Ashok Mehra',
          phone: '+91 9988776655',
          relation: 'Father',
        },
      },
    };
    const res = createMockRes();

    await transportController.createApplication(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.data.applicationNumber.startsWith('TAPP-'));
    assert.ok(['submitted', 'pending'].includes(res.jsonData.data.status));
    app1Doc = res.jsonData.data;
  });

  // Test 16: Duplicate active application prevention for same academic year
  await t.test('Test 16: Duplicate active application rejected with 409', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
      body: {
        preferredRouteId: route1Doc._id,
        preferredPickupStopId: stop1Doc._id,
        academicYear: '2026-2027',
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.createApplication(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already have an active/i);
        return true;
      }
    );
  });

  // Test 17: Student cross-application access rejection (Anti-IDOR)
  await t.test('Test 17: Student can only view their own applications (Anti-IDOR)', async () => {
    // Student 1 queries
    const req1 = {
      user: { userId: student1User._id, role: 'student' },
      query: {},
    };
    const res1 = createMockRes();
    await transportController.getApplications(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.jsonData.data.length, 1);
    assert.strictEqual(String(res1.jsonData.data[0]._id), String(app1Doc._id));

    // Student 2 queries -> 0 applications
    const req2 = {
      user: { userId: student2User._id, role: 'student' },
      query: {},
    };
    const res2 = createMockRes();
    await transportController.getApplications(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.jsonData.data.length, 0);
  });

  // Test 18: Application approval authorization (Admin / Transport Manager)
  await t.test('Test 18: Application approval by Transport Manager', async () => {
    const req = {
      user: { userId: managerUser._id, role: 'transport_manager' },
      params: { id: app1Doc._id },
      body: {
        decision: 'approved',
        comments: 'Verified residential address and stop feasibility. Approved.',
      },
    };
    const res = createMockRes();

    await transportController.reviewApplication(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'approved');
  });

  // Test 19: Application rejection validation requires minimum 5 characters
  await t.test('Test 19: Application rejection requires detailed reason (min 5 chars)', async () => {
    // Create an application for Student 2
    const appReq = {
      user: { userId: student2User._id, role: 'student' },
      body: {
        preferredRouteId: route1Doc._id,
        preferredPickupStopId: stop2Doc._id,
        academicYear: '2026-2027',
      },
    };
    const appRes = createMockRes();
    await transportController.createApplication(appReq, appRes);
    app2Doc = appRes.jsonData.data;

    // Reject with too short reason (<5 chars) -> 400
    const reqShort = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: app2Doc._id },
      body: { decision: 'rejected', rejectionReason: 'No' },
    };
    const resShort = createMockRes();
    await assert.rejects(
      async () => {
        await transportController.reviewApplication(reqShort, resShort);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /minimum 5 characters/i);
        return true;
      }
    );

    // Approve Student 2's application for downstream allocation tests
    const reqApprove = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: app2Doc._id },
      body: { decision: 'approved', comments: 'Approved for seat allocation' },
    };
    const resApprove = createMockRes();
    await transportController.reviewApplication(reqApprove, resApprove);
    assert.strictEqual(resApprove.statusCode, 200);
  });

  // Test 20: Successful route allocation to Student 1
  await t.test('Test 20: Successful route allocation to approved student', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student1Doc._id,
        applicationId: app1Doc._id,
        routeId: route1Doc._id,
        pickupStopId: stop1Doc._id,
        academicYear: '2026-2027',
        remarks: 'Allocated morning & evening transit pass',
      },
    };
    const res = createMockRes();

    await transportController.allocateStudent(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'allocated');
    alloc1Doc = res.jsonData.data;

    // Verify route allocated count incremented from 0 to 1
    const route = await TransportRoute.findById(route1Doc._id);
    assert.strictEqual(route.allocatedStudentsCount, 1);
  });

  // Test 21: Route capacity limit reached (allocate Student 2, reaching capacity 2)
  await t.test('Test 21: Route capacity limits enforced', async () => {
    // Allocate Student 2 to Route 1 (capacity: 2)
    const req2 = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student2Doc._id,
        applicationId: app2Doc._id,
        routeId: route1Doc._id,
        pickupStopId: stop2Doc._id,
      },
    };
    const res2 = createMockRes();
    await transportController.allocateStudent(req2, res2);
    assert.strictEqual(res2.statusCode, 201);

    const route = await TransportRoute.findById(route1Doc._id);
    assert.strictEqual(route.allocatedStudentsCount, 2); // Now at maxCapacity (2)
  });

  // Test 22: Capacity over-allocation rejection (allocating Student 3 fails with 409)
  await t.test('Test 22: Capacity over-allocation rejected with 409', async () => {
    const req3 = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student3Doc._id,
        routeId: route1Doc._id,
        pickupStopId: stop1Doc._id,
      },
    };
    const res3 = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.allocateStudent(req3, res3);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /capacity limit/i);
        return true;
      }
    );
  });

  // Test 23: Conflicting student allocation prevention (cannot hold 2 active routes)
  await t.test('Test 23: Duplicate active allocation rejected if student holds active pass', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        studentId: student1Doc._id, // Student 1 already holds pass on Route 1
        routeId: route2Doc._id,
        pickupStopId: stop1Doc._id,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await transportController.allocateStudent(req, res);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /already possesses an active/i);
        return true;
      }
    );
  });

  // Test 24: Student route overview loads allocation
  await t.test('Test 24: Student transport overview loads allocated route and stops', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student' },
    };
    const res = createMockRes();

    await transportController.getStudentTransportOverview(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.hasActiveTransport, true);
    assert.strictEqual(res.jsonData.data.allocation.allocationNumber, alloc1Doc.allocationNumber);
    assert.ok(res.jsonData.data.routeStops.length >= 2);
  });

  // Test 25: Allocation cancellation releases capacity atomically
  await t.test('Test 25: Allocation cancellation releases route capacity', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      params: { id: alloc1Doc._id },
      body: { reason: 'Student shifted to campus hostel' },
    };
    const res = createMockRes();

    await transportController.cancelAllocation(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'cancelled');

    // Route capacity decremented from 2 to 1
    const route = await TransportRoute.findById(route1Doc._id);
    assert.strictEqual(route.allocatedStudentsCount, 1);
  });

  // Test 26: Transport fee stored in integer paise
  await t.test('Test 26: Transport fee amounts stored in integer paise precision', async () => {
    const policy = await transportService.getActivePolicy();
    assert.strictEqual(typeof policy.defaultTransportFeeInPaise, 'number');
    assert.strictEqual(policy.defaultTransportFeeInPaise, 1800000); // Rs. 18,000.00
  });

  // Test 27: Duplicate invoice prevention
  await t.test('Test 27: Student transport billing maintains single active allocation invariant', async () => {
    const activeCount = await TransportAllocation.countDocuments({
      student: student1Doc._id,
      status: { $in: ['allocated', 'active'] },
    });
    // Student 1's allocation was cancelled in Test 25
    assert.strictEqual(activeCount, 0);

    // Student 2 holds 1 active allocation
    const student2ActiveCount = await TransportAllocation.countDocuments({
      student: student2Doc._id,
      status: { $in: ['allocated', 'active'] },
    });
    assert.strictEqual(student2ActiveCount, 1);
  });

  // Test 28: Daily trip scheduling
  let tripDoc;
  await t.test('Test 28: Daily trip scheduling and operational creation', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        routeId: route1Doc._id,
        vehicleId: vehicle1Doc._id,
        driverUserId: driver1User._id,
        tripType: 'morning_pickup',
        scheduledDeparture: new Date(Date.now() + 30 * 60 * 1000),
        scheduledArrival: new Date(Date.now() + 75 * 60 * 1000),
      },
    };
    const res = createMockRes();

    await transportController.createTrip(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.data.status, 'scheduled');
    tripDoc = res.jsonData.data;
  });

  // Test 29: Daily trip status update by driver
  await t.test('Test 29: Trip departure and arrival status update', async () => {
    const req = {
      user: { userId: driver1User._id, role: 'driver' },
      params: { id: tripDoc._id },
      body: {
        status: 'in_progress',
        actualDeparture: new Date(),
      },
    };
    const res = createMockRes();

    await transportController.updateTripStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.status, 'in_progress');
  });

  // Test 30: Trip delay reporting
  await t.test('Test 30: Driver delay reporting with delayMinutes and reason', async () => {
    const req = {
      user: { userId: driver1User._id, role: 'driver' },
      params: { id: tripDoc._id },
      body: {
        status: 'delayed',
        delayMinutes: 20,
        delayReason: 'Heavy morning peak hour metro construction jam',
      },
    };
    const res = createMockRes();

    await transportController.updateTripStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.delayMinutes, 20);
    assert.match(res.jsonData.data.delayReason, /metro construction/i);
  });

  // Test 31: Vehicle maintenance service log
  await t.test('Test 31: Vehicle maintenance service logging with cost in integer paise', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        vehicleId: vehicle1Doc._id,
        maintenanceType: 'routine_service',
        description: 'Engine oil flush, brake pad replacement, and tire rotation',
        serviceProvider: 'Tata Commercial Service Centre',
        costInPaise: 350000, // Rs. 3,500.00
        odometerReadingKm: 18500,
        downtimeDays: 1,
      },
    };
    const res = createMockRes();

    await transportController.recordMaintenance(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.data.costInPaise, 350000);
    assert.strictEqual(res.jsonData.data.maintenanceType, 'routine_service');
  });

  // Test 32: Document expiry reminders detection
  await t.test('Test 32: Document expiry alerts detect upcoming and expired documents', async () => {
    const alerts = await transportService.getExpiringDocuments(30);
    assert.ok(alerts.totalAlerts >= 1);
    assert.ok(alerts.driverAlerts.some((d) => d.fullName === 'Balwant Verma'));
  });

  // Test 33: Transport complaint creation (category: transport)
  await t.test('Test 33: Transport complaint registration (category: transport)', async () => {
    const complaint = await Complaint.create({
      raisedBy: student1User._id,
      category: 'transport',
      title: 'Bus arrived 25 mins late at Metro terminal',
      description: 'The morning pickup on Route 1 was delayed without prior announcement.',
      vehicle: vehicle1Doc._id,
      route: route1Doc._id,
      priority: 'high',
      status: 'pending',
    });

    assert.strictEqual(complaint.category, 'transport');
    assert.strictEqual(String(complaint.route), String(route1Doc._id));
  });

  // Test 34: Incident reporting
  await t.test('Test 34: Transport incident logging with severity and details', async () => {
    const req = {
      user: { userId: driver1User._id, role: 'driver' },
      body: {
        routeId: route1Doc._id,
        vehicleId: vehicle1Doc._id,
        category: 'traffic_delay',
        severity: 'medium',
        title: 'Road blocked due to tree fall on Main Avenue',
        description: 'Traffic was diverted via ring road causing 15 min delay.',
      },
    };
    const res = createMockRes();

    await transportController.reportIncident(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.data.incidentNumber.startsWith('TINC-'));
  });

  // Test 35: Centralized notification delivery for transport events
  await t.test('Test 35: Notifications created with category: transport', async () => {
    const notifications = await Notification.find({
      recipient: student1User._id,
      category: 'transport',
    });
    assert.ok(notifications.length >= 2, 'Transport application & allocation notifications must be generated');
    const titles = notifications.map((n) => n.title);
    assert.ok(titles.some((t) => t.includes('Transport Application') || t.includes('Allocated')));
  });

  // Test 36: Policy configuration update by Admin
  await t.test('Test 36: Transport policy update by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      body: {
        applicationWindowOpen: true,
        defaultTransportFeeInPaise: 1950000, // Updated to 19,500.00 INR
        allowRouteChanges: true,
      },
    };
    const res = createMockRes();

    await transportController.updateTransportPolicy(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.defaultTransportFeeInPaise, 1950000);
  });

  // Test 37: CSV formula injection defense (CWE-1236)
  await t.test('Test 37: CSV formula injection defense (CWE-1236)', async () => {
    assert.strictEqual(transportService.sanitizeCsvValue('=1+2'), '"\'=1+2"');
    assert.strictEqual(transportService.sanitizeCsvValue('+CMD'), '"\'+CMD"');
    assert.strictEqual(transportService.sanitizeCsvValue('-500'), '"\'-500"');
    assert.strictEqual(transportService.sanitizeCsvValue('@SUM(B1:B10)'), '"\'@SUM(B1:B10)"');
    assert.strictEqual(transportService.sanitizeCsvValue('Normal Route'), '"Normal Route"');

    // Test routes CSV export API
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
      query: { type: 'routes' },
    };
    const res = createMockRes();
    await transportController.exportTransportCsv(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.ok(res.rawBody.includes('Route Code,Route Name'));
  });

  // Test 38: Real-time transport metrics accuracy
  await t.test('Test 38: Transport metrics calculate accurate counts directly from database', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin' },
    };
    const res = createMockRes();

    await transportController.getTransportMetrics(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    const { metrics: m } = res.jsonData.data;
    assert.ok(m.totalVehicles >= 2);
    assert.ok(m.totalRoutes >= 2);
    assert.strictEqual(typeof m.occupancyRatePercentage, 'number');
    assert.ok(m.occupancyRatePercentage >= 0 && m.occupancyRatePercentage <= 100);
  });

  // Test 39: Historical allocation preservation
  await t.test('Test 39: Historical allocation records preserved after cancellation', async () => {
    const student1Allocations = await TransportAllocation.find({ student: student1Doc._id });
    assert.strictEqual(student1Allocations.length, 1);
    assert.strictEqual(student1Allocations[0].status, 'cancelled');
    assert.ok(student1Allocations[0].cancellationReason.length > 0);
  });

  // Test 40: Role-based endpoint authorization enforcement
  await t.test('Test 40: Role-based access control blocks unauthorized operations', async () => {
    const managerOnly = allowRoles('admin', 'transport_manager');
    const studentReq = { user: { userId: student1User._id, role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;

    managerOnly(studentReq, res, () => { nextCalled = true; });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(nextCalled, false);
  });

  await t.test('Teardown: Close isolated test database connection', async () => {
    await mongoose.connection.close();
  });
});

