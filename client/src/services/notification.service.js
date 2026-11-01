/**
 * client/src/services/notification.service.js
 * Frontend API client for notifications, preferences, and announcements.
 */
import api from './api';

export const notificationService = {
  // Notifications
  getNotifications: async (params = {}) => {
    const response = await api.get('/api/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/api/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.patch(`/api/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (category = null) => {
    const response = await api.patch('/api/notifications/read-all', { category });
    return response.data;
  },

  markAsUnread: async (id) => {
    const response = await api.patch(`/api/notifications/${id}/unread`);
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await api.delete(`/api/notifications/${id}`);
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get('/api/notifications/preferences');
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.patch('/api/notifications/preferences', preferences);
    return response.data;
  },

  // Announcements
  getVisibleAnnouncements: async () => {
    const response = await api.get('/api/announcements');
    return response.data;
  },

  getAnnouncementById: async (id) => {
    const response = await api.get(`/api/announcements/${id}`);
    return response.data;
  },

  createAnnouncement: async (data) => {
    const response = await api.post('/api/announcements', data);
    return response.data;
  },

  updateAnnouncement: async (id, data) => {
    const response = await api.patch(`/api/announcements/${id}`, data);
    return response.data;
  },

  publishAnnouncement: async (id) => {
    const response = await api.post(`/api/announcements/${id}/publish`);
    return response.data;
  },

  archiveAnnouncement: async (id) => {
    const response = await api.post(`/api/announcements/${id}/archive`);
    return response.data;
  },

  getAdminAnnouncements: async (params = {}) => {
    const response = await api.get('/api/announcements/admin/all', { params });
    return response.data;
  },
};

export default notificationService;

