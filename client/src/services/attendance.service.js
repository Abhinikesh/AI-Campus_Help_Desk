/**
 * client/src/services/attendance.service.js
 * Centralized API service for CampusSphere AI Smart Attendance.
 */
import api from './api';

export const attendanceService = {
  // ── Student Attendance APIs ──────────────────────────────────
  getStudentAttendance: async () => {
    const res = await api.get('/api/student/attendance');
    return res.data;
  },

  getStudentAttendanceHistory: async (params = {}) => {
    const res = await api.get('/api/student/attendance/history', { params });
    return res.data;
  },

  getStudentActiveSessions: async () => {
    const res = await api.get('/api/student/attendance/sessions');
    return res.data;
  },

  joinAttendanceSession: async (sessionId, data = {}) => {
    const res = await api.post(`/api/student/attendance/join/${sessionId}`, data);
    return res.data;
  },

  getFaceStatus: async () => {
    const res = await api.get('/api/student/face/status');
    return res.data;
  },

  enrollFace: async (data) => {
    const res = await api.post('/api/student/face/enroll', data);
    return res.data;
  },

  revokeFace: async () => {
    const res = await api.post('/api/student/face/revoke');
    return res.data;
  },

  // ── Faculty Attendance APIs ──────────────────────────────────
  getFacultyTimetable: async () => {
    const res = await api.get('/api/faculty/timetable');
    return res.data;
  },

  createSession: async (data) => {
    const res = await api.post('/api/faculty/attendance/sessions', data);
    return res.data;
  },

  getFacultySessions: async () => {
    const res = await api.get('/api/faculty/attendance/sessions');
    return res.data;
  },

  getSessionDetails: async (sessionId) => {
    const res = await api.get(`/api/faculty/attendance/sessions/${sessionId}`);
    return res.data;
  },

  closeSession: async (sessionId) => {
    const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/close`);
    return res.data;
  },

  finalizeSession: async (sessionId) => {
    const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/finalize`);
    return res.data;
  },

  updateStudentAttendance: async (data) => {
    const res = await api.post('/api/faculty/attendance/mark-student', data);
    return res.data;
  },

  getFacultyRecords: async (params = {}) => {
    const res = await api.get('/api/faculty/attendance/records', { params });
    return res.data;
  },

  getFacultyReports: async () => {
    const res = await api.get('/api/faculty/attendance/reports');
    return res.data;
  },

  // ── Admin Attendance APIs ────────────────────────────────────
  getAdminOverview: async () => {
    const res = await api.get('/api/admin/attendance/overview');
    return res.data;
  },

  getAdminSessions: async (params = {}) => {
    const res = await api.get('/api/admin/attendance/sessions', { params });
    return res.data;
  },

  getAdminRecords: async (params = {}) => {
    const res = await api.get('/api/admin/attendance/records', { params });
    return res.data;
  },

  getAdminFaceEnrollments: async () => {
    const res = await api.get('/api/admin/attendance/face-enrollments');
    return res.data;
  },

  deleteFaceEnrollment: async (studentId) => {
    const res = await api.delete(`/api/admin/attendance/face-enrollments/${studentId}`);
    return res.data;
  },

  getAdminAnalytics: async () => {
    const res = await api.get('/api/admin/attendance/analytics');
    return res.data;
  },

  getAdminSettings: async () => {
    const res = await api.get('/api/admin/attendance/settings');
    return res.data;
  },

  updateAdminSettings: async (data) => {
    const res = await api.put('/api/admin/attendance/settings', data);
    return res.data;
  },
};

export default attendanceService;
