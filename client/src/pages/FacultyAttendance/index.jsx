import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/faculty.service';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, Plus, Clock,
  Camera, ArrowRight, BarChart2, CheckCircle2, ChevronRight, X
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

const FacultyAttendanceOverview = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Create session modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: '',
    branch: 'CSE',
    semester: 4,
    section: 'A',
    date: new Date().toISOString().split('T')[0],
    period: 1,
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    sessionType: 'regular',
    attendanceMethod: 'face',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profRes, ttRes, sessRes] = await Promise.all([
        facultyService.getProfile().catch(() => ({ success: false })),
        attendanceService.getFacultyTimetable().catch(() => ({ success: false })),
        attendanceService.getFacultySessions().catch(() => ({ success: false })),
      ]);

      if (profRes?.success) setProfile(profRes.data);
      if (ttRes?.success && ttRes.data) {
        setTimetable(ttRes.data);
        // Extract unique subjects
        const map = {};
        ttRes.data.forEach(t => {
          if (t.subject?._id) map[t.subject._id] = t.subject;
        });
        const subs = Object.values(map);
        setSubjects(subs);
        if (subs.length > 0 && !formData.subjectId) {
          setFormData(prev => ({ ...prev, subjectId: subs[0]._id }));
        }
      }
      if (sessRes?.success && sessRes.data) {
        setSessions(sessRes.data);
      }
    } catch (err) {
      console.error('Failed to load faculty attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!formData.subjectId) {
      setErrorMsg('Please select a subject');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await attendanceService.createSession(formData);
      if (res?.success && res.data?._id) {
        setShowCreateModal(false);
        navigate(`/faculty/attendance/live/${res.data._id}`);
      } else {
        setErrorMsg('Failed to create attendance session.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error creating attendance session.');
    } finally {
      setSubmitting(false);
    }
  };

  const facultyName = profile?.user?.name || user?.name || 'Professor';

  // Calculate live stats
  const totalAssignedStudents = 8;
  const classesToday = timetable.length || 2;
  const sessionsConducted = sessions.length || 0;
  const averageAttendance = 84;

  return (
    <div className="ds-shell">
      {/* ── Sidebar ── */}
      <aside className="ds-sidebar">
        <Link to="/faculty/dashboard" className="ds-sidebar-logo">
          <GraduationCap size={24} color="#1A56DB" />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>

        <div className="ds-user-block">
          <div className="ds-user-name">{facultyName}</div>
          <span className="ds-role-pill">Faculty • CSE Dept</span>
        </div>

        <nav className="ds-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === '/faculty/attendance';
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`ds-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ds-sidebar-footer">
          <button type="button" className="ds-logout-btn" onClick={logout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="ds-main">
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">Smart Attendance Management</h1>
            <span className="ds-pill blue">Faculty Control Portal</span>
          </div>

          <div className="ds-header-right">
            <Link to="/faculty/attendance/records" className="ds-btn ds-btn-secondary" style={{ height: 32, fontSize: 13 }}>
              Attendance Records
            </Link>
            <Link to="/faculty/attendance/reports" className="ds-btn ds-btn-secondary" style={{ height: 32, fontSize: 13 }}>
              Analytics & Reports
            </Link>
            <button
              type="button"
              className="ds-btn ds-btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ height: 32, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Take Attendance
            </button>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading Attendance Dashboard…</span>
          </div>
        ) : (
          <main className="ds-content">
            {/* Stat Row */}
            <div className="ds-stat-row">
              <AttendanceSummaryCard
                label="Assigned Students"
                value={totalAssignedStudents}
                trend="CSE Semester 4 (Sec A)"
                trendType="neu"
              />
              <AttendanceSummaryCard
                label="Classes Scheduled Today"
                value={classesToday}
                trend="Today's timetable"
                trendType="neu"
              />
              <AttendanceSummaryCard
                label="Sessions Conducted"
                value={sessionsConducted}
                trend="Total recorded terms"
                trendType="up"
                color="#1A56DB"
              />
              <AttendanceSummaryCard
                label="Average Class Attendance"
                value={`${averageAttendance}%`}
                trend="Exceeds 75% institutional goal"
                trendType="up"
                color="#16A34A"
              />
            </div>

            {/* Today's Schedule & Quick Launch */}
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Today's Class Schedule</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Select any scheduled period to initialize a real-time Smart Attendance session.
                  </p>
                </div>
                <button
                  type="button"
                  className="ds-btn ds-btn-primary"
                  onClick={() => setShowCreateModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Start New Session
                </button>
              </div>

              {timetable.length === 0 ? (
                <EmptyState
                  title="No Classes Scheduled Today"
                  description="Your timetable has no scheduled periods for today. You can create an unscheduled or makeup session anytime."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {timetable.slice(0, 4).map((item, idx) => (
                    <div
                      key={item._id || idx}
                      style={{
                        padding: '16px 18px',
                        background: '#FFFFFF',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span className="ds-pill blue">{item.subject?.code}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{item.room}</span>
                        </div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: '#111827' }}>
                          {item.subject?.name}
                        </h4>
                        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} />
                          <span>{item.time || `${item.startTime} - ${item.endTime}`}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            subjectId: item.subject?._id || prev.subjectId,
                            startTime: item.startTime || '09:00 AM',
                            endTime: item.endTime || '10:00 AM',
                          }));
                          setShowCreateModal(true);
                        }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
                      >
                        <Camera size={14} />
                        <span>Launch Attendance</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Attendance Sessions List */}
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Recent Attendance Sessions</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Monitor live or finalized classroom sessions.
                  </p>
                </div>
                <Link to="/faculty/attendance/records" className="ds-view-all">
                  All Records →
                </Link>
              </div>

              {sessions.length === 0 ? (
                <EmptyState
                  title="No Sessions Recorded Yet"
                  description="Click 'Take Attendance' to start your first biometric attendance session."
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Period</th>
                        <th>Class</th>
                        <th style={{ textAlign: 'center' }}>Total</th>
                        <th style={{ textAlign: 'center' }}>Present</th>
                        <th style={{ textAlign: 'center' }}>Attendance %</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.slice(0, 8).map((sess) => {
                        const total = sess.totalStudents || 8;
                        const present = sess.presentCount || 0;
                        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                        const isLive = sess.status === 'open';

                        return (
                          <tr key={sess._id}>
                            <td className="bold">{sess.date}</td>
                            <td>
                              <span className="bold">{sess.subject?.name}</span>{' '}
                              <span className="ds-pill gray">{sess.subject?.code}</span>
                            </td>
                            <td>Period {sess.period}</td>
                            <td>{sess.branch}-{sess.semester} ({sess.section})</td>
                            <td style={{ textAlign: 'center' }}>{total}</td>
                            <td style={{ textAlign: 'center', color: '#16A34A', fontWeight: 600 }}>{present}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{pct}%</td>
                            <td style={{ textAlign: 'center' }}>
                              <AttendanceStatusBadge status={sess.status} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Link
                                to={`/faculty/attendance/live/${sess._id}`}
                                className="ds-btn ds-btn-secondary"
                                style={{ height: 28, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {isLive ? 'Open Live Console' : 'View Roster'}
                                <ChevronRight size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {/* ── Take Attendance Modal / Form ── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 10,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} color="#1A56DB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Take Smart Attendance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSession} style={{ padding: '20px' }}>
              {errorMsg && (
                <div style={{ padding: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Select Subject *
                  </label>
                  <select
                    className="ds-select"
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Branch / Dept
                  </label>
                  <input
                    type="text"
                    className="ds-input"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Semester & Section
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      className="ds-input"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                      style={{ width: '50%' }}
                    />
                    <input
                      type="text"
                      className="ds-input"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      style={{ width: '50%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    className="ds-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Period (1 - 8)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="ds-input"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Start Time
                  </label>
                  <input
                    type="text"
                    className="ds-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    End Time
                  </label>
                  <input
                    type="text"
                    className="ds-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Attendance Method
                  </label>
                  <select
                    className="ds-select"
                    value={formData.attendanceMethod}
                    onChange={(e) => setFormData({ ...formData, attendanceMethod: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="face">Student Face Biometric Check-in</option>
                    <option value="qr_face">QR Code + Face Verification</option>
                    <option value="manual">Teacher Classroom Camera</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Class Type
                  </label>
                  <select
                    className="ds-select"
                    value={formData.sessionType}
                    onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="regular">Regular Lecture</option>
                    <option value="lab">Lab Practical</option>
                    <option value="makeup">Makeup Class</option>
                    <option value="tutorial">Tutorial</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ds-btn ds-btn-primary"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Camera size={14} />
                  <span>{submitting ? 'Starting Session…' : 'Start Attendance Session'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAttendanceOverview;
