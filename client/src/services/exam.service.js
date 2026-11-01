/**
 * client/src/services/exam.service.js
 * Frontend API client for Examination Management, Marks Entry, Approval & Publication.
 */
import api from './api';

export const examService = {
  // ── Examination Scheduling & Management ─────────────────────────────────────
  createExam: async (examData) => {
    const response = await api.post('/api/exams', examData);
    return response.data;
  },

  getFacultyExams: async (params = {}) => {
    const response = await api.get('/api/exams/faculty', { params });
    return response.data;
  },

  getExamById: async (id) => {
    const response = await api.get(`/api/exams/${id}`);
    return response.data;
  },

  updateExam: async (id, data) => {
    const response = await api.patch(`/api/exams/${id}`, data);
    return response.data;
  },

  cancelExam: async (id) => {
    const response = await api.post(`/api/exams/${id}/cancel`);
    return response.data;
  },

  getExamRoster: async (id) => {
    const response = await api.get(`/api/exams/${id}/roster`);
    return response.data;
  },

  // ── Marks Entry & Approval Lifecycle ────────────────────────────────────────
  saveDraftMarks: async (id, payload) => {
    const response = await api.post(`/api/exams/${id}/marks/draft`, payload);
    return response.data;
  },

  submitMarksForReview: async (id) => {
    const response = await api.post(`/api/exams/${id}/marks/submit`);
    return response.data;
  },

  reviewAndApproveMarks: async (id) => {
    const response = await api.post(`/api/exams/${id}/marks/approve`);
    return response.data;
  },

  publishExamResults: async (id) => {
    const response = await api.post(`/api/exams/${id}/results/publish`);
    return response.data;
  },

  requestMarksCorrection: async (id, reason) => {
    const response = await api.post(`/api/exams/${id}/marks/request-correction`, { reason });
    return response.data;
  },

  // ── Audited Mark Correction ─────────────────────────────────────────────────
  correctPublishedMark: async (markId, data) => {
    const response = await api.post(`/api/exams/marks/${markId}/correct`, data);
    return response.data;
  },

  // ── Student Endpoints ───────────────────────────────────────────────────────
  getStudentSchedule: async () => {
    const response = await api.get('/api/exams/student/schedule');
    return response.data;
  },

  getStudentResults: async () => {
    const response = await api.get('/api/exams/student/results');
    return response.data;
  },

  // ── Admin Oversight ─────────────────────────────────────────────────────────
  getAdminOverview: async (params = {}) => {
    const response = await api.get('/api/exams/admin/overview', { params });
    return response.data;
  },
};

export default examService;

