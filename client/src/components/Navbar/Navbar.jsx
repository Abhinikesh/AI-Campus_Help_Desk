import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth() || { user: { role: 'student', name: 'Arjun' }, logout: () => console.log('Logged out') };
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          { name: 'Dashboard', path: '/student/dashboard' },
          { name: 'Attendance', path: '/student/attendance' },
          { name: 'Exams', path: '/student/exams' },
          { name: 'Results', path: '/student/results' },
          { name: 'Academic Drive', path: '/student/drive' },
          { name: 'Complaints', path: '/student/complaints' },
          { name: 'AI Help Desk', path: '/student/ai-help' }
        ];
        break;
      case 'faculty':
        links = [
          { name: 'Dashboard', path: '/faculty/dashboard' },
          { name: 'Attendance Mgmt', path: '/faculty/attendance' },
          { name: 'Timetable', path: '/faculty/timetable' },
          { name: 'Student Results', path: '/faculty/results' },
          { name: 'Academic Drive', path: '/faculty/drive' },
          { name: 'Complaints', path: '/faculty/complaints' },
          { name: 'AI Help Desk', path: '/faculty/ai-help' }
        ];
        break;
      case 'admin':
        links = [
          { name: 'Dashboard', path: '/admin/dashboard' },
          { name: 'Smart Attendance', path: '/admin/attendance' },
          { name: 'Complaints', path: '/admin/complaints' },
          { name: 'AI Help Desk', path: '/admin/ai-help' }
        ];
        break;
      default:
        links = [
          { name: 'Home', path: '/' }
        ];
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
          <img src="/campussphere-logo.png" alt="CampusSphere" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span className="logo-text">CampusSphere</span>
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
