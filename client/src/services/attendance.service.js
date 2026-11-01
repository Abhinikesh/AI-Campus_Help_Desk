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

  grantConsent: async (data = { consentGiven: true }) => {
    const res = await api.post('/api/student/face/consent', data);
    return res.data;
  },

  enrollFace: async (data) => {
    const res = await api.post('/api/student/face/enroll', data);
    return res.data;
  },

  requestReEnrollment: async (reason) => {
    const res = await api.post('/api/student/face/re-enroll', { reason });
    return res.data;
  },

  revokeFace: async () => {
    const res = await api.post('/api/student/face/revoke');
    return res.data;
  },

  purgeBulkEnrollments: async (data) => {
    const res = await api.post('/api/admin/attendance/face-enrollments/purge-bulk', data);
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

  getQrChallenge: async (sessionId) => {
    const res = await api.get(`/api/attendance/sessions/${sessionId}/qr-challenge`);
    return res.data;
  },

  pauseSession: async (sessionId, reason = 'Paused by instructor') => {
    try {
      const res = await api.post(`/api/attendance/sessions/${sessionId}/pause`, { reason });
      return res.data;
    } catch (e) {
      const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/pause`, { reason });
      return res.data;
    }
  },

  resumeSession: async (sessionId, reason = 'Resumed by instructor') => {
    try {
      const res = await api.post(`/api/attendance/sessions/${sessionId}/resume`, { reason });
      return res.data;
    } catch (e) {
      const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/resume`, { reason });
      return res.data;
    }
  },

  closeSession: async (sessionId, reason = 'Class lecture concluded') => {
    try {
      const res = await api.post(`/api/attendance/sessions/${sessionId}/end`, { reason });
      return res.data;
    } catch (e) {
      const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/close`, { reason });
      return res.data;
    }
  },

  finalizeSession: async (sessionId, reason = 'Roster confirmed and finalized') => {
    try {
      const res = await api.post(`/api/attendance/sessions/${sessionId}/finalize`, { reason });
      return res.data;
    } catch (e) {
      const res = await api.patch(`/api/faculty/attendance/sessions/${sessionId}/finalize`, { reason });
      return res.data;
    }
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
