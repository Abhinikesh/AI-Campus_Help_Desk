/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/student.service';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, Loader2
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import '../../styles/dashboard-shared.css';
import './Student.css';

// ── Nav items ─────────────────────────────────────────────────
const NAV = [
  { label: 'Dashboard',       icon: LayoutDashboard, to: '/student/dashboard' },
  { label: 'My Courses',      icon: BookOpen,         to: '/student/results'   },
  { label: 'Attendance',      icon: CalendarCheck,    to: '/student/attendance' },
  { label: 'Results & Grades',icon: BarChart2,        to: '/student/results'   },
  { label: 'Academic Drive',  icon: Folder,           to: '/student/drive'     },
  { label: 'Complaints',      icon: Flag,             to: '/student/complaints' },
  { label: 'AI Help Desk',    icon: MessageCircle,    to: '/student/ai-help'   },
];

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

// ══════════════════════════════════════════════════════════════
const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading,       setLoading]       = useState(true);
  const [profile,       setProfile]       = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints,    setComplaints]    = useState([]);
  const [activeNav,     setActiveNav]     = useState('Dashboard');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const [profRes, annRes, compRes] = await Promise.all([
          studentService.getProfile(),
          studentService.getAnnouncements(),
          studentService.getComplaints(),
        ]);
        if (profRes.success)  setProfile(profRes.data);
        if (annRes.success && annRes.data.length > 0)
          setAnnouncements(annRes.data.slice(0, 4));
        else if (profRes.success && profRes.data.announcements?.length)
          setAnnouncements(profRes.data.announcements.slice(0, 4));
        if (compRes.success)  setComplaints(compRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <span className="ds-loading-text">Loading Student Dashboard…</span>
      </div>
    );
  }

  const studentName  = profile?.userId?.name || user?.name || 'Student';
  const attendanceAvg = profile?.attendance?.length
    ? Math.round(
        profile.attendance.reduce((acc, s) =>
          acc + (s.total > 0 ? (s.attended / s.total) * 100 : 0), 0
        ) / profile.attendance.length
      )
    : 84;

  const cgpa = profile?.results?.length
    ? (profile.results.reduce((s, r) => s + (r.marks || 0), 0) /
       profile.results.length / 10).toFixed(1)
    : '8.4';

  // sample courses if none from API
  const SAMPLE_COURSES = [
    { code: 'CS301', name: 'Data Structures', faculty: 'Dr. Sharma', next: 'Mon 9:00 AM', progress: 68 },
    { code: 'CS302', name: 'Operating Systems', faculty: 'Prof. Mehta', next: 'Mon 11:00 AM', progress: 52 },
    { code: 'CS303', name: 'DBMS', faculty: 'Dr. Iyer', next: 'Tue 10:00 AM', progress: 80 },
  ];

  return (
    <div className="ds-shell">

      {/* ── SIDEBAR ── */}
      <aside className="ds-sidebar">
        <Link to="/" className="ds-sidebar-logo">
          <GraduationCap size={20} color="#1A56DB" strokeWidth={1.75} />
          <span className="ds-logo-text">
            CampusSphere <span className="ds-logo-ai">AI</span>
          </span>
        </Link>

        <div className="ds-user-block">
          <div className="ds-user-name">{studentName}</div>
          <span className="ds-role-pill">Student</span>
        </div>

        <nav className="ds-nav">
          {NAV.map(({ label, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              className={`ds-nav-item${activeNav === label ? ' active' : ''}`}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ds-sidebar-footer">
          <button className="ds-logout-btn" onClick={() => logout(navigate)}>
            <LogOut size={16} strokeWidth={1.75} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="ds-main">

        {/* Top header */}
        <header className="ds-header">
          <span className="ds-header-title">{activeNav}</span>
          <div className="ds-header-right">
            <button className="ds-bell-btn" aria-label="Notifications">
              <Bell size={18} />
              <span className="ds-bell-dot" />
            </button>
            <div className="ds-avatar">{initials(studentName)}</div>
          </div>
        </header>

        <div className="ds-content">

          {/* ── STAT CARDS ── */}
          <div className="ds-stat-row">
            <div className="ds-stat-card">
              <div className="ds-stat-label">Attendance</div>
              <div className="ds-stat-value">{attendanceAvg}%</div>
              <div className={`ds-stat-trend ${attendanceAvg < 75 ? 'down' : 'up'}`}>
                {attendanceAvg < 75 ? '▼ Below 75% threshold' : '▲ Above required limit'}
              </div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Courses Enrolled</div>
              <div className="ds-stat-value">{profile?.attendance?.length || 6}</div>
              <div className="ds-stat-trend neu">This semester</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Pending Assignments</div>
              <div className="ds-stat-value">3</div>
              <div className="ds-stat-trend down">▼ 2 due this week</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">CGPA</div>
              <div className="ds-stat-value">{cgpa}</div>
              <div className="ds-stat-trend up">▲ +0.2 this semester</div>
            </div>
          </div>

          {/* ── ATTENDANCE OVERVIEW ── */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Attendance Overview</span>
              <Link to="/student/attendance" className="ds-view-all">View All →</Link>
            </div>

            {/* Table */}
            <div className="ds-table-wrap" style={{ marginBottom: 20 }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Total Classes</th>
                    <th>Attended</th>
                    <th>Percentage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile?.attendance?.length ? profile.attendance : [
                    { subject: 'Data Structures',   code: 'CS301', total: 42, attended: 38 },
                    { subject: 'Operating Systems', code: 'CS302', total: 40, attended: 30 },
                    { subject: 'DBMS',              code: 'CS303', total: 38, attended: 36 },
                    { subject: 'Computer Networks', code: 'CS304', total: 36, attended: 20 },
                    { subject: 'Software Engg.',    code: 'CS305', total: 30, attended: 24 },
                  ]).map((s, i) => {
                    const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
                    return (
                      <tr key={i}>
                        <td className="bold">{s.subject}</td>
                        <td>{s.total}</td>
                        <td>{s.attended}</td>
                        <td>{pct}%</td>
                        <td><span className={`ds-pill ${pillClass(pct)}`}>{pillLabel(pct)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Progress bars */}
            <div>
              {(profile?.attendance?.length ? profile.attendance : [
                { subject: 'Data Structures',   total: 42, attended: 38 },
                { subject: 'Operating Systems', total: 40, attended: 30 },
                { subject: 'DBMS',              total: 38, attended: 36 },
                { subject: 'Computer Networks', total: 36, attended: 20 },
                { subject: 'Software Engg.',    total: 30, attended: 24 },
              ]).slice(0, 5).map((s, i) => {
                const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
                return (
                  <div key={i} className="att-subject-row">
                    <div className="att-subject-name">{s.subject}</div>
                    <div className="att-bar-wrap">
                      <div className="ds-bar-track">
                        <div className={`ds-bar-fill ${barClass(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="att-pct">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── MY COURSES ── */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">My Courses</span>
              <Link to="/student/results" className="ds-view-all">View All →</Link>
            </div>
            <div className="courses-grid">
              {SAMPLE_COURSES.map((c, i) => (
                <div key={i} className="course-card">
                  <div className="course-code">{c.code}</div>
                  <div className="course-name">{c.name}</div>
                  <div className="course-faculty">{c.faculty}</div>
                  <div className="course-next">{c.next}</div>
                  <div>
                    <div className="course-prog-label">
                      <span>Progress</span><span>{c.progress}%</span>
                    </div>
                    <div className="ds-bar-track" style={{ height: 6 }}>
                      <div className="ds-bar-fill" style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RESULTS TABLE ── */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Results & Grades</span>
              <Link to="/student/results" className="ds-view-all">View All →</Link>
            </div>
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Internal</th>
                    <th>External</th>
                    <th>Total</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile?.results?.length ? profile.results.slice(0, 5) : [
                    { subject: 'Data Structures',   internal: 28, external: 68, total: 96,  grade: 'O'  },
                    { subject: 'Operating Systems', internal: 24, external: 55, total: 79,  grade: 'B+' },
                    { subject: 'DBMS',              internal: 30, external: 72, total: 102, grade: 'O'  },
                    { subject: 'Computer Networks', internal: 20, external: 48, total: 68,  grade: 'C'  },
                    { subject: 'Software Engg.',    internal: 26, external: 60, total: 86,  grade: 'A'  },
                  ]).map((r, i) => (
                    <tr key={i}>
                      <td className="bold">{r.subject}</td>
                      <td>{r.internal ?? Math.round((r.marks||0) * 0.3)}</td>
                      <td>{r.external ?? Math.round((r.marks||0) * 0.7)}</td>
                      <td>{r.total ?? r.marks}</td>
                      <td><span className={`ds-pill ${gradePill(r.grade)}`}>{r.grade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 14, fontSize: 15, fontWeight: 700, color: '#111827' }}>
              CGPA: {cgpa}
            </div>
          </div>

          {/* ── BOTTOM: Announcements + Quick Links ── */}
          <div className="ds-two-col">
            {/* Announcements */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Announcements</span>
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
                <div className="ds-empty">No recent announcements.</div>
              )}
            </div>

            {/* Quick Links */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Quick Links</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'My Timetable',    to: '/student/exams',      icon: CalendarCheck },
                  { label: 'Academic Drive',  to: '/student/drive',      icon: Folder        },
                  { label: 'AI Help Desk',    to: '/student/ai-help',    icon: MessageCircle },
                  { label: 'Raise Complaint', to: '/student/complaints', icon: Flag          },
                  { label: 'Results',         to: '/student/results',    icon: BarChart2     },
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
      </div>
      <ChatWidget />
    </div>
  );
};

export default StudentDashboard;
