/**
 * client/src/services/hr.service.js
 * Axios API client for CampusSphere AI Institutional HR, Employee Directory, Leaves & Workforce.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/hr',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('campus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const hrService = {
  // Metrics & Dashboard
  getDashboardMetrics: async () => {
    const res = await api.get('/dashboard/metrics');
    return res.data;
  },

  // Departments & Designations
  getDepartments: async (params = {}) => {
    const res = await api.get('/departments', { params });
    return res.data;
  },
  createDepartment: async (data) => {
    const res = await api.post('/departments', data);
    return res.data;
  },
  updateDepartment: async (id, data) => {
    const res = await api.put(`/departments/${id}`, data);
    return res.data;
  },

  getDesignations: async (params = {}) => {
    const res = await api.get('/designations', { params });
    return res.data;
  },
  createDesignation: async (data) => {
    const res = await api.post('/designations', data);
    return res.data;
  },
  updateDesignation: async (id, data) => {
    const res = await api.put(`/designations/${id}`, data);
    return res.data;
  },

  // Employee Directory & Profiles
  getEmployees: async (params = {}) => {
    const res = await api.get('/employees', { params });
    return res.data;
  },
  getEmployeeById: async (id) => {
    const res = await api.get(`/employees/${id}`);
    return res.data;
  },
  getMyProfile: async () => {
    const res = await api.get('/employees/me');
    return res.data;
  },
  createEmployee: async (data) => {
    const res = await api.post('/employees', data);
    return res.data;
  },
  updateEmployee: async (id, data) => {
    const res = await api.put(`/employees/${id}`, data);
    return res.data;
  },
  verifyOnboarding: async (id) => {
    const res = await api.patch(`/employees/${id}/verify-onboarding`);
    return res.data;
  },
  confirmProbation: async (id, data = {}) => {
    const res = await api.patch(`/employees/${id}/confirm-probation`, data);
    return res.data;
  },
  transferEmployee: async (id, data) => {
    const res = await api.patch(`/employees/${id}/transfer`, data);
    return res.data;
  },
  separateEmployee: async (id, data) => {
    const res = await api.patch(`/employees/${id}/separate`, data);
    return res.data;
  },

  // Leave Policies & Balances
  getLeavePolicies: async (params = {}) => {
    const res = await api.get('/leave-policies', { params });
    return res.data;
  },
  createLeavePolicy: async (data) => {
    const res = await api.post('/leave-policies', data);
    return res.data;
  },
  updateLeavePolicy: async (id, data) => {
    const res = await api.put(`/leave-policies/${id}`, data);
    return res.data;
  },
  getMyLeaveBalances: async (params = {}) => {
    const res = await api.get('/leaves/my-balances', { params });
    return res.data;
  },
  getEmployeeLeaveBalances: async (employeeId, params = {}) => {
    const res = await api.get(`/leaves/balances/${employeeId}`, { params });
    return res.data;
  },
  adjustLeaveBalance: async (data) => {
    const res = await api.post('/leaves/adjust-balance', data);
    return res.data;
  },
  getLeaveLedger: async (employeeId, params = {}) => {
    const res = await api.get(`/leaves/ledger/${employeeId}`, { params });
    return res.data;
  },

  // Leave Applications & Approvals
  applyForLeave: async (data) => {
    const res = await api.post('/leaves/apply', data);
    return res.data;
  },
  getMyLeaveApplications: async () => {
    const res = await api.get('/leaves/my-applications');
    return res.data;
  },
  getLeaveApplications: async (params = {}) => {
    const res = await api.get('/leaves/applications', { params });
    return res.data;
  },
  reviewLeaveApplication: async (id, data) => {
    const res = await api.patch(`/leaves/applications/${id}/review`, data);
    return res.data;
  },
  cancelLeaveApplication: async (id) => {
    const res = await api.patch(`/leaves/applications/${id}/cancel`);
    return res.data;
  },

  // Employee Attendance & Shifts
  checkIn: async (data = {}) => {
    const res = await api.post('/attendance/check-in', data);
    return res.data;
  },
  checkOut: async () => {
    const res = await api.post('/attendance/check-out');
    return res.data;
  },
  getMyAttendance: async (params = {}) => {
    const res = await api.get('/attendance/my-attendance', { params });
    return res.data;
  },
  getAttendanceRoster: async (params = {}) => {
    const res = await api.get('/attendance/roster', { params });
    return res.data;
  },
  correctAttendance: async (id, data) => {
    const res = await api.patch(`/attendance/${id}/correct`, data);
    return res.data;
  },

  // Work Schedules
  getWorkSchedules: async () => {
    const res = await api.get('/schedules');
    return res.data;
  },
  createWorkSchedule: async (data) => {
    const res = await api.post('/schedules', data);
    return res.data;
  },

  // Employee Documents
  uploadDocument: async (formData) => {
    const res = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getEmployeeDocuments: async (employeeId) => {
    const res = await api.get(`/documents/employee/${employeeId}`);
    return res.data;
  },
  verifyDocument: async (id) => {
    const res = await api.patch(`/documents/${id}/verify`);
    return res.data;
  },
  downloadDocumentUrl: (id) => `/api/hr/documents/${id}/download`,

  // Announcements & Training
  getAnnouncements: async () => {
    const res = await api.get('/announcements');
    return res.data;
  },
  createAnnouncement: async (data) => {
    const res = await api.post('/announcements', data);
    return res.data;
  },
  acknowledgeAnnouncement: async (id) => {
    const res = await api.post(`/announcements/${id}/acknowledge`);
    return res.data;
  },

  getTrainingRecords: async (employeeId) => {
    const res = await api.get(`/training/employee/${employeeId}`);
    return res.data;
  },
  createTrainingRecord: async (data) => {
    const res = await api.post('/training', data);
    return res.data;
  },

  // CSV Exports
  exportEmployeesCsvUrl: () => '/api/hr/export/employees',
  exportLeavesCsvUrl: () => '/api/hr/export/leaves',
};

export default hrService;
