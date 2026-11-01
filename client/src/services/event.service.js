/**
 * client/src/services/event.service.js
 * Axios API client for CampusSphere AI Campus Events, Clubs & Activities.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/events',
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

const eventService = {
  // ── Events ──
  getEvents: async (params = {}) => {
    const res = await api.get('/', { params });
    return res.data;
  },
  getEventById: async (id) => {
    const res = await api.get(`/${id}`);
    return res.data;
  },
  createEvent: async (data) => {
    const res = await api.post('/', data);
    return res.data;
  },
  updateEvent: async (id, data) => {
    const res = await api.patch(`/${id}`, data);
    return res.data;
  },
  submitEventForApproval: async (id) => {
    const res = await api.post(`/${id}/submit`);
    return res.data;
  },
  reviewEventApproval: async (id, data) => {
    const res = await api.patch(`/${id}/approval`, data);
    return res.data;
  },
  publishEvent: async (id) => {
    const res = await api.post(`/${id}/publish`);
    return res.data;
  },
  cancelEvent: async (id, data) => {
    const res = await api.post(`/${id}/cancel`, data);
    return res.data;
  },

  // ── Registrations & Waitlist ──
  registerForEvent: async (id, data = {}) => {
    const res = await api.post(`/${id}/register`, data);
    return res.data;
  },
  cancelRegistration: async (eventId, registrationId, data = {}) => {
    const res = await api.patch(`/${eventId}/registrations/${registrationId}/cancel`, data);
    return res.data;
  },
  getMyRegistrations: async () => {
    const res = await api.get('/my-registrations');
    return res.data;
  },
  getEventRegistrations: async (eventId, params = {}) => {
    const res = await api.get(`/${eventId}/registrations`, { params });
    return res.data;
  },

  // ── Attendance ──
  recordAttendance: async (eventId, data) => {
    const res = await api.post(`/${eventId}/attendance`, data);
    return res.data;
  },
  correctAttendance: async (eventId, attendanceId, data) => {
    const res = await api.patch(`/${eventId}/attendance/${attendanceId}`, data);
    return res.data;
  },
  getEventAttendance: async (eventId) => {
    const res = await api.get(`/${eventId}/attendance`);
    return res.data;
  },

  // ── Certificates ──
  issueCertificate: async (eventId, data) => {
    const res = await api.post(`/${eventId}/certificates/issue`, data);
    return res.data;
  },
  getMyCertificates: async () => {
    const res = await api.get('/my-certificates');
    return res.data;
  },
  verifyCertificate: async (identifier) => {
    const res = await axios.get(`/api/certificates/verify/${identifier}`);
    return res.data;
  },

  // ── Clubs & Memberships ──
  getClubs: async (params = {}) => {
    const res = await api.get('/clubs', { params });
    return res.data;
  },
  getClubById: async (id) => {
    const res = await api.get(`/clubs/${id}`);
    return res.data;
  },
  createClub: async (data) => {
    const res = await api.post('/clubs', data);
    return res.data;
  },
  applyForMembership: async (clubId, data = {}) => {
    const res = await api.post(`/clubs/${clubId}/membership`, data);
    return res.data;
  },
  reviewMembership: async (clubId, membershipId, data) => {
    const res = await api.patch(`/clubs/${clubId}/membership/${membershipId}`, data);
    return res.data;
  },
  getMyMemberships: async () => {
    const res = await api.get('/clubs/my-memberships');
    return res.data;
  },

  // ── Venues & Bookings ──
  getVenues: async () => {
    const res = await api.get('/venues');
    return res.data;
  },
  createVenue: async (data) => {
    const res = await api.post('/venues', data);
    return res.data;
  },
  bookVenue: async (data) => {
    const res = await api.post('/venues/bookings', data);
    return res.data;
  },

  // ── Announcements & Feedback ──
  getAnnouncements: async (params = {}) => {
    const res = await api.get('/announcements', { params });
    return res.data;
  },
  createAnnouncement: async (data) => {
    const res = await api.post('/announcements', data);
    return res.data;
  },
  submitFeedback: async (eventId, data) => {
    const res = await api.post(`/${eventId}/feedback`, data);
    return res.data;
  },

  // ── Metrics & CSV Exports ──
  getOverviewMetrics: async () => {
    const res = await api.get('/reports/overview');
    return res.data;
  },
  getParticipantsExportUrl: (eventId) => `/api/events/${eventId}/export-participants`,
};

export default eventService;
