/**
 * server/controllers/placement.controller.js
 * Comprehensive controller handling corporate directories, student placement profiles,
 * career opportunities, eligibility evaluations, drives, interviews, offers, and analytics.
 */
'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Company = require('../models/Company');
const PlacementProfile = require('../models/PlacementProfile');
const PlacementOpportunity = require('../models/PlacementOpportunity');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementSelectionStage = require('../models/PlacementSelectionStage');
const PlacementApplication = require('../models/PlacementApplication');
const PlacementStageResult = require('../models/PlacementStageResult');
const PlacementOffer = require('../models/PlacementOffer');
const PlacementCoordinatorAssignment = require('../models/PlacementCoordinatorAssignment');
const CareerResource = require('../models/CareerResource');
const PlacementAuditLog = require('../models/PlacementAuditLog');
const Student = require('../models/Student');
const User = require('../models/User');
const Mark = require('../models/Mark');
const resultCalculationService = require('../services/resultCalculation.service');
const { placementService } = require('../services/placement.service');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');

// Audit log helper
async function logAudit(action, entityType, entityId, performedBy, details = {}, ipAddress = null) {
  try {
    await PlacementAuditLog.create({
      action,
      entityType,
      entityId,
      performedBy,
      details,
      ipAddress,
    });
  } catch (err) {
    console.warn('Placement audit log error:', err.message);
  }
}

// -------------------------------------------------------------
// 1. COMPANY DIRECTORY
// -------------------------------------------------------------

exports.getCompanies = async (req, res, next) => {
  try {
    const { status, industry, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (industry) filter.industry = industry;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyCode: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [companies, total] = await Promise.all([
      Company.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Company.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: companies,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createCompany = async (req, res, next) => {
  try {
    const {
      name,
      companyCode,
      industry,
      website,
      description,
      location,
      recruiterName,
      recruiterEmail,
      recruiterPhone,
      tier,
      notes,
    } = req.body;

    if (!name || !companyCode || !industry) {
      throw new ApiError(400, 'Company name, company code, and industry classification are required');
    }

    const normalizedCode = companyCode.trim().toUpperCase();
    const existing = await Company.findOne({ companyCode: normalizedCode });
    if (existing) {
      throw new ApiError(409, `A company with code '${normalizedCode}' already exists`);
    }

    const company = await Company.create({
      name: name.trim(),
      companyCode: normalizedCode,
      industry: industry.trim(),
      website: (website || '').trim(),
      description: (description || '').trim(),
      location: (location || '').trim(),
      recruiterName: (recruiterName || '').trim(),
      recruiterEmail: (recruiterEmail || '').trim().toLowerCase(),
      recruiterPhone: (recruiterPhone || '').trim(),
      tier: tier || 'tier_1',
      notes: (notes || '').trim(),
      createdBy: req.user._id,
    });

    await logAudit('CREATE_COMPANY', 'Company', company._id, req.user._id, { companyCode: normalizedCode });

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company,
    });
  } catch (err) {
    next(err);
  }
};

exports.getCompanyById = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      throw new ApiError(404, 'Company not found');
    }

    const [opportunities, drives] = await Promise.all([
      PlacementOpportunity.find({ company: company._id }).sort({ createdAt: -1 }),
      PlacementDrive.find({ company: company._id }).sort({ registrationStartDate: -1 }),
    ]);

    res.json({
      success: true,
      data: {
        company,
        opportunities,
        drives,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      throw new ApiError(404, 'Company not found');
    }

    const allowedFields = [
      'name',
      'industry',
      'website',
      'description',
      'location',
      'recruiterName',
      'recruiterEmail',
      'recruiterPhone',
      'tier',
      'notes',
      'status',
      'verificationStatus',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        company[field] = req.body[field];
      }
    });

    await company.save();
    await logAudit('UPDATE_COMPANY', 'Company', company._id, req.user._id, req.body);

    res.json({
      success: true,
      message: 'Company profile updated successfully',
      data: company,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 2. STUDENT PLACEMENT PROFILE & RESUME
// -------------------------------------------------------------

exports.getMyProfile = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      throw new ApiError(404, 'Student record not found for authenticated user');
    }

    let profile = await PlacementProfile.findOne({ student: student._id });
    if (!profile) {
      // Auto-initialize placement profile
      profile = await PlacementProfile.create({
        student: student._id,
        user: req.user._id,
        registrationStatus: 'registered',
      });
      profile.calculateCompletionScore();
      await profile.save();
    }

    // Attach authoritative academic metrics
    const publishedMarks = await Mark.find({
      student: student._id,
      status: 'published',
      isWithheld: false,
    }).populate('subject exam');

    const result = resultCalculationService.calculateSemesterResult(publishedMarks);

    res.json({
      success: true,
      data: {
        profile,
        student: {
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          branch: student.branch,
          program: student.program,
          semester: student.semester,
          admissionYear: student.admissionYear,
        },
        academicMetrics: {
          cgpa: result.cgpa || 0,
          sgpa: result.sgpa || 0,
          backlogsCount: result.failedSubjects || 0,
          totalSubjectsEvaluated: result.totalSubjects || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      throw new ApiError(404, 'Student record not found');
    }

    let profile = await PlacementProfile.findOne({ student: student._id });
    if (!profile) {
      profile = new PlacementProfile({ student: student._id, user: req.user._id });
    }

    const {
      careerInterests,
      preferredJobRoles,
      technicalSkills,
      frameworksAndTools,
      projects,
      internships,
      certifications,
      achievements,
      workExperienceMonths,
      preferredLocation,
      preferredEmploymentType,
      registrationStatus,
    } = req.body;

    if (careerInterests !== undefined) profile.careerInterests = careerInterests;
    if (preferredJobRoles !== undefined) profile.preferredJobRoles = preferredJobRoles;
    if (technicalSkills !== undefined) profile.technicalSkills = technicalSkills;
    if (frameworksAndTools !== undefined) profile.frameworksAndTools = frameworksAndTools;
    if (projects !== undefined) profile.projects = projects;
    if (internships !== undefined) profile.internships = internships;
    if (certifications !== undefined) profile.certifications = certifications;
    if (achievements !== undefined) profile.achievements = achievements;
    if (workExperienceMonths !== undefined) profile.workExperienceMonths = Number(workExperienceMonths);
    if (preferredLocation !== undefined) profile.preferredLocation = preferredLocation;
    if (preferredEmploymentType !== undefined) profile.preferredEmploymentType = preferredEmploymentType;
    if (registrationStatus && ['registered', 'opted_out'].includes(registrationStatus)) {
      profile.registrationStatus = registrationStatus;
    }

    profile.calculateCompletionScore();
    await profile.save();

    res.json({
      success: true,
      message: 'Placement profile updated successfully',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please attach a valid resume document (PDF or DOCX)');
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      throw new ApiError(404, 'Student record not found');
    }

    let profile = await PlacementProfile.findOne({ student: student._id });
    if (!profile) {
      profile = new PlacementProfile({ student: student._id, user: req.user._id });
    }

    profile.resumeUrl = req.file.filename;
    profile.resumeOriginalName = req.file.originalname;
    profile.resumeUploadedAt = new Date();
    profile.calculateCompletionScore();
    await profile.save();

    await logAudit('UPLOAD_RESUME', 'PlacementProfile', profile._id, req.user._id, {
      filename: req.file.filename,
      originalName: req.file.originalname,
    });

    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        resumeUrl: profile.resumeUrl,
        resumeOriginalName: profile.resumeOriginalName,
        resumeUploadedAt: profile.resumeUploadedAt,
        profileCompletionScore: profile.profileCompletionScore,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadResume = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safePath = placementService.resolveSafeDocumentPath('resumes', filename);

    // Anti-IDOR Authorization Check
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      const profile = await PlacementProfile.findOne({ student: student._id, resumeUrl: filename });
      if (!profile) {
        // Also check if they submitted this resume on an active application
        const app = await PlacementApplication.findOne({ student: student._id, resumeUrl: filename });
        if (!app) {
          throw new ApiError(403, 'Access denied: You can only download your own resume');
        }
      }
    }

    res.download(safePath, filename);
  } catch (err) {
    next(err);
  }
};

exports.getStudentProfileById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      throw new ApiError(404, 'Student not found');
    }

    // Role check: Admin, Placement Officer, or Coordinator
    if (req.user.role === 'student' && student.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Access denied: Cross-profile access is strictly prohibited');
    }

    const profile = await PlacementProfile.findOne({ student: student._id });
    const publishedMarks = await Mark.find({
      student: student._id,
      status: 'published',
      isWithheld: false,
    }).populate('subject exam');

    const result = resultCalculationService.calculateSemesterResult(publishedMarks);

    res.json({
      success: true,
      data: {
        student,
        profile,
        academicMetrics: {
          cgpa: result.cgpa || 0,
          backlogsCount: result.failedSubjects || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 3. PLACEMENT OPPORTUNITIES & ELIGIBILITY
// -------------------------------------------------------------

exports.getOpportunities = async (req, res, next) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    // For students, strictly hide drafts and archived opportunities
    if (req.user.role === 'student') {
      filter.status = 'published';
    } else if (status) {
      filter.status = status;
    }

    if (type) filter.opportunityType = type;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { opportunityCode: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [opportunities, total] = await Promise.all([
      PlacementOpportunity.find(filter)
        .populate('company', 'name companyCode industry location tier logoUrl')
        .sort({ applicationDeadline: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PlacementOpportunity.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: opportunities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createOpportunity = async (req, res, next) => {
  try {
    const {
      companyId,
      opportunityCode,
      title,
      description,
      opportunityType,
      requiredSkills,
      preferredQualifications,
      eligibleDepartments,
      eligibleBranches,
      eligibleBatches,
      minimumCgpa,
      maximumBacklogs,
      otherEligibilityCriteria,
      workLocation,
      workMode,
      compensationPaise,
      stipendPaise,
      compensationDisplay,
      applicationOpeningDate,
      applicationDeadline,
      selectionProcessOverview,
      openingsCount,
    } = req.body;

    if (!companyId || !opportunityCode || !title || !description || !applicationOpeningDate || !applicationDeadline) {
      throw new ApiError(400, 'Company, opportunity code, title, description, and application dates are required');
    }

    const company = await Company.findById(companyId);
    if (!company) {
      throw new ApiError(404, 'Associated company not found');
    }

    const normalizedCode = opportunityCode.trim().toUpperCase();
    const existing = await PlacementOpportunity.findOne({ opportunityCode: normalizedCode });
    if (existing) {
      throw new ApiError(409, `An opportunity with code '${normalizedCode}' already exists`);
    }

    if (new Date(applicationOpeningDate) > new Date(applicationDeadline)) {
      throw new ApiError(400, 'Application opening date cannot be after application deadline');
    }

    const opportunity = await PlacementOpportunity.create({
      opportunityCode: normalizedCode,
      company: company._id,
      title: title.trim(),
      description: description.trim(),
      opportunityType: opportunityType || 'full_time',
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      preferredQualifications: (preferredQualifications || '').trim(),
      eligibleDepartments: Array.isArray(eligibleDepartments) ? eligibleDepartments.map((d) => d.toUpperCase()) : [],
      eligibleBranches: Array.isArray(eligibleBranches) ? eligibleBranches.map((b) => b.toUpperCase()) : [],
      eligibleBatches: Array.isArray(eligibleBatches) ? eligibleBatches.map(Number) : [],
      minimumCgpa: minimumCgpa !== undefined ? Number(minimumCgpa) : 0,
      maximumBacklogs: maximumBacklogs !== undefined ? Number(maximumBacklogs) : 0,
      otherEligibilityCriteria: (otherEligibilityCriteria || '').trim(),
      workLocation: workLocation.trim(),
      workMode: workMode || 'on_site',
      compensationPaise: compensationPaise !== undefined ? Number(compensationPaise) : 0,
      stipendPaise: stipendPaise !== undefined ? Number(stipendPaise) : 0,
      compensationDisplay: (compensationDisplay || '').trim(),
      applicationOpeningDate,
      applicationDeadline,
      selectionProcessOverview: (selectionProcessOverview || '').trim(),
      openingsCount: openingsCount !== undefined ? Number(openingsCount) : 1,
      status: 'draft',
      createdBy: req.user._id,
    });

    await logAudit('CREATE_OPPORTUNITY', 'PlacementOpportunity', opportunity._id, req.user._id, {
      opportunityCode: normalizedCode,
    });

    res.status(201).json({
      success: true,
      message: 'Placement opportunity created in draft state',
      data: opportunity,
    });
  } catch (err) {
    next(err);
  }
};

exports.getOpportunityById = async (req, res, next) => {
  try {
    const opportunity = await PlacementOpportunity.findById(req.params.id).populate(
      'company',
      'name companyCode industry website location tier logoUrl'
    );

    if (!opportunity) {
      throw new ApiError(404, 'Opportunity not found');
    }

    // Students cannot view draft opportunities directly by URL
    if (req.user.role === 'student' && opportunity.status !== 'published') {
      throw new ApiError(403, 'Access denied: Opportunity is not open for applications');
    }

    let eligibility = null;
    let existingApplication = null;

    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) {
        eligibility = await placementService.evaluateStudentEligibility(student._id, opportunity._id);
        existingApplication = await PlacementApplication.findOne({
          student: student._id,
          opportunity: opportunity._id,
        });
      }
    }

    res.json({
      success: true,
      data: {
        opportunity,
        eligibility,
        existingApplication,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateOpportunity = async (req, res, next) => {
  try {
    const opportunity = await PlacementOpportunity.findById(req.params.id);
    if (!opportunity) {
      throw new ApiError(404, 'Opportunity not found');
    }

    const { changeSummary, ...updates } = req.body;

    const allowedUpdates = [
      'title',
      'description',
      'opportunityType',
      'requiredSkills',
      'preferredQualifications',
      'eligibleDepartments',
      'eligibleBranches',
      'eligibleBatches',
      'minimumCgpa',
      'maximumBacklogs',
      'workLocation',
      'workMode',
      'compensationPaise',
      'stipendPaise',
      'compensationDisplay',
      'applicationOpeningDate',
      'applicationDeadline',
      'selectionProcessOverview',
      'openingsCount',
      'status',
    ];

    allowedUpdates.forEach((f) => {
      if (updates[f] !== undefined) {
        opportunity[f] = updates[f];
      }
    });

    opportunity.history.push({
      updatedAt: new Date(),
      updatedBy: req.user._id,
      changeSummary: changeSummary || 'Opportunity details updated',
    });

    await opportunity.save();
    await logAudit('UPDATE_OPPORTUNITY', 'PlacementOpportunity', opportunity._id, req.user._id, updates);

    res.json({
      success: true,
      message: 'Opportunity updated successfully',
      data: opportunity,
    });
  } catch (err) {
    next(err);
  }
};

exports.publishOpportunity = async (req, res, next) => {
  try {
    const opportunity = await PlacementOpportunity.findById(req.params.id).populate('company', 'name');
    if (!opportunity) {
      throw new ApiError(404, 'Opportunity not found');
    }

    opportunity.status = 'published';
    opportunity.publishedAt = new Date();
    opportunity.publishedBy = req.user._id;
    await opportunity.save();

    await logAudit('PUBLISH_OPPORTUNITY', 'PlacementOpportunity', opportunity._id, req.user._id);

    // Notify registered students about new opportunity
    try {
      const registeredProfiles = await PlacementProfile.find({ registrationStatus: 'registered' }).select('user');
      const recipientIds = registeredProfiles.map((p) => p.user);

      if (recipientIds.length > 0) {
        await notificationService.createBulkNotifications({
          title: `New Placement Opportunity: ${opportunity.title}`,
          message: `${opportunity.company.name} has posted an opening for ${opportunity.title}. Apply before the deadline.`,
          category: 'placement',
          priority: 'high',
          recipients: recipientIds,
          sender: req.user._id,
        });
      }
    } catch (notifErr) {
      console.warn('Notification dispatch non-fatal failure:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Opportunity published successfully and visible to students',
      data: opportunity,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 4. PLACEMENT RECRUITMENT DRIVES
// -------------------------------------------------------------

exports.getDrives = async (req, res, next) => {
  try {
    const { status, academicYear, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      filter.status = { $in: ['scheduled', 'registration_open', 'ongoing'] };
    } else if (status) {
      filter.status = status;
    }

    if (academicYear) filter.academicYear = academicYear;

    // For coordinators, if not admin/officer, optionally show assigned drives
    if (req.user.role === 'placement_coordinator') {
      filter.coordinators = req.user._id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [drives, total] = await Promise.all([
      PlacementDrive.find(filter)
        .populate('company', 'name companyCode industry location logoUrl')
        .populate('opportunity', 'title opportunityType compensationDisplay applicationDeadline')
        .populate('coordinators', 'name email loginId')
        .sort({ registrationStartDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PlacementDrive.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: drives,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createDrive = async (req, res, next) => {
  try {
    const {
      driveCode,
      driveName,
      companyId,
      opportunityId,
      academicYear,
      description,
      registrationStartDate,
      registrationEndDate,
      prePlacementTalkDate,
      assessmentDate,
      interviewStartDate,
      venue,
      instructions,
      coordinatorIds,
    } = req.body;

    if (!driveCode || !driveName || !companyId || !opportunityId || !academicYear || !registrationStartDate || !registrationEndDate) {
      throw new ApiError(400, 'Drive code, name, company, opportunity, academic year, and dates are required');
    }

    const normalizedCode = driveCode.trim().toUpperCase();
    const existing = await PlacementDrive.findOne({ driveCode: normalizedCode });
    if (existing) {
      throw new ApiError(409, `Placement drive with code '${normalizedCode}' already exists`);
    }

    if (new Date(registrationStartDate) > new Date(registrationEndDate)) {
      throw new ApiError(400, 'Registration start date cannot be after registration end date');
    }

    const drive = await PlacementDrive.create({
      driveCode: normalizedCode,
      driveName: driveName.trim(),
      company: companyId,
      opportunity: opportunityId,
      academicYear: academicYear.trim(),
      description: (description || '').trim(),
      registrationStartDate,
      registrationEndDate,
      prePlacementTalkDate,
      assessmentDate,
      interviewStartDate,
      venue: (venue || 'Campus Placement Cell / Virtual').trim(),
      instructions: (instructions || '').trim(),
      coordinators: Array.isArray(coordinatorIds) ? coordinatorIds : [],
      status: 'scheduled',
      createdBy: req.user._id,
    });

    // Sync with Academic Calendar
    await placementService.syncDriveWithCalendar(drive, req.user._id);

    await logAudit('CREATE_DRIVE', 'PlacementDrive', drive._id, req.user._id, { driveCode: normalizedCode });

    res.status(201).json({
      success: true,
      message: 'Placement drive scheduled successfully',
      data: drive,
    });
  } catch (err) {
    next(err);
  }
};

exports.getDriveById = async (req, res, next) => {
  try {
    const drive = await PlacementDrive.findById(req.params.id)
      .populate('company', 'name companyCode industry website location')
      .populate('opportunity')
      .populate('coordinators', 'name email loginId');

    if (!drive) {
      throw new ApiError(404, 'Placement drive not found');
    }

    const stages = await PlacementSelectionStage.find({ drive: drive._id }).sort({ sequence: 1 });

    res.json({
      success: true,
      data: {
        drive,
        stages,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateDrive = async (req, res, next) => {
  try {
    const drive = await PlacementDrive.findById(req.params.id);
    if (!drive) {
      throw new ApiError(404, 'Placement drive not found');
    }

    await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, drive._id);

    const allowed = [
      'driveName',
      'description',
      'registrationStartDate',
      'registrationEndDate',
      'prePlacementTalkDate',
      'assessmentDate',
      'interviewStartDate',
      'venue',
      'instructions',
      'status',
      'coordinators',
    ];

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) {
        drive[f] = req.body[f];
      }
    });

    await drive.save();
    await placementService.syncDriveWithCalendar(drive, req.user._id);
    await logAudit('UPDATE_DRIVE', 'PlacementDrive', drive._id, req.user._id, req.body);

    res.json({
      success: true,
      message: 'Drive details updated successfully',
      data: drive,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 5. STUDENT APPLICATION WORKFLOW
// -------------------------------------------------------------

exports.applyForOpportunity = async (req, res, next) => {
  try {
    const { opportunityId } = req.body;
    if (!opportunityId) {
      throw new ApiError(400, 'Opportunity ID is required');
    }

    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      throw new ApiError(404, 'Student profile not found');
    }

    const opportunity = await PlacementOpportunity.findById(opportunityId);
    if (!opportunity) {
      throw new ApiError(404, 'Placement opportunity not found');
    }

    if (opportunity.status !== 'published') {
      throw new ApiError(400, 'Opportunity is not open for applications');
    }

    const now = new Date();
    if (opportunity.applicationDeadline && new Date(opportunity.applicationDeadline) < now) {
      throw new ApiError(400, 'Application deadline for this opportunity has expired');
    }

    // Duplicate check
    const existingApp = await PlacementApplication.findOne({
      student: student._id,
      opportunity: opportunity._id,
    });

    if (existingApp) {
      throw new ApiError(409, 'You have already applied for this opportunity');
    }

    // Check student has an uploaded resume
    const profile = await PlacementProfile.findOne({ student: student._id });
    if (!profile || !profile.resumeUrl) {
      throw new ApiError(400, 'Please upload your resume to your placement profile before applying');
    }

    // Run authoritative server-side eligibility evaluation
    const evalResult = await placementService.evaluateStudentEligibility(student._id, opportunity._id);
    if (!evalResult.isEligible) {
      throw new ApiError(400, `Eligibility check failed: ${evalResult.reasons.join('; ')}`);
    }

    // Look up linked drive if any
    const drive = await PlacementDrive.findOne({
      opportunity: opportunity._id,
      status: { $in: ['scheduled', 'registration_open', 'ongoing'] },
    });

    const applicationNumber = `PL-APP-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const application = await PlacementApplication.create({
      applicationNumber,
      student: student._id,
      user: req.user._id,
      opportunity: opportunity._id,
      drive: drive ? drive._id : null,
      academicYear: drive?.academicYear || '2025-2026',
      resumeUrl: profile.resumeUrl,
      resumeOriginalName: profile.resumeOriginalName,
      eligibilitySnapshot: evalResult,
      status: 'submitted',
      statusHistory: [
        {
          status: 'submitted',
          changedAt: new Date(),
          changedBy: req.user._id,
          reason: 'Application submitted by candidate',
        },
      ],
    });

    await logAudit('SUBMIT_APPLICATION', 'PlacementApplication', application._id, req.user._id, {
      applicationNumber,
      opportunityCode: opportunity.opportunityCode,
    });

    // Notify student
    try {
      await notificationService.createNotification({
        recipient: req.user._id,
        title: 'Application Submitted',
        message: `Your application (${applicationNumber}) for ${opportunity.title} was submitted successfully.`,
        category: 'placement',
        priority: 'normal',
      });
    } catch (notifErr) {
      console.warn('Notification non-fatal failure:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyApplications = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      throw new ApiError(404, 'Student record not found');
    }

    const applications = await PlacementApplication.find({ student: student._id })
      .populate({
        path: 'opportunity',
        select: 'title opportunityCode opportunityType workLocation compensationDisplay applicationDeadline',
        populate: { path: 'company', select: 'name companyCode industry logoUrl' },
      })
      .populate('drive', 'driveName driveCode venue status')
      .populate('currentStage', 'stageName sequence stageType scheduledDate')
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

exports.getDriveApplications = async (req, res, next) => {
  try {
    const { driveId, status, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (driveId) {
      await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, driveId);
      filter.drive = driveId;
    }
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [applications, total] = await Promise.all([
      PlacementApplication.find(filter)
        .populate('student', 'fullName rollNumber branch semester program email phone')
        .populate('opportunity', 'title opportunityCode compensationDisplay')
        .populate('drive', 'driveName driveCode')
        .populate('currentStage', 'stageName sequence')
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PlacementApplication.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.withdrawApplication = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const application = await PlacementApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    // Ownership check
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (!student || application.student.toString() !== student._id.toString()) {
        throw new ApiError(403, 'Access denied: You can only withdraw your own applications');
      }
    }

    if (['offered', 'offer_accepted', 'selected'].includes(application.status)) {
      throw new ApiError(400, 'Applications with active offers or selections cannot be self-withdrawn; contact the Placement Office');
    }

    application.status = 'withdrawn';
    application.withdrawalReason = (reason || 'Candidate withdrew application').trim();
    application.withdrawnAt = new Date();
    application.statusHistory.push({
      status: 'withdrawn',
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: application.withdrawalReason,
    });

    await application.save();
    await logAudit('WITHDRAW_APPLICATION', 'PlacementApplication', application._id, req.user._id, { reason });

    res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, remarks, stageId } = req.body;
    const application = await PlacementApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    if (application.drive) {
      await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, application.drive);
    }

    const previousStatus = application.status;
    application.status = status;
    if (remarks) application.coordinatorRemarks = remarks.trim();
    if (stageId) application.currentStage = stageId;

    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: remarks || `Status changed from ${previousStatus} to ${status}`,
    });

    await application.save();
    await logAudit('UPDATE_APPLICATION_STATUS', 'PlacementApplication', application._id, req.user._id, {
      from: previousStatus,
      to: status,
      remarks,
    });

    // Notify student on key status transitions
    if (['shortlisted', 'interview_scheduled', 'selected', 'rejected'].includes(status)) {
      try {
        await notificationService.createNotification({
          recipient: application.user,
          title: `Placement Application Update: ${status.replace(/_/g, ' ').toUpperCase()}`,
          message: `Your application (${application.applicationNumber}) status was updated to ${status.replace(/_/g, ' ')}.`,
          category: 'placement',
          priority: 'high',
        });
      } catch (notifErr) {
        console.warn('Status notification non-fatal failure:', notifErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 6. SELECTION STAGES & INTERVIEWS
// -------------------------------------------------------------

exports.createSelectionStage = async (req, res, next) => {
  try {
    const { driveId, stageName, stageType, sequence, scheduledDate, scheduledTime, venueOrLink, instructions } = req.body;
    if (!driveId || !stageName || sequence === undefined) {
      throw new ApiError(400, 'Drive ID, stage name, and sequence order are required');
    }

    await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, driveId);

    const existingSeq = await PlacementSelectionStage.findOne({ drive: driveId, sequence: Number(sequence) });
    if (existingSeq) {
      throw new ApiError(409, `A selection stage with sequence #${sequence} already exists for this drive`);
    }

    const stage = await PlacementSelectionStage.create({
      drive: driveId,
      stageName: stageName.trim(),
      stageType: stageType || 'technical_interview',
      sequence: Number(sequence),
      scheduledDate,
      scheduledTime,
      venueOrLink: (venueOrLink || '').trim(),
      instructions: (instructions || '').trim(),
      coordinator: req.user._id,
    });

    await logAudit('CREATE_SELECTION_STAGE', 'PlacementSelectionStage', stage._id, req.user._id, {
      stageName,
      sequence,
    });

    res.status(201).json({
      success: true,
      message: 'Selection stage configured successfully',
      data: stage,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStageResult = async (req, res, next) => {
  try {
    const { applicationId, stageId, outcome, score, maxScore, internalNotes, studentFeedback } = req.body;
    if (!applicationId || !stageId || !outcome) {
      throw new ApiError(400, 'Application ID, stage ID, and outcome are required');
    }

    const stage = await PlacementSelectionStage.findById(stageId);
    if (!stage) throw new ApiError(404, 'Selection stage not found');

    await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, stage.drive);

    const application = await PlacementApplication.findById(applicationId);
    if (!application) throw new ApiError(404, 'Application not found');

    let stageResult = await PlacementStageResult.findOne({ application: applicationId, stage: stageId });

    if (!stageResult) {
      stageResult = await PlacementStageResult.create({
        application: applicationId,
        stage: stageId,
        student: application.student,
        outcome,
        score: score !== undefined ? Number(score) : null,
        maxScore: maxScore !== undefined ? Number(maxScore) : null,
        internalNotes: (internalNotes || '').trim(),
        studentFeedback: (studentFeedback || '').trim(),
        evaluatedBy: req.user._id,
      });
    } else {
      stageResult.outcome = outcome;
      if (score !== undefined) stageResult.score = Number(score);
      if (internalNotes !== undefined) stageResult.internalNotes = internalNotes.trim();
      if (studentFeedback !== undefined) stageResult.studentFeedback = studentFeedback.trim();
      stageResult.evaluatedBy = req.user._id;
      stageResult.evaluatedAt = new Date();
      await stageResult.save();
    }

    await logAudit('UPDATE_STAGE_RESULT', 'PlacementStageResult', stageResult._id, req.user._id, { outcome });

    res.json({
      success: true,
      message: 'Stage evaluation recorded successfully',
      data: stageResult,
    });
  } catch (err) {
    next(err);
  }
};

exports.correctStageResult = async (req, res, next) => {
  try {
    const { newOutcome, reason } = req.body;
    if (!newOutcome || !reason || reason.trim().length < 5) {
      throw new ApiError(400, 'A new outcome and mandatory justification (min 5 characters) are required for correction');
    }

    const stageResult = await PlacementStageResult.findById(req.params.id);
    if (!stageResult) throw new ApiError(404, 'Stage result record not found');

    const stage = await PlacementSelectionStage.findById(stageResult.stage);
    if (stage) {
      await placementService.verifyCoordinatorDriveAccess(req.user._id, req.user.role, stage.drive);
    }

    const previousOutcome = stageResult.outcome;
    stageResult.outcome = newOutcome;
    stageResult.correctionHistory.push({
      previousOutcome,
      newOutcome,
      reason: reason.trim(),
      correctedBy: req.user._id,
      correctedAt: new Date(),
    });

    await stageResult.save();
    await logAudit('CORRECT_STAGE_RESULT', 'PlacementStageResult', stageResult._id, req.user._id, {
      from: previousOutcome,
      to: newOutcome,
      reason,
    });

    res.json({
      success: true,
      message: 'Stage outcome corrected with audit trail preserved',
      data: stageResult,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyInterviewSchedule = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) throw new ApiError(404, 'Student not found');

    // Get applications shortlisted for interviews
    const applications = await PlacementApplication.find({
      student: student._id,
      status: { $in: ['shortlisted', 'assessment_scheduled', 'interview_scheduled'] },
    }).populate({
      path: 'drive',
      select: 'driveName venue prePlacementTalkDate assessmentDate interviewStartDate',
      populate: { path: 'company', select: 'name companyCode logoUrl' },
    });

    res.json({
      success: true,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 7. OFFER MANAGEMENT
// -------------------------------------------------------------

exports.issueOffer = async (req, res, next) => {
  try {
    const { applicationId, employmentType, compensationPaise, monthlyStipendPaise, compensationDisplay, joiningDate, location } = req.body;
    if (!applicationId) {
      throw new ApiError(400, 'Application ID is required');
    }

    const application = await PlacementApplication.findById(applicationId).populate('opportunity');
    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    const existingOffer = await PlacementOffer.findOne({
      student: application.student,
      opportunity: application.opportunity._id,
    });

    if (existingOffer) {
      throw new ApiError(409, 'An offer has already been issued for this student and opportunity');
    }

    const offerNumber = `OFF-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const offer = await PlacementOffer.create({
      offerNumber,
      application: application._id,
      student: application.student,
      user: application.user,
      company: application.opportunity.company,
      opportunity: application.opportunity._id,
      drive: application.drive,
      employmentType: employmentType || application.opportunity.opportunityType,
      compensationPaise: compensationPaise !== undefined ? Number(compensationPaise) : application.opportunity.compensationPaise,
      monthlyStipendPaise: monthlyStipendPaise !== undefined ? Number(monthlyStipendPaise) : application.opportunity.stipendPaise,
      compensationDisplay: (compensationDisplay || application.opportunity.compensationDisplay || '').trim(),
      joiningDate,
      location: (location || application.opportunity.workLocation || '').trim(),
      status: 'issued',
      studentResponse: 'pending',
      issuedBy: req.user._id,
    });

    application.status = 'offered';
    application.statusHistory.push({
      status: 'offered',
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: `Official employment offer issued: ${offerNumber}`,
    });
    await application.save();

    await logAudit('ISSUE_OFFER', 'PlacementOffer', offer._id, req.user._id, { offerNumber });

    // Notify student
    try {
      await notificationService.createNotification({
        recipient: application.user,
        title: 'Congratulations! Official Placement Offer Received',
        message: `You have received an offer (${offerNumber}) from the placement office. Please review and respond.`,
        category: 'placement',
        priority: 'urgent',
      });
    } catch (notifErr) {
      console.warn('Offer notification non-fatal failure:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Placement offer issued successfully',
      data: offer,
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadOfferLetter = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please upload a valid offer letter document (PDF/DOCX)');
    }

    const offer = await PlacementOffer.findById(req.params.id);
    if (!offer) {
      throw new ApiError(404, 'Offer not found');
    }

    offer.offerLetterUrl = req.file.filename;
    offer.offerLetterOriginalName = req.file.originalname;
    await offer.save();

    await logAudit('UPLOAD_OFFER_LETTER', 'PlacementOffer', offer._id, req.user._id, {
      filename: req.file.filename,
    });

    res.json({
      success: true,
      message: 'Offer document uploaded successfully',
      data: {
        offerLetterUrl: offer.offerLetterUrl,
        offerLetterOriginalName: offer.offerLetterOriginalName,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadOfferLetter = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safePath = placementService.resolveSafeDocumentPath('offers', filename);

    // Anti-IDOR Authorization Check
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      const offer = await PlacementOffer.findOne({ student: student._id, offerLetterUrl: filename });
      if (!offer) {
        throw new ApiError(403, 'Access denied: You can only download your own offer letters');
      }
    }

    res.download(safePath, filename);
  } catch (err) {
    next(err);
  }
};

exports.respondToOffer = async (req, res, next) => {
  try {
    const { response, declineReason } = req.body;
    if (!response || !['accepted', 'declined'].includes(response)) {
      throw new ApiError(400, "Response must be either 'accepted' or 'declined'");
    }

    const offer = await PlacementOffer.findById(req.params.id);
    if (!offer) throw new ApiError(404, 'Offer not found');

    // Anti-IDOR: Check student ownership
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (!student || offer.student.toString() !== student._id.toString()) {
        throw new ApiError(403, 'Access denied: You can only respond to your own offers');
      }
    }

    offer.studentResponse = response;
    offer.studentResponseAt = new Date();
    offer.status = response === 'accepted' ? 'accepted' : 'declined';
    if (response === 'declined' && declineReason) {
      offer.studentDeclineReason = declineReason.trim();
    }
    await offer.save();

    // Sync application
    const app = await PlacementApplication.findById(offer.application);
    if (app) {
      app.status = response === 'accepted' ? 'offer_accepted' : 'offer_declined';
      app.statusHistory.push({
        status: app.status,
        changedAt: new Date(),
        changedBy: req.user._id,
        reason: `Student ${response} the offer`,
      });
      await app.save();
    }

    await logAudit('RESPOND_TO_OFFER', 'PlacementOffer', offer._id, req.user._id, { response });

    res.json({
      success: true,
      message: `Offer ${response} successfully`,
      data: offer,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPlacement = async (req, res, next) => {
  try {
    const offer = await PlacementOffer.findById(req.params.id);
    if (!offer) throw new ApiError(404, 'Offer not found');

    offer.isPlacementVerified = true;
    offer.verifiedBy = req.user._id;
    offer.verifiedAt = new Date();
    await offer.save();

    await logAudit('VERIFY_PLACEMENT', 'PlacementOffer', offer._id, req.user._id);

    res.json({
      success: true,
      message: 'Student placement officially verified',
      data: offer,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyOffers = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) throw new ApiError(404, 'Student not found');

    const offers = await PlacementOffer.find({ student: student._id })
      .populate('company', 'name companyCode industry location logoUrl')
      .populate('opportunity', 'title opportunityType compensationDisplay workLocation')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: offers,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllOffers = async (req, res, next) => {
  try {
    const { status, verified, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (verified !== undefined) filter.isPlacementVerified = verified === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    const [offers, total] = await Promise.all([
      PlacementOffer.find(filter)
        .populate('student', 'fullName rollNumber branch semester email phone')
        .populate('company', 'name companyCode industry')
        .populate('opportunity', 'title opportunityCode compensationDisplay')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PlacementOffer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: offers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 8. CAREER DEVELOPMENT RESOURCES
// -------------------------------------------------------------

exports.getCareerResources = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = { isPublished: true };

    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const resources = await CareerResource.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: resources,
    });
  } catch (err) {
    next(err);
  }
};

exports.createCareerResource = async (req, res, next) => {
  try {
    const { title, category, description, resourceType, externalUrl, tags, targetBatches, targetDepartments } = req.body;
    if (!title || !category) {
      throw new ApiError(400, 'Title and category are required');
    }

    const resource = await CareerResource.create({
      title: title.trim(),
      category,
      description: (description || '').trim(),
      resourceType: resourceType || 'article',
      externalUrl: (externalUrl || '').trim(),
      tags: Array.isArray(tags) ? tags : [],
      targetBatches: Array.isArray(targetBatches) ? targetBatches.map(Number) : [],
      targetDepartments: Array.isArray(targetDepartments) ? targetDepartments.map((d) => d.toUpperCase()) : [],
      uploadedBy: req.user._id,
    });

    await logAudit('CREATE_CAREER_RESOURCE', 'CareerResource', resource._id, req.user._id, { title });

    res.status(201).json({
      success: true,
      message: 'Career development resource published',
      data: resource,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// 9. ANALYTICS & CSV EXPORTS
// -------------------------------------------------------------

exports.getMetrics = async (req, res, next) => {
  try {
    const { academicYear } = req.query;
    const metrics = await placementService.getPlacementMetrics({ academicYear });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { type = 'applications', academicYear } = req.query;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=placement-${type}-${Date.now()}.csv`);

    if (type === 'companies') {
      const companies = await Company.find().sort({ name: 1 });
      res.write(placementService.toCsvRow(['Company Code', 'Company Name', 'Industry', 'Location', 'Tier', 'Status', 'Recruiter Email']));
      for (const c of companies) {
        res.write(
          placementService.toCsvRow([
            c.companyCode,
            c.name,
            c.industry,
            c.location,
            c.tier,
            c.status,
            c.recruiterEmail,
          ])
        );
      }
    } else if (type === 'offers') {
      const offers = await PlacementOffer.find()
        .populate('student', 'fullName rollNumber branch')
        .populate('company', 'name')
        .populate('opportunity', 'title')
        .sort({ createdAt: -1 });

      res.write(placementService.toCsvRow(['Offer Number', 'Roll Number', 'Student Name', 'Branch', 'Company', 'Role', 'Status', 'Verified', 'CTC (Display)']));
      for (const o of offers) {
        res.write(
          placementService.toCsvRow([
            o.offerNumber,
            o.student?.rollNumber || '',
            o.student?.fullName || '',
            o.student?.branch || '',
            o.company?.name || '',
            o.opportunity?.title || '',
            o.status,
            o.isPlacementVerified ? 'YES' : 'NO',
            o.compensationDisplay,
          ])
        );
      }
    } else {
      // Default: applications
      const filter = {};
      if (academicYear) filter.academicYear = academicYear;
      const apps = await PlacementApplication.find(filter)
        .populate('student', 'fullName rollNumber branch')
        .populate('opportunity', 'title opportunityCode')
        .sort({ appliedAt: -1 });

      res.write(placementService.toCsvRow(['Application Number', 'Roll Number', 'Student Name', 'Branch', 'Job Code', 'Job Title', 'Status', 'Applied Date']));
      for (const a of apps) {
        res.write(
          placementService.toCsvRow([
            a.applicationNumber,
            a.student?.rollNumber || '',
            a.student?.fullName || '',
            a.student?.branch || '',
            a.opportunity?.opportunityCode || '',
            a.opportunity?.title || '',
            a.status,
            a.appliedAt ? a.appliedAt.toISOString().slice(0, 10) : '',
          ])
        );
      }
    }

    res.end();
  } catch (err) {
    next(err);
  }
};
