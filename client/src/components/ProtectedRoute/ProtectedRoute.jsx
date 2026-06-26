import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_DASHBOARDS = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
  admin:     '/admin/dashboard',
};

/**
 * ProtectedRoute
 * @param {string} role   - required role string (e.g. 'student')
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
  if (role && user.role !== role) {
    return <Navigate to={ROLE_DASHBOARDS[user.role] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
