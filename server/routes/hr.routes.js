/**
 * server/routes/hr.routes.js
 * Express routes for Institutional HR, Employee Directory, Leaves, Attendance, and Documents.
 */
'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const hrController = require('../controllers/hr.controller');
const { uploadHrDocument } = require('../services/hr.service');

// All HR routes require authentication and strictly exclude students
const HR_STAFF_ROLES = ['admin', 'hr_admin', 'hr_officer', 'department_head', 'faculty', 'employee'];
const HR_MANAGERS = ['admin', 'hr_admin', 'hr_officer'];
const HR_APPROVERS = ['admin', 'hr_admin', 'hr_officer', 'department_head'];

router.use(authMiddleware);
router.use(allowRoles(...HR_STAFF_ROLES));

// ============================================================================
// 1. DASHBOARD & EXPORTS
// ============================================================================
router.get('/dashboard/metrics', allowRoles(...HR_MANAGERS), hrController.getDashboardMetrics);
router.get('/export/employees', allowRoles(...HR_MANAGERS), hrController.exportEmployeesCsv);
router.get('/export/leaves', allowRoles(...HR_MANAGERS), hrController.exportLeavesCsv);

// ============================================================================
// 2. DEPARTMENTS & DESIGNATIONS
// ============================================================================
router.get('/departments', hrController.getDepartments);
router.post('/departments', allowRoles('admin', 'hr_admin'), hrController.createDepartment);
router.put('/departments/:id', allowRoles('admin', 'hr_admin'), hrController.updateDepartment);

router.get('/designations', hrController.getDesignations);
router.post('/designations', allowRoles('admin', 'hr_admin'), hrController.createDesignation);
router.put('/designations/:id', allowRoles('admin', 'hr_admin'), hrController.updateDesignation);

// ============================================================================
// 3. EMPLOYEE DIRECTORY & PROFILES
// ============================================================================
router.get('/employees/me', hrController.getMyProfile);
router.get('/employees', allowRoles(...HR_MANAGERS, 'department_head'), hrController.getEmployees);
router.get('/employees/:id', hrController.getEmployeeById);
router.post('/employees', allowRoles(...HR_MANAGERS), hrController.createEmployee);
router.put('/employees/:id', hrController.updateEmployee);

// Lifecycle Transitions
router.patch('/employees/:id/verify-onboarding', allowRoles(...HR_MANAGERS), hrController.verifyOnboarding);
router.patch('/employees/:id/confirm-probation', allowRoles(...HR_MANAGERS), hrController.confirmProbation);
router.patch('/employees/:id/transfer', allowRoles(...HR_MANAGERS), hrController.transferEmployee);
router.patch('/employees/:id/separate', allowRoles(...HR_MANAGERS), hrController.separateEmployee);

// ============================================================================
// 4. LEAVE POLICIES & BALANCES
// ============================================================================
router.get('/leave-policies', hrController.getLeavePolicies);
router.post('/leave-policies', allowRoles('admin', 'hr_admin'), hrController.createLeavePolicy);
router.put('/leave-policies/:id', allowRoles('admin', 'hr_admin'), hrController.updateLeavePolicy);

router.get('/leaves/my-balances', hrController.getMyLeaveBalances);
router.get('/leaves/balances/:employeeId', allowRoles(...HR_MANAGERS, 'department_head'), hrController.getEmployeeLeaveBalances);
router.post('/leaves/adjust-balance', allowRoles('admin', 'hr_admin'), hrController.adjustLeaveBalance);
router.get('/leaves/ledger/:employeeId', allowRoles(...HR_MANAGERS), hrController.getLeaveLedger);

// ============================================================================
// 5. LEAVE APPLICATIONS & APPROVALS
// ============================================================================
router.get('/leaves/my-applications', hrController.getMyLeaveApplications);
router.post('/leaves/apply', hrController.applyForLeave);
router.get('/leaves/applications', allowRoles(...HR_MANAGERS, 'department_head'), hrController.getLeaveApplications);
router.patch('/leaves/applications/:id/review', allowRoles(...HR_APPROVERS), hrController.reviewLeaveApplication);
router.patch('/leaves/applications/:id/cancel', hrController.cancelLeaveApplication);

// ============================================================================
// 6. EMPLOYEE ATTENDANCE & SHIFTS
// ============================================================================
router.post('/attendance/check-in', hrController.checkIn);
router.post('/attendance/check-out', hrController.checkOut);
router.get('/attendance/my-attendance', hrController.getMyAttendance);
router.get('/attendance/roster', allowRoles(...HR_MANAGERS, 'department_head'), hrController.getAttendanceRoster);
router.patch('/attendance/:id/correct', allowRoles(...HR_APPROVERS), hrController.correctAttendance);

router.get('/schedules', hrController.getWorkSchedules);
router.post('/schedules', allowRoles('admin', 'hr_admin'), hrController.createWorkSchedule);

// ============================================================================
// 7. EMPLOYEE DOCUMENTS
// ============================================================================
router.post('/documents/upload', uploadHrDocument.single('file'), hrController.uploadDocument);
router.get('/documents/employee/:employeeId', hrController.getEmployeeDocuments);
router.get('/documents/:id/download', hrController.downloadDocument);
router.patch('/documents/:id/verify', allowRoles(...HR_MANAGERS), hrController.verifyDocument);

// ============================================================================
// 8. ANNOUNCEMENTS & TRAINING
// ============================================================================
router.get('/announcements', hrController.getAnnouncements);
router.post('/announcements', allowRoles('admin', 'hr_admin'), hrController.createAnnouncement);
router.post('/announcements/:id/acknowledge', hrController.acknowledgeAnnouncement);

router.get('/training/employee/:employeeId', hrController.getTrainingRecords);
router.post('/training', allowRoles(...HR_MANAGERS), hrController.createTrainingRecord);

module.exports = router;
