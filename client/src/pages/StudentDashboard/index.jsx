/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { studentService } from '../../services/student.service';
import attendanceService from '../../services/attendance.service';
import Sidebar, { NAV_CONFIG } from '../../components/Sidebar/Sidebar';
import AppHeader from '../../components/AppHeader/AppHeader';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, Loader2, ArrowRight
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Student.css';

// ── Initials helper ───────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ── Attendance bar color ──────────────────────────────────────
const barClass = (pct) =>
  pct >= 75 ? '' : pct >= 60 ? 'warn' : 'crit';

const pillClass = (pct) =>
  pct >= 75 ? 'green' : pct >= 60 ? 'amber' : 'red';

const pillLabel = (pct) =>
  pct >= 75 ? 'Good' : pct >= 60 ? 'Low' : 'Critical';

// ── Grade pill ────────────────────────────────────────────────
const gradePill = (grade = '') => {
  if (['O', 'A+', 'A'].includes(grade)) return 'green';
  if (['B+', 'B'].includes(grade))      return 'blue';
  if (['C', 'D'].includes(grade))       return 'amber';
  return 'red';
};

// ── Curated Module Descriptions for Launcher Tiles ─────────────
const MODULE_DESCRIPTIONS = {
  '/student/attendance': 'Lecture presence, biometric logs & smart check-in',
  '/student/timetable': 'Weekly class schedule, periods & academic calendar',
  '/student/assignments': 'Subject coursework, deadlines & online submissions',
  '/student/fees': 'Tuition fee payments, receipts & online clearance',
  '/student/hostel': 'Hostel room allocation, mess schedule & facilities',
  '/student/placement': 'Campus recruitment drives, internships & interviews',
  '/notifications': 'Institutional notices, academic circulars & alerts',
  '/student/results': 'Semester marks, GPA evaluation & grade sheets',
  '/student/exams': 'Upcoming term exams, datesheet & hall tickets',
  '/student/complaints': 'Student grievance filing & status tracking',
  '/student/ai-help': '24/7 intelligent campus assistance & resolution',
};

// ══════════════════════════════════════════════════════════════
const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

  const [activeView,    setActiveView]    = useState('modules');
  const [loading,       setLoading]       = useState(true);
  const [profile,       setProfile]       = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints,    setComplaints]    = useState([]);
  const [attendance,    setAttendance]    = useState([]);
  const [results,       setResults]       = useState([]);

  // Dynamically derive authorized Student module destinations from navigation config
  const studentModules = (NAV_CONFIG.student || []).filter(
    (item) => item.to !== '/student/dashboard'
  );

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setAnnouncements([]);
      setComplaints([]);
      setAttendance([]);
      setResults([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const [profRes, annRes, compRes, attRes, resRes] = await Promise.all([
          studentService.getProfile().catch((err) => {
            if (err?.response?.status === 401) {
              logout(navigate);
            }
            return { success: false };
          }),
          studentService.getAnnouncements().catch(() => ({ success: false })),
          studentService.getComplaints().catch(() => ({ success: false })),
          attendanceService.getStudentAttendance().catch(() => ({ success: false })),
          studentService.getResults().catch(() => ({ success: false })),
        ]);

        if (profRes.success)  setProfile(profRes.data);
        if (annRes.success && annRes.data?.length > 0)
          setAnnouncements(annRes.data.slice(0, 4));
        if (compRes.success)  setComplaints(compRes.data || []);
        if (attRes.success && attRes.data?.length > 0)
          setAttendance(attRes.data);
        else setAttendance([]);
        if (resRes.success && resRes.data?.length > 0)
          setResults(resRes.data);
        else setResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, logout, navigate]);

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <span className="ds-loading-text">Loading Student Dashboard…</span>
      </div>
    );
  }

  const studentName = profile?.fullName || profile?.user?.name || user?.name || 'Student';
  const semester = profile?.semester != null ? profile.semester : '--';
  const branch = profile?.branch || '--';

  // Authoritative subjects attendance average from real records
  const attendanceAvg = attendance.length
    ? Math.round(
        attendance.reduce((acc, s) =>
          acc + (s.total > 0 ? (s.attended / s.total) * 100 : 0), 0
        ) / attendance.length
      )
    : null;

  // Real CGPA computed from published results
  const cgpa = results.length
    ? (results.reduce((s, r) => s + (r.marks || 0), 0) / results.length / 10).toFixed(1)
    : '--';

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── MAIN CONTENT ── */}
      <div className="ds-main">
        {/* Top header */}
        <AppHeader
          title="Student Dashboard"
          subtitle={`Semester ${semester} • ${branch}`}
        />

        <div className="ds-content">

          {/* ── Top Welcome & Overview Banner ── */}
          <div className="sd-welcome-banner">
            <div className="sd-welcome-left">
              <h2 className="sd-welcome-title">Welcome back, {studentName}</h2>
              <p className="sd-welcome-subtitle">
                Access your campus modules, lecture attendance, course schedules, and student services.
              </p>
            </div>
            <div className="sd-welcome-badges">
              <div className="sd-quick-stat-badge">
                <span className="sd-stat-badge-label">Attendance</span>
                <span className={`sd-stat-badge-val ${attendanceAvg < 75 ? 'warn' : 'good'}`}>
                  {attendanceAvg}%
                </span>
              </div>
              <div className="sd-quick-stat-badge">
                <span className="sd-stat-badge-label">CGPA</span>
                <span className="sd-stat-badge-val good">{cgpa}</span>
              </div>
              <div className="sd-quick-stat-badge">
                <span className="sd-stat-badge-label">Courses</span>
                <span className="sd-stat-badge-val">{displayAttendance.length}</span>
              </div>
            </div>
          </div>

          {/* ── View Switcher: Module Launcher vs Detailed Analytics ── */}
          <div className="sd-view-tabs" role="tablist" aria-label="Student Dashboard Views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'modules'}
              className={`sd-view-tab ${activeView === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveView('modules')}
            >
              <LayoutDashboard size={15} />
              <span>Campus Modules ({studentModules.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'analytics'}
              className={`sd-view-tab ${activeView === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveView('analytics')}
            >
              <BarChart2 size={15} />
              <span>Academic & Course Overview</span>
            </button>
          </div>

          {/* ── VIEW 1: MODULE LAUNCHER GRID (DEFAULT) ── */}
          {activeView === 'modules' && (
            <div className="sd-launcher-section">
              <div className="sd-modules-grid">
                {studentModules.map((item) => {
                  const Icon = item.icon;
                  const desc = MODULE_DESCRIPTIONS[item.to] || 'Access student module';

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="sd-module-card"
                      title={`Open ${item.label}`}
                      aria-label={`Open ${item.label}`}
                    >
                      <div className="sd-module-card-top">
                        <div className="sd-module-icon-wrap">
                          <Icon size={20} className="sd-module-icon" />
                        </div>
                        <ChevronRight size={16} className="sd-module-arrow" />
                      </div>
                      <div className="sd-module-info">
                        <h3 className="sd-module-name">{item.label}</h3>
                        <p className="sd-module-desc">{desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Quick Academic Snapshot Link Bar */}
              <div className="sd-glance-bar">
                <div className="sd-glance-left">
                  <span className="sd-glance-heading">Academic Snapshot</span>
                  <span className="sd-glance-text">
                    Semester {semester} {branch} • {displayAttendance.length} enrolled courses • Attendance: {attendanceAvg}% • CGPA: {cgpa}
                  </span>
                </div>
                <button
                  type="button"
                  className="sd-glance-btn"
                  onClick={() => setActiveView('analytics')}
                >
                  <span>Detailed Analytics & Marksheet</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── VIEW 2: DETAILED ACADEMIC & COURSE OVERVIEW ── */}
          {activeView === 'analytics' && (
            <div className="sd-analytics-section">
              {/* ── STAT CARDS ── */}
              <div className="ds-stat-row">
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Attendance</div>
                  <div className="ds-stat-value">{attendanceAvg != null ? `${attendanceAvg}%` : '--'}</div>
                  <div className={`ds-stat-trend ${attendanceAvg != null && attendanceAvg < 75 ? 'down' : 'up'}`}>
                    {attendanceAvg != null ? (attendanceAvg < 75 ? '▼ Below 75% threshold' : '▲ Above required limit') : 'No attendance logs'}
                  </div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Courses Logged</div>
                  <div className="ds-stat-value">{attendance.length}</div>
                  <div className="ds-stat-trend neu">Semester {semester}</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Active Grievances</div>
                  <div className="ds-stat-value">{complaints.length}</div>
                  <div className="ds-stat-trend neu">Campus Issues</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">CGPA</div>
                  <div className="ds-stat-value">{cgpa}</div>
                  <div className="ds-stat-trend up">{cgpa !== '--' ? '▲ Current Semester' : 'Awaiting publication'}</div>
                </div>
              </div>

              {/* ── ATTENDANCE OVERVIEW ── */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <span className="ds-section-title">Attendance Overview (Semester {semester})</span>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6B7280' }}>
                      Real-time lecture presence and biometric logs
                    </p>
                  </div>
                  <Link to="/student/attendance" className="ds-view-all">View All →</Link>
                </div>

                {/* Table */}
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Total Classes</th>
                        <th>Attended</th>
                        <th>Percentage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.length > 0 ? (
                        attendance.slice(0, 7).map((s, i) => {
                          const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 100;
                          return (
                            <tr key={i}>
                              <td className="bold">{s.subject}</td>
                              <td><span className="ds-code-badge">{s.code || '--'}</span></td>
                              <td>{s.total}</td>
                              <td>{s.attended}</td>
                              <td style={{ fontWeight: 600 }}>{pct}%</td>
                              <td><span className={`ds-pill ${pillClass(pct)}`}>{pillLabel(pct)}</span></td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', padding: '24px' }}>
                            No lecture attendance records logged for current semester yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── RESULTS & GRADES ── */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-section-title">Academic Results & Grades (Semester {semester})</span>
                  <Link to="/student/results" className="ds-view-all">Full Marksheet →</Link>
                </div>
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Credits</th>
                        <th>Marks</th>
                        <th>Grade</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.length > 0 ? (
                        results.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="bold">{r.subject}</td>
                            <td><span className="ds-code-badge">{r.code}</span></td>
                            <td>{r.credits || 3}</td>
                            <td style={{ fontWeight: 600 }}>{r.marks} / 100</td>
                            <td>
                              <span className={`ds-pill ${gradePill(r.grade)}`}>
                                {r.grade}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13 }}>
                                Pass
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', padding: '24px' }}>
                            No published examination results recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ textAlign: 'right', marginTop: 14, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                  Cumulative CGPA: {cgpa !== '--' ? `${cgpa} / 10` : 'Not Available'}
                </div>
              </div>

              {/* ── BOTTOM: Announcements + Quick Links ── */}
              <div className="ds-two-col">
                {/* Announcements */}
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Campus Announcements</span>
                  </div>
                  {announcements.length > 0 ? announcements.map((ann, i) => (
                    <div key={ann._id || i} className="ann-item">
                      <div className="ann-top">
                        <span className="ann-title">{ann.title}</span>
                        <span className="ann-date">{new Date(ann.date || ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="ann-body">{ann.body}</div>
                    </div>
                  )) : (
                    <div className="ds-empty">No new announcements at this time.</div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Quick Portals</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Smart Attendance', to: '/student/attendance', icon: CalendarCheck },
                      { label: 'Semester Exams',   to: '/student/exams',      icon: GraduationCap },
                      { label: 'Marks & Results',  to: '/student/results',    icon: BarChart2     },
                      { label: 'Campus Grievance', to: '/student/complaints', icon: Flag          },
                      { label: 'AI Help Desk',     to: '/student/ai-help',    icon: MessageCircle },
                    ].map(({ label, to, icon: Icon }) => (
                      <Link key={label} to={to} className="ds-quicklink">
                        <div className="ds-quicklink-left">
                          <Icon size={16} color="#1A56DB" strokeWidth={1.75} />
                          {label}
                        </div>
                        <ChevronRight size={16} color="#9CA3AF" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
