import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../NotificationBell/NotificationBell';
import { LogOut, ChevronDown, Shield, User } from 'lucide-react';
import './AppHeader.css';

const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const ROLE_DISPLAY = {
  student: 'Student',
  faculty: 'Faculty',
  admin: 'Administrator',
  transport_manager: 'Transport Manager',
  driver: 'Campus Driver',
  attendant: 'Bus Attendant',
  placement_officer: 'Placement Officer',
  placement_coordinator: 'Placement Coordinator',
  event_organizer: 'Event Organizer',
  club_coordinator: 'Club Coordinator',
  warden: 'Hostel Warden',
  librarian: 'Chief Librarian',
  inventory_manager: 'Inventory Manager',
  procurement_officer: 'Procurement Officer',
  storekeeper: 'Storekeeper',
  hr_admin: 'HR Admin',
  hr_officer: 'HR Officer',
  employee: 'Staff Member',
  parent: 'Parent Guardian',
  admission: 'Admission Officer',
};

const ROUTE_TITLE_MAP = {
  '/student/dashboard': 'Student Dashboard',
  '/student/timetable': 'Timetable & Academic Calendar',
  '/student/assignments': 'Assignments & Submissions',
  '/student/fees': 'Fees & Online Payments',
  '/student/hostel': 'Hostel & Housing Allocation',
  '/student/transport': 'Campus Transport & Bus Routes',
  '/student/placement': 'Placement Cell & Job Openings',
  '/student/activities': 'Campus Activities & Student Clubs',
  '/student/library': 'Library Catalog & Issued Books',
  '/student/attendance': 'Smart Attendance Overview',
  '/student/exams': 'Examination Schedule',
  '/student/results': 'Academic Results & Marksheet',
  '/student/drive': 'Academic Drive & Course Material',
  '/student/complaints': 'Student Grievance Redressal',
  '/student/ai-help': 'AI Campus Help Desk',
  '/faculty/dashboard': 'Faculty Portal Dashboard',
  '/faculty/students': 'Student 360 & Directory Search',
  '/faculty/attendance': 'Faculty Attendance Management',
  '/faculty/assignments': 'Assignment Management',
  '/faculty/timetable': 'Faculty Weekly Schedule',
  '/faculty/results': 'Course Results & Grade Management',
  '/faculty/hr': 'Faculty HR & Leave Self-Service',
  '/admin/dashboard': 'Admin Command Center',
  '/admin/students': 'Student Identity & Enrollment Management',
  '/admin/attendance': 'Campus Smart Attendance Administration',
  '/admin/timetable': 'Timetable & Academic Scheduling',
  '/admin/finance': 'Institutional Finance & Fees',
  '/admin/inventory': 'Campus Inventory & Assets',
  '/admin/hr': 'Human Resources & Workforce',
  '/admin/hostel': 'Hostel Administration',
  '/admin/transport': 'Transport Operations Desk',
  '/admin/placement': 'Campus Placement Desk',
  '/admin/activities': 'Student Activities & Events',
  '/admin/library': 'Library Administration Desk',
  '/admin/complaints': 'Grievance Resolution Hub',
  '/admin/ai-help': 'AI Help Desk Administration',
  '/notifications': 'Notification Center',
};

const AppHeader = ({ title, subtitle, badge, extraRight, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const role = user?.role || 'student';
  const roleLabel = ROLE_DISPLAY[role] || (role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' '));
  const homePath = `/${role}/dashboard`;

  // Determine dynamic title if none provided
  const displayTitle = title || ROUTE_TITLE_MAP[location.pathname] || 'CampusSphere AI';

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout(navigate);
  };

  return (
    <header className="ds-header cs-app-header">
      {/* ── Left: Platform Branding & Dynamic Page Context ── */}
      <div className="cs-app-header-left">
        <Link to={homePath} className="cs-app-header-brand" title="CampusSphere AI">
          <img
            src="/campussphere-logo.png"
            alt="CampusSphere"
            className="cs-app-header-logo"
          />
          <div className="cs-app-header-brand-text">
            <span className="cs-app-header-brandname">CampusSphere</span>
            <span className="cs-app-header-ai-pill">AI</span>
          </div>
        </Link>

        <div className="cs-app-header-divider" aria-hidden="true" />

        <div className="cs-app-header-title-wrap">
          <h1 className="cs-app-header-title">{displayTitle}</h1>
          {subtitle && <span className="cs-app-header-subtitle">{subtitle}</span>}
          {badge && <span className="cs-app-header-badge">{badge}</span>}
          {children}
        </div>
      </div>

      {/* ── Right: Page Extras + Notifications + User Profile ── */}
      <div className="cs-app-header-right">
        {extraRight}

        {/* Live Notification Bell with Dropdown */}
        <NotificationBell />

        {/* User Account Controls */}
        <div className="cs-app-header-profile" ref={dropdownRef}>
          <button
            type="button"
            className="cs-app-header-user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-label="User account controls"
          >
            <div className="cs-app-header-avatar">
              {initials(user?.name)}
            </div>
            <div className="cs-app-header-user-meta">
              <span className="cs-app-header-user-name" title={user?.name}>
                {user?.name || 'User'}
              </span>
              <span className="cs-app-header-user-role">
                {roleLabel}
              </span>
            </div>
            <ChevronDown size={14} className={`cs-app-header-chevron ${dropdownOpen ? 'rotated' : ''}`} />
          </button>

          {/* User Account Dropdown */}
          {dropdownOpen && (
            <div className="cs-app-header-dropdown">
              <div className="cs-app-header-dropdown-user">
                <div className="cs-app-header-dropdown-avatar">
                  {initials(user?.name)}
                </div>
                <div className="cs-app-header-dropdown-details">
                  <div className="cs-app-header-dropdown-name">{user?.name || 'User'}</div>
                  <div className="cs-app-header-dropdown-email">{user?.email || ''}</div>
                  <span className="cs-app-header-dropdown-role-badge">{roleLabel}</span>
                </div>
              </div>

              <div className="cs-app-header-dropdown-divider" />

              <div className="cs-app-header-dropdown-menu">
                <Link
                  to={homePath}
                  className="cs-app-header-dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <Shield size={15} />
                  <span>Dashboard Home</span>
                </Link>
                <Link
                  to="/notifications"
                  className="cs-app-header-dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User size={15} />
                  <span>Notification Center</span>
                </Link>
                <button
                  type="button"
                  className="cs-app-header-dropdown-item cs-dropdown-signout"
                  onClick={handleLogout}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
