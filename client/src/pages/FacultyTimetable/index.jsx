import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import attendanceService from '../../services/attendance.service';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, Clock,
  MapPin, Camera, Calendar
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/faculty/dashboard'  },
  { label: 'My Classes',       icon: BookOpen,        to: '/faculty/timetable'  },
  { label: 'Attendance Mgmt',  icon: CalendarCheck,   to: '/faculty/attendance' },
  { label: 'Student Results',  icon: Users,           to: '/faculty/results'    },
  { label: 'Announcements',    icon: Megaphone,       to: '/faculty/dashboard'  },
  { label: 'Academic Drive',   icon: Folder,          to: '/faculty/drive'      },
  { label: 'Complaints',       icon: Flag,            to: '/faculty/complaints' },
  { label: 'AI Help Desk',     icon: MessageCircle,   to: '/faculty/ai-help'    },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const FacultyTimetable = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState([]);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true);
        const res = await attendanceService.getFacultyTimetable();
        if (res?.success && res.data) {
          setTimetable(res.data);
        }
      } catch (err) {
        console.error('Error fetching timetable:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, []);

  const facultyName = user?.name || 'Professor';
  const { isCollapsed } = useSidebar();

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── Main Content ── */}
      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">My Weekly Teaching Timetable</h1>
            <span className="ds-pill blue">Semester 5 (2026–2027)</span>
          </div>

          <div className="ds-header-right">
            <Link to="/faculty/attendance" className="ds-btn ds-btn-primary" style={{ height: 32, fontSize: 13 }}>
              Attendance Portal
            </Link>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading teaching schedule…</span>
          </div>
        ) : (
          <main className="ds-content">
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Classroom Periods & Lecture Halls</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Click "Launch Smart Attendance" on any class to start facial verification.
                  </p>
                </div>
              </div>

              {timetable.length === 0 ? (
                <EmptyState
                  title="No Timetable Entries"
                  description="No teaching periods have been assigned to your profile for this semester."
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Day of Week</th>
                        <th>Scheduled Time</th>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Venue / Room</th>
                        <th>Semester / Branch</th>
                        <th style={{ textAlign: 'right' }}>Smart Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timetable.map((tt) => (
                        <tr key={tt._id}>
                          <td className="bold">{tt.dayName || 'Monday'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E293B' }}>
                              <Clock size={13} color="#1A56DB" />
                              <span>{tt.time || `${tt.startTime} - ${tt.endTime}`}</span>
                            </div>
                          </td>
                          <td><span className="ds-pill blue">{tt.subject?.code}</span></td>
                          <td className="bold">{tt.subject?.name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563' }}>
                              <MapPin size={13} />
                              <span>{tt.room}</span>
                            </div>
                          </td>
                          <td>{tt.subject?.branch || 'CSE'} - Sem {tt.subject?.semester || 4}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Link
                              to="/faculty/attendance"
                              className="ds-btn ds-btn-secondary"
                              style={{ height: 28, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Camera size={13} />
                              <span>Start Attendance</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default FacultyTimetable;
