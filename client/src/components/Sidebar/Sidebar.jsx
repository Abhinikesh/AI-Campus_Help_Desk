import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Clock,
  ChevronLeft, ChevronRight, Menu, GraduationCap, UserCheck, Bell, CreditCard, Library,
  Building, Bus, Briefcase
} from 'lucide-react';
import './Sidebar.css';

const NAV_CONFIG = {
  student: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/student/dashboard'   },
    { label: 'Attendance',       icon: CalendarCheck,   to: '/student/attendance'  },
    { label: 'Timetable & Cal',  icon: Clock,           to: '/student/timetable'   },
    { label: 'Assignments',      icon: BookOpen,        to: '/student/assignments' },
    { label: 'Fees & Payments',  icon: CreditCard,      to: '/student/fees'        },
    { label: 'Hostel & Housing', icon: Building,        to: '/student/hostel'      },
    { label: 'Campus Transport', icon: Bus,             to: '/student/transport'   },
    { label: 'Placement Cell',   icon: Briefcase,       to: '/student/placement'   },
    { label: 'Library & Books',  icon: Library,         to: '/student/library'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Results & Grades', icon: BarChart2,       to: '/student/results'     },
    { label: 'Exam Schedule',    icon: GraduationCap,   to: '/student/exams'       },
    { label: 'Academic Drive',   icon: Folder,          to: '/student/drive'       },
    { label: 'Complaints',       icon: Flag,            to: '/student/complaints'  },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/student/ai-help'     },
  ],
  faculty: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/faculty/dashboard'   },
    { label: 'Smart Attendance', icon: CalendarCheck,   to: '/faculty/attendance'  },
    { label: 'Assignments',      icon: BookOpen,        to: '/faculty/assignments' },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Weekly Timetable', icon: Clock,           to: '/faculty/timetable'   },
    { label: 'Student Results',  icon: BarChart2,       to: '/faculty/results'     },
    { label: 'Academic Drive',   icon: Folder,          to: '/faculty/drive'       },
    { label: 'Complaints',       icon: Flag,            to: '/faculty/complaints'  },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/faculty/ai-help'     },
  ],
  admin: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/admin/dashboard'     },
    { label: 'Smart Attendance', icon: UserCheck,       to: '/admin/attendance'    },
    { label: 'Scheduling & Cal', icon: Clock,           to: '/admin/timetable'     },
    { label: 'Finance & Fees',   icon: CreditCard,      to: '/admin/finance'       },
    { label: 'Hostel Desk',      icon: Building,        to: '/admin/hostel'        },
    { label: 'Transport Desk',   icon: Bus,             to: '/admin/transport'     },
    { label: 'Placement Desk',   icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Library Desk',     icon: Library,         to: '/admin/library'       },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  transport_manager: [
    { label: 'Transport Desk',   icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  placement_officer: [
    { label: 'Placement Desk',   icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  placement_coordinator: [
    { label: 'Placement Desk',   icon: Briefcase,       to: '/admin/placement'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  driver: [
    { label: 'My Route & Trips', icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  attendant: [
    { label: 'My Route & Trips', icon: Bus,             to: '/admin/transport'     },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  warden: [
    { label: 'Hostel Desk',      icon: Building,        to: '/admin/hostel'        },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  librarian: [
    { label: 'Library Desk',     icon: Library,         to: '/admin/library'       },
    { label: 'Notifications',    icon: Bell,            to: '/notifications'       },
    { label: 'Complaints Hub',   icon: Flag,            to: '/admin/complaints'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/admin/ai-help'       },
  ],
  parent: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/parent/dashboard'    },
    { label: 'Attendance',       icon: CalendarCheck,   to: '/parent/dashboard'    },
    { label: 'Results',          icon: BarChart2,       to: '/parent/dashboard'    },
    { label: 'Complaints',       icon: Flag,            to: '/parent/dashboard'    },
    { label: 'AI Help Desk',     icon: MessageCircle,   to: '/parent/ai-help'      },
  ],
  admission: [
    { label: 'Application Status', icon: LayoutDashboard, to: '/admission/dashboard' },
    { label: 'Upload Documents',   icon: Folder,          to: '/admission/dashboard' },
    { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admission/ai-help'   },
  ],
};

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || 'student';
  const navItems = NAV_CONFIG[role] || NAV_CONFIG.student;
  const homePath = `/${role}/dashboard`;

  const handleLogout = async () => {
    await logout(navigate);
  };

  const width = isCollapsed ? 64 : 240;

  return (
    <aside className="cs-sidebar" style={{ width }}>
      {/* ── Top Header with Logo & Toggle ── */}
      <div className="cs-sidebar-header">
        <Link to={homePath} className="cs-sidebar-logo-link" title="CampusSphere Home">
          <img
            src="/campussphere-logo.png"
            alt="CampusSphere"
            className="cs-sidebar-logo-img"
          />
          {!isCollapsed && <span className="cs-sidebar-brand">CampusSphere</span>}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="cs-sidebar-toggle-btn"
          title={isCollapsed ? 'Expand panel' : 'Minimize panel'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── User Information (only when expanded) ── */}
      {!isCollapsed && (
        <div className="cs-sidebar-user">
          <div className="cs-sidebar-avatar">{initials(user?.name)}</div>
          <div className="cs-sidebar-user-meta">
            <div className="cs-sidebar-user-name" title={user?.name}>
              {user?.name || 'User'}
            </div>
            <div className="cs-sidebar-user-role">
              {role.charAt(0).toUpperCase() + role.slice(1)} • Sem 5
            </div>
          </div>
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
              style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
            >
              <div className="cs-sidebar-icon">
                <Icon size={18} />
              </div>
              {!isCollapsed && <span>{item.label}</span>}
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
          style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
        >
          <div className="cs-sidebar-icon">
            <LogOut size={18} />
          </div>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
