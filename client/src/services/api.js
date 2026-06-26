import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// NOTE: Do NOT add a 401 redirect here.
// AuthContext.fetchUser() calls GET /api/auth/me which legitimately returns 401
// when unauthenticated. A redirect here would cause an infinite reload loop.
// ProtectedRoute handles unauthenticated state by redirecting to "/" declaratively.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
