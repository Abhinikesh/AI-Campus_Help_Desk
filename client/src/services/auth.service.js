import api from './api';

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },
  studentLogin: async ({ rollNumber, gmail }) => {
    const response = await api.post('/api/auth/student-login', { rollNumber, gmail });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  changePassword: async (data) => {
    const response = await api.post('/api/auth/change-password', data);
    return response.data;
  },
};
