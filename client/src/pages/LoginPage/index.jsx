/**
 * LoginPage — replaces the marketing Landing page.
 * Shows the three role cards. Clicking one opens the LoginModal.
 * If already authenticated, redirects to the appropriate dashboard.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../../components/LoginModal/LoginModal';
import './LoginPage.css';

const ROLES = [
  {
    id: 'student',
    Icon: GraduationCap,
    label: 'Student',
    desc: 'Access attendance, results, fees & more',
  },
  {
    id: 'faculty',
    Icon: BookOpen,
    label: 'Faculty',
    desc: 'Manage classes, marks & announcements',
  },
  {
    id: 'admin',
    Icon: Shield,
    label: 'Admin',
    desc: 'Manage users, complaints & campus data',
  },
];

const LoginPage = () => {
  const { user, loading, getDashboard } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);

  if (loading) return null;
  if (user) return <Navigate to={getDashboard(user.role)} replace />;

  return (
    <div className="lp-root">
      {/* Background blobs */}
      <div className="lp-blob lp-blob-1" aria-hidden="true" />
      <div className="lp-blob lp-blob-2" aria-hidden="true" />

      <main className="lp-center">
        {/* Logo + heading */}
        <div className="lp-header">
          <div className="lp-logo-ring">
            <GraduationCap size={36} strokeWidth={1.5} />
          </div>
          <h1 className="lp-title">CampusSphere ERP</h1>
          <p className="lp-subtitle">Choose your role to sign in</p>
        </div>

        {/* Role cards */}
        <div className="lp-cards" role="list">
          {ROLES.map(({ id, Icon, label, desc }) => (
            <button
              key={id}
              className="lp-card"
              role="listitem"
              onClick={() => setSelectedRole(id)}
              id={`role-btn-${id}`}
            >
              <div className="lp-card-icon">
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <div className="lp-card-text">
                <span className="lp-card-label">{label}</span>
                <span className="lp-card-desc">{desc}</span>
              </div>
              <span className="lp-card-arrow">→</span>
            </button>
          ))}
        </div>

        <p className="lp-footer-note">
          CampusSphere ERP · Secure · Role-based access
        </p>
      </main>

      {/* Login modal */}
      {selectedRole && (
        <LoginModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </div>
  );
};

export default LoginPage;
