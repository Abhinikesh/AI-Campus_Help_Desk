/**
 * server/services/placement.service.js
 * Domain service for student eligibility calculations, coordinator scoping,
 * secure document storage, formula injection sanitization, and analytics.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const Student = require('../models/Student');
const Mark = require('../models/Mark');
const Company = require('../models/Company');
const PlacementOpportunity = require('../models/PlacementOpportunity');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementProfile = require('../models/PlacementProfile');
const PlacementApplication = require('../models/PlacementApplication');
const PlacementOffer = require('../models/PlacementOffer');
const PlacementCoordinatorAssignment = require('../models/PlacementCoordinatorAssignment');
const AcademicCalendarEvent = require('../models/AcademicCalendarEvent');
const resultCalculationService = require('./resultCalculation.service');
const ApiError = require('../utils/ApiError');

// Storage Directories
const BASE_UPLOAD_DIR = path.resolve(__dirname, '../uploads/placement');
const RESUMES_DIR = path.join(BASE_UPLOAD_DIR, 'resumes');
const OFFERS_DIR = path.join(BASE_UPLOAD_DIR, 'offers');

[RESUMES_DIR, OFFERS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

// Multer Storage Engines
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESUMES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `resume-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const offerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, OFFERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `offer-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new ApiError(400, 'Invalid file format. Only PDF, DOC, and DOCX files are permitted.'));
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new ApiError(400, 'Invalid MIME type for document upload.'));
  }
  cb(null, true);
};

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: documentFileFilter,
});

const uploadOfferDoc = multer({
  storage: offerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: documentFileFilter,
});

class PlacementService {
  /**
   * Evaluates student eligibility server-side against an opportunity's criteria.
   * Reads authoritative CGPA and backlog metrics from Mark.js without trusting client input.
   */
  async evaluateStudentEligibility(studentId, opportunityId) {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new ApiError(404, 'Student profile not found');
    }

    const opportunity = await PlacementOpportunity.findById(opportunityId);
    if (!opportunity) {
      throw new ApiError(404, 'Placement opportunity not found');
    }

    const reasons = [];
    let isEligible = true;

    // 1. Placement Registration Status Check
    const profile = await PlacementProfile.findOne({ student: student._id });
    if (!profile || profile.registrationStatus !== 'registered') {
      isEligible = false;
      reasons.push(
        profile
          ? `Student placement registration status is '${profile.registrationStatus}'`
          : 'Student has not registered for campus placements'
      );
    }

    // 2. Department & Branch Check
    const studentBranch = (student.branch || '').toUpperCase();
    if (
      opportunity.eligibleBranches &&
      opportunity.eligibleBranches.length > 0 &&
      !opportunity.eligibleBranches.includes(studentBranch)
    ) {
      isEligible = false;
      reasons.push(`Branch '${studentBranch}' is not eligible for this opportunity`);
    }

    // 3. Batch Check (Expected Graduation Year)
    // admissionYear + 4 for 4-year programs, admissionYear + 3 for 3-year
    const expectedGraduationYear = (student.admissionYear || 2022) + (student.program === 'B.Tech' ? 4 : 3);
    if (
      opportunity.eligibleBatches &&
      opportunity.eligibleBatches.length > 0 &&
      !opportunity.eligibleBatches.includes(expectedGraduationYear) &&
      !opportunity.eligibleBatches.includes(student.admissionYear)
    ) {
      isEligible = false;
      reasons.push(`Graduation batch '${expectedGraduationYear}' is not eligible for this opportunity`);
    }

    // 4. Authoritative CGPA & Backlogs Calculation from Mark.js
    const publishedMarks = await Mark.find({
      student: student._id,
      status: 'published',
      isWithheld: false,
    }).populate('subject exam');

    let evaluatedCgpa = 0;
    let evaluatedBacklogs = 0;

    if (publishedMarks && publishedMarks.length > 0) {
      const semResult = resultCalculationService.calculateSemesterResult(publishedMarks);
      evaluatedCgpa = semResult.cgpa || 0;
      evaluatedBacklogs = semResult.failedSubjects || 0;
    }

    // 5. Minimum CGPA Check
    if (opportunity.minimumCgpa > 0 && evaluatedCgpa < opportunity.minimumCgpa) {
      isEligible = false;
      reasons.push(
        `CGPA (${evaluatedCgpa.toFixed(2)}) is below the required threshold of ${opportunity.minimumCgpa.toFixed(2)}`
      );
    }

    // 6. Maximum Backlogs Check
    if (opportunity.maximumBacklogs !== undefined && evaluatedBacklogs > opportunity.maximumBacklogs) {
      isEligible = false;
      reasons.push(
        `Active backlogs (${evaluatedBacklogs}) exceed the permissible maximum of ${opportunity.maximumBacklogs}`
      );
    }

    // 7. Application Deadline Check
    const now = new Date();
    if (opportunity.applicationDeadline && new Date(opportunity.applicationDeadline) < now) {
      isEligible = false;
      reasons.push('Application deadline for this opportunity has expired');
    }

    return {
      isEligible,
      evaluationStatus: isEligible ? 'eligible' : 'not_eligible',
      evaluatedCgpa,
      evaluatedBacklogs,
      studentBranch,
      studentSemester: student.semester || 1,
      studentBatch: expectedGraduationYear,
      evaluatedAt: new Date(),
      reasons,
    };
  }

  /**
   * Verifies whether a coordinator or placement officer is authorized to manage a specific drive.
   */
  async verifyCoordinatorDriveAccess(userId, userRole, driveId) {
    if (['admin', 'placement_officer'].includes(userRole)) {
      return true;
    }

    if (userRole === 'placement_coordinator' || userRole === 'faculty') {
      const drive = await PlacementDrive.findById(driveId);
      if (!drive) {
        throw new ApiError(404, 'Placement drive not found');
      }

      const isListedCoordinator =
        drive.coordinators && drive.coordinators.some((c) => c.toString() === userId.toString());

      if (isListedCoordinator) {
        return true;
      }

      const activeAssignment = await PlacementCoordinatorAssignment.findOne({
        coordinator: userId,
        drive: driveId,
        status: 'active',
      });

      if (activeAssignment) {
        return true;
      }

      throw new ApiError(403, 'Access denied: You are not assigned to manage this recruitment drive');
    }

    throw new ApiError(403, 'Access denied: Insufficient placement privileges');
  }

  /**
   * Safely resolves a stored document path while preventing directory traversal attacks.
   */
  resolveSafeDocumentPath(subfolder, filename) {
    if (!filename || typeof filename !== 'string') {
      throw new ApiError(400, 'Invalid document identifier');
    }

    // Prevent directory traversal characters
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new ApiError(400, 'Path traversal detected in file request');
    }

    const targetDir = subfolder === 'offers' ? OFFERS_DIR : RESUMES_DIR;
    const resolvedPath = path.resolve(targetDir, filename);

    if (!resolvedPath.startsWith(targetDir)) {
      throw new ApiError(403, 'Directory traversal attempt intercepted');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new ApiError(404, 'Requested document not found on storage server');
    }

    return resolvedPath;
  }

  /**
   * Sanitizes cell values for CSV exports to prevent Spreadsheet Formula Injection (CWE-1236).
   */
  sanitizeCsvValue(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Formats a row of fields into an RFC-4180 compliant CSV line with formula sanitization.
   */
  toCsvRow(fields) {
    return (
      fields
        .map((f) => {
          const sanitized = this.sanitizeCsvValue(f);
          if (
            sanitized.includes(',') ||
            sanitized.includes('"') ||
            sanitized.includes('\n') ||
            sanitized.includes('\r')
          ) {
            return `"${sanitized.replace(/"/g, '""')}"`;
          }
          return sanitized;
        })
        .join(',') + '\r\n'
    );
  }

  /**
   * Direct database analytics calculation for placement metrics without fabricated numbers.
   */
  async getPlacementMetrics(filters = {}) {
    const { academicYear } = filters;

    const driveMatch = {};
    const appMatch = {};
    const offerMatch = {};

    if (academicYear) {
      driveMatch.academicYear = academicYear;
      appMatch.academicYear = academicYear;
    }

    const [
      totalRegisteredStudents,
      completedProfilesCount,
      activeCompaniesCount,
      publishedOpportunitiesCount,
      upcomingDrivesCount,
      applicationsAggregate,
      offersAggregate,
      verifiedPlacementsCount,
    ] = await Promise.all([
      PlacementProfile.countDocuments({ registrationStatus: 'registered' }),
      PlacementProfile.countDocuments({ profileStatus: 'complete' }),
      Company.countDocuments({ status: 'active' }),
      PlacementOpportunity.countDocuments({ status: 'published' }),
      PlacementDrive.countDocuments({
        ...driveMatch,
        status: { $in: ['scheduled', 'registration_open', 'ongoing'] },
      }),
      PlacementApplication.aggregate([
        { $match: appMatch },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            shortlisted: {
              $sum: {
                $cond: [{ $in: ['$status', ['shortlisted', 'assessment_scheduled', 'interview_scheduled', 'selected', 'offered', 'offer_accepted']] }, 1, 0],
              },
            },
            interviewsScheduled: {
              $sum: {
                $cond: [{ $eq: ['$status', 'interview_scheduled'] }, 1, 0],
              },
            },
          },
        },
      ]),
      PlacementOffer.aggregate([
        { $match: offerMatch },
        {
          $group: {
            _id: null,
            totalOffers: { $sum: 1 },
            acceptedOffers: {
              $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
            },
            totalCtcPaise: { $sum: '$compensationPaise' },
            avgCtcPaise: { $avg: '$compensationPaise' },
            maxCtcPaise: { $max: '$compensationPaise' },
          },
        },
      ]),
      PlacementOffer.countDocuments({ isPlacementVerified: true }),
    ]);

    const appStats = applicationsAggregate[0] || {
      totalApplications: 0,
      shortlisted: 0,
      interviewsScheduled: 0,
    };

    const offerStats = offersAggregate[0] || {
      totalOffers: 0,
      acceptedOffers: 0,
      totalCtcPaise: 0,
      avgCtcPaise: 0,
      maxCtcPaise: 0,
    };

    // Calculate real placement percentage: verified placements / registered students * 100
    const placementPercentage =
      totalRegisteredStudents > 0
        ? Math.round((verifiedPlacementsCount / totalRegisteredStudents) * 1000) / 10
        : 0;

    return {
      totalRegisteredStudents,
      completedProfilesCount,
      activeCompaniesCount,
      publishedOpportunitiesCount,
      upcomingDrivesCount,
      totalApplications: appStats.totalApplications,
      shortlistedCandidates: appStats.shortlisted,
      interviewsScheduled: appStats.interviewsScheduled,
      totalOffers: offerStats.totalOffers,
      acceptedOffers: offerStats.acceptedOffers,
      verifiedPlacements: verifiedPlacementsCount,
      placementPercentage,
      averageCtcPaise: Math.round(offerStats.avgCtcPaise || 0),
      highestCtcPaise: offerStats.maxCtcPaise || 0,
    };
  }

  /**
   * Syncs a scheduled recruitment drive with the institutional Academic Calendar.
   */
  async syncDriveWithCalendar(drive, performedByUserId) {
    if (!drive || !drive.driveName || !drive.registrationStartDate) return null;

    try {
      const title = `Campus Recruitment Drive: ${drive.driveName}`;
      const description = `Placement drive by ${drive.company?.name || 'Recruiter'}. Venue/Link: ${drive.venue || 'TBA'}`;

      let calendarEvent;
      if (drive.calendarEvent) {
        calendarEvent = await AcademicCalendarEvent.findById(drive.calendarEvent);
      }

      if (calendarEvent) {
        calendarEvent.title = title;
        calendarEvent.description = description;
        calendarEvent.startDate = drive.registrationStartDate;
        calendarEvent.endDate = drive.registrationEndDate || drive.registrationStartDate;
        await calendarEvent.save();
      } else {
        calendarEvent = await AcademicCalendarEvent.create({
          title,
          description,
          eventType: 'registration_period',
          startDate: drive.registrationStartDate,
          endDate: drive.registrationEndDate || drive.registrationStartDate,
          targetAudience: 'students',
          isHoliday: false,
          createdBy: performedByUserId,
        });
        drive.calendarEvent = calendarEvent._id;
        await drive.save();
      }
      return calendarEvent;
    } catch (err) {
      // Non-fatal calendar sync failure
      console.warn('Academic calendar event sync error:', err.message);
      return null;
    }
  }
}

const placementServiceInstance = new PlacementService();

module.exports = {
  placementService: placementServiceInstance,
  uploadResume,
  uploadOfferDoc,
  RESUMES_DIR,
  OFFERS_DIR,
};
