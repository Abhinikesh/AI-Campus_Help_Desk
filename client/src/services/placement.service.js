/**
 * client/src/services/placement.service.js
 * Axios API client for CampusSphere AI Placement & Career Development Subsystem.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/placement',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const placementService = {
  // ── Profile & Resume ──
  getMyProfile: async () => {
    const res = await api.get('/profile/my');
    return res.data;
  },
  updateMyProfile: async (data) => {
    const res = await api.put('/profile/my', data);
    return res.data;
  },
  uploadResume: async (formData) => {
    const res = await api.post('/profile/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getResumeDownloadUrl: (filename) => `/api/placement/resumes/${filename}`,
  getStudentProfileById: async (studentId) => {
    const res = await api.get(`/students/${studentId}/profile`);
    return res.data;
  },

  // ── Companies ──
  getCompanies: async (params = {}) => {
    const res = await api.get('/companies', { params });
    return res.data;
  },
  getCompanyById: async (id) => {
    const res = await api.get(`/companies/${id}`);
    return res.data;
  },
  createCompany: async (data) => {
    const res = await api.post('/companies', data);
    return res.data;
  },
  updateCompany: async (id, data) => {
    const res = await api.put(`/companies/${id}`, data);
    return res.data;
  },

  // ── Opportunities ──
  getOpportunities: async (params = {}) => {
    const res = await api.get('/opportunities', { params });
    return res.data;
  },
  getOpportunityById: async (id) => {
    const res = await api.get(`/opportunities/${id}`);
    return res.data;
  },
  createOpportunity: async (data) => {
    const res = await api.post('/opportunities', data);
    return res.data;
  },
  updateOpportunity: async (id, data) => {
    const res = await api.put(`/opportunities/${id}`, data);
    return res.data;
  },
  publishOpportunity: async (id) => {
    const res = await api.post(`/opportunities/${id}/publish`);
    return res.data;
  },

  // ── Drives ──
  getDrives: async (params = {}) => {
    const res = await api.get('/drives', { params });
    return res.data;
  },
  getDriveById: async (id) => {
    const res = await api.get(`/drives/${id}`);
    return res.data;
  },
  createDrive: async (data) => {
    const res = await api.post('/drives', data);
    return res.data;
  },
  updateDrive: async (id, data) => {
    const res = await api.put(`/drives/${id}`, data);
    return res.data;
  },

  // ── Applications ──
  applyForOpportunity: async (opportunityId) => {
    const res = await api.post('/applications', { opportunityId });
    return res.data;
  },
  getMyApplications: async () => {
    const res = await api.get('/applications/my');
    return res.data;
  },
  getDriveApplications: async (params = {}) => {
    const res = await api.get('/applications', { params });
    return res.data;
  },
  withdrawApplication: async (id, reason) => {
    const res = await api.post(`/applications/${id}/withdraw`, { reason });
    return res.data;
  },
  updateApplicationStatus: async (id, data) => {
    const res = await api.patch(`/applications/${id}/status`, data);
    return res.data;
  },

  // ── Selection Stages & Results ──
  createSelectionStage: async (data) => {
    const res = await api.post('/stages', data);
    return res.data;
  },
  updateStageResult: async (data) => {
    const res = await api.post('/stages/result', data);
    return res.data;
  },
  correctStageResult: async (id, data) => {
    const res = await api.patch(`/stages/results/${id}/correct`, data);
    return res.data;
  },
  getMyInterviewSchedule: async () => {
    const res = await api.get('/interviews/my');
    return res.data;
  },

  // ── Offers ──
  issueOffer: async (data) => {
    const res = await api.post('/offers', data);
    return res.data;
  },
  uploadOfferLetter: async (id, formData) => {
    const res = await api.post(`/offers/${id}/document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getOfferLetterDownloadUrl: (filename) => `/api/placement/offers/documents/${filename}`,
  respondToOffer: async (id, data) => {
    const res = await api.patch(`/offers/${id}/respond`, data);
    return res.data;
  },
  verifyPlacement: async (id) => {
    const res = await api.post(`/offers/${id}/verify`);
    return res.data;
  },
  getMyOffers: async () => {
    const res = await api.get('/offers/my');
    return res.data;
  },
  getAllOffers: async (params = {}) => {
    const res = await api.get('/offers', { params });
    return res.data;
  },

  // ── Career Resources ──
  getCareerResources: async (params = {}) => {
    const res = await api.get('/resources', { params });
    return res.data;
  },
  createCareerResource: async (data) => {
    const res = await api.post('/resources', data);
    return res.data;
  },

  // ── Metrics & CSV Export ──
  getMetrics: async (params = {}) => {
    const res = await api.get('/metrics', { params });
    return res.data;
  },
  getExportUrl: (type = 'applications', academicYear = '') =>
    `/api/placement/export?type=${type}${academicYear ? `&academicYear=${academicYear}` : ''}`,
};

export default placementService;

