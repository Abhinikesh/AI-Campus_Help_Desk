import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

const AuthContext = createContext(null);

const ROLE_DASHBOARDS = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin:   '/admin/dashboard',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await authService.getMe();
      if (data.success) setUser(data.data);
      else              setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // login: { loginId, password, role }
  const login = async (loginId, password, role) => {
    const data = await authService.login({ loginId, password, role });
    if (data.success) {
      if (data.data?.token) {
        localStorage.setItem('campus_token', data.data.token);
      }
      if (data.data) {
        setUser({
          id: data.data.id || data.data.userId,
          name: data.data.name,
          role: data.data.role,
          mustChangePassword: data.data.mustChangePassword,
        });
      }
      await fetchUser();
      return data;
    }
    throw new Error(data.message || 'Login failed');
  };

  const logout = async (navigate) => {
    try { await authService.logout(); } catch { /* ignore */ }
    localStorage.removeItem('campus_token');
    setUser(null);
    if (navigate) navigate('/');
  };

  const getDashboard = (role) => ROLE_DASHBOARDS[role] || '/';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser, getDashboard }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
