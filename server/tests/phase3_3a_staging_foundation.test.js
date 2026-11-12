/**
 * server/tests/phase3_3a_staging_foundation.test.js
 * Comprehensive Isolated Test Suite for Phase 3.3A:
 * Code-Only Student Staging Pipeline Foundation.
 *
 * SAFETY MANDATE:
 * - Runs exclusively against an ephemeral MongoMemoryServer instance.
 * - Asserts test connection is isolated and database name is NOT 'campus-erp'.
 * - ZERO live database mutation.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import Phase 3.1 staging models
const StudentStaging = require('../models/StudentStaging');
const AdmissionApplication = require('../models/AdmissionApplication');
const StudentAcademicSubmission = require('../models/StudentAcademicSubmission');
const StudentInternship = require('../models/StudentInternship');
const ImportOperationLog = require('../models/ImportOperationLog');
const User = require('../models/User');

test('Phase 3.3A: Code-Only Student Staging Pipeline Foundation Suite', async (t) => {
  let mongod;
  let testUri;
  let parsedData;
  const batchId = 'BATCH-TEST-PHASE3_3A-NODE-001';
  const fixturePath = path.resolve(__dirname, '../scripts/student_staging/fixtures/synthetic_student_workbook.xlsx');

  await t.test('Setup: Spin up isolated MongoMemoryServer and verify safety boundaries', async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'campus-erp-test-phase3-3a-isolated',
      },
    });

    testUri = mongod.getUri();
    assert.ok(testUri, 'MongoMemoryServer URI must be valid');
    assert.ok(!testUri.includes('27018'), 'Must not use live port 27018');

    await mongoose.connect(testUri);
    const currentDbName = mongoose.connection.db.databaseName;

    assert.notEqual(currentDbName, 'campus-erp', 'CRITICAL SAFETY VIOLATION: Database name must NOT be campus-erp');
    console.log(`✅ [Phase 3.3A Test] Connected safely to isolated MongoMemoryServer: ${currentDbName}`);

    // Create indexes for isolated testing
    await StudentStaging.createIndexes();
    await AdmissionApplication.createIndexes();
    await StudentAcademicSubmission.createIndexes();
    await StudentInternship.createIndexes();
    await ImportOperationLog.createIndexes();
  });

  await t.test('Execute deterministic Python parser on synthetic fixture', async () => {
    // Generate synthetic fixture if missing
    const fixtureScript = path.resolve(__dirname, '../scripts/student_staging/synthetic_fixtures.py');
    execSync(`python3 "${fixtureScript}"`, { stdio: 'pipe' });

    // Execute parser script and capture JSON output
    const parserScript = path.resolve(__dirname, '../scripts/student_staging/parser.py');
    const stdout = execSync(`python3 -c "
from server.scripts.student_staging.parser import parse_student_workbook
import json
res = parse_student_workbook('${fixturePath}', '${batchId}')
print(json.dumps(res))
"`, { cwd: path.resolve(__dirname, '../..'), encoding: 'utf-8' });

    parsedData = JSON.parse(stdout);
    assert.ok(parsedData, 'Parsed data must be valid JSON');
    assert.equal(parsedData.batchId, batchId);
    assert.equal(parsedData.counts.studentMaster, 7);
    assert.equal(parsedData.counts.admissionApplications, 6);
    assert.equal(parsedData.counts.studentInternships, 4);
    assert.equal(parsedData.counts.academicSubmissions, 5);
  });

  await t.test('Ingest parsed StudentStaging records into isolated database', async () => {
    const rawStaging = parsedData.records.studentStaging;
    assert.equal(rawStaging.length, 7);

    // Bulk insert into StudentStaging
    const inserted = await StudentStaging.insertMany(rawStaging);
    assert.equal(inserted.length, 7);

    // Verify idempotency constraint: Duplicate (batchId, sourceSheet, sourceRow) must throw
    let duplicateRejected = false;
    try {
      await StudentStaging.create(rawStaging[0]);
    } catch (err) {
      if (err.code === 11000) {
        duplicateRejected = true;
      }
    }
    assert.equal(duplicateRejected, true, 'Duplicate (batchId, sourceSheet, sourceRow) must be rejected with E11000');

    // Verify conflict candidate parsing
    const bhavya = await StudentStaging.findOne({ normalizedRollNumber: '21SET/CSE/002' });
    assert.ok(bhavya);
    assert.equal(bhavya.conflictCandidates.length, 1);
    assert.equal(bhavya.conflictCandidates[0].field, 'Student Name');
  });

  await t.test('Ingest parsed AdmissionApplication records & verify duplicate app numbers support', async () => {
    const rawAdmissions = parsedData.records.admissionApplications;
    assert.equal(rawAdmissions.length, 6);

    const inserted = await AdmissionApplication.insertMany(rawAdmissions);
    assert.equal(inserted.length, 6);

    // Verify duplicate application numbers coexist safely
    const dupRecords = await AdmissionApplication.find({ applicationNumber: 'APP-2021-DUP' });
    assert.equal(dupRecords.length, 2, 'Duplicate application numbers must coexist safely');
    assert.notEqual(dupRecords[0].sourceRow, dupRecords[1].sourceRow);

    // Verify privacy exclusion: password is completely absent
    const sample = await AdmissionApplication.findOne();
    assert.equal(sample.toObject().password, undefined);
    assert.equal(sample.toObject().admitPassword, undefined);
  });

  await t.test('Ingest parsed StudentInternship records & verify null organizationName support', async () => {
    const rawInternships = parsedData.records.studentInternships;
    assert.equal(rawInternships.length, 4);

    const inserted = await StudentInternship.insertMany(rawInternships);
    assert.equal(inserted.length, 4);

    // Verify missing company name is accepted as null
    const nullCompany = await StudentInternship.findOne({ normalizedRollNumber: '21SET/CSE/002' });
    assert.ok(nullCompany);
    assert.equal(nullCompany.organizationName, null);

    // Verify multiple internships for single student
    const multiple = await StudentInternship.find({ normalizedRollNumber: '21SET/CSE/003' });
    assert.equal(multiple.length, 2);
  });

  await t.test('Ingest parsed StudentAcademicSubmission & verify non-canonical default', async () => {
    const rawAcademic = parsedData.records.academicSubmissions;
    assert.equal(rawAcademic.length, 5);

    const inserted = await StudentAcademicSubmission.insertMany(rawAcademic);
    assert.equal(inserted.length, 5);

    // Verify isCanonical is FALSE on all records
    for (const sub of inserted) {
      assert.equal(sub.isCanonical, false, 'isCanonical must be false on all initial staged submissions');
      assert.equal(sub.reviewStatus, 'pending_review');
    }

    // Verify Table 2 branch was not corrupted with 10th percentage
    const table2Entry = await StudentAcademicSubmission.findOne({ normalizedRollNumber: '21SET/CSE/002' });
    assert.ok(table2Entry);
    assert.equal(table2Entry.branch, null);
    assert.equal(table2Entry.tenthPercentage, 91.2);
  });

  await t.test('Record batch lifecycle in ImportOperationLog', async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const opLog = await ImportOperationLog.create({
      batchId,
      operationType: 'staging_ingestion',
      sourceMetadata: {
        workbookName: parsedData.metadata.workbookName,
        workbookHash: parsedData.metadata.workbookHash,
        workbookSizeBytes: parsedData.metadata.workbookSizeBytes,
        sheetsProcessed: parsedData.metadata.sheetsProcessed,
      },
      status: 'staged',
      counts: parsedData.counts,
      executedBy: dummyUserId,
    });

    assert.ok(opLog);
    assert.equal(opLog.status, 'staged');
    assert.equal(opLog.counts.get('totalStagedRecords'), 22);
  });

  await t.test('Teardown: Disconnect and destroy isolated MongoMemoryServer', async () => {
    await mongoose.disconnect();
    await mongod.stop();
    console.log('✅ [Phase 3.3A Test] Disconnected and destroyed isolated MongoMemoryServer.');
  });
});

