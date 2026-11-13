/**
 * server/controllers/enrollmentVerification.controller.js
 *
 * Phase 3.7 — Enrollment Verification Workflow
 *
 * Admin controller for managing independent enrollment verification for
 * Batch 003 staging students.
 *
 * Security & Integrity Constraints:
 *  - Strictly Admin-only (protected by admin.routes.js router middleware).
 *  - Only operates on BATCH-20261112-STAGING-003.
 *  - Batch 001 and Batch 002 records are strictly rejected.
 *  - Never writes to Student, User, or staging collections.
 *  - Does NOT authorize production Student creation or promotion.
 *  - Proof of enrollment CANNOT be inferred from internship, marks, or applications.
 *  - Requires independent evidence (type + reference) before status can be VERIFIED.
 *  - Immutable audit trail for every action.
 */
'use strict';

const mongoose = require('mongoose');
const {
  EnrollmentVerification,
  BATCH_ID,
  VERIFICATION_STATUSES,
  EVIDENCE_TYPES,
  EVIDENCE_VERIFICATION_LEVELS,
} = require('../models/EnrollmentVerification');
const StudentStaging = require('../models/StudentStaging');
const AdmissionApplication = require('../models/AdmissionApplication');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActor(req) {
  const actorId = req.user?.userId || req.user?._id || req.user?.id;
  const actorName = req.user?.name || 'Administrator';
  const actorRole = req.user?.role || 'admin';
  const ip = req.ip || req.connection?.remoteAddress || '';
  return { actorId, actorName, actorRole, ip };
}

/**
 * Validate that a normalized roll number belongs to Batch 003 staging.
 * Throws ApiError if not found or if from a different batch.
 */
async function assertBatch003StagingStudent(normalizedRoll) {
  const staging = await StudentStaging.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: normalizedRoll,
  }).lean();

  if (!staging) {
    throw new ApiError(
      404,
      `No Batch 003 staging record found for roll number '${normalizedRoll}'. Cross-batch or un-staged records are not permitted.`
    );
  }
  return staging;
}

// ─── GET /api/admin/staging/enrollment/stats ──────────────────────────────────
/**
 * Return aggregate verification counts across Batch 003.
 * Staging records without an explicit decision record default to PENDING.
 */
const getVerificationStats = asyncHandler(async (req, res) => {
  const totalStaging = await StudentStaging.countDocuments({ batchId: BATCH_ID });

  const statusAgg = await EnrollmentVerification.aggregate([
    { $match: { batchId: BATCH_ID } },
    { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
  ]);

  const counts = {
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    REQUIRES_REVIEW: 0,
  };

  let explicitTotal = 0;
  for (const item of statusAgg) {
    if (counts[item._id] !== undefined) {
      counts[item._id] = item.count;
      explicitTotal += item.count;
    }
  }

  // Any staging record not yet explicitly evaluated is implicitly PENDING
  const unrecorded = Math.max(0, totalStaging - explicitTotal);
  counts.PENDING += unrecorded;

  return res.status(200).json({
    success: true,
    data: {
      batchId: BATCH_ID,
      totalStaging,
      verified: counts.VERIFIED,
      rejected: counts.REJECTED,
      requiresReview: counts.REQUIRES_REVIEW,
      pending: counts.PENDING,
      explicitDecisionsCount: explicitTotal,
    },
  });
});

// ─── GET /api/admin/staging/enrollment ────────────────────────────────────────
/**
 * List enrollment verification records with search, filter, and pagination.
 */
const listVerifications = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const stagingFilter = { batchId: BATCH_ID };
  if (search && search.trim()) {
    const s = search.trim();
    stagingFilter.$or = [
      { normalizedRollNumber: { $regex: s, $options: 'i' } },
      { studentName: { $regex: s, $options: 'i' } },
    ];
  }

  const stagingStudents = await StudentStaging.find(stagingFilter)
    .select('normalizedRollNumber studentName rawPayload reviewStatus')
    .sort({ normalizedRollNumber: 1 })
    .lean();

  const verifications = await EnrollmentVerification.find({ batchId: BATCH_ID }).lean();
  const verifMap = new Map();
  for (const v of verifications) {
    verifMap.set(v.normalizedRollNumber, v);
  }

  let combined = stagingStudents.map((st) => {
    const v = verifMap.get(st.normalizedRollNumber);
    let resolvedName = st.studentName;
    if (!resolvedName && st.rawPayload) {
      resolvedName =
        st.rawPayload.Name ||
        st.rawPayload.studentName ||
        st.rawPayload['Student Name'];
    }

    return {
      stagingId: st._id,
      normalizedRollNumber: st.normalizedRollNumber,
      studentName: resolvedName || 'Unknown Student',
      verificationStatus: v ? v.verificationStatus : 'PENDING',
      evidenceType: v ? v.evidenceType : null,
      evidenceReference: v ? v.evidenceReference : null,
      evidenceVerificationLevel: v ? v.evidenceVerificationLevel : null,
      reviewerAdminName: v ? v.reviewerAdminName : null,
      reviewerRemarks: v ? v.reviewerRemarks : '',
      verifiedAt: v ? v.verifiedAt : null,
      updatedAt: v ? v.updatedAt : null,
      createdAt: v ? v.createdAt : null,
      hasExplicitRecord: !!v,
    };
  });

  if (status && status !== 'ALL') {
    combined = combined.filter((c) => c.verificationStatus === status);
  }

  const total = combined.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const items = combined.slice(startIndex, startIndex + limitNum);

  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    },
  });
});

// ─── GET /api/admin/staging/enrollment/:rollNumber ────────────────────────────
/**
 * Get detailed verification status and audit history for a single roll number.
 */
const getVerificationDetail = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  let verification = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  }).lean();

  // If no explicit record yet, return a virtual pending state
  if (!verification) {
    verification = {
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      studentName: staging.studentName,
      stagingId: staging._id,
      verificationStatus: 'PENDING',
      evidenceType: null,
      evidenceReference: null,
      evidenceVerificationLevel: null,
      reviewerAdminId: null,
      reviewerAdminName: null,
      reviewerRemarks: '',
      verifiedAt: null,
      auditHistory: [],
    };
  }

  // Also include admission summary for context (read-only, non-PII)
  const admission = await AdmissionApplication.findOne({
    batchId: BATCH_ID,
    $or: [{ rollNumber: roll }, { normalizedRollNumber: roll }],
  })
    .select('applicationNumber course school admissionStatus')
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      verification,
      staging: {
        stagingId: staging._id,
        normalizedRollNumber: staging.normalizedRollNumber,
        studentName: staging.studentName,
        reviewStatus: staging.reviewStatus,
        conflictCandidates: staging.conflictCandidates || [],
      },
      admission: admission || null,
    },
  });
});

// ─── GET /api/admin/staging/enrollment/:rollNumber/history ────────────────────
/**
 * Retrieve the audit trail for a student's verification decisions.
 */
const getVerificationHistory = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  await assertBatch003StagingStudent(roll);

  const verification = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  }).lean();

  return res.status(200).json({
    success: true,
    data: {
      normalizedRollNumber: roll,
      auditHistory: verification ? verification.auditHistory || [] : [],
    },
  });
});

// ─── POST /api/admin/staging/enrollment ───────────────────────────────────────
/**
 * Create a PENDING verification record for a Batch 003 staging roll number.
 */
const createPendingVerification = asyncHandler(async (req, res) => {
  const { rollNumber } = req.body;
  if (!rollNumber || !rollNumber.trim()) {
    throw new ApiError(400, 'rollNumber is required');
  }

  const roll = rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  const existing = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  });

  if (existing) {
    throw new ApiError(
      400,
      `Enrollment verification record already exists for roll number '${roll}' with status '${existing.verificationStatus}'.`
    );
  }

  const { actorId, actorName, actorRole, ip } = getActor(req);

  const newRecord = new EnrollmentVerification({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
    studentName: staging.studentName,
    stagingId: staging._id,
    verificationStatus: 'PENDING',
    auditHistory: [
      {
        action: 'CREATED',
        status: 'PENDING',
        actorId,
        actorName,
        actorRole,
        remarks: 'Pending verification initialized',
        ip,
        timestamp: new Date(),
      },
    ],
  });

  await newRecord.save();

  return res.status(201).json({
    success: true,
    data: newRecord,
    message: `Pending verification created for roll number '${roll}'.`,
  });
});

// ─── PATCH /api/admin/staging/enrollment/:rollNumber/evidence ────────────────
/**
 * Record or update independent enrollment evidence without immediately approving.
 */
const recordEvidence = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  const { evidenceType, evidenceReference, evidenceVerificationLevel, remarks } = req.body;

  if (!evidenceType || !EVIDENCE_TYPES.includes(evidenceType)) {
    throw new ApiError(
      400,
      `Invalid or missing evidenceType. Must be one of: ${EVIDENCE_TYPES.join(', ')}`
    );
  }

  if (!evidenceReference || !evidenceReference.trim()) {
    throw new ApiError(400, 'evidenceReference is required and cannot be empty.');
  }

  if (
    evidenceVerificationLevel &&
    !EVIDENCE_VERIFICATION_LEVELS.includes(evidenceVerificationLevel)
  ) {
    throw new ApiError(
      400,
      `Invalid evidenceVerificationLevel. Must be one of: ${EVIDENCE_VERIFICATION_LEVELS.join(', ')}`
    );
  }

  const { actorId, actorName, actorRole, ip } = getActor(req);

  let record = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  });

  if (!record) {
    record = new EnrollmentVerification({
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      studentName: staging.studentName,
      stagingId: staging._id,
      verificationStatus: 'PENDING',
    });
  }

  record.evidenceType = evidenceType;
  record.evidenceReference = evidenceReference.trim();
  if (evidenceVerificationLevel) {
    record.evidenceVerificationLevel = evidenceVerificationLevel;
  } else if (!record.evidenceVerificationLevel) {
    record.evidenceVerificationLevel = 'REFERENCE_RECORDED';
  }

  record.auditHistory.push({
    action: 'EVIDENCE_RECORDED',
    status: record.verificationStatus,
    actorId,
    actorName,
    actorRole,
    evidenceType: record.evidenceType,
    evidenceReference: record.evidenceReference,
    evidenceVerificationLevel: record.evidenceVerificationLevel,
    remarks: remarks || 'Evidence recorded for verification',
    ip,
    timestamp: new Date(),
  });

  await record.save();

  return res.status(200).json({
    success: true,
    data: record,
    message: `Enrollment evidence successfully recorded for ${roll}.`,
  });
});

// ─── PATCH /api/admin/staging/enrollment/:rollNumber/approve ─────────────────
/**
 * Approve enrollment verification.
 * Enforces strict precondition:
 *  - Independent evidence (type + reference) must be present.
 *  - Internship, marks, applications, or Student Master do NOT qualify.
 */
const approveVerification = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  const {
    evidenceType,
    evidenceReference,
    evidenceVerificationLevel,
    remarks,
  } = req.body;

  let record = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  });

  if (!record) {
    record = new EnrollmentVerification({
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      studentName: staging.studentName,
      stagingId: staging._id,
      verificationStatus: 'PENDING',
    });
  }

  const effType = evidenceType || record.evidenceType;
  const effRef = evidenceReference ? evidenceReference.trim() : record.evidenceReference;
  const effLevel =
    evidenceVerificationLevel ||
    record.evidenceVerificationLevel ||
    'REFERENCE_RECORDED';

  if (!effType || !EVIDENCE_TYPES.includes(effType)) {
    throw new ApiError(
      400,
      `Cannot verify enrollment without an acceptable evidenceType (${EVIDENCE_TYPES.join(', ')}). Internship records, marks, and applications are not acceptable proof.`
    );
  }

  if (!effRef || !effRef.trim()) {
    throw new ApiError(
      400,
      'Cannot verify enrollment without an independent evidenceReference document identifier.'
    );
  }

  if (!EVIDENCE_VERIFICATION_LEVELS.includes(effLevel)) {
    throw new ApiError(
      400,
      `Invalid evidenceVerificationLevel. Must be one of: ${EVIDENCE_VERIFICATION_LEVELS.join(', ')}`
    );
  }

  const { actorId, actorName, actorRole, ip } = getActor(req);

  record.verificationStatus = 'VERIFIED';
  record.evidenceType = effType;
  record.evidenceReference = effRef;
  record.evidenceVerificationLevel = effLevel;
  record.reviewerAdminId = actorId;
  record.reviewerAdminName = actorName;
  record.reviewerRemarks = remarks || record.reviewerRemarks || 'Enrollment verified against independent evidence';
  record.verifiedAt = new Date();

  record.auditHistory.push({
    action: 'APPROVED',
    status: 'VERIFIED',
    actorId,
    actorName,
    actorRole,
    evidenceType: effType,
    evidenceReference: effRef,
    evidenceVerificationLevel: effLevel,
    remarks: record.reviewerRemarks,
    ip,
    timestamp: new Date(),
  });

  await record.save();

  return res.status(200).json({
    success: true,
    data: record,
    message: `Enrollment status for ${roll} is now VERIFIED.`,
  });
});

// ─── PATCH /api/admin/staging/enrollment/:rollNumber/reject ──────────────────
/**
 * Reject enrollment verification.
 * Requires reviewer remarks explaining reason.
 */
const rejectVerification = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) {
    throw new ApiError(400, 'Rejection requires reviewer remarks explaining the decision.');
  }

  let record = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  });

  if (!record) {
    record = new EnrollmentVerification({
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      studentName: staging.studentName,
      stagingId: staging._id,
      verificationStatus: 'PENDING',
    });
  }

  const { actorId, actorName, actorRole, ip } = getActor(req);

  record.verificationStatus = 'REJECTED';
  record.reviewerAdminId = actorId;
  record.reviewerAdminName = actorName;
  record.reviewerRemarks = remarks.trim();

  record.auditHistory.push({
    action: 'REJECTED',
    status: 'REJECTED',
    actorId,
    actorName,
    actorRole,
    remarks: remarks.trim(),
    ip,
    timestamp: new Date(),
  });

  await record.save();

  return res.status(200).json({
    success: true,
    data: record,
    message: `Enrollment for ${roll} has been REJECTED.`,
  });
});

// ─── PATCH /api/admin/staging/enrollment/:rollNumber/review ──────────────────
/**
 * Mark enrollment as REQUIRES_REVIEW.
 * Requires reviewer remarks detailing what needs clarification.
 */
const requestReview = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const staging = await assertBatch003StagingStudent(roll);

  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) {
    throw new ApiError(400, 'Review request requires remarks specifying what requires review.');
  }

  let record = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  });

  if (!record) {
    record = new EnrollmentVerification({
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      studentName: staging.studentName,
      stagingId: staging._id,
      verificationStatus: 'PENDING',
    });
  }

  const { actorId, actorName, actorRole, ip } = getActor(req);

  record.verificationStatus = 'REQUIRES_REVIEW';
  record.reviewerAdminId = actorId;
  record.reviewerAdminName = actorName;
  record.reviewerRemarks = remarks.trim();

  record.auditHistory.push({
    action: 'REVIEW_REQUESTED',
    status: 'REQUIRES_REVIEW',
    actorId,
    actorName,
    actorRole,
    remarks: remarks.trim(),
    ip,
    timestamp: new Date(),
  });

  await record.save();

  return res.status(200).json({
    success: true,
    data: record,
    message: `Enrollment for ${roll} is set to REQUIRES_REVIEW.`,
  });
});

module.exports = {
  getVerificationStats,
  listVerifications,
  getVerificationDetail,
  getVerificationHistory,
  createPendingVerification,
  recordEvidence,
  approveVerification,
  rejectVerification,
  requestReview,
};
