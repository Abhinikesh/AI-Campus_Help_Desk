/**
 * client/src/services/transport.service.js
 * Axios API client for CampusSphere AI Transport Management System.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/transport',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const transportService = {
  // ── Student Overview ──
  getStudentOverview: async () => {
    const res = await api.get('/student/overview');
    return res.data;
  },

  // ── Metrics & Policy ──
  getMetrics: async () => {
    const res = await api.get('/admin/metrics');
    return res.data;
  },
  getPolicy: async () => {
    const res = await api.get('/policy');
    return res.data;
  },
  updatePolicy: async (data) => {
    const res = await api.patch('/policy', data);
    return res.data;
  },

  // ── Vehicles ──
  getVehicles: async (params = {}) => {
    const res = await api.get('/vehicles', { params });
    return res.data;
  },
  getVehicleById: async (id) => {
    const res = await api.get(`/vehicles/${id}`);
    return res.data;
  },
  createVehicle: async (data) => {
    const res = await api.post('/vehicles', data);
    return res.data;
  },
  updateVehicle: async (id, data) => {
    const res = await api.patch(`/vehicles/${id}`, data);
    return res.data;
  },
  archiveVehicle: async (id) => {
    const res = await api.delete(`/vehicles/${id}`);
    return res.data;
  },

  // ── Routes & Stops ──
  getRoutes: async (params = {}) => {
    const res = await api.get('/routes', { params });
    return res.data;
  },
  getRouteById: async (id) => {
    const res = await api.get(`/routes/${id}`);
    return res.data;
  },
  createRoute: async (data) => {
    const res = await api.post('/routes', data);
    return res.data;
  },
  updateRoute: async (id, data) => {
    const res = await api.patch(`/routes/${id}`, data);
    return res.data;
  },
  assignVehicleAndStaff: async (routeId, data) => {
    const res = await api.post(`/routes/${routeId}/assign`, data);
    return res.data;
  },
  getStops: async (routeId) => {
    const res = await api.get(`/routes/${routeId}/stops`);
    return res.data;
  },
  createStop: async (routeId, data) => {
    const res = await api.post(`/routes/${routeId}/stops`, data);
    return res.data;
  },

  // ── Staff (Drivers & Attendants) ──
  getStaff: async (params = {}) => {
    const res = await api.get('/staff', { params });
    return res.data;
  },
  createStaff: async (data) => {
    const res = await api.post('/staff', data);
    return res.data;
  },

  // ── Applications ──
  getApplications: async (params = {}) => {
    const res = await api.get('/applications', { params });
    return res.data;
  },
  createApplication: async (data) => {
    const res = await api.post('/applications', data);
    return res.data;
  },
  reviewApplication: async (id, data) => {
    const res = await api.patch(`/applications/${id}/review`, data);
    return res.data;
  },

  // ── Allocations ──
  getAllocations: async (params = {}) => {
    const res = await api.get('/allocations', { params });
    return res.data;
  },
  allocateStudent: async (data) => {
    const res = await api.post('/allocations', data);
    return res.data;
  },
  cancelAllocation: async (id, data) => {
    const res = await api.post(`/allocations/${id}/cancel`, data);
    return res.data;
  },

  // ── Daily Trips ──
  getTrips: async (params = {}) => {
    const res = await api.get('/trips', { params });
    return res.data;
  },
  createTrip: async (data) => {
    const res = await api.post('/trips', data);
    return res.data;
  },
  updateTripStatus: async (id, data) => {
    const res = await api.patch(`/trips/${id}`, data);
    return res.data;
  },

  // ── Maintenance & Incidents ──
  getMaintenance: async (params = {}) => {
    const res = await api.get('/maintenance', { params });
    return res.data;
  },
  recordMaintenance: async (data) => {
    const res = await api.post('/maintenance', data);
    return res.data;
  },
  getIncidents: async (params = {}) => {
    const res = await api.get('/incidents', { params });
    return res.data;
  },
  reportIncident: async (data) => {
    const res = await api.post('/incidents', data);
    return res.data;
  },

  // ── CSV Export ──
  exportCsvUrl: (reportType = 'routes') => {
    return `/api/transport/reports/export?reportType=${reportType}`;
  },
};

export default transportService;

