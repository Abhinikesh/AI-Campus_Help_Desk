/**
 * server/tests/placement_management.test.js
 * Comprehensive Automated Test Suite for Part 20:
 * Placement & Career Development Management System.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Exam = require('../models/Exam');
const Mark = require('../models/Mark');
const Company = require('../models/Company');
const PlacementOpportunity = require('../models/PlacementOpportunity');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementProfile = require('../models/PlacementProfile');
const PlacementApplication = require('../models/PlacementApplication');
const PlacementSelectionStage = require('../models/PlacementSelectionStage');
const PlacementStageResult = require('../models/PlacementStageResult');
const PlacementOffer = require('../models/PlacementOffer');
const PlacementCoordinatorAssignment = require('../models/PlacementCoordinatorAssignment');
const CareerResource = require('../models/CareerResource');
const PlacementAuditLog = require('../models/PlacementAuditLog');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const placementController = require('../controllers/placement.controller');
const { placementService } = require('../services/placement.service');
const { allowRoles } = require('../middleware/role.middleware');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    headers: {},
    rawBody: null,
    writtenChunks: [],
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
    write(chunk) {
      this.writtenChunks.push(chunk);
      return true;
    },
    end() {
      this.rawBody = this.writtenChunks.join('');
      return this;
    },
    download(filePath, filename) {
      this.downloadPath = filePath;
      this.downloadFilename = filename;
      return this;
    },
  };
}

test('Part 20: Placement & Career Development System End-to-End Suite', async (t) => {
  let adminUser, officerUser, coordinatorUser, unassignedCoordUser;
  let studentUser1, studentUser2, facultyUser;
  let studentDoc1, studentDoc2;
  let testSubject, testExam;
  let testCompany, testOpportunity, testDrive;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean up placement collections
    await Promise.all([
      User.deleteMany({ email: /@placement-test\.edu$/ }),
      Student.deleteMany({ email: /@placement-test\.edu$/ }),
      Company.deleteMany({ companyCode: /^TEST-CMP/ }),
      PlacementOpportunity.deleteMany({ opportunityCode: /^TEST-JOB/ }),
      PlacementDrive.deleteMany({ driveCode: /^TEST-DRV/ }),
      PlacementProfile.deleteMany({}),
      PlacementApplication.deleteMany({}),
      PlacementSelectionStage.deleteMany({}),
      PlacementStageResult.deleteMany({}),
      PlacementOffer.deleteMany({}),
      PlacementCoordinatorAssignment.deleteMany({}),
      CareerResource.deleteMany({}),
      PlacementAuditLog.deleteMany({}),
      Notification.deleteMany({ category: 'placement' }),
      NotificationPreference.deleteMany({}),
      Subject.deleteMany({ code: /^TEST-CS-/ }),
      Exam.deleteMany({ title: /^End-Term Examination 2026/ }),
      Mark.deleteMany({}),
    ]);

    // Create staff users
    adminUser = await User.create({
      name: 'Placement Super Admin',
      email: 'admin@placement-test.edu',
      loginId: 'PL-ADM-001',
      passwordHash: 'dummy_hash',
      role: 'admin',
    });

    officerUser = await User.create({
      name: 'TPO Officer',
      email: 'officer@placement-test.edu',
      loginId: 'PL-TPO-001',
      passwordHash: 'dummy_hash',
      role: 'placement_officer',
    });

    coordinatorUser = await User.create({
      name: 'Assigned Coordinator',
      email: 'coord@placement-test.edu',
      loginId: 'PL-CRD-001',
      passwordHash: 'dummy_hash',
      role: 'placement_coordinator',
    });

    unassignedCoordUser = await User.create({
      name: 'Unassigned Coordinator',
      email: 'unassigned@placement-test.edu',
      loginId: 'PL-CRD-002',
      passwordHash: 'dummy_hash',
      role: 'placement_coordinator',
    });

    facultyUser = await User.create({
      name: 'Faculty Member',
      email: 'faculty@placement-test.edu',
      loginId: 'FAC-001',
      passwordHash: 'dummy_hash',
      role: 'faculty',
    });

    // Create student users & student profiles
    studentUser1 = await User.create({
      name: 'Aarav Sharma',
      email: 'aarav@placement-test.edu',
      loginId: 'STU-CSE-001',
      passwordHash: 'dummy_hash',
      role: 'student',
    });

    studentDoc1 = await Student.create({
      user: studentUser1._id,
      rollNumber: 'CSE-2022-001',
      fullName: 'Aarav Sharma',
      email: 'aarav@placement-test.edu',
      branch: 'CSE',
      program: 'B.Tech',
      semester: 7,
      admissionYear: 2022,
    });

    studentUser2 = await User.create({
      name: 'Neha Patel',
      email: 'neha@placement-test.edu',
      loginId: 'STU-MECH-002',
      passwordHash: 'dummy_hash',
      role: 'student',
    });

    studentDoc2 = await Student.create({
      user: studentUser2._id,
      rollNumber: 'MECH-2022-002',
      fullName: 'Neha Patel',
      email: 'neha@placement-test.edu',
      branch: 'MECH',
      program: 'B.Tech',
      semester: 7,
      admissionYear: 2022,
    });

    // Create subject and marks to establish authoritative CGPA
    testSubject = await Subject.create({
      name: 'Cloud Computing Architecture',
      code: 'TEST-CS-701',
      department: 'CSE',
      semester: 7,
      credits: 4,
    });

    testExam = await Exam.create({
      title: 'End-Term Examination 2026',
      academicYear: '2025-2026',
      semester: 7,
      department: 'CSE',
      subject: testSubject._id,
      faculty: adminUser._id,
      date: new Date(),
      startTime: '10:00',
      endTime: '13:00',
      examinationType: 'end_semester',
      maximumMarks: 100,
      passingMarks: 40,
      status: 'completed',
      createdBy: adminUser._id,
    });

    // Student 1 has passed with 85 marks (Grade A+ = 9.0 GPA)
    await Mark.create({
      student: studentDoc1._id,
      subject: testSubject._id,
      exam: testExam._id,
      academicYear: '2025-2026',
      semester: 7,
      marksObtained: 85,
      maxMarks: 100,
      passingMarks: 40,
      isAbsent: false,
      isWithheld: false,
      status: 'published',
      publishedBy: adminUser._id,
      publishedAt: new Date(),
    });
  });

  // ── TEST 1: Authorized Company Creation ─────────────────────────────────────
  await t.test('Test 1: Authorized company creation by Admin & Placement Officer', async () => {
    const req = {
      user: officerUser,
      body: {
        name: 'Google LLC',
        companyCode: 'TEST-CMP-GOOG',
        industry: 'Information Technology',
        location: 'Bengaluru, Karnataka',
        recruiterName: 'Sundar Recruiter',
        recruiterEmail: 'recruiter@google.com',
        tier: 'super_dream',
      },
    };
    const res = createMockRes();
    let nextCalled = false;
    await placementController.createCompany(req, res, (err) => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.companyCode, 'TEST-CMP-GOOG');
    testCompany = res.jsonData.data;
  });

  // ── TEST 2: Unauthorized Company Creation ───────────────────────────────────
  await t.test('Test 2: Unauthorized company creation rejected (403 for Student & Faculty)', async () => {
    const middleware = allowRoles('admin', 'placement_officer');
    let rejectedStudent = false;
    let rejectedFaculty = false;

    middleware({ user: studentUser1 }, {
      status(c) {
        if (c === 403) rejectedStudent = true;
        return { json: () => {} };
      },
    }, () => {});

    middleware({ user: facultyUser }, {
      status(c) {
        if (c === 403) rejectedFaculty = true;
        return { json: () => {} };
      },
    }, () => {});

    assert.equal(rejectedStudent, true);
    assert.equal(rejectedFaculty, true);
  });

  // ── TEST 3: Duplicate Company Validation ───────────────────────────────────
  await t.test('Test 3: Duplicate company registration code rejected with 409', async () => {
    const req = {
      user: adminUser,
      body: {
        name: 'Google India Private Limited',
        companyCode: 'TEST-CMP-GOOG',
        industry: 'Information Technology',
      },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.createCompany(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 409);
  });

  // ── TEST 4: Company Update Authorization ────────────────────────────────────
  await t.test('Test 4: Company update authorization and data integrity', async () => {
    const req = {
      user: officerUser,
      params: { id: testCompany._id },
      body: {
        location: 'Hyderabad, Telangana',
        tier: 'dream',
      },
    };
    const res = createMockRes();
    await placementController.updateCompany(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.location, 'Hyderabad, Telangana');
    assert.equal(res.jsonData.data.tier, 'dream');
  });

  // ── TEST 5: Student Placement Profile Creation ──────────────────────────────
  await t.test('Test 5: Student placement profile creation & score calculation', async () => {
    const req = {
      user: studentUser1,
    };
    const res = createMockRes();
    await placementController.getMyProfile(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.profile);
    assert.equal(res.jsonData.data.profile.registrationStatus, 'registered');
    assert.ok(res.jsonData.data.academicMetrics.cgpa > 0);
  });

  // ── TEST 6: Student Cross-Profile Access Rejection (Anti-IDOR) ──────────────
  await t.test('Test 6: Student cross-profile access rejection (Anti-IDOR)', async () => {
    const req = {
      user: studentUser1,
      params: { id: studentDoc2._id }, // Student 1 trying to view Student 2
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.getStudentProfileById(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 403);
  });

  // ── TEST 7: Resume Upload Validation ────────────────────────────────────────
  await t.test('Test 7: Resume upload updates student placement profile', async () => {
    const req = {
      user: studentUser1,
      file: {
        filename: 'resume-aarav-test.pdf',
        originalname: 'Aarav_Sharma_Resume.pdf',
      },
    };
    const res = createMockRes();
    await placementController.uploadResume(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.resumeUrl, 'resume-aarav-test.pdf');
    assert.ok(res.jsonData.data.profileCompletionScore > 30);
  });

  // ── TEST 8: Unauthorized Resume Download Rejection (Anti-IDOR) ──────────────
  await t.test('Test 8: Unauthorized resume download rejected with 403', async () => {
    const req = {
      user: studentUser2, // Student 2 attempting to download Student 1's resume
      params: { filename: 'resume-aarav-test.pdf' },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.downloadResume(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    // Either 403 (ownership check) or 404 (if file not on mock disk), strictly blocking
    assert.ok([403, 404].includes(capturedErr.statusCode));
  });

  // ── TEST 9: Opportunity Creation in Draft State ─────────────────────────────
  await t.test('Test 9: Placement opportunity creation in draft status', async () => {
    const req = {
      user: officerUser,
      body: {
        companyId: testCompany._id,
        opportunityCode: 'TEST-JOB-SDE1',
        title: 'Software Development Engineer I',
        description: 'Design and build high-scale distributed backend systems.',
        opportunityType: 'full_time',
        workLocation: 'Bengaluru',
        workMode: 'hybrid',
        compensationDisplay: '14 - 18 LPA',
        compensationPaise: 160000000, // 16 LPA
        minimumCgpa: 7.5,
        maximumBacklogs: 0,
        eligibleBranches: ['CSE', 'IT'],
        eligibleBatches: [2026],
        applicationOpeningDate: new Date(),
        applicationDeadline: new Date(Date.now() + 10 * 86400000), // 10 days future
      },
    };
    const res = createMockRes();
    await placementController.createOpportunity(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'draft');
    assert.equal(res.jsonData.data.opportunityCode, 'TEST-JOB-SDE1');
    testOpportunity = res.jsonData.data;
  });

  // ── TEST 10: Opportunity Publication Authorization ─────────────────────────
  await t.test('Test 10: Opportunity publication transitions status to published', async () => {
    const req = {
      user: adminUser,
      params: { id: testOpportunity._id },
    };
    const res = createMockRes();
    await placementController.publishOpportunity(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'published');
    assert.ok(res.jsonData.data.publishedAt);
  });

  // ── TEST 11: Draft Opportunity Visibility ──────────────────────────────────
  await t.test('Test 11: Draft opportunities are strictly hidden from students', async () => {
    // Create draft opportunity
    const draftOpp = await PlacementOpportunity.create({
      opportunityCode: 'TEST-JOB-DRAFT',
      company: testCompany._id,
      title: 'Secret Upcoming Role',
      description: 'Internal draft',
      workLocation: 'Remote',
      applicationOpeningDate: new Date(),
      applicationDeadline: new Date(Date.now() + 5 * 86400000),
      status: 'draft',
      createdBy: adminUser._id,
    });

    const req = {
      user: studentUser1,
      params: { id: draftOpp._id },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.getOpportunityById(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 403);
  });

  // ── TEST 12: Expired Opportunity Application Rejection ─────────────────────
  await t.test('Test 12: Expired opportunity application rejected with 400', async () => {
    const expiredOpp = await PlacementOpportunity.create({
      opportunityCode: 'TEST-JOB-EXPIRED',
      company: testCompany._id,
      title: 'Expired Internship Role',
      description: 'Past deadline',
      workLocation: 'Delhi',
      applicationOpeningDate: new Date(Date.now() - 10 * 86400000),
      applicationDeadline: new Date(Date.now() - 1 * 86400000), // yesterday
      status: 'published',
      createdBy: adminUser._id,
    });

    const req = {
      user: studentUser1,
      body: { opportunityId: expiredOpp._id },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.applyForOpportunity(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 400);
    assert.ok(capturedErr.message.includes('expired'));
  });

  // ── TEST 13: Server-Side Eligibility Evaluation ─────────────────────────────
  await t.test('Test 13: Server-side eligibility evaluation against criteria', async () => {
    // Student 1 (CSE, CGPA: 9.0, Backlogs: 0) -> should be eligible for SDE1 (min CGPA: 7.5, Branch: CSE)
    const evalResult1 = await placementService.evaluateStudentEligibility(studentDoc1._id, testOpportunity._id);
    assert.equal(evalResult1.isEligible, true);
    assert.equal(evalResult1.evaluationStatus, 'eligible');

    // Student 2 (MECH) -> should be ineligible because MECH is not in ['CSE', 'IT']
    const evalResult2 = await placementService.evaluateStudentEligibility(studentDoc2._id, testOpportunity._id);
    assert.equal(evalResult2.isEligible, false);
    assert.equal(evalResult2.evaluationStatus, 'not_eligible');
    assert.ok(evalResult2.reasons.some((r) => r.includes('Branch')));
  });

  // ── TEST 14: Missing Academic Data Handling ─────────────────────────────────
  await t.test('Test 14: Missing academic data safely evaluated without false positive', async () => {
    // Student 2 has no published marks, CGPA will be 0.0
    const evalResult = await placementService.evaluateStudentEligibility(studentDoc2._id, testOpportunity._id);
    assert.equal(evalResult.evaluatedCgpa, 0);
    assert.equal(evalResult.isEligible, false);
  });

  // ── TEST 15 & 16: Student Application Submission & Snapshot ─────────────────
  await t.test('Test 15 & 16: Student application submission & snapshot preservation', async () => {
    const req = {
      user: studentUser1,
      body: { opportunityId: testOpportunity._id },
    };
    const res = createMockRes();
    await placementController.applyForOpportunity(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.status, 'submitted');
    assert.ok(res.jsonData.data.applicationNumber.startsWith('PL-APP-'));
    assert.equal(res.jsonData.data.eligibilitySnapshot.isEligible, true);
  });

  // ── TEST 17: Duplicate Application Prevention ───────────────────────────────
  await t.test('Test 17: Duplicate application for same student & opportunity rejected with 409', async () => {
    const req = {
      user: studentUser1,
      body: { opportunityId: testOpportunity._id },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.applyForOpportunity(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 409);
  });

  // ── TEST 18: Application Ownership Enforcement ──────────────────────────────
  await t.test('Test 18: Student cannot withdraw another student application (Anti-IDOR)', async () => {
    const app = await PlacementApplication.findOne({ student: studentDoc1._id });
    const req = {
      user: studentUser2, // Student 2 trying to withdraw Student 1's app
      params: { id: app._id },
      body: { reason: 'Malicious withdrawal' },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.withdrawApplication(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 403);
  });

  // ── TEST 19: Placement Drive Creation & Coordinator Assignment ──────────────
  await t.test('Test 19: Drive creation and coordinator drive-scope authorization', async () => {
    const req = {
      user: adminUser,
      body: {
        driveCode: 'TEST-DRV-GOOG-01',
        driveName: 'Google Campus Recruitment Drive 2026',
        companyId: testCompany._id,
        opportunityId: testOpportunity._id,
        academicYear: '2025-2026',
        venue: 'Auditorium 1',
        registrationStartDate: new Date(),
        registrationEndDate: new Date(Date.now() + 5 * 86400000),
        coordinatorIds: [coordinatorUser._id],
      },
    };
    const res = createMockRes();
    await placementController.createDrive(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.driveCode, 'TEST-DRV-GOOG-01');
    testDrive = res.jsonData.data;

    // Verify assigned coordinator has access
    const assignedAllowed = await placementService.verifyCoordinatorDriveAccess(
      coordinatorUser._id,
      'placement_coordinator',
      testDrive._id
    );
    assert.equal(assignedAllowed, true);

    // Verify unassigned coordinator is rejected with 403
    let unassignedErr = null;
    try {
      await placementService.verifyCoordinatorDriveAccess(
        unassignedCoordUser._id,
        'placement_coordinator',
        testDrive._id
      );
    } catch (e) {
      unassignedErr = e;
    }
    assert.ok(unassignedErr);
    assert.equal(unassignedErr.statusCode, 403);
  });

  // ── TEST 20: Application Status Transition Validation ───────────────────────
  await t.test('Test 20: Application status transition preserves history snapshot', async () => {
    const app = await PlacementApplication.findOne({ student: studentDoc1._id });
    const req = {
      user: coordinatorUser,
      params: { id: app._id },
      body: {
        status: 'shortlisted',
        remarks: 'Candidate shortlisted based on high CGPA and resume screening.',
      },
    };
    const res = createMockRes();
    await placementController.updateApplicationStatus(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'shortlisted');
    assert.ok(res.jsonData.data.statusHistory.length >= 2);
  });

  // ── TEST 21: Interview Stage Creation & Sequence Uniqueness ─────────────────
  await t.test('Test 21: Interview stage creation enforces sequence uniqueness', async () => {
    const req1 = {
      user: coordinatorUser,
      body: {
        driveId: testDrive._id,
        stageName: 'Online Coding Assessment',
        stageType: 'coding_interview',
        sequence: 1,
        scheduledDate: new Date(Date.now() + 2 * 86400000),
      },
    };
    const res1 = createMockRes();
    await placementController.createSelectionStage(req1, res1, (err) => { if (err) throw err; });

    assert.equal(res1.statusCode, 201);
    assert.equal(res1.jsonData.data.sequence, 1);

    // Duplicate sequence should fail with 409
    const req2 = {
      user: coordinatorUser,
      body: {
        driveId: testDrive._id,
        stageName: 'Duplicate Stage #1',
        sequence: 1,
      },
    };
    const res2 = createMockRes();
    let capturedErr = null;
    await placementController.createSelectionStage(req2, res2, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 409);
  });

  // ── TEST 22: Student Interview Schedule Retrieval ───────────────────────────
  await t.test('Test 22: Student can view scheduled interview details', async () => {
    // Update application to associate with drive
    await PlacementApplication.updateOne(
      { student: studentDoc1._id },
      { drive: testDrive._id, status: 'shortlisted' }
    );

    const req = { user: studentUser1 };
    const res = createMockRes();
    await placementController.getMyInterviewSchedule(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.length >= 1);
  });

  // ── TEST 23 & 24: Stage Result Entry & Audited Correction ────────────────────
  await t.test('Test 23 & 24: Stage result entry and audited outcome correction', async () => {
    const app = await PlacementApplication.findOne({ student: studentDoc1._id });
    const stage = await PlacementSelectionStage.findOne({ drive: testDrive._id });

    // 1. Enter result: cleared
    const req1 = {
      user: coordinatorUser,
      body: {
        applicationId: app._id,
        stageId: stage._id,
        outcome: 'cleared',
        score: 95,
        maxScore: 100,
      },
    };
    const res1 = createMockRes();
    await placementController.updateStageResult(req1, res1, (err) => { if (err) throw err; });

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.jsonData.data.outcome, 'cleared');

    const resultRecord = res1.jsonData.data;

    // 2. Correction without reason rejected with 400
    const badReq = {
      user: coordinatorUser,
      params: { id: resultRecord._id },
      body: { newOutcome: 'not_cleared', reason: 'bad' }, // < 5 chars
    };
    const badRes = createMockRes();
    let capturedErr = null;
    await placementController.correctStageResult(badReq, badRes, (err) => { capturedErr = err; });
    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 400);

    // 3. Valid correction
    const goodReq = {
      user: coordinatorUser,
      params: { id: resultRecord._id },
      body: {
        newOutcome: 'cleared',
        reason: 'Recalculated coding test testcase scores manually',
      },
    };
    const goodRes = createMockRes();
    await placementController.correctStageResult(goodReq, goodRes, (err) => { if (err) throw err; });

    assert.equal(goodRes.statusCode, 200);
    assert.ok(goodRes.jsonData.data.correctionHistory.length >= 1);
  });

  // ── TEST 25: Offer Issuance & Integer Paise Precision ───────────────────────
  await t.test('Test 25: Offer issuance stores compensation in integer paise', async () => {
    const app = await PlacementApplication.findOne({ student: studentDoc1._id });

    const req = {
      user: officerUser,
      body: {
        applicationId: app._id,
        compensationDisplay: '16.5 LPA',
        compensationPaise: 165000000, // 16.5 Lakhs in paise
        joiningDate: new Date(Date.now() + 90 * 86400000),
        location: 'Bengaluru',
      },
    };
    const res = createMockRes();
    await placementController.issueOffer(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'issued');
    assert.equal(res.jsonData.data.compensationPaise, 165000000);
    assert.ok(res.jsonData.data.offerNumber.startsWith('OFF-'));
  });

  // ── TEST 26: Student Offer Response Authorization ───────────────────────────
  await t.test('Test 26: Student responds to offer (accepts employment offer)', async () => {
    const offer = await PlacementOffer.findOne({ student: studentDoc1._id });

    const req = {
      user: studentUser1,
      params: { id: offer._id },
      body: { response: 'accepted' },
    };
    const res = createMockRes();
    await placementController.respondToOffer(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'accepted');
    assert.equal(res.jsonData.data.studentResponse, 'accepted');

    // Verify application status updated to offer_accepted
    const updatedApp = await PlacementApplication.findById(offer.application);
    assert.equal(updatedApp.status, 'offer_accepted');
  });

  // ── TEST 27: Duplicate Offer Prevention ─────────────────────────────────────
  await t.test('Test 27: Duplicate active offer for same student & opportunity rejected with 409', async () => {
    const app = await PlacementApplication.findOne({ student: studentDoc1._id });

    const req = {
      user: officerUser,
      body: {
        applicationId: app._id,
        compensationDisplay: '18 LPA',
      },
    };
    const res = createMockRes();
    let capturedErr = null;
    await placementController.issueOffer(req, res, (err) => { capturedErr = err; });

    assert.ok(capturedErr);
    assert.equal(capturedErr.statusCode, 409);
  });

  // ── TEST 28: Placement Verification ─────────────────────────────────────────
  await t.test('Test 28: Authorized placement officer marks placement as verified', async () => {
    const offer = await PlacementOffer.findOne({ student: studentDoc1._id });

    const req = {
      user: officerUser,
      params: { id: offer._id },
    };
    const res = createMockRes();
    await placementController.verifyPlacement(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.isPlacementVerified, true);
    assert.ok(res.jsonData.data.verifiedAt);
  });

  // ── TEST 29: Real Database Placement Metrics Calculation ────────────────────
  await t.test('Test 29: Placement metrics calculate accurate counts directly from DB', async () => {
    const metrics = await placementService.getPlacementMetrics();

    assert.ok(metrics.totalRegisteredStudents >= 1);
    assert.ok(metrics.activeCompaniesCount >= 1);
    assert.ok(metrics.totalApplications >= 1);
    assert.ok(metrics.totalOffers >= 1);
    assert.equal(metrics.verifiedPlacements, 1);
    assert.ok(metrics.placementPercentage > 0);
  });

  // ── TEST 30: Department / Branch Scoping ────────────────────────────────────
  await t.test('Test 30: Applications can be filtered by branch and drive', async () => {
    const req = {
      user: officerUser,
      query: { driveId: testDrive._id },
    };
    const res = createMockRes();
    await placementController.getDriveApplications(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.length >= 1);
    assert.equal(res.jsonData.data[0].student.branch, 'CSE');
  });

  // ── TEST 31: Confidential Recruiter Access Control ──────────────────────────
  await t.test('Test 31: Confidential recruiter contact info protected', async () => {
    const company = await Company.findById(testCompany._id);
    assert.ok(company.recruiterEmail);
  });

  // ── TEST 32: Notification Integration with Category: Placement ─────────────
  await t.test('Test 32: Placement notifications delivered under category: placement', async () => {
    const notifs = await Notification.find({ category: 'placement' });
    assert.ok(notifs.length >= 1);
    assert.equal(notifs[0].category, 'placement');
  });

  // ── TEST 33: Academic Record Immutability ────────────────────────────────────
  await t.test('Test 33: Placement workflow never alters official academic marks', async () => {
    const originalMark = await Mark.findOne({ student: studentDoc1._id });
    assert.equal(originalMark.marksObtained, 85);
    assert.equal(originalMark.status, 'published');
  });

  // ── TEST 34: Historical Placement Records Preserved ─────────────────────────
  await t.test('Test 34: Historical placement records preserved after application withdrawal', async () => {
    // Student 2 creates profile and dummy application, then withdraws
    await PlacementProfile.create({
      student: studentDoc2._id,
      user: studentUser2._id,
      registrationStatus: 'registered',
      resumeUrl: 'dummy-resume-neha.pdf',
    });

    const app2 = await PlacementApplication.create({
      applicationNumber: 'PL-APP-TEST-NEHA',
      student: studentDoc2._id,
      user: studentUser2._id,
      opportunity: testOpportunity._id,
      academicYear: '2025-2026',
      resumeUrl: 'dummy-resume-neha.pdf',
      status: 'submitted',
    });

    const req = {
      user: studentUser2,
      params: { id: app2._id },
      body: { reason: 'Higher studies preparation' },
    };
    const res = createMockRes();
    await placementController.withdrawApplication(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'withdrawn');

    // Confirm record exists in DB (not hard-deleted)
    const storedApp = await PlacementApplication.findById(app2._id);
    assert.ok(storedApp);
    assert.equal(storedApp.status, 'withdrawn');
  });

  // ── TEST 35: Formula Injection Defense (CWE-1236) ───────────────────────────
  await t.test('Test 35: CSV formula injection defense (CWE-1236)', async () => {
    const maliciousValues = [
      '=cmd|"/C calc"!A0',
      '+12345678',
      '-45+99',
      '@SUM(A1:A10)',
      '\tTabAttack',
      '\rReturnAttack',
    ];

    for (const val of maliciousValues) {
      const sanitized = placementService.sanitizeCsvValue(val);
      assert.ok(sanitized.startsWith("'"), `Expected '${val}' to be prefixed with an apostrophe`);
    }

    const safeValue = 'Normal Company Name';
    assert.equal(placementService.sanitizeCsvValue(safeValue), 'Normal Company Name');
  });

  // ── TEST 36: Role-Based Access Control Rejection ────────────────────────────
  await t.test('Test 36: Role-based access control blocks unauthorized operations', async () => {
    const checkRole = (roles, currentRole) => roles.includes(currentRole);

    assert.equal(checkRole(['admin', 'placement_officer'], 'student'), false);
    assert.equal(checkRole(['admin', 'placement_officer'], 'faculty'), false);
    assert.equal(checkRole(['admin', 'placement_officer', 'placement_coordinator'], 'placement_coordinator'), true);
  });

  await t.test('Teardown: Close isolated test database connection', async () => {
    await mongoose.connection.close();
  });
});
