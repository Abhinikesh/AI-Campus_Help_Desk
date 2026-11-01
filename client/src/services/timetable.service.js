import api from './api';

export const timetableService = {
  // Student API
  getStudentTimetable: async () => {
    const res = await api.get('/api/timetable/student');
    return res.data;
  },

  // Faculty API
  getFacultyTimetable: async () => {
    const res = await api.get('/api/timetable/faculty');
    return res.data;
  },

  // Admin / General query
  getTimetableEntries: async (params = {}) => {
    const res = await api.get('/api/timetable', { params });
    return res.data;
  },

  createTimetableEntry: async (data) => {
    const res = await api.post('/api/timetable', data);
    return res.data;
  },

  updateTimetableEntry: async (id, data) => {
    const res = await api.put(`/api/timetable/${id}`, data);
    return res.data;
  },

  cancelTimetableEntry: async (id, data) => {
    const res = await api.delete(`/api/timetable/${id}`, { data });
    return res.data;
  },

  publishTimetable: async (data) => {
    const res = await api.post('/api/timetable/publish', data);
    return res.data;
  },

  getTimetableVersions: async (params = {}) => {
    const res = await api.get('/api/timetable/versions', { params });
    return res.data;
  },
};

export default timetableService;

