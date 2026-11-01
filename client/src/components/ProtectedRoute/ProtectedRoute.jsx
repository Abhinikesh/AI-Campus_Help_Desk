import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_DASHBOARDS = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin:   '/admin/dashboard',
  warden:  '/admin/hostel',
  librarian: '/admin/library',
  transport_manager: '/admin/transport',
  driver:  '/admin/transport',
  attendant: '/admin/transport',
  placement_officer: '/admin/placement',
  placement_coordinator: '/admin/placement',
};

/**
 * ProtectedRoute
 * @param {string|string[]} role   - required role string or array (e.g. 'student', ['admin', 'warden'])
 * @param {React.Node} children
 *
 * Logic:
 *  - Loading → show spinner
 *  - Not logged in → redirect to /
 *  - Wrong role → redirect to their own dashboard
 *  - Correct role → render children
 */
const ProtectedRoute = ({ role, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        gap: '12px',
        flexDirection: 'column',
      }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{ color: '#64748b', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
          Verifying session…
        </p>
      </div>
    );
  }

  // Not authenticated → back to landing
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Wrong role → redirect to their own dashboard
  if (role) {
    const allowed = Array.isArray(role) ? role : role.split(',').map(r => r.trim());
    if (!allowed.includes(user.role)) {
      return <Navigate to={ROLE_DASHBOARDS[user.role] || '/'} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
