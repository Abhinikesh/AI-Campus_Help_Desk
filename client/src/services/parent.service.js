import api from './api';

export const parentService = {
  getStudentData: async () => {
    const response = await api.get('/api/parent/student-data');
    return response.data;
  }
};
