#!/usr/bin/env node
/**
 * server/scripts/student_staging/ingest_staging.js
 * Phase 3.3B — Controlled Student Data Staging Ingestion
 *
 * NON-NEGOTIABLE SAFETY & PRIVACY BOUNDARIES:
 * - Reads parser output from stdin (JSON) — never reads workbook directly.
 * - Writes ONLY to approved staging collections:
 *     studentstagings, admissionapplications, studentacademicsubmissions,
 *     studentinternships, importoperationlogs.
 * - ZERO writes to: students, users, or any operational collection.
 * - Idempotent upserts keyed on { batchId, sourceSheet, sourceRow } or { batchId, sourceRow }.
 * - Validates every record against Mongoose model schema before inserting.
 * - On error: stops, preserves operation log, reports sanitized failure details.
 * - Standalone mongod: no transactions assumed.
 * - PII-FREE OUTPUT: never prints student names, roll numbers, emails, phones, or credentials.
 *
 * Usage:
 *   python3 parser.py <workbook> <batchId> --full-output | node ingest_staging.js --dry-run
 *   python3 parser.py <workbook> <batchId> --full-output | node ingest_staging.js --apply
 */

'use strict';

const mongoose = require('mongoose');

// ─── Load Staging Models (autoIndex:false, autoCreate:false guaranteed) ───────
const StudentStaging = require('../../models/StudentStaging');
const AdmissionApplication = require('../../models/AdmissionApplication');
const StudentAcademicSubmission = require('../../models/StudentAcademicSubmission');
const StudentInternship = require('../../models/StudentInternship');
const ImportOperationLog = require('../../models/ImportOperationLog');

// ─── Configuration ────────────────────────────────────────────────────────────
const MONGO_URI = 'mongodb://127.0.0.1:27018/campus-erp';
const SYSTEM_EXECUTOR_ID = new mongoose.Types.ObjectId('6ae46faf9e9e56f71ecccdcf'); // Admin ObjectId

const STAGING_COLLECTION_NAMES = new Set([
  'studentstagings',
  'admissionapplications',
  'studentacademicsubmissions',
  'studentinternships',
  'importoperationlogs',
  'importfieldchangelogs',
]);

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('Usage: node ingest_staging.js --dry-run | --apply');
  process.exit(1);
}

// ─── Read parsed data from stdin ─────────────────────────────────────────────
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Failed to parse stdin as JSON: ' + e.message));
      }
    });
    process.stdin.on('error', reject);
  });
}

// ─── Explicit index creation (since autoIndex:false) ─────────────────────────
async function ensureStagingIndexes() {
  await StudentStaging.createIndexes();
  await AdmissionApplication.createIndexes();
  await StudentAcademicSubmission.createIndexes();
  await StudentInternship.createIndexes();
  await ImportOperationLog.createIndexes();
}

// ─── Verify active unique indexes ────────────────────────────────────────────
async function verifyStagingIndexes(db) {
  const ssIndexes = await db.collection('studentstagings').indexes();
  const aaIndexes = await db.collection('admissionapplications').indexes();
  const sasIndexes = await db.collection('studentacademicsubmissions').indexes();
  const siIndexes = await db.collection('studentinternships').indexes();
  const opIndexes = await db.collection('importoperationlogs').indexes();

  const hasSSIdempotency = ssIndexes.some(i => i.unique && i.key && i.key.batchId === 1 && i.key.sourceSheet === 1 && i.key.sourceRow === 1);
  const hasAAIdempotency = aaIndexes.some(i => i.unique && i.key && i.key.batchId === 1 && i.key.sourceRow === 1);
  const hasSASIdempotency = sasIndexes.some(i => i.unique && i.key && i.key.batchId === 1 && i.key.sourceRow === 1);
  const hasSIIdempotency = siIndexes.some(i => i.unique && i.key && i.key.batchId === 1 && i.key.sourceRow === 1);
  const hasOpLogUnique = opIndexes.some(i => i.unique && i.key && i.key.batchId === 1);

  if (!hasSSIdempotency || !hasAAIdempotency || !hasSASIdempotency || !hasSIIdempotency || !hasOpLogUnique) {
    throw new Error('Required staging unique idempotency indexes are NOT all active!');
  }
  return true;
}

// ─── Baseline collection verification ─────────────────────────────────────────
async function getCollectionCounts(db) {
  const cols = await db.listCollections().toArray();
  const counts = {};
  for (const c of cols) {
    counts[c.name] = await db.collection(c.name).countDocuments();
  }
  return counts;
}

// ─── Idempotent upsert helpers with schema validation ─────────────────────────

async function upsertStudentStaging(records) {
  let inserted = 0, skipped = 0, errors = 0;
  for (const rec of records) {
    try {
      // Validate with Mongoose schema
      const doc = new StudentStaging(rec);
      const valErr = doc.validateSync();
      if (valErr) {
        errors++;
        continue;
      }

      const filter = { batchId: rec.batchId, sourceSheet: rec.sourceSheet, sourceRow: rec.sourceRow };
      const result = await StudentStaging.collection.updateOne(
        filter,
        { $setOnInsert: {
          batchId: rec.batchId,
          sourceSheet: rec.sourceSheet,
          sourceRow: rec.sourceRow,
          rawIdentifier: rec.rawIdentifier || null,
          normalizedRollNumber: rec.normalizedRollNumber || null,
          studentName: rec.studentName || null,
          rawPayload: rec.rawPayload || {},
          conflictCandidates: rec.conflictCandidates || [],
          reviewStatus: rec.reviewStatus || 'pending_review',
          reviewedBy: null,
          reviewNotes: '',
          promotedTargetId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }},
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      if (e.code === 11000) { skipped++; }
      else { errors++; }
    }
  }
  return { inserted, skipped, errors };
}

async function upsertAdmissionApplications(records) {
  let inserted = 0, skipped = 0, errors = 0;
  for (const rec of records) {
    try {
      const doc = new AdmissionApplication(rec);
      const valErr = doc.validateSync();
      if (valErr) {
        errors++;
        continue;
      }

      const filter = { batchId: rec.batchId, sourceRow: rec.sourceRow };
      const result = await AdmissionApplication.collection.updateOne(
        filter,
        { $setOnInsert: {
          batchId: rec.batchId,
          sourceRow: rec.sourceRow,
          applicationNumber: rec.applicationNumber,
          studentName: rec.studentName,
          course: rec.course || null,
          school: rec.school || null,
          email: rec.email || null,
          teamsId: rec.teamsId || null,
          dateOfReporting: rec.dateOfReporting || null,
          studentId: null,
          admissionStatus: rec.admissionStatus || 'applicant',
          reviewNotes: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }},
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      if (e.code === 11000) { skipped++; }
      else { errors++; }
    }
  }
  return { inserted, skipped, errors };
}

async function upsertStudentInternships(records) {
  let inserted = 0, skipped = 0, errors = 0;
  for (const rec of records) {
    try {
      const doc = new StudentInternship(rec);
      const valErr = doc.validateSync();
      if (valErr) {
        errors++;
        continue;
      }

      const filter = { batchId: rec.batchId, sourceRow: rec.sourceRow };
      const result = await StudentInternship.collection.updateOne(
        filter,
        { $setOnInsert: {
          batchId: rec.batchId,
          sourceRow: rec.sourceRow,
          normalizedRollNumber: rec.normalizedRollNumber,
          studentNameAsPerRS: rec.studentNameAsPerRS || null,
          branch: rec.branch || null,
          section: rec.section || null,
          verticalMentor: rec.verticalMentor || null,
          officialId: rec.officialId || null,
          organizationName: rec.organizationName || null,
          completeAddress: rec.completeAddress || null,
          mode: rec.mode || null,
          contactNumber: rec.contactNumber || null,
          emailId: rec.emailId || null,
          startDate: rec.startDate || null,
          internshipTitle: rec.internshipTitle || null,
          stipendProvided: rec.stipendProvided !== undefined ? rec.stipendProvided : null,
          monthlyStipendAmount: rec.monthlyStipendAmount || null,
          placementDone: rec.placementDone !== undefined ? rec.placementDone : null,
          offerLetterUrl: null, // Always null — privacy mandate
          linkageStatus: rec.linkageStatus || 'unmatched',
          createdAt: new Date(),
          updatedAt: new Date(),
        }},
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      if (e.code === 11000) { skipped++; }
      else { errors++; }
    }
  }
  return { inserted, skipped, errors };
}

async function upsertAcademicSubmissions(records) {
  let inserted = 0, skipped = 0, errors = 0;
  for (const rec of records) {
    try {
      let subTime = null;
      if (rec.submissionTimestamp) {
        const parsed = new Date(rec.submissionTimestamp);
        if (!isNaN(parsed.getTime())) subTime = parsed;
      }

      const toValidate = Object.assign({}, rec, { submissionTimestamp: subTime, isCanonical: false });
      const doc = new StudentAcademicSubmission(toValidate);
      const valErr = doc.validateSync();
      if (valErr) {
        errors++;
        continue;
      }

      const filter = { batchId: rec.batchId, sourceRow: rec.sourceRow };
      const result = await StudentAcademicSubmission.collection.updateOne(
        filter,
        { $setOnInsert: {
          batchId: rec.batchId,
          sourceRow: rec.sourceRow,
          submissionTimestamp: subTime,
          rawRollNumber: rec.rawRollNumber,
          normalizedRollNumber: rec.normalizedRollNumber,
          studentId: null,
          studentName: rec.studentName || null,
          branch: rec.branch || null,
          tenthPercentage: rec.tenthPercentage !== undefined ? rec.tenthPercentage : null,
          tenthBoard: rec.tenthBoard || null,
          twelfthPercentage: rec.twelfthPercentage !== undefined ? rec.twelfthPercentage : null,
          twelfthBoard: rec.twelfthBoard || null,
          selfReportedCgpa: rec.selfReportedCgpa !== undefined ? rec.selfReportedCgpa : null,
          selfReportedActiveReappears: rec.selfReportedActiveReappears || 0,
          selfReportedDeadReappears: rec.selfReportedDeadReappears || 0,
          reappearSubjects: rec.reappearSubjects || [],
          contactNumber: rec.contactNumber || null,
          personalEmail: rec.personalEmail || null,
          collegeEmail: rec.collegeEmail || null,
          isCanonical: false, // HARDCODED — non-canonical by default
          reviewStatus: rec.reviewStatus || 'pending_review',
          reviewNotes: '',
          promotedToStudentId: null,
          promotedAt: null,
          promotedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }},
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      if (e.code === 11000) { skipped++; }
      else { errors++; }
    }
  }
  return { inserted, skipped, errors };
}

// ─── Main Execution Controller ────────────────────────────────────────────────
async function main() {
  const parsed = await readStdin();
  const { batchId, metadata, counts, records, validationErrors } = parsed;

  if (isDryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      batchId,
      metadata,
      parsedCounts: counts,
      validationErrorsCount: (validationErrors || []).length,
      message: 'Dry run complete — no database writes performed.',
    }, null, 2));
    process.exit(0);
  }

  // ── APPLY MODE ──────────────────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Preflight baseline checks
  const baselineCounts = await getCollectionCounts(db);
  const baselineStudentCount = baselineCounts['students'] || 0;
  const baselineUserCount = baselineCounts['users'] || 0;

  if (baselineStudentCount !== 15) {
    await mongoose.disconnect();
    console.error(`[3.3B ABORT] Expected 15 students, found ${baselineStudentCount}.`);
    process.exit(2);
  }

  // 2. Explicitly create staging collections & indexes
  await ensureStagingIndexes();
  await verifyStagingIndexes(db);

  // 3. Create or update operation log (status: started)
  try {
    await ImportOperationLog.collection.findOneAndUpdate(
      { batchId },
      { $setOnInsert: {
        batchId,
        operationType: 'staging_ingestion',
        sourceMetadata: {
          workbookName: metadata.workbookName,
          workbookHash: metadata.workbookHash,
          workbookSizeBytes: metadata.workbookSizeBytes,
          sheetsProcessed: metadata.sheetsProcessed,
        },
        status: 'started',
        counts: {},
        validationSummary: { totalRecords: counts.totalStagedRecords, validRecords: 0, invalidRecords: 0, errorDetails: [] },
        executedBy: SYSTEM_EXECUTOR_ID,
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }},
      { upsert: true, returnDocument: 'after' }
    );
  } catch (e) {
    if (e.code !== 11000) {
      await mongoose.disconnect();
      console.error('[3.3B ABORT] Failed to create operation log:', e.message);
      process.exit(2);
    }
  }

  // 4. Ingest each collection
  const smResult = await upsertStudentStaging(records.studentStaging || []);
  const aaResult = await upsertAdmissionApplications(records.admissionApplications || []);
  const irResult = await upsertStudentInternships(records.studentInternships || []);
  const acResult = await upsertAcademicSubmissions(records.academicSubmissions || []);

  const totalInserted = smResult.inserted + aaResult.inserted + irResult.inserted + acResult.inserted;
  const totalSkipped = smResult.skipped + aaResult.skipped + irResult.skipped + acResult.skipped;
  const totalErrors = smResult.errors + aaResult.errors + irResult.errors + acResult.errors;
  const finalStatus = totalErrors === 0 ? 'staged' : 'failed';

  // 5. Update operation log
  await ImportOperationLog.collection.updateOne(
    { batchId },
    { $set: {
      status: finalStatus,
      counts: {
        studentStaging_inserted: smResult.inserted,
        studentStaging_skipped: smResult.skipped,
        admissionApplications_inserted: aaResult.inserted,
        admissionApplications_skipped: aaResult.skipped,
        studentInternships_inserted: irResult.inserted,
        studentInternships_skipped: irResult.skipped,
        academicSubmissions_inserted: acResult.inserted,
        academicSubmissions_skipped: acResult.skipped,
        totalInserted,
        totalSkipped,
        totalErrors,
      },
      'validationSummary.validRecords': totalInserted + totalSkipped,
      'validationSummary.invalidRecords': totalErrors,
      completedAt: new Date(),
      updatedAt: new Date(),
    }}
  );

  // 6. Post-ingestion verification
  const postCounts = await getCollectionCounts(db);
  const finalStudentCount = postCounts['students'] || 0;
  const finalUserCount = postCounts['users'] || 0;

  const smCount = await StudentStaging.collection.countDocuments({ batchId });
  const aaCount = await AdmissionApplication.collection.countDocuments({ batchId });
  const irCount = await StudentInternship.collection.countDocuments({ batchId });
  const acCount = await StudentAcademicSubmission.collection.countDocuments({ batchId });
  const logCount = await ImportOperationLog.collection.countDocuments({ batchId });

  // Verification: academic submissions MUST remain non-canonical
  const canonicalCount = await StudentAcademicSubmission.collection.countDocuments({ batchId, isCanonical: true });

  // Verification: zero password or parental fields in rawPayload
  const privacyViolations = await StudentStaging.collection.countDocuments({
    batchId,
    $or: [
      { 'rawPayload.password': { $exists: true } },
      { 'rawPayload.admitPassword': { $exists: true } },
      { 'rawPayload.credential': { $exists: true } },
      { 'rawPayload.fatherName': { $exists: true } },
      { 'rawPayload.motherName': { $exists: true } },
    ]
  });

  // Verification: operational collections invariance
  const operationalChanged = [];
  for (const [col, count] of Object.entries(baselineCounts)) {
    if (!STAGING_COLLECTION_NAMES.has(col)) {
      if (postCounts[col] !== count) {
        operationalChanged.push({ col, before: count, after: postCounts[col] });
      }
    }
  }

  await mongoose.disconnect();

  const output = {
    mode: 'apply',
    batchId,
    metadata,
    parsedCounts: counts,
    ingestionResults: {
      studentStaging: smResult,
      admissionApplications: aaResult,
      studentInternships: irResult,
      academicSubmissions: acResult,
    },
    stagedBatchDocumentCounts: {
      studentstagings: smCount,
      admissionapplications: aaCount,
      studentinternships: irCount,
      studentacademicsubmissions: acCount,
      importoperationlogs: logCount,
    },
    invarianceChecks: {
      studentsUnchanged: finalStudentCount === 15,
      studentCountBefore: baselineStudentCount,
      studentCountAfter: finalStudentCount,
      usersUnchanged: finalUserCount === baselineUserCount,
      userCountBefore: baselineUserCount,
      userCountAfter: finalUserCount,
      canonicalSubmissionsCreated: canonicalCount,
      privacyViolationsDetected: privacyViolations,
      operationalCollectionsChanged: operationalChanged,
    },
    operationStatus: finalStatus,
    totalInserted,
    totalSkipped,
    totalErrors,
    validationErrorsCount: (validationErrors || []).length,
  };

  console.log(JSON.stringify(output, null, 2));

  if (totalErrors > 0 || finalStatus === 'failed' || operationalChanged.length > 0 || finalStudentCount !== 15) {
    process.exit(3);
  }
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[3.3B ABORT] Fatal error:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(2);
});
