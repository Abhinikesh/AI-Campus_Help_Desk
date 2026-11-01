import api from './api';

export const calendarService = {
  getCalendarEvents: async (params = {}) => {
    const res = await api.get('/api/calendar/events', { params });
    return res.data;
  },

  getUpcomingEvents: async () => {
    const res = await api.get('/api/calendar/upcoming');
    return res.data;
  },

  createCalendarEvent: async (data) => {
    const res = await api.post('/api/calendar/events', data);
    return res.data;
  },

  updateCalendarEvent: async (id, data) => {
    const res = await api.put(`/api/calendar/events/${id}`, data);
    return res.data;
  },

  deleteCalendarEvent: async (id) => {
    const res = await api.delete(`/api/calendar/events/${id}`);
    return res.data;
  },
};

export default calendarService;

