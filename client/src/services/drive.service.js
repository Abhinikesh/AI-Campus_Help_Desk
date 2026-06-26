import api from './api';

export const getFiles = async (category = 'all', search = '') => {
  const res = await api.get('/api/drive', {
    params: { category, search }
  });
  return res.data;
};

export const uploadFile = async (formData, onProgress) => {
  const res = await api.post('/api/drive/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      const percent = Math.round((e.loaded * 100) / e.total);
      if (onProgress) onProgress(percent);
    }
  });
  return res.data;
};

export const downloadFile = async (id, filename) => {
  const res = await api.get(`/api/drive/download/${id}`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const shareFile = async (id) => {
  const res = await api.get(`/api/drive/share/${id}`);
  return res.data;
};

export const deleteFile = async (id) => {
  const res = await api.delete(`/api/drive/${id}`);
  return res.data;
};
