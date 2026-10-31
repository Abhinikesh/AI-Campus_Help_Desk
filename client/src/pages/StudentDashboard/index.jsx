/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { studentService } from '../../services/student.service';
import attendanceService from '../../services/attendance.service';
import Sidebar from '../../components/Sidebar/Sidebar';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, Loader2
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

// ══════════════════════════════════════════════════════════════
const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

  const [loading,       setLoading]       = useState(true);
  const [profile,       setProfile]       = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints,    setComplaints]    = useState([]);
  const [attendance,    setAttendance]    = useState([]);
  const [results,       setResults]       = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const [profRes, annRes, compRes, attRes, resRes] = await Promise.all([
          studentService.getProfile().catch(() => ({ success: false })),
          studentService.getAnnouncements().catch(() => ({ success: false })),
          studentService.getComplaints().catch(() => ({ success: false })),
          attendanceService.getStudentAttendance().catch(() => ({ success: false })),
          studentService.getResults().catch(() => ({ success: false })),
        ]);

        if (profRes.success)  setProfile(profRes.data);
        if (annRes.success && annRes.data.length > 0)
          setAnnouncements(annRes.data.slice(0, 4));
        if (compRes.success)  setComplaints(compRes.data);
        if (attRes.success && attRes.data?.length > 0)
          setAttendance(attRes.data);
        if (resRes.success && resRes.data?.length > 0)
          setResults(resRes.data);
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

  const studentName = profile?.fullName || profile?.userId?.name || user?.name || 'Student';
  const semester = profile?.semester || 5;
  const branch = profile?.branch || 'CSE';

  // 5th Sem real subjects attendance average
  const attendanceAvg = attendance.length
    ? Math.round(
        attendance.reduce((acc, s) =>
          acc + (s.total > 0 ? (s.attended / s.total) * 100 : 0), 0
        ) / attendance.length
      )
    : 88;

  const cgpa = results.length
    ? (results.reduce((s, r) => s + (r.marks || 0), 0) / results.length / 10).toFixed(1)
    : '8.6';

  // 5th Sem Courses
  const coursesList = [
    { code: 'CS501', name: 'Design Analysis of Algorithms (DAA)', faculty: 'Prof. Neha Singh', next: 'Mon 08:10 AM', progress: 85 },
    { code: 'CS502', name: 'Formal Languages and Automata Theory (FLAT)', faculty: 'Prof. Poonam Nandal', next: 'Mon 09:00 AM', progress: 80 },
    { code: 'CS503', name: 'AI Concepts & Applications (AICA)', faculty: 'Prof. Meeta Singh', next: 'Tue 08:10 AM', progress: 90 },
    { code: 'CS504', name: 'Computer Graphics (CG)', faculty: 'Prof. Ginni Sehgal', next: 'Tue 09:50 AM', progress: 75 },
    { code: 'CS505', name: 'Software Development Processes (SDP)', faculty: 'Prof. Swati Hans', next: 'Wed 08:10 AM', progress: 88 },
  ];

  const fallbackAttendance = [
    { subject: 'Design Analysis of Algorithms', code: 'CS501', total: 15, attended: 15 },
    { subject: 'Formal Languages and Automata Theory', code: 'CS502', total: 15, attended: 14 },
    { subject: 'Artificial Intelligence Concepts & Apps', code: 'CS503', total: 15, attended: 15 },
    { subject: 'Computer Graphics', code: 'CS504', total: 15, attended: 13 },
    { subject: 'Software Development Processes', code: 'CS505', total: 15, attended: 14 },
    { subject: 'Design Thinking & Innovation - III', code: 'CS506', total: 15, attended: 15 },
    { subject: 'Entrepreneurship & Startups', code: 'CS507', total: 15, attended: 14 },
  ];

  const displayAttendance = attendance.length > 0 ? attendance : fallbackAttendance;

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── MAIN CONTENT ── */}
      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Top header */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ds-header-title">Student Dashboard</span>
            <span className="ds-pill blue">Semester {semester} • {branch}</span>
          </div>
          <div className="ds-header-right">
            <button className="ds-bell-btn" aria-label="Notifications" title="Notifications">
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
              <div className="ds-stat-value">{displayAttendance.length}</div>
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
              <div className="ds-stat-trend up">▲ Current Semester</div>
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
                  {displayAttendance.slice(0, 7).map((s, i) => {
                    const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 100;
                    return (
                      <tr key={i}>
                        <td className="bold">{s.subject}</td>
                        <td><span className="ds-code-badge">{s.code || `CS50${i+1}`}</span></td>
                        <td>{s.total}</td>
                        <td>{s.attended}</td>
                        <td style={{ fontWeight: 600 }}>{pct}%</td>
                        <td><span className={`ds-pill ${pillClass(pct)}`}>{pillLabel(pct)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 5TH SEM COURSES ── */}
          <div className="ds-card">
            <div className="ds-card-header">
              <div>
                <span className="ds-section-title">Enrolled Courses (Semester {semester} CSE-A)</span>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6B7280' }}>
                  Official college timetable subjects and instructors
                </p>
              </div>
              <Link to="/student/results" className="ds-view-all">View Syllabus →</Link>
            </div>
            <div className="courses-grid">
              {coursesList.map((c, i) => (
                <div key={i} className="course-card">
                  <div className="course-code">{c.code}</div>
                  <div className="course-name">{c.name}</div>
                  <div className="course-faculty">{c.faculty}</div>
                  <div className="course-next">{c.next}</div>
                  <div>
                    <div className="course-prog-label">
                      <span>Course Progress</span><span>{c.progress}%</span>
                    </div>
                    <div className="ds-bar-track" style={{ height: 6 }}>
                      <div className="ds-bar-fill" style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
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
                  {(results.length > 0 ? results.slice(0, 5) : [
                    { subject: 'Design Analysis of Algorithms', code: 'CS501', credits: 4, marks: 88, grade: 'A' },
                    { subject: 'Formal Languages and Automata Theory', code: 'CS502', credits: 4, marks: 76, grade: 'B+' },
                    { subject: 'Artificial Intelligence Concepts & Apps', code: 'CS503', credits: 4, marks: 92, grade: 'A+' },
                    { subject: 'Computer Graphics', code: 'CS504', credits: 3, marks: 84, grade: 'A' },
                    { subject: 'Software Development Processes', code: 'CS505', credits: 3, marks: 80, grade: 'A' },
                  ]).map((r, i) => (
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
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 14, fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Cumulative CGPA: {cgpa} / 10
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
                  { label: 'Academic Drive',   to: '/student/drive',      icon: Folder        },
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
      </div>
    </div>
  );
};

export default StudentDashboard;
