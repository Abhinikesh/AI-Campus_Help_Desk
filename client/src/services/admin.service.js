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
};
