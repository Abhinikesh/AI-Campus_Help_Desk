import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

const AuthContext = createContext(null);

const ROLE_DASHBOARDS = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
  admin:     '/admin/dashboard',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);   // { name, role, email, rollNumber }
  const [loading, setLoading] = useState(true);   // true while verifying JWT on boot

  // ── Fetch current user from cookie JWT ────────────────────
  const fetchUser = useCallback(async () => {
    try {
      const data = await authService.getMe();
      if (data.success) setUser(data.user);
      else              setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on app boot
  useEffect(() => { fetchUser(); }, [fetchUser]);

  // ── Login ──────────────────────────────────────────────────
  const login = async (identifier, password, role) => {
    // Backend now handles 'identifier' directly for all roles
    // Students login with roll number; others with email
    const payload = {
      identifier, // 8-digit roll for students, email for others
      password,
      role,
    };
    
    const data = await authService.login(payload);
    if (data.success) {
      await fetchUser();
      return data; // { success, role, name, redirectTo }
    }
    throw new Error(data.error || data.message || 'Login failed');
  };

  // ── Logout ─────────────────────────────────────────────────
  const logout = async (navigate) => {
    try {
      await authService.logout();
    } catch { /* ignore */ }
    setUser(null);
    if (navigate) navigate('/');
  };

  // ── Admission Login ─────────────────────────────────────────
  const admissionLogin = async (name, phone) => {
    const data = await authService.admissionLogin({ name, phone });
    if (data.success) {
      await fetchUser();
      return data;
    }
    throw new Error(data.message || 'Admission login failed');
  };

  const getDashboard = (role) => ROLE_DASHBOARDS[role] || '/';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser, getDashboard, admissionLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
