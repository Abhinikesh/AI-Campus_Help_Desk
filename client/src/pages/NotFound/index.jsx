import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Home, ArrowLeft } from 'lucide-react';
import './NotFound.css';

const ROLE_DASH = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  admin:     '/admin/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
};

const NotFound = () => {
  const { user } = useAuth() || {};
  const homeUrl = user?.role ? (ROLE_DASH[user.role] || '/') : '/';

  return (
    <div className="nf-page">
      <div className="nf-logo">
        <img src="/campussphere-logo.png" alt="CampusSphere" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <span className="nf-logo-text">CampusSphere</span>
      </div>

      <div className="nf-body">
        <div className="nf-code">404</div>
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-sub">The page you are looking for doesn't exist or has been moved.</p>

        <div className="nf-actions">
          <Link to={homeUrl} className="nf-btn primary">
            <Home size={16} /> Go to Home
          </Link>
          <button className="nf-btn outline" onClick={() => window.history.back()}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
