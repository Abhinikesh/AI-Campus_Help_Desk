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
  }
};
