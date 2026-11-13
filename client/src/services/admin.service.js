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

  // Phase 3.8: Controlled Verified Student Promotion
  getPromotionStats: async () => {
    const response = await api.get('/api/admin/staging/promotion/stats');
    return response.data;
  },
  getPromotionPreview: async (rollNumber) => {
    const response = await api.get(`/api/admin/staging/promotion/preview/${encodeURIComponent(rollNumber)}`);
    return response.data;
  },
  promoteStudent: async (rollNumber) => {
    const response = await api.post(`/api/admin/staging/promotion/${encodeURIComponent(rollNumber)}`);
    return response.data;
  },
  getPromotionHistory: async (rollNumber) => {
    const response = await api.get('/api/admin/staging/promotion/history', {
      params: { rollNumber },
    });
    return response.data;
  },

  // ── Phase 3.9A/B: Enrollment Register Import ──────────────────────────────
  listLocalRegisterFiles: async () => {
    const response = await api.get('/api/admin/staging/register/local-files');
    return response.data;
  },
  loadLocalRegisterFile: async (filename) => {
    const response = await api.post('/api/admin/staging/register/load-local', { filename });
    return response.data;
  },
  uploadEnrollmentRegister: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/admin/staging/register/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  previewRegisterMapping: async (importId, columnMapping) => {
    const response = await api.post(`/api/admin/staging/register/preview/${importId}`, { columnMapping });
    return response.data;
  },
  executeRegisterImport: async (importId, columnMapping) => {
    const response = await api.post(`/api/admin/staging/register/import/${importId}`, { columnMapping });
    return response.data;
  },
  listRegisterImports: async ({ page, limit } = {}) => {
    const response = await api.get('/api/admin/staging/register/imports', { params: { page, limit } });
    return response.data;
  },
  getRegisterImportDetail: async (importId) => {
    const response = await api.get(`/api/admin/staging/register/imports/${importId}`);
    return response.data;
  },
  getRegisterImportRows: async (importId, { status, page, limit } = {}) => {
    const response = await api.get(`/api/admin/staging/register/imports/${importId}/rows`, {
      params: { status, page, limit },
    });
    return response.data;
  },
  getRegisterRowDetail: async (rowId) => {
    const response = await api.get(`/api/admin/staging/register/rows/${rowId}`);
    return response.data;
  },
  reviewRegisterRowEvidence: async (rowId, { decision, remarks }) => {
    const response = await api.patch(`/api/admin/staging/register/rows/${rowId}/review`, { decision, remarks });
    return response.data;
  },
  deleteRegisterImport: async (importId) => {
    const response = await api.delete(`/api/admin/staging/register/imports/${importId}`);
    return response.data;
  },
};
