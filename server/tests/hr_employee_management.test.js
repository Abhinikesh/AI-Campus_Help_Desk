/**
 * server/tests/hr_employee_management.test.js
 * Comprehensive Automated Test Suite for Part 23:
 * Institutional HR, Employee Records, Leave & Workforce Management.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmploymentHistory = require('../models/EmploymentHistory');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');
const EmployeeLeaveApplication = require('../models/EmployeeLeaveApplication');
const EmployeeWorkSchedule = require('../models/EmployeeWorkSchedule');
const EmployeeAttendance = require('../models/EmployeeAttendance');
const EmployeeDocument = require('../models/EmployeeDocument');
const HRAnnouncement = require('../models/HRAnnouncement');
const EmployeeTrainingRecord = require('../models/EmployeeTrainingRecord');
const HRAuditLog = require('../models/HRAuditLog');

const hrController = require('../controllers/hr.controller');
const { hrService } = require('../services/hr.service');

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
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(content) {
      this.rawBody = content;
      return this;
    }
  };
}

test('Part 23: Institutional HR & Workforce Management Test Suite', async (t) => {
  let adminUser, hrAdminUser, hrOfficerUser, facultyUser, employeeUser, studentUser;
  let academicDept, adminDept;
  let professorDesig, officerDesig;
  let testPolicyCasual, testPolicySick;
  let facultyEmployee, staffEmployee;
  let testSchedule;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    await mongoose.disconnect();
    await mongoose.connect(TEST_DB_URI);
    verifyTestDatabaseIsolation();

    // Clean prior Part 23 test fixtures
    await Department.deleteMany({ code: /^TEST-/ });
    await Designation.deleteMany({ code: /^TEST-/ });
    await EmployeeProfile.deleteMany({ employeeId: /^EMP-TEST-/ });
    await EmployeeProfile.deleteMany({ employeeId: /^EMP-\d{4}-/ });
    await EmploymentHistory.deleteMany({});
    await LeavePolicy.deleteMany({ code: /^TEST-/ });
    await EmployeeLeaveBalance.deleteMany({});
    await LeaveLedgerEntry.deleteMany({});
    await EmployeeLeaveApplication.deleteMany({});
    await EmployeeWorkSchedule.deleteMany({ code: /^TEST-/ });
    await EmployeeAttendance.deleteMany({});
    await EmployeeDocument.deleteMany({});
    await HRAnnouncement.deleteMany({});
    await EmployeeTrainingRecord.deleteMany({});
    await HRAuditLog.deleteMany({});
    await User.deleteMany({ email: /^test\.hr\./ });

    // Seed test users
    adminUser = await User.create({
      name: 'System Admin',
      email: 'test.hr.admin@campussphere.edu',
      loginId: 'HR-ADM-01',
      passwordHash: 'dummy',
      role: 'admin'
    });

    hrAdminUser = await User.create({
      name: 'HR Director',
      email: 'test.hr.hradmin@campussphere.edu',
      loginId: 'HR-DIR-01',
      passwordHash: 'dummy',
      role: 'hr_admin'
    });

    hrOfficerUser = await User.create({
      name: 'HR Officer',
      email: 'test.hr.officer@campussphere.edu',
      loginId: 'HR-OFF-01',
      passwordHash: 'dummy',
      role: 'hr_officer'
    });

    facultyUser = await User.create({
      name: 'Dr. Jane Hopper',
      email: 'test.hr.faculty@campussphere.edu',
      loginId: 'FAC-HR-01',
      passwordHash: 'dummy',
      role: 'faculty'
    });

    employeeUser = await User.create({
      name: 'John Staff',
      email: 'test.hr.staff@campussphere.edu',
      loginId: 'EMP-HR-01',
      passwordHash: 'dummy',
      role: 'employee'
    });

    studentUser = await User.create({
      name: 'Bobby Student',
      email: 'test.hr.student@campussphere.edu',
      loginId: 'STU-HR-01',
      passwordHash: 'dummy',
      role: 'student'
    });

    assert.ok(adminUser._id);
    assert.ok(hrAdminUser._id);
    assert.ok(facultyUser._id);
    assert.ok(employeeUser._id);
  });

  // --------------------------------------------------------------------------
  // SECTION 1: DEPARTMENTS & DESIGNATIONS
  // --------------------------------------------------------------------------

  await t.test('1. Create academic department with unique code', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Computer Science & Engineering',
        code: 'TEST-CSE',
        type: 'academic',
        description: 'CS Academic Department'
      }
    };
    const res = createMockRes();
    await hrController.createDepartment(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.code, 'TEST-CSE');
    academicDept = res.jsonData.data;
  });

  await t.test('2. Enforce unique constraint on department code', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Duplicate CS Department',
        code: 'TEST-CSE',
        type: 'academic'
      }
    };
    const res = createMockRes();
    await hrController.createDepartment(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already exists/i);
  });

  await t.test('3. Create administrative department', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Human Resources & Personnel',
        code: 'TEST-HRP',
        type: 'administrative'
      }
    };
    const res = createMockRes();
    await hrController.createDepartment(req, res);

    assert.equal(res.statusCode, 201);
    adminDept = res.jsonData.data;
  });

  await t.test('4. Create designation with hierarchy and department association', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        title: 'Associate Professor',
        code: 'TEST-ASC-PROF',
        category: 'teaching_faculty',
        department: academicDept._id,
        reportingLevel: 3
      }
    };
    const res = createMockRes();
    await hrController.createDesignation(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.code, 'TEST-ASC-PROF');
    professorDesig = res.jsonData.data;
  });

  await t.test('5. Enforce unique constraint on designation code', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        title: 'Duplicate Professor',
        code: 'TEST-ASC-PROF',
        category: 'teaching_faculty'
      }
    };
    const res = createMockRes();
    await hrController.createDesignation(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already exists/i);
  });

  await t.test('6. Create staff administrative designation', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        title: 'Senior HR Executive',
        code: 'TEST-SR-HREXEC',
        category: 'administrative_staff',
        department: adminDept._id,
        reportingLevel: 2
      }
    };
    const res = createMockRes();
    await hrController.createDesignation(req, res);

    assert.equal(res.statusCode, 201);
    officerDesig = res.jsonData.data;
  });

  // --------------------------------------------------------------------------
  // SECTION 2: EMPLOYEE MASTER DIRECTORY & IDENTITY INTEGRITY
  // --------------------------------------------------------------------------

  await t.test('7. Onboard faculty employee linking existing user (Zero duplicate identity)', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        user: facultyUser._id,
        firstName: 'Jane',
        lastName: 'Hopper',
        officialEmail: 'test.hr.faculty@campussphere.edu',
        personalEmail: 'jane.personal@gmail.com',
        phone: '9876543210',
        employeeCategory: 'teaching_faculty',
        department: academicDept._id,
        designation: professorDesig._id,
        employmentType: 'permanent',
        employmentStatus: 'active',
        joiningDate: new Date('2024-01-15')
      }
    };
    const res = createMockRes();
    await hrController.createEmployee(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.match(res.jsonData.data.employeeId, /^EMP-\d{4}-\d{4}$/);
    facultyEmployee = res.jsonData.data;
  });

  await t.test('8. Enforce 1:1 user-to-employee constraint (reject second employee profile for same user)', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        user: facultyUser._id,
        firstName: 'Jane',
        lastName: 'Hopper Duplicate',
        officialEmail: 'test.hr.faculty2@campussphere.edu',
        employeeCategory: 'teaching_faculty',
        department: academicDept._id,
        designation: professorDesig._id,
        joiningDate: new Date()
      }
    };
    const res = createMockRes();
    await hrController.createEmployee(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already linked/i);
  });

  await t.test('9. Onboard non-teaching employee on probation with auto-created user account', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        user: employeeUser._id,
        firstName: 'John',
        lastName: 'Staff',
        officialEmail: 'test.hr.staff@campussphere.edu',
        employeeCategory: 'administrative_staff',
        department: adminDept._id,
        designation: officerDesig._id,
        employmentType: 'probation',
        employmentStatus: 'probation',
        joiningDate: new Date('2026-06-01')
      }
    };
    const res = createMockRes();
    await hrController.createEmployee(req, res);

    assert.equal(res.statusCode, 201);
    staffEmployee = res.jsonData.data;
    assert.equal(staffEmployee.employmentStatus, 'probation');
    assert.equal(staffEmployee.onboardingStatus, 'pending');
  });

  await t.test('10. Employee directory search and department filter', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      query: { department: academicDept._id.toString() }
    };
    const res = createMockRes();
    await hrController.getEmployees(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.length, 1);
    assert.equal(res.jsonData.data[0].employeeId, facultyEmployee.employeeId);
  });

  await t.test('11. Query employee profile by ID', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: facultyEmployee._id.toString() }
    };
    const res = createMockRes();
    await hrController.getEmployeeById(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.officialEmail, 'test.hr.faculty@campussphere.edu');
  });

  await t.test('12. Employee can retrieve their own profile via /employees/me', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role }
    };
    const res = createMockRes();
    await hrController.getMyProfile(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.employeeId, facultyEmployee.employeeId);
  });

  // --------------------------------------------------------------------------
  // SECTION 3: EMPLOYEE LIFECYCLE MANAGEMENT
  // --------------------------------------------------------------------------

  await t.test('13. Verify employee onboarding status (pending -> verified)', async () => {
    const req = {
      user: { userId: hrOfficerUser._id, role: hrOfficerUser.role },
      params: { id: staffEmployee._id.toString() }
    };
    const res = createMockRes();
    await hrController.verifyOnboarding(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.onboardingStatus, 'verified');
    assert.ok(res.jsonData.data.verifiedAt);
  });

  await t.test('14. Confirm employee probation (probation -> confirmed)', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: staffEmployee._id.toString() },
      body: { reason: 'Satisfactory performance during 6-month probation' }
    };
    const res = createMockRes();
    await hrController.confirmProbation(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.employmentStatus, 'confirmed');
    assert.ok(res.jsonData.data.confirmationDate);

    // Verify EmploymentHistory entry
    const history = await EmploymentHistory.findOne({
      employee: staffEmployee._id,
      changeType: 'confirmation'
    });
    assert.ok(history);
    assert.equal(history.newValue, 'confirmed');
  });

  await t.test('15. Department transfer and promotion with EmploymentHistory logging', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: staffEmployee._id.toString() },
      body: {
        newDepartment: academicDept._id,
        newDesignation: officerDesig._id,
        changeType: 'transfer',
        reason: 'Transferred to Computer Science Department office'
      }
    };
    const res = createMockRes();
    await hrController.transferEmployee(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.department.toString(), academicDept._id.toString());

    const history = await EmploymentHistory.findOne({
      employee: staffEmployee._id,
      changeType: 'transfer'
    });
    assert.ok(history);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: LEAVE POLICIES & BALANCE LEDGER
  // --------------------------------------------------------------------------

  await t.test('16. Create Casual Leave policy with entitlement and rules', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Casual Leave',
        code: 'TEST-CL',
        description: 'Standard casual leave quota',
        annualEntitlement: 12,
        applicableCategory: 'all',
        maxConsecutiveDays: 3,
        minNoticeDays: 1,
        carryForwardMax: 0,
        allowNegativeBalance: false
      }
    };
    const res = createMockRes();
    await hrController.createLeavePolicy(req, res);

    assert.equal(res.statusCode, 201);
    testPolicyCasual = res.jsonData.data;
    assert.equal(testPolicyCasual.annualEntitlement, 12);
  });

  await t.test('17. Create Sick / Medical Leave policy', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Sick Leave',
        code: 'TEST-SL',
        description: 'Medical and recuperation leave',
        annualEntitlement: 10,
        applicableCategory: 'all',
        maxConsecutiveDays: 15,
        minNoticeDays: 0,
        allowNegativeBalance: false
      }
    };
    const res = createMockRes();
    await hrController.createLeavePolicy(req, res);

    assert.equal(res.statusCode, 201);
    testPolicySick = res.jsonData.data;
  });

  await t.test('18. Initialize leave balances for faculty employee and check ledger', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { employeeId: facultyEmployee._id.toString() },
      query: { year: 2026 }
    };
    const res = createMockRes();
    await hrController.getEmployeeLeaveBalances(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.length >= 2);

    const clBalance = res.jsonData.data.find((b) => b.policy?.code === 'TEST-CL');
    assert.ok(clBalance);
    assert.equal(clBalance.currentBalance, 12);
    assert.equal(clBalance.used, 0);

    // Verify initial double-entry ledger entry
    const ledger = await LeaveLedgerEntry.findOne({
      employee: facultyEmployee._id,
      policy: testPolicyCasual._id,
      type: 'CREDIT',
      reason: 'annual_grant'
    });
    assert.ok(ledger);
    assert.equal(ledger.days, 12);
    assert.equal(ledger.newBalance, 12);
  });

  await t.test('19. Administrative balance adjustment with ledger tracking', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        employeeId: facultyEmployee._id,
        policyId: testPolicyCasual._id,
        year: 2026,
        adjustmentDays: 2,
        reason: 'Compensatory off granted for weekend conference duty'
      }
    };
    const res = createMockRes();
    await hrController.adjustLeaveBalance(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.balance.currentBalance, 14);
    assert.equal(res.jsonData.data.ledgerEntry.type, 'CREDIT');
    assert.equal(res.jsonData.data.ledgerEntry.days, 2);
  });

  // --------------------------------------------------------------------------
  // SECTION 5: LEAVE REQUISITIONS & VALIDATIONS
  // --------------------------------------------------------------------------

  let createdLeaveApp;

  await t.test('20. Reject leave application when end date precedes start date', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        policy: testPolicyCasual._id,
        startDate: '2026-08-10',
        endDate: '2026-08-08',
        reason: 'Invalid date sequence'
      }
    };
    const res = createMockRes();
    await hrController.applyForLeave(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /Start date cannot be after end date/i);
  });

  await t.test('21. Reject leave application exceeding max consecutive days', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        policy: testPolicyCasual._id, // maxConsecutiveDays = 3
        startDate: '2026-08-03',
        endDate: '2026-08-08', // 6 days
        reason: 'Too many consecutive days'
      }
    };
    const res = createMockRes();
    await hrController.applyForLeave(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /Maximum consecutive days allowed/i);
  });

  await t.test('22. Successfully submit valid leave application', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        policy: testPolicyCasual._id,
        startDate: '2026-08-10',
        endDate: '2026-08-11', // 2 days
        reason: 'Attending family wedding ceremony',
        contactDuringLeave: '9876543210'
      }
    };
    const res = createMockRes();
    await hrController.applyForLeave(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'pending');
    assert.equal(res.jsonData.data.totalDays, 2);
    assert.match(res.jsonData.data.applicationNumber, /^LV-\d{4}-/);
    createdLeaveApp = res.jsonData.data;
  });

  await t.test('23. Reject overlapping leave application for same employee', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        policy: testPolicyCasual._id,
        startDate: '2026-08-11', // Overlaps with 2026-08-10 to 2026-08-11
        endDate: '2026-08-12',
        reason: 'Overlapping request'
      }
    };
    const res = createMockRes();
    await hrController.applyForLeave(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /overlapping/i);
  });

  // --------------------------------------------------------------------------
  // SECTION 6: SEPARATION OF DUTIES & APPROVAL WORKFLOW
  // --------------------------------------------------------------------------

  await t.test('24. CRITICAL: Separation of duties — applicant CANNOT approve own leave application', async () => {
    // The faculty member attempts to review / approve their own leave request
    const req = {
      user: { userId: facultyUser._id, role: 'faculty' },
      params: { id: createdLeaveApp._id.toString() },
      body: { action: 'approve', comments: 'Self approval attempt' }
    };
    const res = createMockRes();
    await hrController.reviewLeaveApplication(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Separation of duties violation/i);
  });

  await t.test('25. Authorized HR Admin approves leave application', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: createdLeaveApp._id.toString() },
      body: { action: 'approve', comments: 'Approved by HR Director' }
    };
    const res = createMockRes();
    await hrController.reviewLeaveApplication(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'approved');
  });

  await t.test('26. Verify atomic leave balance deduction and double-entry ledger debit', async () => {
    const balance = await EmployeeLeaveBalance.findOne({
      employee: facultyEmployee._id,
      policy: testPolicyCasual._id,
      year: 2026
    });

    // Previous balance was 14; 2 days deducted -> 12 left
    assert.equal(balance.used, 2);
    assert.equal(balance.currentBalance, 12);

    const debitEntry = await LeaveLedgerEntry.findOne({
      referenceApplication: createdLeaveApp._id,
      type: 'DEBIT',
      reason: 'leave_taken'
    });
    assert.ok(debitEntry);
    assert.equal(debitEntry.days, 2);
    assert.equal(debitEntry.previousBalance, 14);
    assert.equal(debitEntry.newBalance, 12);
  });

  await t.test('27. Verify approved leave synchronized to EmployeeAttendance (status: on_leave)', async () => {
    const attRecords = await EmployeeAttendance.find({
      employee: facultyEmployee._id,
      approvedLeave: createdLeaveApp._id
    });

    assert.equal(attRecords.length, 2);
    assert.equal(attRecords[0].status, 'on_leave');
    assert.match(attRecords[0].notes, /Approved Leave/);
  });

  await t.test('28. Reject leave application flow with mandatory rejection reason', async () => {
    // Create another leave application to reject
    const applyReq = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        policy: testPolicyCasual._id,
        startDate: '2026-08-20',
        endDate: '2026-08-21',
        reason: 'Personal outing'
      }
    };
    const applyRes = createMockRes();
    await hrController.applyForLeave(applyReq, applyRes);
    assert.equal(applyRes.statusCode, 201);
    const rejectApp = applyRes.jsonData.data;

    // Review with rejection
    const reviewReq = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: rejectApp._id.toString() },
      body: { action: 'reject', rejectionReason: 'Critical department accreditation audit scheduled on those dates' }
    };
    const reviewRes = createMockRes();
    await hrController.reviewLeaveApplication(reviewReq, reviewRes);

    assert.equal(reviewRes.statusCode, 200);
    assert.equal(reviewRes.jsonData.data.status, 'rejected');
    assert.match(reviewRes.jsonData.data.rejectionReason, /accreditation/);
  });

  await t.test('29. Cancellation of approved leave refunds balance and reverts attendance', async () => {
    const cancelReq = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: createdLeaveApp._id.toString() }
    };
    const cancelRes = createMockRes();
    await hrController.cancelLeaveApplication(cancelReq, cancelRes);

    assert.equal(cancelRes.statusCode, 200);
    assert.equal(cancelRes.jsonData.data.status, 'cancelled');

    // Balance should be refunded: used back to 0, currentBalance back to 14
    const balance = await EmployeeLeaveBalance.findOne({
      employee: facultyEmployee._id,
      policy: testPolicyCasual._id,
      year: 2026
    });
    assert.equal(balance.used, 0);
    assert.equal(balance.currentBalance, 14);

    // Ledger should have refund entry
    const refundEntry = await LeaveLedgerEntry.findOne({
      referenceApplication: createdLeaveApp._id,
      type: 'CREDIT',
      reason: 'cancellation_refund'
    });
    assert.ok(refundEntry);
    assert.equal(refundEntry.days, 2);
  });

  // --------------------------------------------------------------------------
  // SECTION 7: EMPLOYEE ATTENDANCE & SHIFTS
  // --------------------------------------------------------------------------

  await t.test('30. Create Work Schedule / Shift', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        name: 'Standard Faculty Shift',
        code: 'TEST-FAC-SHIFT',
        shiftType: 'general',
        startTime: '09:00',
        endTime: '17:00',
        gracePeriodMinutes: 15
      }
    };
    const res = createMockRes();
    await hrController.createWorkSchedule(req, res);

    assert.equal(res.statusCode, 201);
    testSchedule = res.jsonData.data;
  });

  await t.test('31. Employee daily check-in', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: { verificationMethod: 'web_portal' }
    };
    const res = createMockRes();
    await hrController.checkIn(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.checkIn);
    assert.ok(['present', 'late'].includes(res.jsonData.data.status));
  });

  await t.test('32. Reject duplicate check-in on same day', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {}
    };
    const res = createMockRes();
    await hrController.checkIn(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already checked in/i);
  });

  await t.test('33. Employee daily check-out computes working hours', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role }
    };
    const res = createMockRes();
    await hrController.checkOut(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.checkOut);
    assert.equal(typeof res.jsonData.data.workingHours, 'number');
  });

  await t.test('34. Audit-logged attendance correction requires reason', async () => {
    const today = new Date().toISOString().split('T')[0];
    const attRecord = await EmployeeAttendance.findOne({ employee: facultyEmployee._id, date: today });
    assert.ok(attRecord);

    const reqNoReason = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: attRecord._id.toString() },
      body: { status: 'present' } // missing reason
    };
    const resNoReason = createMockRes();
    await hrController.correctAttendance(reqNoReason, resNoReason);
    assert.equal(resNoReason.statusCode, 400);

    const reqValid = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: attRecord._id.toString() },
      body: {
        status: 'present',
        reason: 'Biometric fingerprint reader glitch on main entrance door'
      }
    };
    const resValid = createMockRes();
    await hrController.correctAttendance(reqValid, resValid);

    assert.equal(resValid.statusCode, 200);
    assert.equal(resValid.jsonData.data.status, 'present');
    assert.equal(resValid.jsonData.data.correctionHistory.length, 1);
    assert.match(resValid.jsonData.data.correctionHistory[0].reason, /Biometric fingerprint/);
  });

  // --------------------------------------------------------------------------
  // SECTION 8: EMPLOYEE DOCUMENTS & SECURITY
  // --------------------------------------------------------------------------

  let uploadedDoc;

  await t.test('35. Upload employee qualification document', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      body: {
        employeeId: facultyEmployee._id.toString(),
        documentType: 'qualification',
        title: 'Ph.D. in Computer Science Certificate',
        notes: 'Awarded by Stanford University'
      },
      file: {
        filename: 'doc-phd-cert.pdf',
        path: '/tmp/doc-phd-cert.pdf',
        size: 102400,
        mimetype: 'application/pdf'
      }
    };
    const res = createMockRes();
    await hrController.uploadDocument(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.title, 'Ph.D. in Computer Science Certificate');
    assert.match(res.jsonData.data.documentNumber, /^DOC-\d{4}-/);
    uploadedDoc = res.jsonData.data;
  });

  await t.test('36. Access control: Employee can retrieve own documents', async () => {
    const req = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      params: { employeeId: facultyEmployee._id.toString() }
    };
    const res = createMockRes();
    await hrController.getEmployeeDocuments(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.length, 1);
  });

  await t.test('37. Access control: Other non-HR staff blocked from viewing employee documents', async () => {
    const req = {
      user: { userId: employeeUser._id, role: employeeUser.role }, // different employee
      params: { employeeId: facultyEmployee._id.toString() }
    };
    const res = createMockRes();
    await hrController.getEmployeeDocuments(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Unauthorized/i);
  });

  await t.test('38. HR Admin verifies employee document', async () => {
    const req = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      params: { id: uploadedDoc._id.toString() }
    };
    const res = createMockRes();
    await hrController.verifyDocument(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.isVerified, true);
    assert.ok(res.jsonData.data.verifiedAt);
  });

  // --------------------------------------------------------------------------
  // SECTION 9: ANNOUNCEMENTS, TRAINING & CWE-1236 DEFENSE
  // --------------------------------------------------------------------------

  let hrAnnouncement;

  await t.test('39. Publish HR announcement and record employee acknowledgment', async () => {
    const pubReq = {
      user: { userId: hrAdminUser._id, role: hrAdminUser.role },
      body: {
        title: 'Annual Faculty Research Grant Submissions Open',
        content: 'All teaching faculty are invited to submit grant proposals by Nov 30.',
        targetAudience: 'teaching_faculty',
        priority: 'high'
      }
    };
    const pubRes = createMockRes();
    await hrController.createAnnouncement(pubReq, pubRes);

    assert.equal(pubRes.statusCode, 201);
    assert.match(pubRes.jsonData.data.announcementNumber, /^HRA-\d{4}-/);
    hrAnnouncement = pubRes.jsonData.data;

    // Acknowledge by faculty
    const ackReq = {
      user: { userId: facultyUser._id, role: facultyUser.role },
      params: { id: hrAnnouncement._id.toString() }
    };
    const ackRes = createMockRes();
    await hrController.acknowledgeAnnouncement(ackReq, ackRes);

    assert.equal(ackRes.statusCode, 200);
    assert.equal(ackRes.jsonData.data.acknowledgedBy.length, 1);
  });

  await t.test('40. Log professional training and compliance record', async () => {
    const req = {
      user: { userId: hrOfficerUser._id, role: hrOfficerUser.role },
      body: {
        employee: facultyEmployee._id,
        title: 'Advanced AI & Machine Learning Pedagogical Workshop',
        category: 'pedagogy',
        organizer: 'National Technical Education Board',
        startDate: '2026-05-10',
        endDate: '2026-05-15',
        durationHours: 40,
        status: 'completed',
        scoreOrGrade: 'Distinction'
      }
    };
    const res = createMockRes();
    await hrController.createTrainingRecord(req, res);

    assert.equal(res.statusCode, 201);
    assert.match(res.jsonData.data.trainingNumber, /^TRN-\d{4}-/);
    assert.equal(res.jsonData.data.durationHours, 40);
  });

  await t.test('41. CWE-1236 Formula Injection Sanitization: Escapes malicious spreadsheet formulas', async () => {
    const maliciousInput = '=cmd|"/C calc"!A0';
    const sanitized = hrService.sanitizeCsvCell(maliciousInput);
    assert.ok(sanitized.includes("'="));

    const plusFormula = '+10+20';
    assert.ok(hrService.sanitizeCsvCell(plusFormula).startsWith("'+"));

    const atFormula = '@SUM(A1:A10)';
    assert.ok(hrService.sanitizeCsvCell(atFormula).startsWith("'@"));
  });

  await t.test('42. Executive HR Dashboard Metrics calculation', async () => {
    const metrics = await hrService.getHRDashboardMetrics();
    assert.ok(metrics.workforce.total >= 2);
    assert.equal(typeof metrics.leaves.pending, 'number');
    assert.equal(typeof metrics.todayAttendance.present, 'number');
  });

  await t.test('43. Enforce RBAC: Student role is strictly denied access (403) from HR endpoints', async () => {
    // Test the route-level allowRoles middleware behavior
    const { allowRoles } = require('../middleware/role.middleware');
    const middleware = allowRoles('admin', 'hr_admin', 'hr_officer', 'department_head', 'faculty', 'employee');

    const req = { user: { role: 'student', userId: studentUser._id } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /Access denied for your role/i);
  });

  await t.test('Cleanup: Disconnect from test database', async () => {
    await mongoose.disconnect();
  });
});
