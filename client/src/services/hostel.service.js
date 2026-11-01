/**
 * client/src/services/hostel.service.js
 * Frontend API client for CampusSphere AI Hostel Management System.
 */
import api from './api';

const hostelService = {
  // ── 1. Hostels Management ────────────────────────────────────────────────
  getHostels: async (params = {}) => {
    const res = await api.get('/hostel/hostels', { params });
    return res.data;
  },

  getHostelById: async (id) => {
    const res = await api.get(`/hostel/hostels/${id}`);
    return res.data;
  },

  createHostel: async (data) => {
    const res = await api.post('/hostel/hostels', data);
    return res.data;
  },

  updateHostel: async (id, data) => {
    const res = await api.patch(`/hostel/hostels/${id}`, data);
    return res.data;
  },

  archiveHostel: async (id) => {
    const res = await api.delete(`/hostel/hostels/${id}`);
    return res.data;
  },

  // ── 2. Room & Bed Inventory ──────────────────────────────────────────────
  getRooms: async (params = {}) => {
    const res = await api.get('/hostel/rooms', { params });
    return res.data;
  },

  createRoom: async (data) => {
    const res = await api.post('/hostel/rooms', data);
    return res.data;
  },

  getBeds: async (params = {}) => {
    const res = await api.get('/hostel/beds', { params });
    return res.data;
  },

  createBed: async (data) => {
    const res = await api.post('/hostel/beds', data);
    return res.data;
  },

  // ── 3. Applications ──────────────────────────────────────────────────────
  getApplications: async (params = {}) => {
    const res = await api.get('/hostel/applications', { params });
    return res.data;
  },

  createApplication: async (data) => {
    const res = await api.post('/hostel/applications', data);
    return res.data;
  },

  reviewApplication: async (id, data) => {
    const res = await api.patch(`/hostel/applications/${id}/review`, data);
    return res.data;
  },

  // ── 4. Allocations & Circulation ─────────────────────────────────────────
  getAllocations: async (params = {}) => {
    const res = await api.get('/hostel/allocations', { params });
    return res.data;
  },

  allocateBed: async (data) => {
    const res = await api.post('/hostel/allocations', data);
    return res.data;
  },

  checkInStudent: async (id, data = {}) => {
    const res = await api.post(`/hostel/allocations/${id}/check-in`, data);
    return res.data;
  },

  checkOutStudent: async (id, data = {}) => {
    const res = await api.post(`/hostel/allocations/${id}/check-out`, data);
    return res.data;
  },

  // ── 5. Room Transfers ────────────────────────────────────────────────────
  getTransfers: async (params = {}) => {
    const res = await api.get('/hostel/transfers', { params });
    return res.data;
  },

  requestTransfer: async (data) => {
    const res = await api.post('/hostel/transfers', data);
    return res.data;
  },

  reviewTransfer: async (id, data) => {
    const res = await api.patch(`/hostel/transfers/${id}/review`, data);
    return res.data;
  },

  // ── 6. Maintenance & Complaints ──────────────────────────────────────────
  getComplaints: async (params = {}) => {
    const res = await api.get('/hostel/complaints', { params });
    return res.data;
  },

  createComplaint: async (data) => {
    const res = await api.post('/hostel/complaints', data);
    return res.data;
  },

  updateComplaint: async (id, data) => {
    const res = await api.patch(`/hostel/complaints/${id}`, data);
    return res.data;
  },

  // ── 7. Mess Dining Schedule ──────────────────────────────────────────────
  getMessMenu: async (hostelId) => {
    const res = await api.get('/hostel/mess-menu', { params: { hostelId } });
    return res.data;
  },

  updateMessMenu: async (data) => {
    const res = await api.put('/hostel/mess-menu', data);
    return res.data;
  },

  // ── 8. Policies & Overviews ──────────────────────────────────────────────
  getPolicy: async () => {
    const res = await api.get('/hostel/policy');
    return res.data;
  },

  updatePolicy: async (data) => {
    const res = await api.patch('/hostel/policy', data);
    return res.data;
  },

  getStudentOverview: async () => {
    const res = await api.get('/hostel/student/overview');
    return res.data;
  },

  getAdminMetrics: async () => {
    const res = await api.get('/hostel/admin/metrics');
    return res.data;
  },

  exportCsvUrl: (reportType = 'occupancy', hostelId = '') => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/hostel/reports/export?reportType=${reportType}${hostelId ? `&hostelId=${hostelId}` : ''}`;
  },
};

export default hostelService;

