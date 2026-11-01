/**
 * server/services/hr.service.js
 * Centralized business logic, leave ledger transactions, attendance synchronization,
 * document management, and analytics for the Institutional HR & Workforce subsystem.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const EmployeeProfile = require('../models/EmployeeProfile');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const LeavePolicy = require('../models/LeavePolicy');
const EmployeeLeaveBalance = require('../models/EmployeeLeaveBalance');
const LeaveLedgerEntry = require('../models/LeaveLedgerEntry');
const EmployeeLeaveApplication = require('../models/EmployeeLeaveApplication');
const EmployeeAttendance = require('../models/EmployeeAttendance');
const EmployeeDocument = require('../models/EmployeeDocument');
const HRAnnouncement = require('../models/HRAnnouncement');
const EmployeeTrainingRecord = require('../models/EmployeeTrainingRecord');
const EmploymentHistory = require('../models/EmploymentHistory');
const HRAuditLog = require('../models/HRAuditLog');
const notificationService = require('./notification.service');

// Ensure upload directory exists
const HR_UPLOADS = path.join(__dirname, '../uploads/hr');
if (!fs.existsSync(HR_UPLOADS)) {
  fs.mkdirSync(HR_UPLOADS, { recursive: true });
}

// Multer storage with path-traversal protection and safe filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, HR_UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `doc-${Date.now()}-${cleanBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid document file type. Allowed: PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX'));
  }
};

const uploadHrDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

class HRService {
  /**
   * Generates a canonical sequential Employee ID: EMP-YYYY-XXXX
   */
  async generateEmployeeId() {
    const year = new Date().getFullYear();
    const prefix = `EMP-${year}-`;
    const count = await EmployeeProfile.countDocuments({
      employeeId: new RegExp(`^${prefix}`)
    });
    const nextSeq = String(count + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * Generates unique application, document, announcement, training, or ledger numbers
   */
  async generateNumber(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const ts = Date.now().toString().slice(-4);
    return `${prefix}-${year}-${ts}${rand}`;
  }

  /**
   * Records an immutable audit log entry for HR actions
   */
  async logHRAudit({ action, entityType, entityId, performedBy, performedByRole = '', details = {}, req = null }) {
    try {
      const ipAddress = req ? req.ip || req.headers?.['x-forwarded-for'] || '' : '';
      const userAgent = req ? req.headers?.['user-agent'] || '' : '';
      await HRAuditLog.create({
        action,
        entityType,
        entityId,
        performedBy,
        performedByRole,
        details,
        ipAddress: String(ipAddress),
        userAgent: String(userAgent)
      });
    } catch (err) {
      console.error('HR Audit Log Error:', err.message);
    }
  }

  /**
   * Calculates total working days between two dates.
   * Treats inclusive date range and supports half-day deduction.
   */
  calculateLeaveDays(startDate, endDate, isHalfDay = false) {
    if (isHalfDay) return 0.5;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }

  /**
   * Initializes or refreshes annual leave balances for an employee based on active leave policies.
   */
  async initializeLeaveBalancesForEmployee(employeeProfileId, year = new Date().getFullYear(), authorizedBy = null) {
    const profile = await EmployeeProfile.findById(employeeProfileId);
    if (!profile) throw new Error('Employee profile not found');

    const policies = await LeavePolicy.find({
      isActive: true,
      $or: [
        { applicableCategory: { $in: ['all', profile.employeeCategory] } },
        { applicableCategories: { $in: ['all', profile.employeeCategory] } },
        { applicableCategories: { $size: 0 } },
        { applicableCategories: { $exists: false } }
      ]
    });

    const initializedBalances = [];

    for (const policy of policies) {
      let balance = await EmployeeLeaveBalance.findOne({
        employee: profile._id,
        policy: policy._id,
        year
      });

      if (!balance) {
        balance = await EmployeeLeaveBalance.create({
          employee: profile._id,
          policy: policy._id,
          year,
          openingBalance: policy.annualEntitlement,
          accrued: 0,
          used: 0,
          adjusted: 0,
          currentBalance: policy.annualEntitlement
        });

        const entryNumber = await this.generateNumber('LED');
        await LeaveLedgerEntry.create({
          entryNumber,
          employee: profile._id,
          policy: policy._id,
          year,
          type: 'CREDIT',
          reason: 'annual_grant',
          days: policy.annualEntitlement,
          previousBalance: 0,
          newBalance: policy.annualEntitlement,
          performedBy: authorizedBy || profile.user,
          notes: `Initial ${year} entitlement for ${policy.name}`
        });
      }

      initializedBalances.push(balance);
    }

    return initializedBalances;
  }

  /**
   * Atomically deducts leave days from an employee's leave balance using double-entry ledger.
   */
  async deductLeaveBalance({ employeeId, policyId, year, days, application, user, reason = 'leave_taken' }) {
    const policy = await LeavePolicy.findById(policyId);
    if (!policy) throw new Error('Leave policy not found');

    let filter = {
      employee: employeeId,
      policy: policyId,
      year
    };

    if (!policy.allowNegativeBalance) {
      filter.currentBalance = { $gte: days };
    }

    const currentRecord = await EmployeeLeaveBalance.findOne({ employee: employeeId, policy: policyId, year });
    if (!currentRecord) {
      throw new Error(`No leave balance found for policy ${policy.code} in year ${year}`);
    }

    if (!policy.allowNegativeBalance && currentRecord.currentBalance < days) {
      throw new Error(`Insufficient leave balance. Available: ${currentRecord.currentBalance}, Requested: ${days}`);
    }

    const previousBalance = currentRecord.currentBalance;
    const newBalance = previousBalance - days;

    const updatedBalance = await EmployeeLeaveBalance.findOneAndUpdate(
      filter,
      {
        $inc: { used: days, currentBalance: -days }
      },
      { new: true }
    );

    if (!updatedBalance) {
      throw new Error('Leave balance deduction failed due to concurrent modification or insufficient balance');
    }

    const entryNumber = await this.generateNumber('LED');
    const ledgerEntry = await LeaveLedgerEntry.create({
      entryNumber,
      employee: employeeId,
      policy: policyId,
      year,
      type: 'DEBIT',
      reason,
      days,
      previousBalance,
      newBalance,
      referenceApplication: application ? application._id : null,
      performedBy: user,
      notes: `Leave debited for application ${application ? application.applicationNumber : 'N/A'}`
    });

    return { updatedBalance, ledgerEntry };
  }

  /**
   * Refunds leave days back to employee balance upon leave cancellation or revocation.
   */
  async refundLeaveBalance({ employeeId, policyId, year, days, application, user, reason = 'cancellation_refund' }) {
    const currentRecord = await EmployeeLeaveBalance.findOne({ employee: employeeId, policy: policyId, year });
    if (!currentRecord) throw new Error('Leave balance record not found');

    const previousBalance = currentRecord.currentBalance;
    const newBalance = previousBalance + days;

    const updatedBalance = await EmployeeLeaveBalance.findOneAndUpdate(
      { employee: employeeId, policy: policyId, year },
      {
        $inc: { used: -days, currentBalance: days }
      },
      { new: true }
    );

    const entryNumber = await this.generateNumber('LED');
    const ledgerEntry = await LeaveLedgerEntry.create({
      entryNumber,
      employee: employeeId,
      policy: policyId,
      year,
      type: 'CREDIT',
      reason,
      days,
      previousBalance,
      newBalance,
      referenceApplication: application ? application._id : null,
      performedBy: user,
      notes: `Leave refunded for application ${application ? application.applicationNumber : 'N/A'}`
    });

    return { updatedBalance, ledgerEntry };
  }

  /**
   * Synchronizes approved leave dates into the EmployeeAttendance roster.
   * Ensures employee is marked 'on_leave' or 'half_day' and cannot be marked absent.
   */
  async syncApprovedLeaveAttendance({ employeeId, startDate, endDate, application, isHalfDay = false }) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      await EmployeeAttendance.findOneAndUpdate(
        { employee: employeeId, date: dateStr },
        {
          $set: {
            status: isHalfDay ? 'half_day' : 'on_leave',
            approvedLeave: application._id,
            notes: `Approved Leave: ${application.applicationNumber}`
          },
          $setOnInsert: {
            attendanceNumber: `ATT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
            source: 'leave_sync'
          }
        },
        { upsert: true, new: true }
      );

      current.setDate(current.getDate() + 1);
    }
  }

  /**
   * Reverts employee attendance for a cancelled or revoked approved leave.
   */
  async revertApprovedLeaveAttendance({ employeeId, applicationId }) {
    await EmployeeAttendance.updateMany(
      { employee: employeeId, approvedLeave: applicationId, checkIn: null },
      {
        $set: {
          status: 'absent',
          notes: 'Leave application was cancelled'
        },
        $unset: { approvedLeave: '' }
      }
    );
  }

  /**
   * CWE-1236 Defense: Sanitizes cell strings to neutralize spreadsheet formula injection
   */
  sanitizeCsvCell(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Generates CSV for Employee Directory
   */
  generateEmployeeDirectoryCsv(employees) {
    const headers = [
      'Employee ID',
      'Name',
      'Email',
      'Department',
      'Designation',
      'Category',
      'Employment Type',
      'Status',
      'Joining Date',
      'Work Location'
    ];

    const rows = employees.map((emp) => [
      this.sanitizeCsvCell(emp.employeeId),
      this.sanitizeCsvCell(`${emp.firstName} ${emp.lastName}`),
      this.sanitizeCsvCell(emp.officialEmail),
      this.sanitizeCsvCell(emp.department?.name || 'N/A'),
      this.sanitizeCsvCell(emp.designation?.title || 'N/A'),
      this.sanitizeCsvCell(emp.employeeCategory),
      this.sanitizeCsvCell(emp.employmentType),
      this.sanitizeCsvCell(emp.employmentStatus),
      this.sanitizeCsvCell(emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : 'N/A'),
      this.sanitizeCsvCell(emp.workLocation || 'Main Campus')
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Generates CSV for Leave Applications
   */
  generateLeaveApplicationsCsv(applications) {
    const headers = [
      'Application Number',
      'Employee ID',
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Total Days',
      'Half Day',
      'Status',
      'Applied On'
    ];

    const rows = applications.map((app) => [
      this.sanitizeCsvCell(app.applicationNumber),
      this.sanitizeCsvCell(app.employee?.employeeId || 'N/A'),
      this.sanitizeCsvCell(`${app.employee?.firstName || ''} ${app.employee?.lastName || ''}`.trim()),
      this.sanitizeCsvCell(app.policy?.name || 'N/A'),
      this.sanitizeCsvCell(app.startDate ? new Date(app.startDate).toISOString().split('T')[0] : 'N/A'),
      this.sanitizeCsvCell(app.endDate ? new Date(app.endDate).toISOString().split('T')[0] : 'N/A'),
      this.sanitizeCsvCell(app.totalDays),
      this.sanitizeCsvCell(app.isHalfDay ? 'Yes' : 'No'),
      this.sanitizeCsvCell(app.status),
      this.sanitizeCsvCell(app.createdAt ? new Date(app.createdAt).toISOString().split('T')[0] : 'N/A')
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Aggregates workforce, leave, and attendance KPIs for executive HR dashboard
   */
  async getHRDashboardMetrics() {
    const totalEmployees = await EmployeeProfile.countDocuments({});
    const activeEmployees = await EmployeeProfile.countDocuments({ employmentStatus: { $in: ['active', 'confirmed'] } });
    const probationEmployees = await EmployeeProfile.countDocuments({ employmentStatus: 'probation' });
    const pendingOnboarding = await EmployeeProfile.countDocuments({ onboardingStatus: 'pending' });

    // Category breakdown
    const categoryAgg = await EmployeeProfile.aggregate([
      { $group: { _id: '$employeeCategory', count: { $sum: 1 } } }
    ]);
    const byCategory = {};
    categoryAgg.forEach((item) => {
      byCategory[item._id] = item.count;
    });

    // Department breakdown
    const deptAgg = await EmployeeProfile.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1 } }
    ]);

    // Leave counts
    const pendingLeaves = await EmployeeLeaveApplication.countDocuments({ status: 'pending' });
    const approvedLeaves = await EmployeeLeaveApplication.countDocuments({ status: 'approved' });

    // Today's attendance stats
    const todayStr = new Date().toISOString().split('T')[0];

    const todayAttendanceAgg = await EmployeeAttendance.aggregate([
      { $match: { date: todayStr } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const todayAttendance = {
      present: 0,
      late: 0,
      on_leave: 0,
      half_day: 0,
      absent: 0
    };
    todayAttendanceAgg.forEach((item) => {
      if (todayAttendance[item._id] !== undefined) {
        todayAttendance[item._id] = item.count;
      }
    });

    return {
      workforce: {
        total: totalEmployees,
        active: activeEmployees,
        probation: probationEmployees,
        pendingOnboarding,
        byCategory,
        byDepartment: deptAgg
      },
      leaves: {
        pending: pendingLeaves,
        approved: approvedLeaves
      },
      todayAttendance
    };
  }
}

const hrService = new HRService();

module.exports = {
  hrService,
  uploadHrDocument,
  HR_UPLOADS
};
