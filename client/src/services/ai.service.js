/**
 * client/src/services/ai.service.js
 * API client service for CampusSphere AI Assistant.
 */
import api from './api';

export const aiService = {
  chat: async (payload) => {
    const response = await api.post('/api/ai/chat', payload);
    const data = response.data?.data || response.data || {};
    return {
      ...response.data,
      ...data,
      reply: data.reply || response.data?.reply || '',
      agent: data.agent || response.data?.agent || payload.agent || 'academic',
    };
  },
};
