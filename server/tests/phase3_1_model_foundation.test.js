/**
 * server/tests/phase3_1_model_foundation.test.js
 * Comprehensive Isolated Test Suite for Phase 3.1:
 * Code-Only Student Data Import Foundation.
 *
 * SAFETY MANDATE:
 * - Runs exclusively against an ephemeral MongoMemoryServer instance.
 * - Asserts test connection is isolated and database name is NOT 'campus-erp'.
 * - Never connects to development, production, or default database URIs.
 * - ZERO live database mutation.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import Phase 3.1 models
const Student = require('../models/Student');
const StudentStaging = require('../models/StudentStaging');
const AdmissionApplication = require('../models/AdmissionApplication');
const StudentAcademicSubmission = require('../models/StudentAcademicSubmission');
const StudentInternship = require('../models/StudentInternship');
const ImportOperationLog = require('../models/ImportOperationLog');
const ImportFieldChangeLog = require('../models/ImportFieldChangeLog');
const User = require('../models/User');

test('Phase 3.1: Code-Only Student Data Import Foundation Suite', async (t) => {
  let mongod;
  let testUri;

  // Global Setup: Ephemeral MongoMemoryServer
  await t.test('Setup: Spin up isolated MongoMemoryServer and verify safety boundaries', async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'campus-erp-test-phase3-1-isolated',
      },
    });

    testUri = mongod.getUri();
    assert.ok(testUri, 'MongoMemoryServer URI must be valid');
    assert.ok(!testUri.includes('27018'), 'Must not use live port 27018');

    // Connect mongoose to isolated in-memory DB
    await mongoose.connect(testUri);
    const currentDbName = mongoose.connection.db.databaseName;

    // Strict safety assertions
    assert.notEqual(currentDbName, 'campus-erp', 'CRITICAL SAFETY VIOLATION: Database name must NOT be campus-erp');
    assert.ok(
      currentDbName.includes('isolated') || currentDbName.includes('test'),
      'Database name must contain test or isolated'
    );

    // Build indexes in the isolated memory DB for validation testing
    await Promise.all([
      Student.createIndexes(),
      StudentStaging.createIndexes(),
      AdmissionApplication.createIndexes(),
      StudentAcademicSubmission.createIndexes(),
      StudentInternship.createIndexes(),
      ImportOperationLog.createIndexes(),
      ImportFieldChangeLog.createIndexes(),
      User.createIndexes(),
    ]);

    console.log(`✅ [Phase 3.1 Test] Connected safely to isolated MongoMemoryServer: ${currentDbName}`);
  });

  // Test 1: Partial unique index accepts multiple students with user: null
  await t.test('1. Partial unique index accepts multiple Student records with user: null', async () => {
    const student1 = await Student.create({
      rollNumber: '1/24/SET/BCS/001',
      fullName: 'Offline Student One',
      user: null,
      accountStatus: 'enrolled_offline',
    });
    assert.ok(student1._id);
    assert.equal(student1.user, null);

    const student2 = await Student.create({
      rollNumber: '1/24/SET/BCS/002',
      fullName: 'Offline Student Two',
      user: null,
      accountStatus: 'enrolled_offline',
    });
    assert.ok(student2._id);
    assert.equal(student2.user, null);

    const student3 = await Student.create({
      rollNumber: '1/24/SET/BCS/003',
      fullName: 'Offline Student Three',
      // user omitted (defaults to null)
      accountStatus: 'enrolled_offline',
    });
    assert.ok(student3._id);
    assert.equal(student3.user, null);

    const offlineCount = await Student.countDocuments({ user: null });
    assert.equal(offlineCount, 3, 'All 3 offline students with user: null must be persisted');
  });

  // Test 2: Two students referencing the same User ObjectId are rejected
  await t.test('2. Two Student records referencing the same ObjectId User are rejected by partial index', async () => {
    const sharedUserId = new mongoose.Types.ObjectId();

    const studentA = await Student.create({
      rollNumber: '1/24/SET/BCS/010',
      fullName: 'Student With User A',
      user: sharedUserId,
      accountStatus: 'active_user',
    });
    assert.ok(studentA._id);

    // Second student attempting to link the same user must fail with E11000 duplicate key
    await assert.rejects(
      async () => {
        await Student.create({
          rollNumber: '1/24/SET/BCS/011',
          fullName: 'Student With User B (Collision)',
          user: sharedUserId,
          accountStatus: 'active_user',
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate ObjectId on user must be rejected'
    );
  });

  // Test 3: Duplicate Student roll numbers are rejected
  await t.test('3. Duplicate Student roll numbers are strictly rejected', async () => {
    await assert.rejects(
      async () => {
        await Student.create({
          rollNumber: '1/24/SET/BCS/001', // Collides with student1
          fullName: 'Duplicate Roll Impostor',
          user: null,
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate rollNumber must throw E11000 duplicate key error'
    );
  });

  // Test 4: Duplicate admission application numbers are permitted and flagged
  await t.test('4. Duplicate admission application numbers are permitted and reviewable', async () => {
    const app1 = await AdmissionApplication.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 10,
      applicationNumber: 'MRIIRS24/22870',
      studentName: 'Candidate Alpha',
      course: 'B.Tech CSE',
      admissionStatus: 'duplicate_flagged',
    });
    assert.ok(app1._id);

    const app2 = await AdmissionApplication.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 11,
      applicationNumber: 'MRIIRS24/22870', // Same application number, different sourceRow
      studentName: 'Candidate Beta',
      course: 'B.Tech CSE',
      admissionStatus: 'duplicate_flagged',
    });
    assert.ok(app2._id);
    assert.notEqual(app1._id.toString(), app2._id.toString());

    const apps = await AdmissionApplication.find({ applicationNumber: 'MRIIRS24/22870' });
    assert.equal(apps.length, 2, 'Both duplicate application rows must be preserved safely');
  });

  // Test 5: Missing rawRollNumber is rejected in StudentAcademicSubmission
  await t.test('5. Missing rawRollNumber is rejected in StudentAcademicSubmission', async () => {
    await assert.rejects(
      async () => {
        await StudentAcademicSubmission.create({
          batchId: 'BATCH-202611-01',
          sourceRow: 5,
          normalizedRollNumber: '1/24/SET/BCS/050',
          // rawRollNumber omitted
          tenthPercentage: 85.5,
        });
      },
      (err) => {
        assert.ok(err.name === 'ValidationError');
        assert.ok(err.errors.rawRollNumber);
        return true;
      },
      'Validation must reject submission missing rawRollNumber'
    );
  });

  // Test 6: Missing applicationNumber is rejected in AdmissionApplication
  await t.test('6. Missing applicationNumber is rejected in AdmissionApplication', async () => {
    await assert.rejects(
      async () => {
        await AdmissionApplication.create({
          batchId: 'BATCH-202611-01',
          sourceRow: 15,
          studentName: 'Incomplete Candidate',
          // applicationNumber omitted
        });
      },
      (err) => {
        assert.ok(err.name === 'ValidationError');
        assert.ok(err.errors.applicationNumber);
        return true;
      },
      'Validation must reject admission record missing applicationNumber'
    );
  });

  // Test 7: StudentInternship permits a missing organization name
  await t.test('7. StudentInternship permits missing organizationName (for the 52 incomplete records)', async () => {
    const internshipEmptyOrg = await StudentInternship.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 20,
      normalizedRollNumber: '1/24/SET/BCS/001',
      organizationName: null, // Empty company name
      internshipTitle: 'Self Learning Project',
      linkageStatus: 'unmatched',
    });
    assert.ok(internshipEmptyOrg._id);
    assert.equal(internshipEmptyOrg.organizationName, null);
    assert.equal(internshipEmptyOrg.mode, null, 'Mode must remain null without synthetic defaults');
    assert.equal(internshipEmptyOrg.stipendProvided, null, 'Stipend must remain null without synthetic defaults');
  });

  // Test 8: Multiple internships for the same Student are accepted
  await t.test('8. Multiple internships for the same Student are accepted without conflict', async () => {
    const student = await Student.findOne({ rollNumber: '1/24/SET/BCS/001' });

    const internship1 = await StudentInternship.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 25,
      normalizedRollNumber: '1/24/SET/BCS/001',
      studentId: student._id,
      organizationName: 'Tech Corp Alpha',
      internshipTitle: 'Frontend Intern',
      linkageStatus: 'confirmed_linked',
    });

    const internship2 = await StudentInternship.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 26,
      normalizedRollNumber: '1/24/SET/BCS/001',
      studentId: student._id,
      organizationName: 'AI Labs Beta',
      internshipTitle: 'Research Intern',
      linkageStatus: 'confirmed_linked',
    });

    assert.ok(internship1._id);
    assert.ok(internship2._id);

    const studentInternships = await StudentInternship.find({ studentId: student._id });
    assert.equal(studentInternships.length, 2, 'Student must have 2 internships successfully linked');
  });

  // Test 9: StudentAcademicSubmission records can exist without a matched Student
  await t.test('9. StudentAcademicSubmission records can exist without a matched Student (studentId: null)', async () => {
    const unlinkedSub = await StudentAcademicSubmission.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 30,
      rawRollNumber: '1/24/SET/BCS/999',
      normalizedRollNumber: '1/24/SET/BCS/999',
      studentId: null, // Unlinked
      tenthPercentage: 78.2,
      twelfthPercentage: 82.0,
      isCanonical: false,
      reviewStatus: 'pending_review',
    });
    assert.ok(unlinkedSub._id);
    assert.equal(unlinkedSub.studentId, null);
    assert.equal(unlinkedSub.isCanonical, false);
  });

  // Test 10: Staging records can exist with incomplete identifiers
  await t.test('10. Staging records can exist with incomplete identifiers (no rollNumber or name)', async () => {
    const rawMap = new Map([
      ['UnknownCol1', 'Raw Data Val'],
      ['Notes', 'Incomplete survey row'],
    ]);

    const incompleteStaging = await StudentStaging.create({
      batchId: 'BATCH-202611-01',
      sourceSheet: 'Student Master',
      sourceRow: 99,
      rawIdentifier: null,
      normalizedRollNumber: null,
      studentName: null,
      rawPayload: rawMap,
      reviewStatus: 'pending_review',
    });
    assert.ok(incompleteStaging._id);
    assert.equal(incompleteStaging.normalizedRollNumber, null);
    assert.equal(incompleteStaging.studentName, null);
  });

  // Test 11: Batch/source-row idempotency constraints behave correctly
  await t.test('11. Batch/source-row idempotency constraints reject duplicate ingestion within the same batch', async () => {
    // StudentStaging idempotency: { batchId, sourceSheet, sourceRow }
    await assert.rejects(
      async () => {
        await StudentStaging.create({
          batchId: 'BATCH-202611-01',
          sourceSheet: 'Student Master',
          sourceRow: 99, // Collides with incompleteStaging above
          rawPayload: new Map([['test', 'val']]),
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate { batchId, sourceSheet, sourceRow } must throw E11000'
    );

    // AdmissionApplication idempotency: { batchId, sourceRow }
    await assert.rejects(
      async () => {
        await AdmissionApplication.create({
          batchId: 'BATCH-202611-01',
          sourceRow: 10, // Collides with app1 above
          applicationNumber: 'MRIIRS24/99999',
          studentName: 'Different Name Colliding Row',
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate { batchId, sourceRow } on AdmissionApplication must throw E11000'
    );

    // StudentInternship idempotency: { batchId, sourceRow }
    await assert.rejects(
      async () => {
        await StudentInternship.create({
          batchId: 'BATCH-202611-01',
          sourceRow: 20, // Collides with internshipEmptyOrg above
          normalizedRollNumber: '1/24/SET/BCS/001',
        });
      },
      (err) => {
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
        return true;
      },
      'Duplicate { batchId, sourceRow } on StudentInternship must throw E11000'
    );
  });

  // Test 12: Import logs preserve required provenance and field-change metadata
  await t.test('12. Import logs preserve required provenance and field-change metadata', async () => {
    const adminUserId = new mongoose.Types.ObjectId();

    const opLog = await ImportOperationLog.create({
      batchId: 'BATCH-202611-01',
      operationType: 'staging_validation',
      sourceMetadata: {
        workbookName: 'CampusSphere_AI_Consolidated_Student_Data.xlsx',
        workbookHash: '95e0c6e1e6...',
        workbookSizeBytes: 188897,
        sheetsProcessed: ['Student Master', 'Admission Records', 'Internship Records', 'Academic Records'],
      },
      status: 'validated',
      counts: new Map([
        ['stagedTotal', 2383],
        ['validRecords', 2383],
        ['errors', 0],
      ]),
      validationSummary: {
        totalRecords: 2383,
        validRecords: 2383,
        invalidRecords: 0,
        errorDetails: [],
      },
      executedBy: adminUserId,
    });
    assert.ok(opLog._id);
    assert.equal(opLog.status, 'validated');

    const targetStudentId = new mongoose.Types.ObjectId();
    const fieldLog = await ImportFieldChangeLog.create({
      batchId: 'BATCH-202611-01',
      collectionName: 'students',
      documentId: targetStudentId,
      operation: 'UPDATE',
      fieldPath: 'academicDetails.tenthPercentage',
      beforeValue: null,
      afterValue: 88.5,
      sourceProvenance: {
        sourceSheet: 'Academic Records',
        sourceRow: 45,
        stagingId: new mongoose.Types.ObjectId(),
      },
      changeStatus: 'applied',
      documentUpdatedAtSnapshot: new Date(),
    });
    assert.ok(fieldLog._id);
    assert.equal(fieldLog.afterValue, 88.5);
    assert.equal(fieldLog.changeStatus, 'applied');
  });

  // Test 13: No automatic canonical academic promotion occurs
  await t.test('13. No automatic canonical academic promotion occurs (isCanonical defaults to false)', async () => {
    const submission = await StudentAcademicSubmission.create({
      batchId: 'BATCH-202611-01',
      sourceRow: 50,
      rawRollNumber: '1/24/SET/BCS/117',
      normalizedRollNumber: '1/24/SET/BCS/117',
      tenthPercentage: 73.0,
      selfReportedCgpa: 8.1,
    });
    assert.equal(submission.isCanonical, false, 'isCanonical must default to false');
    assert.equal(submission.reviewStatus, 'pending_review');

    // Verify Student record was not touched or promoted automatically
    const student = await Student.findOne({ rollNumber: '1/24/SET/BCS/001' });
    assert.equal(student.academicDetails.tenthPercentage, null);
    assert.equal(student.academicDetails.promotionStatus, 'unpromoted');
  });

  // Test 14: Model registration does not trigger automatic collection or index creation
  await t.test('14. Model registration schema options set autoIndex: false and autoCreate: false', () => {
    const models = [
      Student,
      StudentStaging,
      AdmissionApplication,
      StudentAcademicSubmission,
      StudentInternship,
      ImportOperationLog,
      ImportFieldChangeLog,
    ];

    for (const model of models) {
      assert.equal(
        model.schema.options.autoIndex,
        false,
        `${model.modelName} must have schema option autoIndex: false`
      );
      assert.equal(
        model.schema.options.autoCreate,
        false,
        `${model.modelName} must have schema option autoCreate: false`
      );
    }
  });

  // Global Teardown: Disconnect and stop memory server
  await t.test('Teardown: Disconnect and terminate isolated MongoMemoryServer', async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('✅ [Phase 3.1 Test] Disconnected and destroyed isolated MongoMemoryServer.');
  });
});

