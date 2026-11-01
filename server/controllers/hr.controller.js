/**
 * server/controllers/hr.controller.js
 * Controller handling Institutional HR, Employee Directory, Leaves, Attendance,
 * Documents, Schedules, Training, Announcements, and Analytics.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmploymentHistory = require('../models/EmploymentHistory');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');
const EmployeeLeaveApplication = require('../models/EmployeeLeaveApplication');
const EmployeeWorkSchedule = require('../models/EmployeeWorkSchedule');
const EmployeeAttendance = require('../models/EmployeeAttendance');
const EmployeeDocument = require('../models/EmployeeDocument');
const HRAnnouncement = require('../models/HRAnnouncement');
const EmployeeTrainingRecord = require('../models/EmployeeTrainingRecord');
const HRAuditLog = require('../models/HRAuditLog');
const User = require('../models/User');

const { hrService, HR_UPLOADS } = require('../services/hr.service');
const notificationService = require('../services/notification.service');

// Helper to get authenticated user ID
const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

// ============================================================================
// 1. DEPARTMENTS & DESIGNATIONS
// ============================================================================

exports.getDepartments = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const departments = await Department.find(filter)
      .populate('headOfDepartment', 'name email role')
      .sort({ name: 1 });

    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, type, description, headOfDepartment } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and unique department code are required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Department.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Department code ${cleanCode} already exists` });
    }

    const dept = await Department.create({
      name: name.trim(),
      code: cleanCode,
      type: type || 'academic',
      description: description || '',
      headOfDepartment: headOfDepartment || null
    });

    await hrService.logHRAudit({
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: dept._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { name: dept.name, code: dept.code },
      req
    });

    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, headOfDepartment, isActive } = req.body;

    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (name) dept.name = name.trim();
    if (type) dept.type = type;
    if (description !== undefined) dept.description = description;
    if (headOfDepartment !== undefined) dept.headOfDepartment = headOfDepartment || null;
    if (isActive !== undefined) dept.isActive = isActive;

    await dept.save();

    await hrService.logHRAudit({
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: dept._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { name: dept.name, isActive: dept.isActive },
      req
    });

    res.status(200).json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDesignations = async (req, res) => {
  try {
    const { department, category, isActive } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const designations = await Designation.find(filter)
      .populate('department', 'name code')
      .sort({ reportingLevel: 1, title: 1 });

    res.status(200).json({ success: true, count: designations.length, data: designations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDesignation = async (req, res) => {
  try {
    const { title, name, code, category, department, reportingLevel, description } = req.body;
    const finalName = (title || name || '').trim();
    if (!finalName || !code || !category) {
      return res.status(400).json({ success: false, message: 'Title/Name, unique code, and category are required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Designation.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Designation code ${cleanCode} already exists` });
    }

    const desig = await Designation.create({
      name: finalName,
      title: finalName,
      code: cleanCode,
      category,
      department: department || null,
      reportingLevel: reportingLevel || 1
    });

    await hrService.logHRAudit({
      action: 'DESIGNATION_CREATED',
      entityType: 'Designation',
      entityId: desig._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { title: desig.title, code: desig.code },
      req
    });

    res.status(201).json({ success: true, data: desig });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, department, reportingLevel, description, isActive } = req.body;

    const desig = await Designation.findById(id);
    if (!desig) {
      return res.status(404).json({ success: false, message: 'Designation not found' });
    }

    if (title) desig.title = title.trim();
    if (category) desig.category = category;
    if (department !== undefined) desig.department = department || null;
    if (reportingLevel !== undefined) desig.reportingLevel = reportingLevel;
    if (description !== undefined) desig.description = description;
    if (isActive !== undefined) desig.isActive = isActive;

    await desig.save();

    res.status(200).json({ success: true, data: desig });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 2. EMPLOYEE DIRECTORY & PROFILES
// ============================================================================

exports.getEmployees = async (req, res) => {
  try {
    const {
      department,
      designation,
      category,
      employmentStatus,
      onboardingStatus,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    if (department) filter.department = department;
    if (designation) filter.designation = designation;
    if (category) filter.employeeCategory = category;
    if (employmentStatus) filter.employmentStatus = employmentStatus;
    if (onboardingStatus) filter.onboardingStatus = onboardingStatus;

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { employeeId: regex },
        { officialEmail: regex }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const employees = await EmployeeProfile.find(filter)
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .populate('reportingManager', 'name email role')
      .populate('user', 'name email role')
      .sort({ employeeId: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await EmployeeProfile.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: employees.length,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      data: employees
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { employeeId: id.toUpperCase() }] } : { employeeId: id.toUpperCase() };

    const employee = await EmployeeProfile.findOne(query)
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .populate('reportingManager', 'name email role')
      .populate('user', 'name email role')
      .populate('verifiedBy', 'name email');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId })
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .populate('reportingManager', 'name email role')
      .populate('user', 'name email role');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'No employee profile linked to your user account' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const {
      employeeId,
      user,
      firstName,
      lastName,
      displayName,
      officialEmail,
      personalEmail,
      phone,
      emergencyContact,
      employeeCategory,
      department,
      designation,
      employmentType,
      employmentStatus,
      joiningDate,
      reportingManager,
      workLocation,
      qualifications
    } = req.body;

    if (!firstName || !lastName || !officialEmail || !employeeCategory || !department || !designation || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, official email, category, department, designation, and joining date are required'
      });
    }

    // Determine or generate employeeId
    const finalEmployeeId = employeeId ? employeeId.toUpperCase().trim() : await hrService.generateEmployeeId();

    const existingId = await EmployeeProfile.findOne({ employeeId: finalEmployeeId });
    if (existingId) {
      return res.status(400).json({ success: false, message: `Employee ID ${finalEmployeeId} already exists` });
    }

    // Resolve User: either passed or find by email or create
    let linkedUserId = user;
    if (!linkedUserId) {
      const existingUser = await User.findOne({ email: officialEmail.toLowerCase().trim() });
      if (existingUser) {
        linkedUserId = existingUser._id;
      } else {
        // Create user account for employee with default temporary credentials
        const bcrypt = require('bcryptjs');
        const defaultPassword = await bcrypt.hash('Campus@123', 10);
        const role = employeeCategory === 'teaching_faculty' ? 'faculty' : 'employee';
        const newUser = await User.create({
          name: `${firstName} ${lastName}`.trim(),
          email: officialEmail.toLowerCase().trim(),
          password: defaultPassword,
          role,
          mustChangePassword: true
        });
        linkedUserId = newUser._id;
      }
    }

    const existingUserLink = await EmployeeProfile.findOne({ user: linkedUserId });
    if (existingUserLink) {
      return res.status(400).json({
        success: false,
        message: `User is already linked to employee profile ${existingUserLink.employeeId}`
      });
    }

    const employee = await EmployeeProfile.create({
      employeeId: finalEmployeeId,
      user: linkedUserId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName: displayName || `${firstName} ${lastName}`,
      officialEmail: officialEmail.toLowerCase().trim(),
      personalEmail: personalEmail || '',
      phone: phone || '',
      emergencyContact: emergencyContact || {},
      employeeCategory,
      department,
      designation,
      employmentType: employmentType || 'permanent',
      employmentStatus: employmentStatus || 'active',
      joiningDate: new Date(joiningDate),
      reportingManager: reportingManager || null,
      workLocation: workLocation || 'Main Campus',
      qualifications: qualifications || [],
      onboardingStatus: 'pending'
    });

    // Automatically initialize leave balances for current year
    try {
      await hrService.initializeLeaveBalancesForEmployee(employee._id, new Date().getFullYear(), getUserId(req));
    } catch (balanceErr) {
      console.warn('Initial leave balance setup warning:', balanceErr.message);
    }

    // Record Employment History & Audit
    await EmploymentHistory.create({
      employee: employee._id,
      changeType: 'onboarding',
      effectiveDate: employee.joiningDate,
      reason: 'Initial Employee Onboarding',
      authorizedBy: getUserId(req)
    });

    await hrService.logHRAudit({
      action: 'EMPLOYEE_CREATED',
      entityType: 'EmployeeProfile',
      entityId: employee._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { employeeId: employee.employeeId, email: employee.officialEmail },
      req
    });

    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeProfile.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const userId = getUserId(req);
    const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);
    const isSelf = employee.user.toString() === userId?.toString();

    if (!isHrOrAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this profile' });
    }

    const {
      firstName,
      lastName,
      displayName,
      phone,
      emergencyContact,
      workLocation,
      qualifications,
      department,
      designation,
      reportingManager,
      employmentType,
      employmentStatus
    } = req.body;

    // Self updates: phone, emergency contact, qualifications, displayName
    if (phone !== undefined) employee.phone = phone;
    if (emergencyContact !== undefined) employee.emergencyContact = emergencyContact;
    if (qualifications !== undefined) employee.qualifications = qualifications;
    if (displayName !== undefined) employee.displayName = displayName;

    // HR/Admin privileged updates
    if (isHrOrAdmin) {
      if (firstName) employee.firstName = firstName.trim();
      if (lastName) employee.lastName = lastName.trim();
      if (workLocation !== undefined) employee.workLocation = workLocation;
      if (department !== undefined) employee.department = department;
      if (designation !== undefined) employee.designation = designation;
      if (reportingManager !== undefined) employee.reportingManager = reportingManager || null;
      if (employmentType !== undefined) employee.employmentType = employmentType;
      if (employmentStatus !== undefined) employee.employmentStatus = employmentStatus;
    }

    await employee.save();

    await hrService.logHRAudit({
      action: 'EMPLOYEE_UPDATED',
      entityType: 'EmployeeProfile',
      entityId: employee._id,
      performedBy: userId,
      performedByRole: req.user?.role,
      details: { employeeId: employee.employeeId },
      req
    });

    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeProfile.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    employee.onboardingStatus = 'verified';
    employee.verifiedBy = getUserId(req);
    employee.verifiedAt = new Date();
    await employee.save();

    await hrService.logHRAudit({
      action: 'ONBOARDING_VERIFIED',
      entityType: 'EmployeeProfile',
      entityId: employee._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { employeeId: employee.employeeId },
      req
    });

    res.status(200).json({ success: true, message: 'Employee onboarding verified successfully', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmProbation = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeProfile.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const previousStatus = employee.employmentStatus;
    employee.employmentStatus = 'confirmed';
    employee.confirmationDate = new Date();
    await employee.save();

    await EmploymentHistory.create({
      employee: employee._id,
      changeType: 'confirmation',
      previousValue: previousStatus,
      newValue: 'confirmed',
      effectiveDate: employee.confirmationDate,
      reason: req.body.reason || 'Successful completion of probation period',
      authorizedBy: getUserId(req)
    });

    await hrService.logHRAudit({
      action: 'PROBATION_CONFIRMED',
      entityType: 'EmployeeProfile',
      entityId: employee._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { employeeId: employee.employeeId, confirmationDate: employee.confirmationDate },
      req
    });

    res.status(200).json({ success: true, message: 'Employee probation confirmed', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.transferEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDepartment, newDesignation, newReportingManager, changeType, effectiveDate, reason } = req.body;

    const employee = await EmployeeProfile.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const prevDept = employee.department;
    const prevDesig = employee.designation;

    if (newDepartment) employee.department = newDepartment;
    if (newDesignation) employee.designation = newDesignation;
    if (newReportingManager !== undefined) employee.reportingManager = newReportingManager || null;

    await employee.save();

    await EmploymentHistory.create({
      employee: employee._id,
      changeType: changeType || 'transfer',
      previousValue: `Dept: ${prevDept}, Desig: ${prevDesig}`,
      newValue: `Dept: ${employee.department}, Desig: ${employee.designation}`,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      reason: reason || 'Departmental reorganization / promotion',
      authorizedBy: getUserId(req)
    });

    res.status(200).json({ success: true, message: 'Employee transfer / promotion recorded', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.separateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { separationType, reason, effectiveDate } = req.body;

    const employee = await EmployeeProfile.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const validStatus = ['resigned', 'retired', 'terminated', 'inactive'];
    const targetStatus = validStatus.includes(separationType) ? separationType : 'resigned';

    employee.employmentStatus = targetStatus;
    employee.separationDetails = {
      date: effectiveDate ? new Date(effectiveDate) : new Date(),
      reason: reason || '',
      separationType: targetStatus,
      approvedBy: getUserId(req)
    };
    await employee.save();

    await EmploymentHistory.create({
      employee: employee._id,
      changeType: targetStatus === 'terminated' ? 'termination' : 'resignation',
      previousValue: 'active',
      newValue: targetStatus,
      effectiveDate: employee.separationDetails.date,
      reason: reason || 'Employment ended',
      authorizedBy: getUserId(req)
    });

    res.status(200).json({ success: true, message: 'Employee separation processed', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 3. LEAVE POLICIES & BALANCES
// ============================================================================

exports.getLeavePolicies = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const filter = {};
    if (category) filter.applicableCategory = { $in: ['all', category] };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const policies = await LeavePolicy.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, count: policies.length, data: policies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLeavePolicy = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      annualEntitlement,
      applicableCategory,
      accrualFrequency,
      maxConsecutiveDays,
      minNoticeDays,
      carryForwardMax,
      encashable,
      requiresAttachmentBeyondDays,
      allowNegativeBalance
    } = req.body;

    if (!name || !code || annualEntitlement === undefined) {
      return res.status(400).json({ success: false, message: 'Name, unique code, and annual entitlement are required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await LeavePolicy.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Leave policy code ${cleanCode} already exists` });
    }

    const policy = await LeavePolicy.create({
      name: name.trim(),
      code: cleanCode,
      description: description || '',
      annualEntitlement: Number(annualEntitlement),
      applicableCategory: applicableCategory || 'all',
      accrualFrequency: accrualFrequency || 'annual',
      maxConsecutiveDays: maxConsecutiveDays || 30,
      minNoticeDays: minNoticeDays || 0,
      carryForwardMax: carryForwardMax || 0,
      encashable: encashable || false,
      requiresAttachmentBeyondDays: requiresAttachmentBeyondDays || 3,
      allowNegativeBalance: allowNegativeBalance || false
    });

    res.status(201).json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLeavePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await LeavePolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Leave policy not found' });
    }

    const fields = [
      'name',
      'description',
      'annualEntitlement',
      'applicableCategory',
      'accrualFrequency',
      'maxConsecutiveDays',
      'minNoticeDays',
      'carryForwardMax',
      'encashable',
      'requiresAttachmentBeyondDays',
      'allowNegativeBalance',
      'isActive'
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) policy[f] = req.body[f];
    });

    await policy.save();
    res.status(200).json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEmployeeLeaveBalances = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);

    let employee = null;
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      employee = await EmployeeProfile.findById(employeeId);
    }
    if (!employee) {
      employee = await EmployeeProfile.findOne({ employeeId: employeeId.toUpperCase() });
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    let balances = await EmployeeLeaveBalance.find({
      employee: employee._id,
      year
    }).populate('policy');

    // If no balances found, initialize them dynamically
    if (balances.length === 0) {
      balances = await hrService.initializeLeaveBalancesForEmployee(employee._id, year, getUserId(req));
      balances = await EmployeeLeaveBalance.find({
        employee: employee._id,
        year
      }).populate('policy');
    }

    res.status(200).json({ success: true, year, count: balances.length, data: balances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyLeaveBalances = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'No employee profile linked to user account' });
    }

    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    let balances = await EmployeeLeaveBalance.find({
      employee: employee._id,
      year
    }).populate('policy');

    if (balances.length === 0) {
      balances = await hrService.initializeLeaveBalancesForEmployee(employee._id, year, userId);
      balances = await EmployeeLeaveBalance.find({
        employee: employee._id,
        year
      }).populate('policy');
    }

    res.status(200).json({ success: true, year, count: balances.length, data: balances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.adjustLeaveBalance = async (req, res) => {
  try {
    const { employeeId, policyId, year, adjustmentDays, reason, notes } = req.body;
    if (!employeeId || !policyId || adjustmentDays === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, policy ID, adjustmentDays, and reason are required'
      });
    }

    const targetYear = parseInt(year || new Date().getFullYear(), 10);
    const days = Number(adjustmentDays);

    const balanceRecord = await EmployeeLeaveBalance.findOne({
      employee: employeeId,
      policy: policyId,
      year: targetYear
    });

    if (!balanceRecord) {
      return res.status(404).json({ success: false, message: 'Leave balance record not found' });
    }

    const previousBalance = balanceRecord.currentBalance;
    const newBalance = previousBalance + days;

    balanceRecord.adjusted += days;
    balanceRecord.currentBalance = newBalance;
    await balanceRecord.save();

    const entryNumber = await hrService.generateNumber('LED');
    const ledgerEntry = await LeaveLedgerEntry.create({
      entryNumber,
      employee: employeeId,
      policy: policyId,
      year: targetYear,
      type: days >= 0 ? 'CREDIT' : 'DEBIT',
      reason: 'administrative_adjustment',
      days: Math.abs(days),
      previousBalance,
      newBalance,
      performedBy: getUserId(req),
      notes: notes || reason
    });

    res.status(200).json({ success: true, data: { balance: balanceRecord, ledgerEntry } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLeaveLedger = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { policyId, year } = req.query;

    const filter = { employee: employeeId };
    if (policyId) filter.policy = policyId;
    if (year) filter.year = parseInt(year, 10);

    const entries = await LeaveLedgerEntry.find(filter)
      .populate('policy', 'name code')
      .populate('performedBy', 'name role')
      .populate('referenceApplication', 'applicationNumber status')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: entries.length, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 4. LEAVE APPLICATIONS & WORKFLOW APPROVALS
// ============================================================================

exports.getLeaveApplications = async (req, res) => {
  try {
    const { status, employeeId, department, year, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (employeeId) filter.employee = employeeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const applications = await EmployeeLeaveApplication.find(filter)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName officialEmail department designation user',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'designation', select: 'title code' }
        ]
      })
      .populate('policy', 'name code annualEntitlement')
      .populate('approvalWorkflow.reviewer', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await EmployeeLeaveApplication.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: applications.length,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      data: applications
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyLeaveApplications = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'No employee profile linked to user account' });
    }

    const applications = await EmployeeLeaveApplication.find({ employee: employee._id })
      .populate('policy', 'name code')
      .populate('approvalWorkflow.reviewer', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: applications.length, data: applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.applyForLeave = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { policy, startDate, endDate, isHalfDay, halfDayType, reason, contactDuringLeave } = req.body;

    if (!policy || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave policy, start date, end date, and reason are required'
      });
    }

    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found for this user' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date' });
    }
    if (start > end) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
    }

    const totalDays = hrService.calculateLeaveDays(start, end, !!isHalfDay);
    if (totalDays <= 0) {
      return res.status(400).json({ success: false, message: 'Calculated leave duration is 0 days' });
    }

    const leavePolicy = await LeavePolicy.findById(policy);
    if (!leavePolicy || !leavePolicy.isActive) {
      return res.status(400).json({ success: false, message: 'Selected leave policy is inactive or invalid' });
    }

    if (leavePolicy.maxConsecutiveDays && totalDays > leavePolicy.maxConsecutiveDays) {
      return res.status(400).json({
        success: false,
        message: `Maximum consecutive days allowed for ${leavePolicy.name} is ${leavePolicy.maxConsecutiveDays} days`
      });
    }

    // Balance check
    const currentYear = start.getFullYear();
    const balanceRecord = await EmployeeLeaveBalance.findOne({
      employee: employee._id,
      policy: leavePolicy._id,
      year: currentYear
    });

    if (!balanceRecord) {
      return res.status(400).json({
        success: false,
        message: `No active leave balance record for policy ${leavePolicy.code} in year ${currentYear}`
      });
    }

    if (!leavePolicy.allowNegativeBalance && balanceRecord.currentBalance < totalDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Available: ${balanceRecord.currentBalance}, Requested: ${totalDays}`
      });
    }

    // Overlapping check
    const overlapping = await EmployeeLeaveApplication.findOne({
      employee: employee._id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: `An overlapping leave application (${overlapping.applicationNumber}) already exists in this period`
      });
    }

    const applicationNumber = await hrService.generateNumber('LV');
    const application = await EmployeeLeaveApplication.create({
      applicationNumber,
      employee: employee._id,
      policy: leavePolicy._id,
      startDate: start,
      endDate: end,
      totalDays,
      isHalfDay: !!isHalfDay,
      halfDayType: isHalfDay ? halfDayType || 'first_half' : null,
      reason: reason.trim(),
      contactDuringLeave: contactDuringLeave || '',
      status: 'pending'
    });

    await hrService.logHRAudit({
      action: 'LEAVE_APPLICATION_SUBMITTED',
      entityType: 'EmployeeLeaveApplication',
      entityId: application._id,
      performedBy: userId,
      performedByRole: req.user?.role,
      details: { applicationNumber: application.applicationNumber, totalDays },
      req
    });

    res.status(201).json({ success: true, data: application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reviewLeaveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments, rejectionReason } = req.body; // action: 'approve' | 'reject'
    const reviewerUserId = getUserId(req);

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject"' });
    }

    const application = await EmployeeLeaveApplication.findById(id)
      .populate('employee')
      .populate('policy');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status} and cannot be reviewed again`
      });
    }

    // =========================================================================
    // SEPARATION OF DUTIES ENFORCEMENT
    // An applicant CANNOT approve their own leave application!
    // =========================================================================
    if (application.employee.user.toString() === reviewerUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Separation of duties violation: You cannot approve or review your own leave application'
      });
    }

    const currentYear = new Date(application.startDate).getFullYear();

    if (action === 'approve') {
      // 1. Deduct leave balance atomically using double-entry ledger
      await hrService.deductLeaveBalance({
        employeeId: application.employee._id,
        policyId: application.policy._id,
        year: currentYear,
        days: application.totalDays,
        application,
        user: reviewerUserId,
        reason: 'leave_taken'
      });

      // 2. Synchronize employee daily attendance
      await hrService.syncApprovedLeaveAttendance({
        employeeId: application.employee._id,
        startDate: application.startDate,
        endDate: application.endDate,
        application,
        isHalfDay: application.isHalfDay
      });

      application.status = 'approved';
      application.approvalWorkflow.push({
        step: 1,
        role: req.user?.role || 'reviewer',
        reviewer: reviewerUserId,
        action: 'approved',
        comments: comments || 'Leave application approved',
        actionAt: new Date()
      });

      await application.save();

      // Notify employee
      try {
        await notificationService.createNotification({
          recipient: application.employee.user,
          title: 'Leave Application Approved',
          message: `Your leave application ${application.applicationNumber} for ${application.totalDays} day(s) has been approved.`,
          category: 'leave',
          priority: 'normal',
          relatedEntityType: 'EmployeeLeaveApplication',
          relatedEntityId: application._id
        });
      } catch (notifErr) {
        console.warn('Leave approval notification warning:', notifErr.message);
      }

      await hrService.logHRAudit({
        action: 'LEAVE_APPLICATION_APPROVED',
        entityType: 'EmployeeLeaveApplication',
        entityId: application._id,
        performedBy: reviewerUserId,
        performedByRole: req.user?.role,
        details: { applicationNumber: application.applicationNumber, totalDays: application.totalDays },
        req
      });

      return res.status(200).json({ success: true, message: 'Leave application approved successfully', data: application });
    } else {
      // Reject
      if (!rejectionReason && !comments) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      application.status = 'rejected';
      application.rejectionReason = rejectionReason || comments;
      application.approvalWorkflow.push({
        step: 1,
        role: req.user?.role || 'reviewer',
        reviewer: reviewerUserId,
        action: 'rejected',
        comments: rejectionReason || comments,
        actionAt: new Date()
      });

      await application.save();

      // Notify employee
      try {
        await notificationService.createNotification({
          recipient: application.employee.user,
          title: 'Leave Application Rejected',
          message: `Your leave application ${application.applicationNumber} was rejected: ${application.rejectionReason}`,
          category: 'leave',
          priority: 'high',
          relatedEntityType: 'EmployeeLeaveApplication',
          relatedEntityId: application._id
        });
      } catch (notifErr) {
        console.warn('Leave rejection notification warning:', notifErr.message);
      }

      await hrService.logHRAudit({
        action: 'LEAVE_APPLICATION_REJECTED',
        entityType: 'EmployeeLeaveApplication',
        entityId: application._id,
        performedBy: reviewerUserId,
        performedByRole: req.user?.role,
        details: { applicationNumber: application.applicationNumber, reason: application.rejectionReason },
        req
      });

      return res.status(200).json({ success: true, message: 'Leave application rejected', data: application });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelLeaveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const application = await EmployeeLeaveApplication.findById(id).populate('employee');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Leave application not found' });
    }

    const isOwner = application.employee.user.toString() === userId.toString();
    const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);

    if (!isOwner && !isHrOrAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this application' });
    }

    if (['cancelled', 'rejected'].includes(application.status)) {
      return res.status(400).json({ success: false, message: `Application is already ${application.status}` });
    }

    // If it was already approved, refund leave balance and revert attendance
    if (application.status === 'approved') {
      const currentYear = new Date(application.startDate).getFullYear();
      await hrService.refundLeaveBalance({
        employeeId: application.employee._id,
        policyId: application.policy,
        year: currentYear,
        days: application.totalDays,
        application,
        user: userId,
        reason: 'cancellation_refund'
      });

      await hrService.revertApprovedLeaveAttendance({
        employeeId: application.employee._id,
        applicationId: application._id
      });
    }

    application.status = 'cancelled';
    await application.save();

    await hrService.logHRAudit({
      action: 'LEAVE_APPLICATION_CANCELLED',
      entityType: 'EmployeeLeaveApplication',
      entityId: application._id,
      performedBy: userId,
      performedByRole: req.user?.role,
      details: { applicationNumber: application.applicationNumber },
      req
    });

    res.status(200).json({ success: true, message: 'Leave application cancelled successfully', data: application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 5. EMPLOYEE ATTENDANCE & DAILY ROSTER
// ============================================================================

exports.checkIn = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const today = new Date().toISOString().split('T')[0];

    let attendance = await EmployeeAttendance.findOne({
      employee: employee._id,
      date: today
    });

    if (attendance && attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for today',
        data: attendance
      });
    }

    const now = new Date();
    // Default shift start 09:30 AM with 15 min grace period
    const shiftStart = new Date();
    shiftStart.setHours(9, 30, 0, 0);
    const graceLimit = new Date(shiftStart.getTime() + 15 * 60 * 1000);

    let status = 'present';
    if (now > graceLimit) {
      status = 'late';
    }

    if (!attendance) {
      attendance = new EmployeeAttendance({
        employee: employee._id,
        date: today
      });
    }

    attendance.checkIn = now;
    attendance.status = status;
    attendance.verificationMethod = req.body?.verificationMethod || 'web_portal';
    attendance.ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '';
    await attendance.save();

    res.status(200).json({ success: true, message: 'Checked in successfully', data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const today = new Date().toISOString().split('T')[0];

    const attendance = await EmployeeAttendance.findOne({
      employee: employee._id,
      date: today
    });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today. Please check in first.'
      });
    }

    const now = new Date();
    attendance.checkOut = now;

    const diffHours = (now.getTime() - new Date(attendance.checkIn).getTime()) / (1000 * 60 * 60);
    attendance.workingHours = Math.round(diffHours * 100) / 100;

    await attendance.save();

    res.status(200).json({ success: true, message: 'Checked out successfully', data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const userId = getUserId(req);
    const employee = await EmployeeProfile.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const { month, year } = req.query;
    const targetYear = parseInt(year || new Date().getFullYear(), 10);
    const targetMonth = parseInt(month || new Date().getMonth() + 1, 10);

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const attendances = await EmployeeAttendance.find({
      employee: employee._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.status(200).json({ success: true, count: attendances.length, data: attendances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendanceRoster = async (req, res) => {
  try {
    const { date, department, status } = req.query;
    const targetDateStr = date
      ? (typeof date === 'string' && date.includes('T') ? date.split('T')[0] : String(date))
      : new Date().toISOString().split('T')[0];

    const matchQuery = { date: targetDateStr };
    if (status) matchQuery.status = status;

    const attendances = await EmployeeAttendance.find(matchQuery)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName officialEmail department designation',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'designation', select: 'title code' }
        ]
      })
      .populate('approvedLeave', 'applicationNumber');

    // Filter by department if requested
    let filtered = attendances;
    if (department) {
      filtered = attendances.filter(
        (a) => a.employee?.department?._id?.toString() === department.toString()
      );
    }

    res.status(200).json({ success: true, count: filtered.length, date: targetDate, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.correctAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, checkIn, checkOut, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Correction reason is mandatory for audit logging' });
    }

    const attendance = await EmployeeAttendance.findById(id).populate('employee');
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const previousData = {
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      workingHours: attendance.workingHours
    };

    if (status) attendance.status = status;
    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) attendance.checkOut = new Date(checkOut);

    if (attendance.checkIn && attendance.checkOut) {
      const diffHours =
        (new Date(attendance.checkOut).getTime() - new Date(attendance.checkIn).getTime()) / (1000 * 60 * 60);
      attendance.workingHours = Math.round(diffHours * 100) / 100;
    }

    attendance.correctionHistory.push({
      previousStatus: previousData.status,
      newStatus: attendance.status,
      correctedBy: getUserId(req),
      reason: reason.trim(),
      correctedAt: new Date()
    });

    await attendance.save();

    await hrService.logHRAudit({
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'EmployeeAttendance',
      entityId: attendance._id,
      performedBy: getUserId(req),
      performedByRole: req.user?.role,
      details: { previous: previousData, current: attendance.status, reason },
      req
    });

    res.status(200).json({ success: true, message: 'Attendance corrected successfully', data: attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 6. WORK SCHEDULES & SHIFTS
// ============================================================================

exports.getWorkSchedules = async (req, res) => {
  try {
    const schedules = await EmployeeWorkSchedule.find().sort({ name: 1 });
    res.status(200).json({ success: true, count: schedules.length, data: schedules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createWorkSchedule = async (req, res) => {
  try {
    const {
      name,
      code,
      shiftType,
      startTime,
      endTime,
      gracePeriodMinutes,
      halfDayThresholdHours,
      fullDayThresholdHours,
      weeklyOffDays
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Schedule name and code are required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await EmployeeWorkSchedule.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Schedule code ${cleanCode} already exists` });
    }

    const schedule = await EmployeeWorkSchedule.create({
      name: name.trim(),
      code: cleanCode,
      shiftType: shiftType || 'general',
      startTime: startTime || '09:00',
      endTime: endTime || '17:30',
      gracePeriodMinutes: gracePeriodMinutes || 15,
      halfDayThresholdHours: halfDayThresholdHours || 4,
      fullDayThresholdHours: fullDayThresholdHours || 8,
      weeklyOffDays: weeklyOffDays || [0, 6] // Sun, Sat default
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 7. EMPLOYEE DOCUMENTS REPOSITORY
// ============================================================================

exports.uploadDocument = async (req, res) => {
  try {
    const { employeeId, documentType, title, isConfidential, notes } = req.body;
    if (!employeeId || !documentType || !title || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, document type, title, and uploaded file are required'
      });
    }

    const employee = await EmployeeProfile.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const userId = getUserId(req);
    const isOwner = employee.user.toString() === userId.toString();
    const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);

    if (!isOwner && !isHrOrAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to upload documents for this employee' });
    }

    const documentNumber = await hrService.generateNumber('DOC');
    const doc = await EmployeeDocument.create({
      documentNumber,
      employee: employee._id,
      documentType,
      title: title.trim(),
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      isConfidential: isConfidential === 'true' || isConfidential === true,
      uploadedBy: userId,
      notes: notes || ''
    });

    await hrService.logHRAudit({
      action: 'DOCUMENT_UPLOADED',
      entityType: 'EmployeeDocument',
      entityId: doc._id,
      performedBy: userId,
      performedByRole: req.user?.role,
      details: { documentNumber: doc.documentNumber, title: doc.title },
      req
    });

    res.status(201).json({ success: true, message: 'Document uploaded successfully', data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await EmployeeProfile.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const userId = getUserId(req);
    const isOwner = employee.user.toString() === userId.toString();
    const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);

    if (!isOwner && !isHrOrAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view documents for this employee' });
    }

    const filter = { employee: employee._id };
    // Non-HR users cannot view confidential documents
    if (!isHrOrAdmin) {
      filter.isConfidential = false;
    }

    const documents = await EmployeeDocument.find(filter)
      .populate('uploadedBy', 'name role')
      .populate('verifiedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: documents.length, data: documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await EmployeeDocument.findById(id).populate('employee');
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const userId = getUserId(req);
    const isOwner = doc.employee.user.toString() === userId.toString();
    const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);

    if (!isOwner && !isHrOrAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to access this document' });
    }

    if (doc.isConfidential && !isHrOrAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: confidential document' });
    }

    // Path traversal defense: resolve path strictly relative to HR_UPLOADS
    const safePath = path.resolve(HR_UPLOADS, path.basename(doc.fileName));
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'Physical document file missing on server' });
    }

    res.download(safePath, doc.title || doc.fileName);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await EmployeeDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    doc.isVerified = true;
    doc.verifiedBy = getUserId(req);
    doc.verifiedAt = new Date();
    await doc.save();

    res.status(200).json({ success: true, message: 'Document verified successfully', data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 8. HR ANNOUNCEMENTS & TRAINING RECORDS
// ============================================================================

exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await HRAnnouncement.find({ isActive: true })
      .populate('publishedBy', 'name role')
      .populate('targetDepartment', 'name code')
      .sort({ publishDate: -1 });

    res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetAudience, targetDepartment, priority, expiryDate } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const announcementNumber = await hrService.generateNumber('HRA');
    const announcement = await HRAnnouncement.create({
      announcementNumber,
      title: title.trim(),
      content: content.trim(),
      targetAudience: targetAudience || 'all',
      targetDepartment: targetDepartment || null,
      priority: priority || 'medium',
      publishedBy: getUserId(req),
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.acknowledgeAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const announcement = await HRAnnouncement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const alreadyAcked = announcement.acknowledgedBy.some((a) => a.user.toString() === userId.toString());
    if (!alreadyAcked) {
      announcement.acknowledgedBy.push({ user: userId, at: new Date() });
      await announcement.save();
    }

    res.status(200).json({ success: true, message: 'Announcement acknowledged', data: announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTrainingRecords = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const filter = {};
    if (employeeId) filter.employee = employeeId;

    const trainings = await EmployeeTrainingRecord.find(filter)
      .populate('employee', 'employeeId firstName lastName')
      .populate('recordedBy', 'name role')
      .sort({ startDate: -1 });

    res.status(200).json({ success: true, count: trainings.length, data: trainings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTrainingRecord = async (req, res) => {
  try {
    const {
      employee,
      title,
      category,
      organizer,
      startDate,
      endDate,
      durationHours,
      status,
      scoreOrGrade,
      feedback
    } = req.body;

    if (!employee || !title || !organizer || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Employee, title, organizer, start date, and end date are required'
      });
    }

    const trainingNumber = await hrService.generateNumber('TRN');
    const record = await EmployeeTrainingRecord.create({
      trainingNumber,
      employee,
      title: title.trim(),
      category: category || 'technical_skill',
      organizer: organizer.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      durationHours: Number(durationHours) || 0,
      status: status || 'completed',
      scoreOrGrade: scoreOrGrade || '',
      feedback: feedback || '',
      recordedBy: getUserId(req)
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================================
// 9. DASHBOARD ANALYTICS & CSV EXPORTS
// ============================================================================

exports.getDashboardMetrics = async (req, res) => {
  try {
    const metrics = await hrService.getHRDashboardMetrics();
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportEmployeesCsv = async (req, res) => {
  try {
    const employees = await EmployeeProfile.find()
      .populate('department', 'name code')
      .populate('designation', 'title code')
      .sort({ employeeId: 1 });

    const csvContent = hrService.generateEmployeeDirectoryCsv(employees);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campus_employees.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportLeavesCsv = async (req, res) => {
  try {
    const applications = await EmployeeLeaveApplication.find()
      .populate('employee', 'employeeId firstName lastName')
      .populate('policy', 'name code')
      .sort({ createdAt: -1 });

    const csvContent = hrService.generateLeaveApplicationsCsv(applications);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leave_applications.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
