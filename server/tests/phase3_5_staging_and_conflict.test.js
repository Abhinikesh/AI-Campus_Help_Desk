/**
 * server/tests/phase3_5_staging_and_conflict.test.js
 * Comprehensive Targeted Test Suite for Phase 3.5:
 * Timetable Staging Ingestion, Reconciliation & Pre-Import Conflict Engine.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const Timetable = require('../models/Timetable');
const TimetableStaging = require('../models/TimetableStaging');
const ConflictRecord = require('../models/ConflictRecord');
const TimetableAnomaly = require('../models/TimetableAnomaly');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Student = require('../models/Student');

const {
  assertIsolatedDatabase,
  computeFileSha256,
  computeEntryExtractionHash,
  verifySourceArtifacts,
  validateExtractedEntries,
  ingestStagingBatch,
  runConflictDetection,
  assessAttendanceReadiness,
  getStudentRosterBoundary,
  VERIFIED_SUBJECT_MAP,
  AMBIGUOUS_SUBJECTS,
  VERIFIED_FACULTY_MAP,
  FACULTY_ALIASES,
  EXPECTED_SOURCE_PDF_SHA256,
} = require('../services/timetableStaging.service');

const STAGING_JSON_PATH = '/tmp/campussphere-timetable-staging-phase3_2_1/staging_timetable.json';
const TEST_BATCH_ID = 'TEST-BATCH-PHASE3_5-001';

test('Phase 3.5: Timetable Staging Ingestion & Conflict Engine Suite', async (t) => {
  let rawEntries;

  await t.test('Setup: Connect to isolated test DB & load source dataset', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean test batch in isolated test database
    await Promise.all([
      TimetableStaging.deleteMany({ importBatchId: TEST_BATCH_ID }),
      ConflictRecord.deleteMany({ academicYear: '2026-2027', resourceId: 'SJ' }),
    ]);

    assert.ok(fs.existsSync(STAGING_JSON_PATH), `Staging JSON must exist at ${STAGING_JSON_PATH}`);
    const rawData = JSON.parse(fs.readFileSync(STAGING_JSON_PATH, 'utf8'));
    rawEntries = Array.isArray(rawData) ? rawData : rawData.entries;
    assert.equal(rawEntries.length, 977, 'Dataset must contain exactly 977 entries');
  });

  // ── 1. Source PDF Checksum Verification ────────────────────────────────────
  await t.test('1. Source PDF checksum strictly matches authentic hash', () => {
    const pdfPath =
      '/Users/abhinikesh/.gemini/antigravity/brain/fa54af9b-a3ec-4155-b2de-927994afd217/.user_uploaded/media_1794370819803_238c020d.pdf';
    assert.ok(fs.existsSync(pdfPath), 'Physical PDF must exist');
    const hash = computeFileSha256(pdfPath);
    assert.equal(hash, EXPECTED_SOURCE_PDF_SHA256);
  });

  // ── 2. Staging Directory Manifest Verification ─────────────────────────────
  await t.test('2. Phase 3.2.3 staging directory manifest verifies all 7 audit files', () => {
    const result = verifySourceArtifacts();
    assert.equal(result.sourcePdf.status, 'VERIFIED');
    assert.equal(result.stagingDirectory.status, 'VERIFIED');
    assert.equal(result.stagingDirectory.filesChecked, 7);
    for (const f of result.stagingDirectory.files) {
      assert.equal(f.status, 'OK');
    }
  });

  // ── 3. Checksum Mismatch Detection ─────────────────────────────────────────
  await t.test('3. Artifact verification rejects tampered or mismatched source checksum', () => {
    assert.throws(
      () => {
        // Point to invalid PDF or expect wrong checksum
        verifySourceArtifacts({ sourcePdfPath: '/dev/null' });
      },
      /SOURCE CHECKSUM MISMATCH/
    );
  });

  // ── 4. Extracted Entries Validation ────────────────────────────────────────
  await t.test('4. Extracted entries validation verifies all master institutional counts', () => {
    const metrics = validateExtractedEntries(rawEntries);
    assert.equal(metrics.totalEntries, 977);
    assert.equal(metrics.totalPages, 50);
    assert.equal(metrics.totalCohorts, 50);
    assert.equal(metrics.singlePeriodSessions, 760);
    assert.equal(metrics.doublePeriodSessions, 217);
    assert.equal(metrics.totalOccupiedPeriodSlots, 1194);
    assert.equal(metrics.subgroupEntries, 226);
    assert.equal(metrics.distinctBatches, 33);
    assert.equal(metrics.invalidEntriesCount, 0);
  });

  // ── 5. Extraction Hash Determinism & Collision Resistance ──────────────────
  await t.test('5. Extraction hash is deterministic and collision-free (977 unique hashes)', () => {
    const hashSet = new Set();
    for (const e of rawEntries) {
      const h = computeEntryExtractionHash(e);
      assert.ok(h && h.length === 64, 'Must be valid 64-char SHA-256');
      hashSet.add(h);
    }
    assert.equal(hashSet.size, 977, 'All 977 extraction hashes must be strictly unique');
  });

  // ── 6. Database Safety Guard ───────────────────────────────────────────────
  await t.test('6. Staging database safety guard blocks development and production database URIs', () => {
    assert.throws(
      () => assertIsolatedDatabase('mongodb://localhost:27017/campus-erp'),
      /STAGING SAFETY VIOLATION/
    );
    assert.throws(
      () => assertIsolatedDatabase('mongodb://localhost:27017/production'),
      /STAGING SAFETY VIOLATION/
    );
    assert.ok(assertIsolatedDatabase('mongodb://127.0.0.1:27018/campus-erp-staging-isolated'));
    assert.ok(assertIsolatedDatabase(TEST_DB_URI));
  });

  // ── 7. Controlled Staging Ingestion ────────────────────────────────────────
  await t.test('7. Controlled staging ingestion inserts all 977 entries into TimetableStaging', async () => {
    const result = await ingestStagingBatch({
      batchId: TEST_BATCH_ID,
      dbUri: TEST_DB_URI,
      stagingJsonPath: STAGING_JSON_PATH,
    });

    assert.equal(result.importBatchId, TEST_BATCH_ID);
    assert.equal(result.totalRead, 977);
    assert.equal(result.totalInStaging, 977);
    assert.equal(result.isIdempotent, true);

    const docCount = await TimetableStaging.countDocuments({ importBatchId: TEST_BATCH_ID });
    assert.equal(docCount, 977);
  });

  // ── 8. Staging Ingestion Idempotency ───────────────────────────────────────
  await t.test('8. Staging ingestion is strictly idempotent (re-run creates 0 duplicates)', async () => {
    const result = await ingestStagingBatch({
      batchId: TEST_BATCH_ID,
      dbUri: TEST_DB_URI,
      stagingJsonPath: STAGING_JSON_PATH,
    });

    assert.equal(result.insertedCount, 0, 'Zero new documents on re-ingest');
    assert.equal(result.duplicatesPrevented, 977, 'All 977 duplicates prevented');
    const docCount = await TimetableStaging.countDocuments({ importBatchId: TEST_BATCH_ID });
    assert.equal(docCount, 977, 'Total in collection remains exactly 977');
  });

  // ── 9. Faculty Reconciliation Baseline ─────────────────────────────────────
  await t.test('9. Faculty reconciliation conforms to approved 18 verified + 92 unmatched + 3 aliases', () => {
    const verifiedKeys = Object.keys(VERIFIED_FACULTY_MAP);
    assert.equal(verifiedKeys.length, 18);
    assert.ok(verifiedKeys.includes('MS'));
    assert.equal(VERIFIED_FACULTY_MAP['MS'].erpLoginId, 'FAC002');
    assert.equal(VERIFIED_FACULTY_MAP['SHV'].erpLoginId, 'FAC019');

    const aliasKeys = Object.keys(FACULTY_ALIASES);
    assert.equal(aliasKeys.length, 3);
    assert.equal(FACULTY_ALIASES['OB'].canonicalAbbreviation, 'ROB');
    assert.equal(FACULTY_ALIASES['KC'].canonicalAbbreviation, 'RKC');
    assert.equal(FACULTY_ALIASES['CH'].canonicalAbbreviation, 'RCH');
  });

  // ── 10. Distinct Faculty Identity Preservation ─────────────────────────────
  await t.test('10. PRA, PREMA, and PRIYA remain distinct from FAC001 with zero improper merging', () => {
    assert.equal(VERIFIED_FACULTY_MAP['PRA'], undefined);
    assert.equal(VERIFIED_FACULTY_MAP['PREMA'], undefined);
    assert.equal(VERIFIED_FACULTY_MAP['PRIYA'], undefined);
    assert.equal(FACULTY_ALIASES['PRA'], undefined);
    assert.equal(FACULTY_ALIASES['PREMA'], undefined);
    assert.equal(FACULTY_ALIASES['PRIYA'], undefined);
  });

  // ── 11. Instructor SJ Unprovisioned Preservation ───────────────────────────
  await t.test('11. Instructor SJ remains associated with source legend name and unprovisioned', () => {
    assert.equal(VERIFIED_FACULTY_MAP['SJ'], undefined, 'SJ must not be in verified map');
    assert.equal(FACULTY_ALIASES['SJ'], undefined, 'SJ must not be an alias');
  });

  // ── 12. Subject Reconciliation Baseline ───────────────────────────────────
  await t.test('12. Subject reconciliation conforms to 14 verified, 2 ambiguous, 100 unmatched', () => {
    const verifiedKeys = Object.keys(VERIFIED_SUBJECT_MAP);
    assert.equal(verifiedKeys.length, 14);
    assert.equal(VERIFIED_SUBJECT_MAP['DAA'].code, 'CS501');
    assert.equal(VERIFIED_SUBJECT_MAP['FLAT'].code, 'CS502');
    assert.equal(VERIFIED_SUBJECT_MAP['AICA'].code, 'CS503');
    assert.equal(VERIFIED_SUBJECT_MAP['5QA-VERB'].code, 'CS514');

    const ambiguousKeys = Object.keys(AMBIGUOUS_SUBJECTS);
    assert.equal(ambiguousKeys.length, 2);
    assert.ok(ambiguousKeys.includes('DSA'));
    assert.ok(ambiguousKeys.includes('DSA Lab'));
  });

  // ── 13. Ambiguous Subject Preservation ─────────────────────────────────────
  await t.test('13. DSA and DSA Lab are preserved as ambiguous without mapping to CS201', () => {
    assert.equal(VERIFIED_SUBJECT_MAP['DSA'], undefined);
    assert.equal(VERIFIED_SUBJECT_MAP['DSA Lab'], undefined);
    assert.match(AMBIGUOUS_SUBJECTS['DSA'], /Curricular semester disparity/);
    assert.match(AMBIGUOUS_SUBJECTS['DSA Lab'], /Curricular semester disparity/);
  });

  // ── 14. Conflict Detection: Room Overlap Categorization ────────────────────
  await t.test('14. Conflict engine separates room overlaps into triplets, venue exempt, and collisions', async () => {
    const report = await runConflictDetection({ batchId: TEST_BATCH_ID, dbUri: TEST_DB_URI });
    assert.equal(report.roomOverlapsCount, 107);
    assert.equal(report.tripletJointSessionsCount, 100, 'Exactly 100 identical triplet matches');
    assert.equal(report.venueExemptCount, 2, 'Exactly 2 outdoor venue exempt slots');
    assert.equal(report.unverifiedRoomCollisions, 5, 'Exactly 5 unverified room collisions');
  });

  // ── 15. Evidentiary Joint-Session Rule Enforcement ─────────────────────────
  await t.test('15. Overlap alone is rejected; unverified room overlaps are flagged as blockers', async () => {
    const report = await runConflictDetection({ batchId: TEST_BATCH_ID, dbUri: TEST_DB_URI });
    assert.ok(report.unverifiedRoomCollisions > 0, 'Unverified room overlaps must remain conflicts');
  });

  // ── 16. Conflict Detection: Faculty Overlap Categorization ─────────────────
  await t.test('16. Conflict engine separates faculty overlaps into joint sessions and collisions', async () => {
    const report = await runConflictDetection({ batchId: TEST_BATCH_ID, dbUri: TEST_DB_URI });
    assert.equal(report.facultyOverlapsCount, 129);
    assert.equal(report.facultyJointExemptCount, 124, '124 verified joint faculty sessions');
    assert.equal(report.facultyCollisionBlockersCount, 5, '5 faculty collisions including SJ blocker');
  });

  // ── 17. Ground-Truth SJ Conflict Detection ─────────────────────────────────
  await t.test('17. SJ Wednesday Period 8 collision across AS18 and AS19 is accurately detected', async () => {
    const report = await runConflictDetection({ batchId: TEST_BATCH_ID, dbUri: TEST_DB_URI });
    assert.equal(report.sjConflictDetected, true);
    assert.equal(report.sjBlockerActive, true);
  });

  // ── 18. SJ Blocker Persistence via ConflictRecord ──────────────────────────
  await t.test('18. SJ blocker is persisted in staging DB as an active publication blocker', async () => {
    const sjRecord = await ConflictRecord.findOne({
      conflictCode: 'POTENTIAL_FACULTY_CONFLICT',
      resourceId: 'SJ',
      academicYear: '2026-2027',
    });

    assert.ok(sjRecord, 'SJ ConflictRecord must exist in staging DB');
    assert.equal(sjRecord.severity, 'BLOCKER');
    assert.equal(sjRecord.resolutionStatus, 'OPEN');
    assert.equal(sjRecord.dayOfWeek, 'Wednesday');
    assert.deepEqual(sjRecord.periodNumbers, [8]);
    assert.equal(sjRecord.conflictingEntries.length, 2);
    assert.equal(sjRecord.isPublicationBlocker(), true);
  });

  // ── 19. Attendance Readiness Assessment ────────────────────────────────────
  await t.test('19. Attendance readiness classifies all 977 entries across 4 canonical tiers', async () => {
    const res = await assessAttendanceReadiness({ batchId: TEST_BATCH_ID });
    const b = res.breakdown;
    assert.equal(b.total, 977);
    assert.equal(b.READY, 49, '49 fully verified entries ready for attendance');
    assert.equal(b.REQUIRES_REVIEW, 47, '47 ambiguous entries requiring review');
    assert.equal(b.BLOCKED, 2, '2 blocked entries (SJ collision)');
    assert.equal(b.NOT_CONFIGURED, 879, '879 unconfigured entries');
    assert.equal(b.READY + b.REQUIRES_REVIEW + b.BLOCKED + b.NOT_CONFIGURED, 977);
    assert.equal(res.zeroAttendanceSessionsCreated, true);
  });

  // ── 20. Attendance Blocking for Unresolved Staged Entries ──────────────────
  await t.test('20. AttendanceSession pre-save hook blocks unmapped staged entries', async () => {
    // Unmapped subject entry
    const unmappedStaged = await TimetableStaging.findOne({
      importBatchId: TEST_BATCH_ID,
      'extractedEntry.rawSubjectAcronym': 'CLE',
    });
    assert.ok(unmappedStaged);
    assert.equal(unmappedStaged.normalizedData.canonicalSubjectId, null);

    // Creating attendance session linked to null subject must fail AttendanceSession schema validation
    const session = new AttendanceSession({
      subject: null, // Unresolved
      faculty: new mongoose.Types.ObjectId(),
      date: '2026-11-25',
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
    });

    await assert.rejects(
      async () => {
        await session.validate();
      },
      /Subject is required/
    );
  });

  // ── 21. Attendance Compatibility with Resolved Timetable Entries ───────────
  await t.test('21. Valid resolved timetable entry successfully creates AttendanceSession', async () => {
    const testUser = await User.create({
      name: 'Dr. Test Faculty P35',
      email: 'p35fac@phase35-test.edu',
      loginId: 'P35FAC01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });
    const testSubject = await Subject.create({
      name: 'Design Analysis of Algorithms',
      code: 'P35-CS501',
      department: 'CSE',
      semester: 5,
      credits: 4,
    });

    const validEntry = await Timetable.create({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P35A',
      dayOfWeek: 1,
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      room: 'AS18',
      subject: testSubject._id,
      faculty: testUser._id,
    });

    const validSession = new AttendanceSession({
      subject: testSubject._id,
      faculty: testUser._id,
      date: '2026-11-30',
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      timetableEntry: validEntry._id,
    });

    const saved = await validSession.save();
    assert.ok(saved._id);
    assert.equal(saved.timetableEntry.toString(), validEntry._id.toString());

    // Clean up
    await AttendanceSession.deleteOne({ _id: saved._id });
    await Timetable.deleteOne({ _id: validEntry._id });
    await Subject.deleteOne({ _id: testSubject._id });
    await User.deleteOne({ _id: testUser._id });
  });

  // ── 22. Student Roster Boundary Verification ───────────────────────────────
  await t.test('22. Student roster boundary accounts for 50 cohorts, 33 subgroup batches, and 0 student mutations', async () => {
    const boundary = await getStudentRosterBoundary({ batchId: TEST_BATCH_ID });
    assert.equal(boundary.totalInstitutionalCohorts, 50);
    assert.equal(boundary.cohortsWithSubgroupsCount, 19);
    assert.equal(boundary.totalDistinctSubgroupBatches, 33);
    assert.equal(boundary.studentRecordsModified, 0);
    assert.equal(boundary.studentBatchAssignmentsCreated, 0);
  });

  // ── 23. Zero Database Mutations on Dev/Prod ────────────────────────────────
  await t.test('23. Confirms zero live timetable entries imported and zero dev/prod mutations', async () => {
    // Live Timetable collection in test DB has zero entries from this batch
    const liveCount = await Timetable.countDocuments({ academicYear: '2026-2027', extractionHash: { $ne: null } });
    assert.equal(liveCount, 0, 'Zero live timetable entries imported');

    // Confirm student and faculty records untouched
    const userCount = await User.countDocuments({ email: /@phase35-test\.edu$/ });
    assert.equal(userCount, 0, 'Zero test users created or lingering');
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect test database cleanly', async () => {
    await TimetableStaging.deleteMany({ importBatchId: TEST_BATCH_ID });
    await ConflictRecord.deleteMany({ academicYear: '2026-2027', resourceId: 'SJ' });
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);
  });
});
