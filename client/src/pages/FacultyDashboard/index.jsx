/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/faculty.service';
import {
  LayoutDashboard, BookOpen, CalendarCheck, Users, Megaphone,
  Folder, Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, X, Loader2
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import '../../styles/dashboard-shared.css';
import './Faculty.css';

const NAV = [
  { label: 'Dashboard',            icon: LayoutDashboard, to: '/faculty/dashboard'  },
  { label: 'My Classes',           icon: BookOpen,        to: '/faculty/timetable'  },
  { label: 'Attendance Mgmt',      icon: CalendarCheck,   to: '/faculty/attendance' },
  { label: 'Student Results',      icon: Users,           to: '/faculty/results'    },
  { label: 'Announcements',        icon: Megaphone,       to: '#'                   },
  { label: 'Academic Drive',       icon: Folder,          to: '/faculty/drive'      },
  { label: 'Complaints',           icon: Flag,            to: '/faculty/complaints' },
  { label: 'AI Help Desk',         icon: MessageCircle,   to: '/faculty/ai-help'    },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [profile,    setProfile]    = useState(null);
  const [timetable,  setTimetable]  = useState([]);
  const [activeNav,  setActiveNav]  = useState('Dashboard');

  // Attendance modal state
  const [showModal,    setShowModal]    = useState(false);
  const [selClass,     setSelClass]     = useState(null);
  const [students,     setStudents]     = useState([]);
  const [roster,       setRoster]       = useState({});
  const [submitting,   setSubmitting]   = useState(false);

  // Announcement state
  const [annText,  setAnnText]  = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annTarget,setAnnTarget]= useState('student');
  const [posting,  setPosting]  = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const [profRes, ttRes] = await Promise.all([
          facultyService.getProfile(),
          facultyService.getTimetable(),
        ]);
        if (profRes.success) setProfile(profRes.data);
        if (ttRes.success)   setTimetable(ttRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const openAttendance = async (slot) => {
    setSelClass(slot);
    setShowModal(true);
    setStudents([]);
    try {
      const res = await facultyService.getStudents();
      if (res.success) {
        setStudents(res.data);
        const init = {};
        res.data.forEach(s => { init[s._id] = 'Present'; });
        setRoster(init);
      }
    } catch { /* ignore */ }
  };

  const toggleStatus = (id) =>
    setRoster(prev => ({ ...prev, [id]: prev[id] === 'Present' ? 'Absent' : 'Present' }));

  const submitAttendance = async () => {
    setSubmitting(true);
    try {
      const data = students.map(s => ({
        studentId: s._id,
        status: roster[s._id],
        subjectName: selClass.subject,
      }));
      const res = await facultyService.markAttendance({ subjectCode: selClass.code, attendanceData: data });
      if (res.success) { setShowModal(false); setSelClass(null); }
    } finally { setSubmitting(false); }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annText.trim()) return;
    setPosting(true);
    try {
      await facultyService.createAnnouncement({
        title: annTitle,
        body: annText,
        targetRoles: [annTarget],
      });
      setAnnTitle(''); setAnnText('');
    } finally { setPosting(false); }
  };

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <span className="ds-loading-text">Loading Faculty Dashboard…</span>
      </div>
    );
  }

  const facultyName = profile?.userId?.name || user?.name || 'Faculty';

  return (
    <div className="ds-shell">

      {/* ── SIDEBAR ── */}
      <aside className="ds-sidebar">
        <Link to="/" className="ds-sidebar-logo">
          <GraduationCap size={20} color="#1A56DB" strokeWidth={1.75} />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>
        <div className="ds-user-block">
          <div className="ds-user-name">{facultyName}</div>
          <span className="ds-role-pill">Faculty</span>
        </div>
        <nav className="ds-nav">
          {NAV.map(({ label, icon: Icon, to }) => (
            <Link
              key={label} to={to}
              className={`ds-nav-item${activeNav === label ? ' active' : ''}`}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={16} strokeWidth={1.75} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ds-sidebar-footer">
          <button className="ds-logout-btn" onClick={() => logout(navigate)}>
            <LogOut size={16} strokeWidth={1.75} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="ds-main">
        <header className="ds-header">
          <span className="ds-header-title">{activeNav}</span>
          <div className="ds-header-right">
            <button className="ds-bell-btn"><Bell size={18} /><span className="ds-bell-dot" /></button>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        <div className="ds-content">

          {/* STAT CARDS */}
          <div className="ds-stat-row">
            <div className="ds-stat-card">
              <div className="ds-stat-label">Total Students</div>
              <div className="ds-stat-value">124</div>
              <div className="ds-stat-trend neu">Across all sections</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Classes Today</div>
              <div className="ds-stat-value">{timetable.length || 4}</div>
              <div className="ds-stat-trend neu">Scheduled</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Pending Evaluations</div>
              <div className="ds-stat-value">12</div>
              <div className="ds-stat-trend down">▼ Needs attention</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Avg Class Attendance</div>
              <div className="ds-stat-value">79%</div>
              <div className="ds-stat-trend up">▲ +3% this week</div>
            </div>
          </div>

          {/* TODAY'S TIMETABLE */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Today's Schedule</span>
            </div>
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Room</th>
                    <th>Batch</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.length > 0 ? timetable.map((slot, i) => (
                    <tr key={i}>
                      <td>{slot.startTime} – {slot.endTime}</td>
                      <td className="bold">{slot.subject}</td>
                      <td><span className="ds-code-badge">{slot.code}</span></td>
                      <td>{slot.room}</td>
                      <td>{slot.batch || 'All'}</td>
                      <td>
                        <button
                          className="ds-btn primary sm"
                          onClick={() => openAttendance(slot)}
                        >
                          Mark Attendance
                        </button>
                      </td>
                    </tr>
                  )) : (
                    [
                      { time: '9:00–10:00', subject: 'Data Structures', code: 'CS301', room: 'A101', batch: 'CS-3A' },
                      { time: '10:00–11:00', subject: 'Algorithms',      code: 'CS302', room: 'A102', batch: 'CS-3B' },
                      { time: '12:00–1:00',  subject: 'DBMS Lab',        code: 'CS303L', room: 'Lab 2', batch: 'CS-3A' },
                      { time: '2:00–3:00',   subject: 'OS Theory',       code: 'CS304', room: 'A105', batch: 'CS-3A' },
                    ].map((s, i) => (
                      <tr key={i}>
                        <td>{s.time}</td>
                        <td className="bold">{s.subject}</td>
                        <td><span className="ds-code-badge">{s.code}</span></td>
                        <td>{s.room}</td>
                        <td>{s.batch}</td>
                        <td>
                          <button className="ds-btn primary sm" onClick={() => openAttendance({ subject: s.subject, code: s.code, batch: s.batch })}>
                            Mark Attendance
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MY SUBJECTS + QUICK LINKS */}
          <div className="ds-two-col">
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">My Subjects</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(profile?.subjects?.length ? profile.subjects : [
                  { name: 'Data Structures', code: 'CS301', credits: 4, semester: '5th' },
                  { name: 'Algorithms',       code: 'CS302', credits: 4, semester: '5th' },
                  { name: 'DBMS',             code: 'CS303', credits: 3, semester: '5th' },
                ]).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F4F5F7' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{s.semester} Semester · {s.credits} Credits</div>
                    </div>
                    <span className="ds-code-badge">{s.code}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Department Links</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Attendance Records', to: '/faculty/attendance', desc: 'Review and update student presence' },
                  { label: 'Results Portal',     to: '/faculty/results',    desc: 'Submit internal and semester marks' },
                  { label: 'Student Complaints', to: '/faculty/complaints', desc: 'Review academic grievances' },
                ].map(({ label, to, desc }) => (
                  <Link key={label} to={to} className="ds-quicklink" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{label}</span>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </div>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{desc}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* POST ANNOUNCEMENT */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Post Announcement</span>
            </div>
            <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="ds-input" style={{ width: '100%' }}
                type="text" placeholder="Announcement title"
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
              />
              <textarea
                className="ds-textarea" rows={3}
                placeholder="Write your announcement…"
                value={annText}
                onChange={e => setAnnText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select className="ds-select" value={annTarget} onChange={e => setAnnTarget(e.target.value)}>
                  <option value="student">All Students</option>
                  <option value="parent">Parents</option>
                  <option value="faculty">Faculty Only</option>
                </select>
                <button className="ds-btn primary" type="submit" disabled={posting || !annTitle.trim() || !annText.trim()}>
                  {posting ? 'Posting…' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* ── ATTENDANCE MODAL ── */}
      {showModal && selClass && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Mark Attendance — {selClass.subject}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{selClass.code} · Batch: {selClass.batch || 'All'}</div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Student list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {students.length > 0 ? students.map(s => (
                <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F4F5F7' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.userId?.name || 'Unknown Student'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{s.rollNumber}</div>
                  </div>
                  <button
                    className={roster[s._id] === 'Present' ? 'ds-toggle-present' : 'ds-toggle-absent'}
                    onClick={() => toggleStatus(s._id)}
                  >
                    {roster[s._id] || 'Present'}
                  </button>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                  <Loader2 size={24} style={{ animation: 'dspin 0.7s linear infinite', margin: '0 auto 8px' }} />
                  Loading student roster…
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="ds-btn ghost" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
              <button className="ds-btn primary" onClick={submitAttendance} disabled={submitting || students.length === 0}>
                {submitting ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
};

export default FacultyDashboard;
