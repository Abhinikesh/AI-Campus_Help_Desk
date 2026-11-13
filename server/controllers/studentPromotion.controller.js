/**
 * server/controllers/studentPromotion.controller.js
 *
 * Phase 3.8 — Controlled Verified Student Promotion
 *
 * Governs the controlled promotion of individually verified Batch 003 staging
 * identities into the production Student collection.
 *
 * Strict Security & Integrity Constraints:
 *  - Promotion eligibility strictly requires:
 *      1. verificationStatus === 'VERIFIED'
 *      2. evidenceVerificationLevel === 'DOCUMENT_VERIFIED' (REFERENCE_RECORDED is blocked)
 *      3. evidenceType is an accepted independent institutional source
 *      4. reviewer Admin identity and verifiedAt timestamp recorded
 *      5. identity resolution has no unresolved ambiguity or invalid identifier
 *      6. no existing production Student represents the same identity
 *      7. required Student fields (rollNumber, fullName) are valid
 *  - Only authorized Admins may perform promotion.
 *  - Batch 003 only (quarantined batches strictly rejected).
 *  - Does NOT automatically create User accounts (user: null, accountStatus: 'enrolled_offline').
 *  - Does NOT generate passwords, synthetic emails or credentials.
 *  - Preserves source lineage and historical records.
 *  - Concurrency protected via atomic state lock.
 *  - Records immutable audit entries in EnrollmentVerification and AuditLog.
 */
'use strict';

const mongoose = require('mongoose');
const Student = require('../models/Student');
const StudentStaging = require('../models/StudentStaging');
const AdmissionApplication = require('../models/AdmissionApplication');
const {
  EnrollmentVerification,
  BATCH_ID,
  EVIDENCE_TYPES,
} = require('../models/EnrollmentVerification');
const AuditLog = require('../models/AuditLog');
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
 * Thoroughly evaluate whether a Batch 003 staging identity is eligible for promotion.
 */
async function evaluateEligibility(normalizedRoll) {
  const roll = normalizedRoll.toUpperCase().trim();
  const reasons = [];

  // 1. Check Batch 003 StudentStaging
  const staging = await StudentStaging.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  }).lean();

  if (!staging) {
    return {
      eligible: false,
      reasons: [`No Batch 003 staging record found for roll number '${roll}'.`],
      staging: null,
      verification: null,
      existingStudent: null,
      candidateData: null,
    };
  }

  // 2. Identity Resolution validity
  if (/^\d{10}$/.test(roll)) {
    reasons.push('Invalid roll number identifier (10-digit phone number format detected).');
  }
  if (staging.conflictCandidates && staging.conflictCandidates.length > 0) {
    reasons.push('Unresolved identity conflict candidates present on staging record.');
  }
  if (staging.reviewStatus === 'rejected') {
    reasons.push('Staging record reviewStatus is marked as rejected.');
  }

  // 3. Resolve Full Name
  let resolvedFullName = staging.studentName;
  if (!resolvedFullName && staging.rawPayload) {
    resolvedFullName =
      staging.rawPayload.Name ||
      staging.rawPayload.studentName ||
      staging.rawPayload['Student Name'];
  }
  if (!resolvedFullName || !resolvedFullName.trim()) {
    reasons.push('Student full name is missing from staging records.');
  }

  // 4. Check EnrollmentVerification
  const verification = await EnrollmentVerification.findOne({
    batchId: BATCH_ID,
    normalizedRollNumber: roll,
  }).lean();

  if (!verification) {
    reasons.push('No enrollment verification record exists for this identity (status is PENDING).');
  } else {
    if (verification.isPromoted) {
      reasons.push('This student identity has already been promoted to the production Student collection.');
    }
    if (verification.verificationStatus !== 'VERIFIED') {
      reasons.push(`Enrollment verification status is '${verification.verificationStatus}'; must be 'VERIFIED'.`);
    }
    if (verification.evidenceVerificationLevel !== 'DOCUMENT_VERIFIED') {
      reasons.push(
        `Evidence verification level is '${verification.evidenceVerificationLevel || 'NONE'}'. Strict requirement: 'DOCUMENT_VERIFIED'. (REFERENCE_RECORDED alone does not qualify).`
      );
    }
    if (!verification.evidenceType || !EVIDENCE_TYPES.includes(verification.evidenceType)) {
      reasons.push('Invalid or missing accepted institutional evidence type.');
    }
    if (!verification.evidenceReference || !verification.evidenceReference.trim()) {
      reasons.push('Independent evidence document reference identifier is missing.');
    }
    if (!verification.reviewerAdminId && !verification.reviewerAdminName) {
      reasons.push('Reviewer administrator identity is not recorded.');
    }
    if (!verification.verifiedAt) {
      reasons.push('Verification timestamp (verifiedAt) is missing.');
    }
  }

  // 5. Check existing production Student collection
  const existingStudent = await Student.findOne({ rollNumber: roll }).lean();
  if (existingStudent) {
    reasons.push(`A production Student already exists with roll number '${roll}' (ID: ${existingStudent._id}).`);
  }

  // 6. Contextual Admission record (non-blocking)
  let admission = null;
  if (resolvedFullName) {
    const firstName = resolvedFullName.trim().split(' ')[0];
    admission = await AdmissionApplication.findOne({
      batchId: BATCH_ID,
      studentName: { $regex: firstName, $options: 'i' },
    }).lean();
  }

  // Assemble candidate Student document data for preview
  const candidateData = {
    rollNumber: roll,
    fullName: resolvedFullName ? resolvedFullName.trim() : null,
    user: null, // Offline institutional student without portal user account
    school: staging.academicProfile?.school || admission?.school || null,
    branch: staging.academicProfile?.branch || admission?.course || null,
    program: staging.academicProfile?.course || admission?.course || null,
    section: staging.academicProfile?.section || null,
    status: 'active',
    accountStatus: 'enrolled_offline',
    sourceBatchId: BATCH_ID,
    importSourceRow: staging.sourceRow,
    admissionApplicationNumber: admission?.applicationNumber || null,
  };

  return {
    eligible: reasons.length === 0,
    reasons,
    staging,
    verification,
    existingStudent,
    admission,
    candidateData,
  };
}

// ─── GET /api/admin/staging/promotion/stats ──────────────────────────────────
/**
 * Return aggregate promotion eligibility statistics across Batch 003.
 */
const getPromotionStats = asyncHandler(async (req, res) => {
  // Find all verified records in Batch 003
  const verifications = await EnrollmentVerification.find({
    batchId: BATCH_ID,
    verificationStatus: 'VERIFIED',
  }).lean();

  let eligibleCount = 0;
  let alreadyPromotedCount = 0;
  let ineligibleVerifiedCount = 0;

  for (const v of verifications) {
    if (v.isPromoted) {
      alreadyPromotedCount++;
      continue;
    }
    const evalResult = await evaluateEligibility(v.normalizedRollNumber);
    if (evalResult.eligible) {
      eligibleCount++;
    } else {
      ineligibleVerifiedCount++;
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      batchId: BATCH_ID,
      totalVerified: verifications.length,
      eligibleCount,
      alreadyPromotedCount,
      ineligibleVerifiedCount,
    },
  });
});

// ─── GET /api/admin/staging/promotion/preview/:rollNumber ────────────────────
/**
 * Detailed eligibility assessment and promotion preview for a single student.
 */
const getPromotionPreview = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const evaluation = await evaluateEligibility(roll);

  return res.status(200).json({
    success: true,
    data: {
      normalizedRollNumber: roll,
      eligible: evaluation.eligible,
      reasons: evaluation.reasons,
      candidateData: evaluation.candidateData,
      verificationSummary: evaluation.verification
        ? {
            status: evaluation.verification.verificationStatus,
            level: evaluation.verification.evidenceVerificationLevel,
            type: evaluation.verification.evidenceType,
            reference: evaluation.verification.evidenceReference,
            reviewer: evaluation.verification.reviewerAdminName,
            verifiedAt: evaluation.verification.verifiedAt,
            isPromoted: evaluation.verification.isPromoted,
            promotedAt: evaluation.verification.promotedAt,
          }
        : null,
      existingStudent: evaluation.existingStudent
        ? {
            id: evaluation.existingStudent._id,
            rollNumber: evaluation.existingStudent.rollNumber,
            fullName: evaluation.existingStudent.fullName,
            accountStatus: evaluation.existingStudent.accountStatus,
          }
        : null,
    },
  });
});

// ─── POST /api/admin/staging/promotion/:rollNumber ───────────────────────────
/**
 * Promote an individually verified Batch 003 staging identity to production Student.
 *
 * Atomically locks promotion state on EnrollmentVerification to prevent
 * double-promotion and concurrent races.
 */
const promoteStudent = asyncHandler(async (req, res) => {
  const roll = req.params.rollNumber.toUpperCase().trim();
  const { actorId, actorName, actorRole, ip } = getActor(req);

  // 1. Server-side recheck of all eligibility requirements
  const evaluation = await evaluateEligibility(roll);
  if (!evaluation.eligible) {
    throw new ApiError(
      400,
      `Student '${roll}' is not eligible for promotion: ${evaluation.reasons.join('; ')}`
    );
  }

  // 2. Atomic state lock on EnrollmentVerification:
  // Updates isPromoted: false -> true only if currently unpromoted and DOCUMENT_VERIFIED
  const lockedVerif = await EnrollmentVerification.findOneAndUpdate(
    {
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
      isPromoted: false,
      verificationStatus: 'VERIFIED',
      evidenceVerificationLevel: 'DOCUMENT_VERIFIED',
    },
    {
      $set: {
        isPromoted: true,
        promotedAt: new Date(),
        promotedByAdminId: actorId,
        promotedByAdminName: actorName,
      },
    },
    { new: true }
  );

  if (!lockedVerif) {
    // Determine exact conflict cause
    const current = await EnrollmentVerification.findOne({
      batchId: BATCH_ID,
      normalizedRollNumber: roll,
    }).lean();

    if (current?.isPromoted) {
      throw new ApiError(409, `Student '${roll}' has already been promoted to production.`);
    }
    throw new ApiError(
      400,
      `Concurrent state conflict: Enrollment verification state changed or is not DOCUMENT_VERIFIED.`
    );
  }

  // 3. Final safety check on production Student collection
  const conflictStudent = await Student.findOne({ rollNumber: roll }).lean();
  if (conflictStudent) {
    // Roll back atomic lock on verification record
    await EnrollmentVerification.updateOne(
      { batchId: BATCH_ID, normalizedRollNumber: roll },
      {
        $set: {
          isPromoted: false,
          promotedAt: null,
          promotedByAdminId: null,
          promotedByAdminName: null,
        },
      }
    );
    throw new ApiError(
      409,
      `Integrity violation: Production Student with roll number '${roll}' already exists.`
    );
  }

  // 4. Create and persist the production Student document
  let createdStudent;
  try {
    const candidate = evaluation.candidateData;
    createdStudent = new Student({
      rollNumber: roll,
      fullName: candidate.fullName,
      user: null, // Institutional offline student without portal user account
      school: candidate.school,
      branch: candidate.branch,
      program: candidate.program,
      section: candidate.section,
      status: 'active',
      accountStatus: 'enrolled_offline',
      sourceBatchId: BATCH_ID,
      importSourceRow: candidate.importSourceRow,
      admissionApplicationNumber: candidate.admissionApplicationNumber,
      hasUnresolvedConflicts: false,
    });

    await createdStudent.save();
  } catch (err) {
    // Roll back atomic lock if insert fails
    await EnrollmentVerification.updateOne(
      { batchId: BATCH_ID, normalizedRollNumber: roll },
      {
        $set: {
          isPromoted: false,
          promotedAt: null,
          promotedByAdminId: null,
          promotedByAdminName: null,
        },
      }
    );
    throw new ApiError(500, `Failed to create production Student record: ${err.message}`);
  }

  // 5. Link created student ID and append audit history to EnrollmentVerification
  lockedVerif.promotedStudentId = createdStudent._id;
  lockedVerif.auditHistory.push({
    action: 'PROMOTED',
    status: 'VERIFIED',
    actorId,
    actorName,
    actorRole,
    evidenceType: lockedVerif.evidenceType,
    evidenceReference: lockedVerif.evidenceReference,
    evidenceVerificationLevel: lockedVerif.evidenceVerificationLevel,
    remarks: `Promoted to production Student record (ID: ${createdStudent._id}, status: enrolled_offline).`,
    ip,
    timestamp: new Date(),
  });
  await lockedVerif.save();

  // 6. Record immutable enterprise AuditLog
  try {
    await AuditLog.create({
      actor: actorId,
      action: 'STUDENT_PROMOTION',
      entityType: 'Student',
      entityId: createdStudent._id,
      summary: `Promoted verified Batch 003 staging student '${roll}' (${createdStudent.fullName}) to production Student collection.`,
      ip,
    });
  } catch (auditErr) {
    // Non-fatal if general AuditLog collection write fails, core transaction completed
    console.error('AuditLog write warning:', auditErr.message);
  }

  return res.status(201).json({
    success: true,
    message: `Student '${roll}' (${createdStudent.fullName}) successfully promoted to production.`,
    data: createdStudent,
  });
});

// ─── GET /api/admin/staging/promotion/history ────────────────────────────────
/**
 * Retrieve list of promoted students and their promotion audit details.
 */
const getPromotionHistory = asyncHandler(async (req, res) => {
  const { rollNumber } = req.query;
  const filter = { batchId: BATCH_ID, isPromoted: true };

  if (rollNumber) {
    filter.normalizedRollNumber = rollNumber.toUpperCase().trim();
  }

  const promotedRecords = await EnrollmentVerification.find(filter)
    .select(
      'normalizedRollNumber studentName evidenceType evidenceReference evidenceVerificationLevel promotedStudentId promotedAt promotedByAdminName auditHistory'
    )
    .sort({ promotedAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      count: promotedRecords.length,
      items: promotedRecords,
    },
  });
});

module.exports = {
  evaluateEligibility,
  getPromotionStats,
  getPromotionPreview,
  promoteStudent,
  getPromotionHistory,
};
