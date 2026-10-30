/**
 * client/src/services/api.js
 * Axios instance. baseURL is '' (relative) so the Vite proxy forwards
 * all /api/* requests to the backend and cookies work without CORS issues.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '',          // rely on Vite proxy → http://localhost:5001
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Do NOT add a global 401 redirect here — ProtectedRoute handles unauthenticated
// state declaratively. A redirect inside the interceptor causes reload loops.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
