import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth() || { user: { role: 'student', name: 'Arjun' }, logout: () => console.log('Logged out') };
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fallback role if user context isn't fully loaded during dev
  const role = user?.role || 'student';

  const toggleMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const getRoleBadgeColor = (userRole) => {
    switch (userRole) {
      case 'student': return 'badge-student';
      case 'faculty': return 'badge-faculty';
      case 'admin': return 'badge-admin';
      case 'parent': return 'badge-parent';
      case 'admission': return 'badge-admission';
      default: return 'badge-student';
    }
  };

  const renderNavLinks = () => {
    let links = [];

    switch (role) {
      case 'student':
        links = [
          { name: 'Home', path: '/student/dashboard' },
          { name: 'Attendance', path: '/student/attendance' },
          { name: 'Exams', path: '/student/exams' },
          { name: 'Results', path: '/student/results' },
          { name: 'AI Help Desk', path: '/student/ai-help' },
          { name: 'Virtual Tour', path: '/student/virtual-tour' },
          { name: 'Drive', path: '/student/drive' },
          { name: 'Complaints', path: '/student/complaints' }
        ];
        break;
      case 'faculty':
        links = [
          { name: 'Home', path: '/faculty/dashboard' },
          { name: 'AI Help Desk', path: '/faculty/ai-help' },
          { name: 'Virtual Tour', path: '/faculty/virtual-tour' },
          { name: 'Drive', path: '/faculty/drive' },
          { name: 'Complaints', path: '/faculty/complaints' }
        ];
        break;
      case 'admin':
        links = [
          { name: 'Home', path: '/admin/dashboard' },
          { name: 'Analytics', path: '/admin/analytics' },
          { name: 'Complaints', path: '/admin/complaints' },
          { name: 'Announcements', path: '/admin/announcements' }
        ];
        break;
      case 'parent':
        links = [
          { name: 'Home', path: '/parent/dashboard' },
          { name: 'AI Help Desk', path: '/parent/ai-help' },
          { name: 'Virtual Tour', path: '/parent/virtual-tour' }
        ];
        break;
      case 'admission':
        links = [
          { name: 'Home', path: '/admission/dashboard' },
          { name: 'AI Help Desk', path: '/admission/ai-help' },
          { name: 'Virtual Tour', path: '/admission/virtual-tour' }
        ];
        break;
      default:
        break;
    }

    return (
      <>
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            {link.name}
          </Link>
        ))}
        <button className="nav-link logout-btn" onClick={() => { setMobileMenuOpen(false); logout(); }}>
          Logout
        </button>
      </>
    );
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo-section" onClick={() => window.location.href = '/'}>
          <GraduationCap className="logo-icon" size={26} color="#3b82f6" />
          <span className="logo-text">CampusSphere <span className="logo-ai">AI</span></span>
          <span className={`role-badge ${getRoleBadgeColor(role)}`}>
            {role === 'admission' ? 'NEW ADMISSION' : role.toUpperCase()}
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-links desktop">
          {renderNavLinks()}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="navbar-links mobile">
          {renderNavLinks()}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
