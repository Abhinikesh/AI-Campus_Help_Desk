import api from './api';

export const facultyService = {
  getProfile: async () => {
    const response = await api.get('/api/faculty/profile');
    return response.data;
  },
  getTimetable: async () => {
    const response = await api.get('/api/faculty/timetable');
    return response.data;
  },
  createAnnouncement: async (data) => {
    const response = await api.post('/api/faculty/announcements', data);
    return response.data;
  },
  getStudents: async () => {
    const response = await api.get('/api/faculty/students');
    return response.data;
  },
  markAttendance: async (data) => {
    const response = await api.post('/api/faculty/attendance', data);
    return response.data;
  }
};
