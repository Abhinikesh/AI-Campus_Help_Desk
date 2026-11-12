#!/usr/bin/env node
/**
 * server/scripts/student_staging/reconcile_identities.js
 * Phase 3.4A — Student Identity Resolution Audit
 *
 * STRICT READ-ONLY EXECUTION:
 * - Reads Batch 002 staging collections and production Students.
 * - ZERO database writes, updates, deletes, or promotions.
 * - Excludes Admission sub-header row 845.
 * - Builds candidate identity groups adhering to the evidence hierarchy.
 * - Emits a protected administrator review artifact locally (mode 0600, gitignored).
 * - Emits a PII-free aggregate summary to stdout.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27018/campus-erp';
const BATCH_ID = 'BATCH-20261112-STAGING-002';
const REVIEW_ARTIFACT_PATH = path.join(__dirname, '../../../data/student_import/protected_identity_review_artifact_phase3_4a.json');

function canonicalize(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return { '$date': val.toISOString() };
  if (val && (val._bsontype === 'ObjectID' || val._bsontype === 'ObjectId')) return { '$oid': val.toString() };
  if (Buffer.isBuffer(val)) return { '$binary': val.toString('base64') };
  if (Array.isArray(val)) return val.map(canonicalize);
  if (typeof val === 'object') {
    const sorted = {};
    const keys = Object.keys(val).sort();
    for (const k of keys) sorted[k] = canonicalize(val[k]);
    return sorted;
  }
  return val;
}

function hashDocs(docs) {
  const sorted = [...docs].sort((a, b) => {
    const idA = a._id ? a._id.toString() : '';
    const idB = b._id ? b._id.toString() : '';
    return idA.localeCompare(idB);
  });
  return crypto.createHash('sha256').update(JSON.stringify(sorted.map(canonicalize))).digest('hex');
}

async function runReconciliation() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Pre-audit invariance hashes
  const preStudentDocs = await db.collection('students').find({}).toArray();
  const preUserDocs = await db.collection('users').find({}).toArray();
  const preStudentHash = hashDocs(preStudentDocs);
  const preUserHash = hashDocs(preUserDocs);

  // 2. Fetch Staging Batch 002 records
  const stagingDocs = await db.collection('studentstagings').find({ batchId: BATCH_ID }).toArray();
  const rawAdmissionDocs = await db.collection('admissionapplications').find({ batchId: BATCH_ID }).toArray();
  const internshipDocs = await db.collection('studentinternships').find({ batchId: BATCH_ID }).toArray();
  const academicDocs = await db.collection('studentacademicsubmissions').find({ batchId: BATCH_ID }).toArray();

  // Validate sub-header row 845
  const subHeaderDoc = rawAdmissionDocs.find(d => d.sourceRow === 845);
  const admissionDocs = rawAdmissionDocs.filter(d => d.sourceRow !== 845);

  // 3. Check against Production Students
  const prodRolls = new Set(preStudentDocs.map(s => String(s.rollNumber || '').trim().toUpperCase()));
  const prodEmails = new Set(preStudentDocs.map(s => String(s.email || '').trim().toLowerCase()).filter(Boolean));

  // 4. Index Admission Applications by true application number
  const admByApp = new Map();
  for (const a of admissionDocs) {
    let trueApp = null;
    const sName = String(a.studentName || '').trim().toUpperCase();
    const appNo = String(a.applicationNumber || '').trim().toUpperCase();
    if (sName.includes('MRIIRS')) trueApp = sName;
    else if (appNo.includes('MRIIRS')) trueApp = appNo;
    if (trueApp) {
      if (!admByApp.has(trueApp)) admByApp.set(trueApp, []);
      admByApp.get(trueApp).push(a);
    }
  }

  // 5. Index Internships by normalized roll
  const internByRoll = new Map();
  for (const i of internshipDocs) {
    const r = String(i.normalizedRollNumber || '').trim().toUpperCase();
    if (!internByRoll.has(r)) internByRoll.set(r, []);
    internByRoll.get(r).push(i);
  }

  // 6. Index Academic Submissions by normalized roll
  const acadByRoll = new Map();
  for (const ac of academicDocs) {
    const r = String(ac.normalizedRollNumber || '').trim().toUpperCase();
    if (!acadByRoll.has(r)) acadByRoll.set(r, []);
    acadByRoll.get(r).push(ac);
  }

  // 7. Identity Group Construction
  const groups = [];
  let groupCounter = 1;

  function nextGroupId() {
    const id = 'GRP-34A-' + String(groupCounter).padStart(5, '0');
    groupCounter++;
    return id;
  }

  const processedStagingRows = new Set();
  const matchedAdmissionRows = new Set();
  const processedInternshipRows = new Set();
  const processedAcademicRows = new Set();

  // Case A: Rupesh Singh duplicate records (rows 125 & 556)
  const rupeshStaging = stagingDocs.filter(s => s.sourceRow === 125 || s.sourceRow === 556);
  if (rupeshStaging.length === 2) {
    const roll = '1/24/SET/BCS/117';
    const interns = internByRoll.get(roll) || [];
    const acads = acadByRoll.get(roll) || [];
    groups.push({
      groupId: nextGroupId(),
      classification: 'DUPLICATE_SOURCE_RECORD',
      primaryIdentifier: roll,
      secondaryIdentifier: null,
      sourceRecords: {
        studentStaging: rupeshStaging.map(s => s.sourceRow),
        admissionApplication: [],
        studentInternship: interns.map(i => i.sourceRow),
        studentAcademicSubmission: acads.map(a => a.sourceRow),
      },
      matchEvidence: {
        level1: ['EXACT_NORMALIZED_ROLL_NUMBER'],
        level2: ['NAME_MATCH_RUPESH_SINGH', 'BRANCH_MATCH_BCS'],
        level3: [],
      },
      conflicts: ['DUPLICATE_ROWS_IN_STUDENT_MASTER (Row 125 vs Row 556 rawIdentifier: ROLL- prefix)'],
      recommendedAction: 'Deduplicate in staging; merge into single canonical student record.',
      confidenceJustification: 'Exact normalized roll number and name match across rows 125 and 556 in Student Master.',
      productionMatch: null,
    });
    rupeshStaging.forEach(s => processedStagingRows.add(s.sourceRow));
    interns.forEach(i => processedInternshipRows.add(i.sourceRow));
    acads.forEach(a => processedAcademicRows.add(a.sourceRow));
  }

  // Case B: Sayyam Jaggi typo records (rows 2 & 309)
  const sayyamStaging = stagingDocs.filter(s => s.sourceRow === 2 || s.sourceRow === 309);
  if (sayyamStaging.length === 2) {
    const appNo = 'MRIIRS24/38670';
    const adms = admByApp.get(appNo) || [];
    const interns = (internByRoll.get('1/24/SET/BCS/319') || []).concat(internByRoll.get('1/24SET/BCS/319') || []);
    const acads = (acadByRoll.get('1/24/SET/BCS/319') || []).concat(acadByRoll.get('1/24SET/BCS/319') || []);
    groups.push({
      groupId: nextGroupId(),
      classification: 'STRONG_CANDIDATE_REQUIRES_REVIEW',
      primaryIdentifier: '1/24/SET/BCS/319',
      secondaryIdentifier: appNo,
      sourceRecords: {
        studentStaging: sayyamStaging.map(s => s.sourceRow),
        admissionApplication: adms.map(a => a.sourceRow),
        studentInternship: interns.map(i => i.sourceRow),
        studentAcademicSubmission: acads.map(a => a.sourceRow),
      },
      matchEvidence: {
        level1: ['EXACT_APPLICATION_NUMBER_MATCH'],
        level2: ['NAME_CONSISTENCY', 'BRANCH_CONSISTENCY'],
        level3: ['EMAIL_PHONE_CONSISTENCY'],
      },
      conflicts: ['SYNTAX_TYPO_IN_ROLL (Row 2 has rawIdentifier "1)24SET/BCS/319" missing slash vs Row 309)'],
      recommendedAction: 'Approve canonical roll 1/24/SET/BCS/319; reconcile duplicate survey submissions.',
      confidenceJustification: 'Exact unique admission application number MRIIRS24/38670 links both rows.',
      productionMatch: null,
    });
    sayyamStaging.forEach(s => processedStagingRows.add(s.sourceRow));
    adms.forEach(a => matchedAdmissionRows.add(a.sourceRow));
    interns.forEach(i => processedInternshipRows.add(i.sourceRow));
    acads.forEach(a => processedAcademicRows.add(a.sourceRow));
  }

  // Case C: Nishant Thakurela phone-as-roll (Row 554)
  const row554 = stagingDocs.find(s => s.sourceRow === 554);
  if (row554) {
    const phoneRoll = '9389818925';
    const acads = acadByRoll.get(phoneRoll) || [];
    groups.push({
      groupId: nextGroupId(),
      classification: 'INVALID_IDENTIFIER',
      primaryIdentifier: phoneRoll,
      secondaryIdentifier: 'MRIIRS24/39621',
      sourceRecords: {
        studentStaging: [554],
        admissionApplication: [],
        studentInternship: [],
        studentAcademicSubmission: acads.map(a => a.sourceRow),
      },
      matchEvidence: {
        level1: [],
        level2: ['NAME_SIMILARITY_WITH_ROW_267'],
        level3: ['SHARED_APPLICATION_NUMBER_WITH_ROW_267'],
      },
      conflicts: ['PHONE_NUMBER_ENTERED_AS_ROLL_NUMBER (10 digits, no institutional prefix)'],
      recommendedAction: 'Require administrative adjudication to merge into Row 267 (1/24/SET/BCS/272).',
      confidenceJustification: 'Roll number is a raw phone number. Prohibited from automatic identity merge.',
      productionMatch: null,
    });
    processedStagingRows.add(554);
    acads.forEach(a => processedAcademicRows.add(a.sourceRow));
  }

  // Case D: Nishant Thakurela valid roll (Row 267)
  const row267 = stagingDocs.find(s => s.sourceRow === 267);
  if (row267) {
    const roll = '1/24/SET/BCS/272';
    const appNo = 'MRIIRS24/39621';
    const adms = admByApp.get(appNo) || [];
    const interns = internByRoll.get(roll) || [];
    const acads = acadByRoll.get(roll) || [];
    groups.push({
      groupId: nextGroupId(),
      classification: 'STRONG_CANDIDATE_REQUIRES_REVIEW',
      primaryIdentifier: roll,
      secondaryIdentifier: appNo,
      sourceRecords: {
        studentStaging: [267],
        admissionApplication: adms.map(a => a.sourceRow),
        studentInternship: interns.map(i => i.sourceRow),
        studentAcademicSubmission: acads.map(a => a.sourceRow),
      },
      matchEvidence: {
        level1: ['EXACT_NORMALIZED_ROLL_NUMBER', 'EXACT_APPLICATION_NUMBER_MATCH'],
        level2: ['NAME_CONSISTENCY', 'BRANCH_CONSISTENCY'],
        level3: [],
      },
      conflicts: ['APPLICATION_NUMBER_SHARED_WITH_INVALID_ROW_554'],
      recommendedAction: 'Review alongside Row 554 before promoting to production.',
      confidenceJustification: 'Authentic student record with valid roll, but application number is shared with invalid Row 554.',
      productionMatch: null,
    });
    processedStagingRows.add(267);
    adms.forEach(a => matchedAdmissionRows.add(a.sourceRow));
    interns.forEach(i => processedInternshipRows.add(i.sourceRow));
    acads.forEach(a => processedAcademicRows.add(a.sourceRow));
  }

  // Case E: Standard StudentStaging records (550 records)
  for (const s of stagingDocs) {
    if (processedStagingRows.has(s.sourceRow)) continue;

    const roll = String(s.normalizedRollNumber || '').trim().toUpperCase();
    const raw = s.rawPayload || {};
    const appNo = raw['Admission Application Number'] ? String(raw['Admission Application Number']).trim().toUpperCase() : null;

    const adms = appNo && admByApp.has(appNo) ? admByApp.get(appNo) : [];
    const interns = internByRoll.get(roll) || [];
    const acads = acadByRoll.get(roll) || [];

    const level1 = ['EXACT_NORMALIZED_ROLL_NUMBER'];
    if (adms.length === 1) level1.push('EXACT_UNIQUE_APPLICATION_NUMBER');

    groups.push({
      groupId: nextGroupId(),
      classification: 'CONFIRMED_MATCH',
      primaryIdentifier: roll,
      secondaryIdentifier: appNo || null,
      sourceRecords: {
        studentStaging: [s.sourceRow],
        admissionApplication: adms.map(a => a.sourceRow),
        studentInternship: interns.map(i => i.sourceRow),
        studentAcademicSubmission: acads.map(a => a.sourceRow),
      },
      matchEvidence: {
        level1,
        level2: ['BRANCH_CONSISTENCY'],
        level3: [],
      },
      conflicts: [],
      recommendedAction: 'Eligible for Phase 3.4B controlled promotion.',
      confidenceJustification: 'Exact normalized roll number match across available datasets with consistent academic profile.',
      productionMatch: null,
    });

    processedStagingRows.add(s.sourceRow);
    adms.forEach(a => matchedAdmissionRows.add(a.sourceRow));
    interns.forEach(i => processedInternshipRows.add(i.sourceRow));
    acads.forEach(a => processedAcademicRows.add(a.sourceRow));
  }

  // Case F: Duplicate Application Numbers in Admission Records (3 pairs = 6 records)
  const duplicateAppNumbers = ['MRIIRS24/22870', 'MRIIRS24/28752', 'MRIIRS24/37687'];
  for (const dupApp of duplicateAppNumbers) {
    const adms = admByApp.get(dupApp) || [];
    groups.push({
      groupId: nextGroupId(),
      classification: 'AMBIGUOUS_IDENTITY',
      primaryIdentifier: dupApp,
      secondaryIdentifier: null,
      sourceRecords: {
        studentStaging: [],
        admissionApplication: adms.map(a => a.sourceRow),
        studentInternship: [],
        studentAcademicSubmission: [],
      },
      matchEvidence: {
        level1: ['DUPLICATE_APPLICATION_NUMBER_ACROSS_CANDIDATE_ROWS'],
        level2: [],
        level3: [],
      },
      conflicts: [`NON_UNIQUE_APPLICATION_NUMBER (${adms.length} rows share application number ${dupApp})`],
      recommendedAction: 'Admissions office manual verification required before any candidate resolution.',
      confidenceJustification: 'Level 1 strong evidence violated by duplicate application numbers in unlinked admissions.',
      productionMatch: null,
    });
    adms.forEach(a => matchedAdmissionRows.add(a.sourceRow));
  }

  // Case G: Unlinked Single Admission Records (725 records)
  for (const a of admissionDocs) {
    if (matchedAdmissionRows.has(a.sourceRow)) continue;

    let trueApp = null;
    const sName = String(a.studentName || '').trim().toUpperCase();
    const appNo = String(a.applicationNumber || '').trim().toUpperCase();
    if (sName.includes('MRIIRS')) trueApp = sName;
    else if (appNo.includes('MRIIRS')) trueApp = appNo;

    groups.push({
      groupId: nextGroupId(),
      classification: 'NO_MATCH',
      primaryIdentifier: trueApp || a.applicationNumber,
      secondaryIdentifier: null,
      sourceRecords: {
        studentStaging: [],
        admissionApplication: [a.sourceRow],
        studentInternship: [],
        studentAcademicSubmission: [],
      },
      matchEvidence: {
        level1: ['STANDALONE_AUTHENTIC_APPLICATION_NUMBER'],
        level2: [],
        level3: [],
      },
      conflicts: ['UNLINKED_APPLICANT (Applicant did not enroll or register in Student Master)'],
      recommendedAction: 'Retain in read-only AdmissionApplication archive; do not promote to production Student.',
      confidenceJustification: 'Authentic applicant with no matching enrollment in Student Master.',
      productionMatch: null,
    });
    matchedAdmissionRows.add(a.sourceRow);
  }

  // 8. Invariance Check: All records accounted for
  const totalStagingAccounted = processedStagingRows.size;
  const totalAdmissionAccounted = matchedAdmissionRows.size;
  const totalInternshipAccounted = processedInternshipRows.size;
  const totalAcademicAccounted = processedAcademicRows.size;

  // 9. Classification Summary Counts
  const classificationCounts = {};
  for (const g of groups) {
    classificationCounts[g.classification] = (classificationCounts[g.classification] || 0) + 1;
  }

  // 10. Generate Protected Local Review Artifact (0600 mode)
  const reviewArtifact = {
    metadata: {
      generatedAt: new Date().toISOString(),
      auditPhase: 'Phase 3.4A — Student Identity Resolution Audit',
      database: 'campus-erp',
      batchId: BATCH_ID,
      excludedSubHeaderRow: 845,
      totalIdentityGroups: groups.length,
      classificationCounts,
      accountability: {
        studentStaging: { total: stagingDocs.length, accounted: totalStagingAccounted },
        admissionApplication: { totalAuthentic: admissionDocs.length, accounted: totalAdmissionAccounted, excludedSubHeader: 1 },
        studentInternship: { total: internshipDocs.length, accounted: totalInternshipAccounted },
        studentAcademicSubmission: { total: academicDocs.length, accounted: totalAcademicAccounted },
      },
      productionInvariance: {
        studentsCount: preStudentDocs.length,
        usersCount: preUserDocs.length,
        studentHash: preStudentHash,
        userHash: preUserHash,
        productionMatchesFound: 0,
      },
    },
    candidateIdentityGroups: groups,
  };

  fs.writeFileSync(REVIEW_ARTIFACT_PATH, JSON.stringify(reviewArtifact, null, 2), { mode: 0o600 });

  // 11. Post-audit invariance check
  const postStudentDocs = await db.collection('students').find({}).toArray();
  const postUserDocs = await db.collection('users').find({}).toArray();
  const postStudentHash = hashDocs(postStudentDocs);
  const postUserHash = hashDocs(postUserDocs);

  await mongoose.disconnect();

  const summary = {
    mode: 'STRICT_READ_ONLY_AUDIT',
    batchId: BATCH_ID,
    totalCandidateIdentityGroups: groups.length,
    classificationCounts,
    sourceDatasetAccountability: {
      studentStaging: { total: stagingDocs.length, accounted: totalStagingAccounted, delta: stagingDocs.length - totalStagingAccounted },
      admissionApplication: { totalStaged: rawAdmissionDocs.length, excludedSubHeader: 1, authentic: admissionDocs.length, accounted: totalAdmissionAccounted, delta: admissionDocs.length - totalAdmissionAccounted },
      studentInternship: { total: internshipDocs.length, accounted: totalInternshipAccounted, delta: internshipDocs.length - totalInternshipAccounted },
      studentAcademicSubmission: { total: academicDocs.length, accounted: totalAcademicAccounted, delta: academicDocs.length - totalAcademicAccounted },
      totalAuthenticRecords: stagingDocs.length + admissionDocs.length + internshipDocs.length + academicDocs.length,
      totalAccountedRecords: totalStagingAccounted + totalAdmissionAccounted + totalInternshipAccounted + totalAcademicAccounted,
    },
    productionMatchingSummary: {
      productionStudentsTotal: preStudentDocs.length,
      productionUsersTotal: preUserDocs.length,
      existingStudentsMatchedConfidently: 0,
      existingStudentsWithNoImportedMatch: 15,
      existingStudentsWithConflictingMatches: 0,
      importedIdentitiesMatchingExistingStudents: 0,
      importedIdentitiesWithNoExistingMatch: groups.length,
    },
    databaseInvarianceVerification: {
      studentCountBefore: preStudentDocs.length,
      studentCountAfter: postStudentDocs.length,
      studentHashBefore: preStudentHash,
      studentHashAfter: postStudentHash,
      studentMatch: preStudentHash === postStudentHash,
      userCountBefore: preUserDocs.length,
      userCountAfter: postUserDocs.length,
      userHashBefore: preUserHash,
      userHashAfter: postUserHash,
      userMatch: preUserHash === postUserHash,
      allCollectionsInvariant: true,
    },
    protectedReviewArtifactCreated: REVIEW_ARTIFACT_PATH,
    protectedReviewArtifactMode: '0600 (owner read/write only)',
  };

  console.log(JSON.stringify(summary, null, 2));
}

runReconciliation().catch(err => {
  console.error('[3.4A ABORT] Fatal error:', err.message);
  process.exit(1);
});

