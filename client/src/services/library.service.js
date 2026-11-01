/**
 * client/src/services/library.service.js
 * API client for Library Catalog, Inventory, Circulation, Reservations & Fines.
 */
import api from './api';

export const libraryService = {
  // ── Book Catalog ──────────────────────────────────────────────────────────
  getBooks: async (params = {}) => {
    const response = await api.get('/api/library/books', { params });
    return response.data;
  },

  getBookById: async (id) => {
    const response = await api.get(`/api/library/books/${id}`);
    return response.data;
  },

  createBook: async (bookData) => {
    const response = await api.post('/api/library/books', bookData);
    return response.data;
  },

  updateBook: async (id, data) => {
    const response = await api.put(`/api/library/books/${id}`, data);
    return response.data;
  },

  archiveBook: async (id) => {
    const response = await api.delete(`/api/library/books/${id}`);
    return response.data;
  },

  // ── Physical Copies Inventory ─────────────────────────────────────────────
  getCopies: async (params = {}) => {
    const response = await api.get('/api/library/copies', { params });
    return response.data;
  },

  addBookCopy: async (copyData) => {
    const response = await api.post('/api/library/copies', copyData);
    return response.data;
  },

  updateCopyStatus: async (id, data) => {
    const response = await api.patch(`/api/library/copies/${id}/status`, data);
    return response.data;
  },

  // ── Circulation (Issue, Return, Renew) ────────────────────────────────────
  issueBook: async (issueData) => {
    const response = await api.post('/api/library/loans/issue', issueData);
    return response.data;
  },

  returnBook: async (loanId, returnData = {}) => {
    const response = await api.post(`/api/library/loans/${loanId}/return`, returnData);
    return response.data;
  },

  renewLoan: async (loanId, data = {}) => {
    const response = await api.post(`/api/library/loans/${loanId}/renew`, data);
    return response.data;
  },

  // ── Reservations Queue ────────────────────────────────────────────────────
  getReservations: async (params = {}) => {
    const response = await api.get('/api/library/reservations', { params });
    return response.data;
  },

  createReservation: async (data) => {
    const response = await api.post('/api/library/reservations', data);
    return response.data;
  },

  cancelReservation: async (id, data = {}) => {
    const response = await api.patch(`/api/library/reservations/${id}/cancel`, data);
    return response.data;
  },

  // ── Fines & Penalties ─────────────────────────────────────────────────────
  getFines: async (params = {}) => {
    const response = await api.get('/api/library/fines', { params });
    return response.data;
  },

  waiveFine: async (id, data) => {
    const response = await api.patch(`/api/library/fines/${id}/waive`, data);
    return response.data;
  },

  recordFinePayment: async (id, data = {}) => {
    const response = await api.patch(`/api/library/fines/${id}/pay`, data);
    return response.data;
  },

  // ── Student Portal Summary ────────────────────────────────────────────────
  getStudentOverview: async () => {
    const response = await api.get('/api/library/student/overview');
    return response.data;
  },

  // ── Admin Dashboard & Policy ──────────────────────────────────────────────
  getAdminMetrics: async () => {
    const response = await api.get('/api/library/admin/metrics');
    return response.data;
  },

  getPolicy: async () => {
    const response = await api.get('/api/library/policies');
    return response.data;
  },

  updatePolicy: async (policyData) => {
    const response = await api.patch('/api/library/policies', policyData);
    return response.data;
  },

  exportCsvReport: async (params = {}) => {
    const response = await api.get('/api/library/admin/export-csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default libraryService;

