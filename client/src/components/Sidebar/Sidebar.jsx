import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Clock,
  ChevronLeft, ChevronRight, Menu, GraduationCap, UserCheck, Bell, CreditCard, Library,
  Building, Bus, Briefcase, Sparkles, Boxes, Users
} from 'lucide-react';
import './Sidebar.css';

const NAV_CONFIG = {
  student: [
    { label: 'Dashboard',          icon: LayoutDashboard, to: '/student/dashboard'   },
    { label: 'Attendance',         icon: CalendarCheck,   to: '/student/attendance'  },
    { label: 'Timetable & Cal',    icon: Clock,           to: '/student/timetable'   },
    { label: 'Assignments',        icon: BookOpen,        to: '/student/assignments' },
    { label: 'Fees & Payments',    icon: CreditCard,      to: '/student/fees'        },
    { label: 'Hostel & Housing',   icon: Building,        to: '/student/hostel'      },
    { label: 'Campus Transport',   icon: Bus,             to: '/student/transport'   },
    { label: 'Placement Cell',     icon: Briefcase,       to: '/student/placement'   },
    { label: 'Activities & Clubs', icon: Sparkles,        to: '/student/activities'  },
    { label: 'Library & Books',    icon: Library,         to: '/student/library'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Results & Grades',   icon: BarChart2,       to: '/student/results'     },
    { label: 'Exam Schedule',      icon: GraduationCap,   to: '/student/exams'       },
    { label: 'Academic Drive',     icon: Folder,          to: '/student/drive'       },
    { label: 'Complaints',         icon: Flag,            to: '/student/complaints'  },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/student/ai-help'     },
  ],
  faculty: [
    { label: 'Dashboard',          icon: LayoutDashboard, to: '/faculty/dashboard'   },
    { label: 'Student 360',        icon: Users,           to: '/faculty/students'    },
    { label: 'Smart Attendance',   icon: CalendarCheck,   to: '/faculty/attendance'  },
    { label: 'Assignments',        icon: BookOpen,        to: '/faculty/assignments' },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Weekly Timetable',   icon: Clock,           to: '/faculty/timetable'   },
    { label: 'HR Self-Service',    icon: Users,           to: '/faculty/hr'          },
    { label: 'Activities & Clubs', icon: Sparkles,        to: '/admin/activities'    },
    { label: 'Assets & Supplies',  icon: Boxes,           to: '/faculty/inventory'   },
    { label: 'Student Results',    icon: BarChart2,       to: '/faculty/results'     },
  ],
  admin: [
    { label: 'Dashboard',          icon: LayoutDashboard, to: '/admin/dashboard'     },
    { label: 'Student Management', icon: GraduationCap,   to: '/admin/students'      },
    { label: 'Smart Attendance',   icon: UserCheck,       to: '/admin/attendance'    },
    { label: 'Scheduling & Cal',   icon: Clock,           to: '/admin/timetable'     },
    { label: 'Finance & Fees',     icon: CreditCard,      to: '/admin/finance'       },
    { label: 'Hostel Desk',        icon: Building,        to: '/admin/hostel'        },
    { label: 'Transport Desk',     icon: Bus,             to: '/admin/transport'     },
    { label: 'Placement Desk',     icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Activities & Clubs', icon: Sparkles,        to: '/admin/activities'    },
    { label: 'Inventory Desk',     icon: Boxes,           to: '/admin/inventory'     },
    { label: 'HR & Workforce',     icon: Users,           to: '/admin/hr'            },
    { label: 'Library Desk',       icon: Library,         to: '/admin/library'       },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  transport_manager: [
    { label: 'Transport Desk',     icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  placement_officer: [
    { label: 'Placement Desk',     icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  placement_coordinator: [
    { label: 'Placement Desk',     icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  driver: [
    { label: 'My Route & Trips',   icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  attendant: [
    { label: 'My Route & Trips',   icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  event_organizer: [
    { label: 'Activities & Clubs', icon: Sparkles,        to: '/admin/activities'    },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  club_coordinator: [
    { label: 'Activities & Clubs', icon: Sparkles,        to: '/admin/activities'    },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  warden: [
    { label: 'Hostel Desk',        icon: Building,        to: '/admin/hostel'        },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  librarian: [
    { label: 'Library Desk',       icon: Library,         to: '/admin/library'       },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  inventory_manager: [
    { label: 'Inventory Desk',     icon: Boxes,           to: '/admin/inventory'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  procurement_officer: [
    { label: 'Procurement Desk',   icon: Boxes,           to: '/admin/inventory'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  storekeeper: [
    { label: 'Inventory Desk',     icon: Boxes,           to: '/admin/inventory'     },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  hr_admin: [
    { label: 'HR & Workforce',     icon: Users,           to: '/admin/hr'            },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  hr_officer: [
    { label: 'HR & Workforce',     icon: Users,           to: '/admin/hr'            },
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',     icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  employee: [
    { label: 'HR Self-Service',    icon: Users,           to: '/employee/self-service'},
    { label: 'Notifications',      icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  parent: [
    { label: 'Dashboard',          icon: LayoutDashboard, to: '/parent/dashboard'    },
    { label: 'Attendance',         icon: CalendarCheck,   to: '/parent/dashboard'    },
    { label: 'Results',            icon: BarChart2,       to: '/parent/dashboard'    },
    { label: 'Complaints',         icon: Flag,            to: '/parent/dashboard'    },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/parent/ai-help'      },
  ],
  admission: [
    { label: 'Application Status', icon: LayoutDashboard, to: '/admission/dashboard' },
    { label: 'Upload Documents',   icon: Folder,          to: '/admission/dashboard' },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admission/ai-help'   },
  ],
};

const ROLE_BADGE_INFO = {
  student:               { label: 'STUDENT',     className: 'badge-student' },
  faculty:               { label: 'FACULTY',     className: 'badge-faculty' },
  admin:                 { label: 'ADMIN',       className: 'badge-admin' },
  warden:                { label: 'WARDEN',      className: 'badge-warden' },
  librarian:             { label: 'LIBRARIAN',   className: 'badge-librarian' },
  transport_manager:     { label: 'TRANSPORT',   className: 'badge-transport' },
  driver:                { label: 'DRIVER',      className: 'badge-transport' },
  attendant:             { label: 'ATTENDANT',   className: 'badge-transport' },
  placement_officer:     { label: 'PLACEMENT',   className: 'badge-placement' },
  placement_coordinator: { label: 'PLACEMENT',   className: 'badge-placement' },
  event_organizer:       { label: 'ACTIVITIES',  className: 'badge-activities' },
  club_coordinator:      { label: 'CLUBS',       className: 'badge-activities' },
  inventory_manager:     { label: 'INVENTORY',   className: 'badge-inventory' },
  procurement_officer:   { label: 'PROCUREMENT', className: 'badge-inventory' },
  storekeeper:           { label: 'STOREKEEPER', className: 'badge-inventory' },
  hr_admin:              { label: 'HR ADMIN',    className: 'badge-hr' },
  hr_officer:            { label: 'HR OFFICER',  className: 'badge-hr' },
  department_head:       { label: 'DEPT HEAD',   className: 'badge-faculty' },
  employee:              { label: 'STAFF',       className: 'badge-staff' },
  parent:                { label: 'PARENT',      className: 'badge-parent' },
  admission:             { label: 'ADMISSION',   className: 'badge-admission' },
};

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar, setIsCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || 'student';
  const navItems = NAV_CONFIG[role] || NAV_CONFIG.student;
  const homePath = `/${role}/dashboard`;

  const badgeInfo = ROLE_BADGE_INFO[role] || { label: role.toUpperCase(), className: 'badge-student' };

  // Auto-close on mobile route navigation
  const handleNavClick = () => {
    if (window.innerWidth <= 768 && setIsCollapsed) {
      setIsCollapsed(true);
    }
  };

  const handleLogout = async () => {
    await logout(navigate);
  };

  return (
    <>
      {/* ── Mobile Top Header (only visible on mobile <= 768px) ── */}
      <div className="cs-mobile-topbar">
        <button
          type="button"
          onClick={toggleSidebar}
          className="cs-mobile-toggle-btn"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <Link to={homePath} className="cs-mobile-brand" onClick={handleNavClick}>
          <img src="/campussphere-logo.png" alt="CampusSphere" className="cs-mobile-logo" />
          <span className="cs-mobile-title">CampusSphere</span>
          <span className={`cs-sidebar-role-badge ${badgeInfo.className}`}>
            {badgeInfo.label}
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="cs-mobile-user-avatar">
            {initials(user?.name)}
          </div>
        </div>
      </div>

      {/* ── Mobile Backdrop (when drawer is open on mobile) ── */}
      {!isCollapsed && (
        <div
          className="cs-sidebar-backdrop"
          onClick={() => setIsCollapsed && setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* ── Shared Unified Sidebar ── */}
      <aside className={`cs-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        {/* ── Top Header with Logo, Brand, Role Badge & Toggle ── */}
        <div className="cs-sidebar-header">
          <Link
            to={homePath}
            className="cs-sidebar-logo-link"
            title={`CampusSphere — ${badgeInfo.label}`}
            onClick={handleNavClick}
          >
            <img
              src="/campussphere-logo.png"
              alt="CampusSphere"
              className="cs-sidebar-logo-img"
            />
            {!isCollapsed && (
              <div className="cs-sidebar-brand-group">
                <span className="cs-sidebar-brand">CampusSphere</span>
                <span className={`cs-sidebar-role-badge ${badgeInfo.className}`}>
                  {badgeInfo.label}
                </span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="cs-sidebar-toggle-btn"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* ── User Information Block ── */}
        {!isCollapsed ? (
          <div className="cs-sidebar-user">
            <div className="cs-sidebar-avatar">{initials(user?.name)}</div>
            <div className="cs-sidebar-user-meta">
              <div className="cs-sidebar-user-name" title={user?.name}>
                {user?.name || 'User'}
              </div>
              <div className="cs-sidebar-user-role">
                {role === 'student'
                  ? `${user?.department || 'Computer Science'} • Sem 5`
                  : role === 'faculty'
                  ? `${user?.department || 'Faculty Department'}`
                  : `${role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')} Portal`}
              </div>
            </div>
          </div>
        ) : (
          <div className="cs-sidebar-user-collapsed" title={user?.name}>
            <div className="cs-sidebar-avatar-small">{initials(user?.name)}</div>
          </div>
        )}

        {/* ── Navigation Links ── */}
        <nav className="cs-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`cs-sidebar-item${isActive ? ' active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                onClick={handleNavClick}
              >
                <div className="cs-sidebar-icon">
                  <Icon size={18} />
                </div>
                {!isCollapsed && <span className="cs-sidebar-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer / Logout ── */}
        <div className="cs-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className="cs-sidebar-logout"
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <div className="cs-sidebar-icon">
              <LogOut size={18} />
            </div>
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
