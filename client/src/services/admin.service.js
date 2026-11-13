import api from './api';

export const adminService = {
  getStats: async () => {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/api/admin/users');
    return response.data;
  },
  getComplaints: async () => {
    const response = await api.get('/api/admin/complaints');
    return response.data;
  },
  updateComplaintStatus: async (id, status) => {
    const response = await api.patch(`/api/admin/complaints/${id}/status`, { status });
    return response.data;
  },
  createAnnouncement: async (data) => {
    const response = await api.post('/api/admin/announcements', data);
    return response.data;
  },
  deactivateUser: async (id) => {
    const response = await api.delete(`/api/admin/users/${id}`);
    return response.data;
  },

  // ── Phase 3.6: Staging Student Management ──────────────────────────────────
  getStagingStats: async () => {
    const response = await api.get('/api/admin/staging/students/stats');
    return response.data;
  },
  searchStagingStudents: async (q) => {
    const response = await api.get('/api/admin/staging/students/search', { params: { q } });
    return response.data;
  },
  listStagingStudents: async ({ search, page, limit, classification } = {}) => {
    const response = await api.get('/api/admin/staging/students', {
      params: { search, page, limit, classification },
    });
    return response.data;
  },
  getStagingStudentDetail: async (rollNumber) => {
    const response = await api.get(`/api/admin/staging/students/${encodeURIComponent(rollNumber)}`);
    return response.data;
  },

  // Phase 3.7: Enrollment Verification Workflow
  getEnrollmentStats: async () => {
    const response = await api.get('/api/admin/staging/enrollment/stats');
    return response.data;
  },
  listEnrollmentVerifications: async ({ search, status, page, limit } = {}) => {
    const response = await api.get('/api/admin/staging/enrollment', {
      params: { search, status, page, limit },
    });
    return response.data;
  },
  getEnrollmentDetail: async (rollNumber) => {
    const response = await api.get(`/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}`);
    return response.data;
  },
  getEnrollmentHistory: async (rollNumber) => {
    const response = await api.get(`/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}/history`);
    return response.data;
  },
  createPendingEnrollment: async (rollNumber) => {
    const response = await api.post('/api/admin/staging/enrollment', { rollNumber });
    return response.data;
  },
  recordEnrollmentEvidence: async (rollNumber, data) => {
    const response = await api.patch(
      `/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}/evidence`,
      data
    );
    return response.data;
  },
  approveEnrollment: async (rollNumber, data) => {
    const response = await api.patch(
      `/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}/approve`,
      data
    );
    return response.data;
  },
  rejectEnrollment: async (rollNumber, data) => {
    const response = await api.patch(
      `/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}/reject`,
      data
    );
    return response.data;
  },
  requestEnrollmentReview: async (rollNumber, data) => {
    const response = await api.patch(
      `/api/admin/staging/enrollment/${encodeURIComponent(rollNumber)}/review`,
      data
    );
    return response.data;
  },
};
