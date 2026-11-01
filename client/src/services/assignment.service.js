/**
 * client/src/services/assignment.service.js
 * Frontend API client for assignments, submissions, grading, and file transfers.
 */
import api from './api';

export const assignmentService = {
  // ── Faculty APIs ────────────────────────────────────────────────────────────
  createAssignment: async (formData) => {
    const response = await api.post('/api/assignments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getFacultyAssignments: async (params = {}) => {
    const response = await api.get('/api/assignments/faculty', { params });
    return response.data;
  },

  getFacultyDashboard: async (params = {}) => {
    const response = await api.get('/api/assignments/faculty/dashboard', { params });
    return response.data;
  },

  getFacultyTaughtSubjects: async () => {
    const response = await api.get('/api/assignments/faculty/subjects');
    return response.data;
  },

  getAssignmentById: async (id) => {
    const response = await api.get(`/api/assignments/${id}`);
    return response.data;
  },

  updateAssignment: async (id, data) => {
    const response = await api.patch(`/api/assignments/${id}`, data);
    return response.data;
  },

  publishAssignment: async (id) => {
    const response = await api.post(`/api/assignments/${id}/publish`);
    return response.data;
  },

  closeAssignment: async (id) => {
    const response = await api.post(`/api/assignments/${id}/close`);
    return response.data;
  },

  getAssignmentSubmissions: async (id) => {
    const response = await api.get(`/api/assignments/${id}/submissions`);
    return response.data;
  },

  evaluateSubmission: async (submissionId, data) => {
    const response = await api.post(`/api/assignments/submissions/${submissionId}/evaluate`, data);
    return response.data;
  },

  publishSubmissionResult: async (submissionId) => {
    const response = await api.post(`/api/assignments/submissions/${submissionId}/publish-result`);
    return response.data;
  },

  // ── Student APIs ────────────────────────────────────────────────────────────
  getStudentAssignments: async (params = {}) => {
    const response = await api.get('/api/assignments/student', { params });
    return response.data;
  },

  getStudentAssignmentDetails: async (id) => {
    const response = await api.get(`/api/assignments/student/${id}`);
    return response.data;
  },

  submitAssignment: async (id, formData) => {
    const response = await api.post(`/api/assignments/${id}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ── Secure Download Helpers ─────────────────────────────────────────────────
  downloadAttachment: async (assignmentId, attachmentId, originalName = 'attachment') => {
    const response = await api.get(`/api/assignments/${assignmentId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadSubmissionFile: async (submissionId, fileId, originalName = 'submission') => {
    const response = await api.get(`/api/submissions/${submissionId}/files/${fileId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // ── Admin APIs ──────────────────────────────────────────────────────────────
  getAdminOverview: async (params = {}) => {
    const response = await api.get('/api/assignments/admin/overview', { params });
    return response.data;
  },
};

export default assignmentService;
