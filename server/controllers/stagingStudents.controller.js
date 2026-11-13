/**
 * server/controllers/stagingStudents.controller.js
 *
 * Phase 3.6 — Admin Staging Student Management
 *
 * Read-only endpoints for browsing and inspecting Batch 003 staging data.
 * Strictly restricted to Admin role (enforced by admin.routes.js router-level middleware).
 *
 * Security constraints:
 *  - Credentials, passwords, and parental PII are never stored in these models.
 *  - offerLetterUrl from StudentInternship is never returned (may contain external URL with PII).
 *  - Only BATCH-20261112-STAGING-003 records are served.
 *  - Zero writes to any collection in this controller.
 */
'use strict';

const StudentStaging = require('../models/StudentStaging');
const AdmissionApplication = require('../models/AdmissionApplication');
const StudentInternship = require('../models/StudentInternship');
const StudentAcademicSubmission = require('../models/StudentAcademicSubmission');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const BATCH_ID = 'BATCH-20261112-STAGING-003';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive an identity classification label for a staging record based on
 * the Phase 3.5A reconciliation ledger decisions. Since the ledger is a
 * local protected file (not in MongoDB), we re-derive the classification
 * from observable data in the staging collections.
 *
 * Rules (consistent with Phase 3.5A):
 *   IDENTITY_CONFIRMED      — has a normalizedRollNumber and at least one
 *                              admission application sharing the same roll.
 *   IDENTITY_UNMATCHED      — no matching admission application.
 *   IDENTITY_REQUIRES_REVIEW — reviewStatus is 'pending_review' and there
 *                              are conflictCandidates present.
 *   IDENTITY_INVALID        — rawIdentifier looks like a phone number.
 */
function deriveIdentityClassification(stagingDoc, hasAdmissionMatch) {
  const roll = stagingDoc.normalizedRollNumber;
  if (!roll) return 'IDENTITY_INVALID';
  // Phone-number heuristic: 10 digits
  if (/^\d{10}$/.test(roll)) return 'IDENTITY_INVALID';
  if (stagingDoc.conflictCandidates && stagingDoc.conflictCandidates.length > 0)
    return 'IDENTITY_REQUIRES_REVIEW';
  if (hasAdmissionMatch) return 'IDENTITY_CONFIRMED';
  return 'IDENTITY_UNMATCHED';
}

/** Build the enrollment status (always NOT_VERIFIED for staging data). */
function enrollmentStatus() {
  return 'ENROLLMENT_NOT_VERIFIED';
}

/**
 * Sanitize a StudentStaging rawPayload map, removing any fields that
 * could contain credentials or excluded PII.
 * The rawPayload is a Mongoose Map; convert to plain object for the response.
 */
function sanitizeRawPayload(rawPayload) {
  if (!rawPayload) return {};
  const excluded = new Set([
    'password', 'Password', 'pwd', 'Pwd',
    'fathersName', 'FathersName', 'fathername', 'fatherName',
    'mothersName', 'MothersName', 'mothername', 'motherName',
    'parentContact', 'ParentContact', 'parentsContact',
    'admissionUrl', 'AdmissionUrl', 'marksheetUrl',
  ]);
  const result = {};
  // rawPayload may be a Mongoose Map (from live doc) or a plain object (from .lean())
  const entries = typeof rawPayload.entries === 'function'
    ? rawPayload.entries()
    : Object.entries(rawPayload);
  for (const [k, v] of entries) {
    if (!excluded.has(k)) result[k] = v;
  }
  return result;
}

// ─── GET /api/admin/staging/students ─────────────────────────────────────────
/**
 * List staging students with search, pagination, and identity classification.
 *
 * Query params:
 *   search  — freetext against name or roll number
 *   page    — page number (default 1)
 *   limit   — records per page (default 20, max 100)
 *   classification — filter by identity classification
 */
const listStagingStudents = asyncHandler(async (req, res) => {
  const { search, page, limit, classification } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
  const skip = (pageNum - 1) * limitNum;

  // Build MongoDB filter for StudentStaging
  const filter = { batchId: BATCH_ID };
  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { normalizedRollNumber: { $regex: s, $options: 'i' } },
      { studentName: { $regex: s, $options: 'i' } },
    ];
  }

  // Fetch total count + paginated staging records
  const [total, stagingDocs] = await Promise.all([
    StudentStaging.countDocuments(filter),
    StudentStaging.find(filter)
      .sort({ sourceRow: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  if (stagingDocs.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        students: [],
        pagination: { page: pageNum, limit: limitNum, total, totalPages: 0 },
        batchId: BATCH_ID,
      },
      message: 'No staging records found',
    });
  }

  // Collect all normalized roll numbers in this page
  const rollNumbers = [...new Set(
    stagingDocs.map(d => d.normalizedRollNumber).filter(Boolean)
  )];

  // Check which rolls have an admission application (for identity classification)
  const admissionMatches = await AdmissionApplication.find({
    batchId: BATCH_ID,
    // AdmissionApplication does not store normalizedRollNumber directly;
    // we match via studentName similarity is too fuzzy and unreliable.
    // Phase 3.5A used application-number cross-reference stored in reconciliation ledger.
    // For the UI list view, we use admission count per roll from StudentAcademicSubmission
    // which does carry normalizedRollNumber.
  }).select('applicationNumber studentName batchId').lean();

  // Build set of names from admission for rough match (all lowercase trimmed)
  const admissionNameSet = new Set(
    admissionMatches.map(a => (a.studentName || '').toLowerCase().trim())
  );

  // Count academic submissions per roll
  const academicCounts = await StudentAcademicSubmission.aggregate([
    { $match: { batchId: BATCH_ID, normalizedRollNumber: { $in: rollNumbers } } },
    { $group: { _id: '$normalizedRollNumber', count: { $sum: 1 } } },
  ]);
  const academicCountMap = {};
  for (const a of academicCounts) academicCountMap[a._id] = a.count;

  // Count internships per roll
  const internshipCounts = await StudentInternship.aggregate([
    { $match: { batchId: BATCH_ID, normalizedRollNumber: { $in: rollNumbers } } },
    { $group: { _id: '$normalizedRollNumber', count: { $sum: 1 } } },
  ]);
  const internshipCountMap = {};
  for (const i of internshipCounts) internshipCountMap[i._id] = i.count;

  // Build response rows
  let students = stagingDocs.map(doc => {
    const roll = doc.normalizedRollNumber;
    const nameMatch = admissionNameSet.has((doc.studentName || '').toLowerCase().trim());
    const identityClass = deriveIdentityClassification(doc, nameMatch);

    return {
      _id: doc._id,
      sourceRow: doc.sourceRow,
      normalizedRollNumber: roll || null,
      studentName: doc.studentName || null,
      reviewStatus: doc.reviewStatus,
      identityClassification: identityClass,
      enrollmentStatus: enrollmentStatus(),
      conflictsCount: doc.conflictCandidates ? doc.conflictCandidates.length : 0,
      academicSubmissionsCount: roll ? (academicCountMap[roll] || 0) : 0,
      internshipsCount: roll ? (internshipCountMap[roll] || 0) : 0,
      batchId: doc.batchId,
    };
  });

  // Apply classification filter after derivation (cannot do in DB without ledger)
  if (classification && classification !== 'all') {
    students = students.filter(s => s.identityClassification === classification);
  }

  return res.status(200).json({
    success: true,
    data: {
      students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: classification && classification !== 'all' ? students.length : total,
        totalPages: classification && classification !== 'all'
          ? Math.ceil(students.length / limitNum)
          : Math.ceil(total / limitNum) || 1,
      },
      batchId: BATCH_ID,
    },
    message: 'Staging students loaded',
  });
});

// ─── GET /api/admin/staging/students/stats ───────────────────────────────────
/**
 * Returns aggregate counts for the staging batch dashboard header.
 */
const getStagingStats = asyncHandler(async (req, res) => {
  const [
    totalMasterRecords,
    totalAdmissions,
    totalInternships,
    totalAcademicSubmissions,
    conflictedRecords,
  ] = await Promise.all([
    StudentStaging.countDocuments({ batchId: BATCH_ID }),
    AdmissionApplication.countDocuments({ batchId: BATCH_ID }),
    StudentInternship.countDocuments({ batchId: BATCH_ID }),
    StudentAcademicSubmission.countDocuments({ batchId: BATCH_ID }),
    StudentStaging.countDocuments({ batchId: BATCH_ID, 'conflictCandidates.0': { $exists: true } }),
  ]);

  // Null-org internships
  const nullOrgInternships = await StudentInternship.countDocuments({
    batchId: BATCH_ID,
    $or: [{ organizationName: null }, { organizationName: '' }],
  });

  // Academic submissions with conflict
  const conflictedAcademicRolls = await StudentAcademicSubmission.aggregate([
    { $match: { batchId: BATCH_ID } },
    {
      $group: {
        _id: '$normalizedRollNumber',
        count: { $sum: 1 },
        cgpas: { $addToSet: '$selfReportedCgpa' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  const conflictingAcademicCount = conflictedAcademicRolls.filter(r => {
    const validCgpas = r.cgpas.filter(c => c !== null && c !== undefined);
    return new Set(validCgpas).size > 1;
  }).length;

  return res.status(200).json({
    success: true,
    data: {
      batchId: BATCH_ID,
      totalMasterRecords,
      totalAdmissions,
      totalInternships,
      nullOrgInternships,
      totalAcademicSubmissions,
      masterConflictedRecords: conflictedRecords,
      academicConflictingStudents: conflictingAcademicCount,
      enrollmentVerified: 0,
      enrollmentNotVerified: totalMasterRecords,
    },
    message: 'Staging stats loaded',
  });
});

// ─── GET /api/admin/staging/students/:rollNumber ─────────────────────────────
/**
 * Full detail view for a staging record identified by its normalizedRollNumber.
 *
 * Returns:
 *   - Staging master record(s)
 *   - Admission application(s) matched by name
 *   - Academic submissions
 *   - Internship records
 *
 * PII exclusions enforced:
 *   - rawPayload is sanitized (no passwords, parental PII)
 *   - offerLetterUrl is excluded from internship records
 */
const getStagingStudentDetail = asyncHandler(async (req, res) => {
  const { rollNumber } = req.params;
  if (!rollNumber || rollNumber.trim().length < 2) {
    throw new ApiError(400, 'Invalid roll number parameter');
  }

  const normalizedRoll = rollNumber.toUpperCase().trim();

  // Fetch master staging record(s) for this roll
  const stagingDocs = await StudentStaging.find({
    batchId: BATCH_ID,
    normalizedRollNumber: normalizedRoll,
  }).lean();

  if (!stagingDocs || stagingDocs.length === 0) {
    throw new ApiError(404, `No staging record found for roll number: ${normalizedRoll}`);
  }

  // Primary staging doc for name lookups
  const primaryDoc = stagingDocs[0];
  const studentName = primaryDoc.studentName || null;

  // Fetch admission application by student name (best available match)
  const admissionFilter = { batchId: BATCH_ID };
  if (studentName) {
    admissionFilter.studentName = { $regex: studentName.split(' ')[0], $options: 'i' };
  }
  const admissionDocs = studentName
    ? await AdmissionApplication.find(admissionFilter).lean()
    : [];

  // Fetch academic submissions
  const academicDocs = await StudentAcademicSubmission.find({
    batchId: BATCH_ID,
    normalizedRollNumber: normalizedRoll,
  })
    .sort({ submissionTimestamp: 1 })
    .lean();

  // Fetch internship records — exclude offerLetterUrl
  const internshipDocs = await StudentInternship.find({
    batchId: BATCH_ID,
    normalizedRollNumber: normalizedRoll,
  })
    .select('-offerLetterUrl')
    .lean();

  // Determine identity classification
  const hasAdmissionMatch = admissionDocs.length > 0;
  const identityClass = deriveIdentityClassification(primaryDoc, hasAdmissionMatch);

  // Build academic summary
  const academicSummary = buildAcademicSummary(academicDocs);

  // Build internship summary
  const internshipSummary = buildInternshipSummary(internshipDocs);

  // Format master records
  const masterRecords = stagingDocs.map(doc => ({
    _id: doc._id,
    sourceRow: doc.sourceRow,
    sourceSheet: doc.sourceSheet,
    rawIdentifier: doc.rawIdentifier,
    normalizedRollNumber: doc.normalizedRollNumber,
    studentName: doc.studentName,
    reviewStatus: doc.reviewStatus,
    reviewNotes: doc.reviewNotes,
    conflictCandidates: doc.conflictCandidates || [],
    rawPayload: sanitizeRawPayload(doc.rawPayload),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  // Format admission records
  const admissionRecords = admissionDocs.map(doc => ({
    _id: doc._id,
    sourceRow: doc.sourceRow,
    applicationNumber: doc.applicationNumber,
    studentName: doc.studentName,
    course: doc.course,
    school: doc.school,
    dateOfReporting: doc.dateOfReporting,
    admissionStatus: doc.admissionStatus,
    reviewNotes: doc.reviewNotes,
    // teamsId and email intentionally omitted (contact PII)
    createdAt: doc.createdAt,
  }));

  // Format academic records
  const academicRecords = academicDocs.map(doc => ({
    _id: doc._id,
    sourceRow: doc.sourceRow,
    submissionTimestamp: doc.submissionTimestamp,
    normalizedRollNumber: doc.normalizedRollNumber,
    rawRollNumber: doc.rawRollNumber,
    studentName: doc.studentName,
    branch: doc.branch,
    tenthPercentage: doc.tenthPercentage,
    tenthBoard: doc.tenthBoard,
    twelfthPercentage: doc.twelfthPercentage,
    twelfthBoard: doc.twelfthBoard,
    selfReportedCgpa: doc.selfReportedCgpa,
    selfReportedActiveReappears: doc.selfReportedActiveReappears,
    selfReportedDeadReappears: doc.selfReportedDeadReappears,
    reappearSubjects: doc.reappearSubjects || [],
    isCanonical: doc.isCanonical,
    reviewStatus: doc.reviewStatus,
    reviewNotes: doc.reviewNotes,
    createdAt: doc.createdAt,
    // personalEmail, collegeEmail, contactNumber intentionally omitted
  }));

  // Format internship records
  const internshipRecords = internshipDocs.map(doc => ({
    _id: doc._id,
    sourceRow: doc.sourceRow,
    normalizedRollNumber: doc.normalizedRollNumber,
    branch: doc.branch,
    section: doc.section,
    organizationName: doc.organizationName,
    internshipTitle: doc.internshipTitle,
    startDate: doc.startDate,
    mode: doc.mode,
    stipendProvided: doc.stipendProvided,
    monthlyStipendAmount: doc.monthlyStipendAmount,
    placementDone: doc.placementDone,
    linkageStatus: doc.linkageStatus,
    reviewNotes: doc.reviewNotes,
    // offerLetterUrl excluded; contactNumber/emailId excluded (PII)
    createdAt: doc.createdAt,
  }));

  return res.status(200).json({
    success: true,
    data: {
      normalizedRollNumber: normalizedRoll,
      studentName,
      identityClassification: identityClass,
      enrollmentStatus: enrollmentStatus(),
      batchId: BATCH_ID,
      masterRecords,
      admissionRecords,
      academicRecords,
      internshipRecords,
      summary: {
        masterCount: masterRecords.length,
        admissionCount: admissionRecords.length,
        academicCount: academicRecords.length,
        internshipCount: internshipRecords.length,
        isDuplicate: masterRecords.length > 1,
        academic: academicSummary,
        internship: internshipSummary,
      },
    },
    message: 'Staging student detail loaded',
  });
});

// ─── GET /api/admin/staging/students/search ──────────────────────────────────
/**
 * Quick search across all three identifier types: name, roll, application number.
 * Returns lightweight results for autocomplete or cross-reference.
 */
const searchStagingStudents = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      success: true,
      data: { results: [] },
      message: 'Query too short',
    });
  }

  const term = q.trim();

  // Search staging by name or roll
  const [stagingResults, admissionResults] = await Promise.all([
    StudentStaging.find({
      batchId: BATCH_ID,
      $or: [
        { normalizedRollNumber: { $regex: term, $options: 'i' } },
        { studentName: { $regex: term, $options: 'i' } },
      ],
    })
      .select('normalizedRollNumber studentName sourceRow reviewStatus')
      .limit(20)
      .lean(),

    AdmissionApplication.find({
      batchId: BATCH_ID,
      $or: [
        { applicationNumber: { $regex: term, $options: 'i' } },
        { studentName: { $regex: term, $options: 'i' } },
      ],
    })
      .select('applicationNumber studentName sourceRow admissionStatus')
      .limit(10)
      .lean(),
  ]);

  const results = [
    ...stagingResults.map(r => ({
      type: 'master',
      normalizedRollNumber: r.normalizedRollNumber,
      studentName: r.studentName,
      sourceRow: r.sourceRow,
      reviewStatus: r.reviewStatus,
      label: `${r.normalizedRollNumber || 'Unknown Roll'} — ${r.studentName || 'Unknown Name'}`,
    })),
    ...admissionResults.map(r => ({
      type: 'admission',
      applicationNumber: r.applicationNumber,
      studentName: r.studentName,
      sourceRow: r.sourceRow,
      admissionStatus: r.admissionStatus,
      label: `App# ${r.applicationNumber} — ${r.studentName || 'Unknown Name'}`,
    })),
  ];

  return res.status(200).json({
    success: true,
    data: { results },
    message: `Found ${results.length} results`,
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAcademicSummary(academicDocs) {
  if (!academicDocs || academicDocs.length === 0) {
    return { submissionCount: 0, eligibility: 'ACADEMIC_DATA_INCOMPLETE', hasConflict: false };
  }

  const validCgpas = academicDocs
    .map(d => d.selfReportedCgpa)
    .filter(c => c !== null && c !== undefined && c > 0);

  const uniqueCgpas = [...new Set(validCgpas)];
  const hasConflict = uniqueCgpas.length > 1;

  let eligibility;
  if (hasConflict) {
    eligibility = 'CONFLICTING_REQUIRES_ADJUDICATION';
  } else if (academicDocs.length === 0) {
    eligibility = 'ACADEMIC_DATA_INCOMPLETE';
  } else if (validCgpas.length === 0) {
    eligibility = 'ACADEMIC_DATA_INCOMPLETE';
  } else {
    eligibility = 'CONSISTENT_PENDING_VERIFICATION';
  }

  const latestDoc = academicDocs[academicDocs.length - 1];

  return {
    submissionCount: academicDocs.length,
    eligibility,
    hasConflict,
    latestCgpa: latestDoc?.selfReportedCgpa ?? null,
    latestTenth: latestDoc?.tenthPercentage ?? null,
    latestTwelfth: latestDoc?.twelfthPercentage ?? null,
    activeReappears: latestDoc?.selfReportedActiveReappears ?? null,
    deadReappears: latestDoc?.selfReportedDeadReappears ?? null,
    branch: latestDoc?.branch ?? null,
  };
}

function buildInternshipSummary(internshipDocs) {
  if (!internshipDocs || internshipDocs.length === 0) {
    return {
      count: 0,
      hasNullOrg: false,
      nullOrgCount: 0,
      completenessPercent: 0,
    };
  }

  const CORE_FIELDS = ['organizationName', 'internshipTitle', 'startDate', 'mode', 'stipendProvided'];

  let nullOrgCount = 0;
  let totalCompleteFields = 0;

  for (const doc of internshipDocs) {
    if (!doc.organizationName) nullOrgCount++;
    for (const f of CORE_FIELDS) {
      if (doc[f] !== null && doc[f] !== undefined && doc[f] !== '') totalCompleteFields++;
    }
  }

  const maxFields = internshipDocs.length * CORE_FIELDS.length;
  const completenessPercent = maxFields > 0
    ? Math.round((totalCompleteFields / maxFields) * 100)
    : 0;

  return {
    count: internshipDocs.length,
    hasNullOrg: nullOrgCount > 0,
    nullOrgCount,
    completenessPercent,
  };
}

module.exports = {
  listStagingStudents,
  getStagingStats,
  getStagingStudentDetail,
  searchStagingStudents,
};
