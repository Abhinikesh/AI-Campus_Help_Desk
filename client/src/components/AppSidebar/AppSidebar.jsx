/**
 * AppSidebar — Shared sidebar for ALL pages (student, faculty, admin).
 * Uses the same design as StudentDashboard (white, ds-sidebar).
 * Role-aware navigation.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Clock, Users,
  UserCheck, GraduationCap, Shield
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const STUDENT_NAV = [
  { label: 'Dashboard',      icon: LayoutDashboard, to: '/student/dashboard'  },
  { label: 'My Courses',     icon: BookOpen,         to: '/student/results'    },
  { label: 'Attendance',     icon: CalendarCheck,    to: '/student/attendance' },
  { label: 'Results',        icon: BarChart2,        to: '/student/results'    },
  { label: 'Exams',          icon: GraduationCap,    to: '/student/exams'      },
  { label: 'Drive',          icon: Folder,           to: '/student/drive'      },
  { label: 'Complaints',     icon: Flag,             to: '/student/complaints' },
  { label: 'AI Help Desk',   icon: MessageCircle,    to: '/student/ai-help'    },
];

const FACULTY_NAV = [
  { label: 'Dashboard',      icon: LayoutDashboard, to: '/faculty/dashboard'           },
  { label: 'Attendance',     icon: CalendarCheck,   to: '/faculty/attendance'          },
  { label: 'Timetable',      icon: Clock,           to: '/faculty/timetable'           },
  { label: 'Student Results',icon: BarChart2,        to: '/faculty/results'             },
  { label: 'Drive',          icon: Folder,          to: '/faculty/drive'               },
  { label: 'Complaints',     icon: Flag,            to: '/faculty/complaints'          },
  { label: 'AI Help Desk',   icon: MessageCircle,   to: '/faculty/ai-help'             },
];

const ADMIN_NAV = [
  { label: 'Dashboard',      icon: LayoutDashboard, to: '/admin/dashboard'    },
  { label: 'Attendance',     icon: UserCheck,       to: '/admin/attendance'   },
  { label: 'Complaints',     icon: Flag,            to: '/admin/complaints'   },
  { label: 'AI Help Desk',   icon: MessageCircle,   to: '/admin/ai-help'      },
];

const NAV_BY_ROLE = {
  student: STUDENT_NAV,
  faculty: FACULTY_NAV,
  admin: ADMIN_NAV,
};

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AppSidebar = ({ activeLabel }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role || 'student';
  const nav = NAV_BY_ROLE[role] || STUDENT_NAV;
  const dashboardPath = `/${role}/dashboard`;

  const handleLogout = async () => {
    await logout(navigate);
  };

  return (
    <aside className="ds-sidebar">
      {/* Logo */}
      <Link to={dashboardPath} className="ds-sidebar-logo">
        <img src="/campussphere-logo.png" alt="CampusSphere" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <span className="ds-logo-text">CampusSphere</span>
      </Link>

      {/* User Info */}
      <div className="ds-user-block">
        <div className="ds-avatar">{initials(user?.name)}</div>
        <div>
          <div className="ds-user-name">{user?.name || 'User'}</div>
          <div className="ds-user-role">{role.charAt(0).toUpperCase() + role.slice(1)}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="ds-nav">
        {nav.map(({ label, icon: Icon, to }) => {
          const isActive = location.pathname === to || (label === activeLabel);
          return (
            <Link
              key={to + label}
              to={to}
              className={`ds-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="ds-sidebar-footer">
        <button className="ds-logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;

