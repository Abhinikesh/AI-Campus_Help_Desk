/**
 * client/src/services/fee.service.js
 * Frontend API client for Student Fee Management, Payments, Concessions & Financial Administration.
 */
import api from './api';

export const feeService = {
  // ── Student Portal Endpoints ──────────────────────────────────────────────
  getStudentOverview: async () => {
    const response = await api.get('/api/fees/student/overview');
    return response.data;
  },

  getStudentReceipts: async () => {
    const response = await api.get('/api/fees/student/receipts');
    return response.data;
  },

  getInvoiceById: async (id) => {
    const response = await api.get(`/api/fees/invoices/${id}`);
    return response.data;
  },

  recordOfflinePayment: async (paymentData) => {
    const response = await api.post('/api/fees/payments', paymentData);
    return response.data;
  },

  getTransactionReceipt: async (id) => {
    const response = await api.get(`/api/fees/payments/${id}/receipt`);
    return response.data;
  },

  requestConcession: async (concessionData) => {
    const response = await api.post('/api/fees/adjustments', concessionData);
    return response.data;
  },

  // ── Admin Financial Endpoints ─────────────────────────────────────────────
  getAdminMetrics: async () => {
    const response = await api.get('/api/fees/admin/metrics');
    return response.data;
  },

  getFeeStructures: async (params = {}) => {
    const response = await api.get('/api/fees/structures', { params });
    return response.data;
  },

  createFeeStructure: async (structureData) => {
    const response = await api.post('/api/fees/structures', structureData);
    return response.data;
  },

  updateFeeStructure: async (id, data) => {
    const response = await api.put(`/api/fees/structures/${id}`, data);
    return response.data;
  },

  archiveFeeStructure: async (id) => {
    const response = await api.delete(`/api/fees/structures/${id}`);
    return response.data;
  },

  generateCohortInvoices: async (generationData) => {
    const response = await api.post('/api/fees/invoices/generate-cohort', generationData);
    return response.data;
  },

  getInvoices: async (params = {}) => {
    const response = await api.get('/api/fees/invoices', { params });
    return response.data;
  },

  cancelInvoice: async (id) => {
    const response = await api.post(`/api/fees/invoices/${id}/cancel`);
    return response.data;
  },

  getTransactions: async (params = {}) => {
    const response = await api.get('/api/fees/payments', { params });
    return response.data;
  },

  verifyPaymentTransaction: async (id, payload) => {
    const response = await api.patch(`/api/fees/payments/${id}/verify`, payload);
    return response.data;
  },

  getAdjustments: async (params = {}) => {
    const response = await api.get('/api/fees/adjustments', { params });
    return response.data;
  },

  approveConcession: async (id) => {
    const response = await api.patch(`/api/fees/adjustments/${id}/approve`);
    return response.data;
  },

  rejectConcession: async (id, payload = {}) => {
    const response = await api.patch(`/api/fees/adjustments/${id}/reject`, payload);
    return response.data;
  },

  recordRefund: async (refundData) => {
    const response = await api.post('/api/fees/adjustments/refund', refundData);
    return response.data;
  },

  exportCsvReport: async (params = {}) => {
    const response = await api.get('/api/fees/admin/export-csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default feeService;

