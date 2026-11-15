/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar, { NAV_CONFIG } from '../../components/Sidebar/Sidebar';
import AppHeader from '../../components/AppHeader/AppHeader';
import { facultyService } from '../../services/faculty.service';
import {
  LayoutDashboard, CalendarCheck, Users, BookOpen, Clock,
  Bell, Sparkles, Boxes, BarChart2,
  ChevronRight, X, Loader2, Search, ArrowRight
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Faculty.css';

// ── Curated Module Descriptions for Faculty Launcher Tiles ─────
const MODULE_DESCRIPTIONS = {
  '/faculty/students': 'Student 360 profiles, academic records & directory search',
  '/faculty/attendance': 'Smart attendance marking, lecture logs & reports',
  '/faculty/assignments': 'Course assignments, submissions & grading reviews',
  '/notifications': 'Official institutional circulars & academic notices',
  '/faculty/timetable': 'Weekly lecture schedule, periods & classroom allocations',
  '/faculty/hr': 'Faculty leave applications, attendance & HR self-service',
  '/admin/activities': 'Campus events, student clubs & activity coordination',
  '/faculty/inventory': 'Lab supplies, departmental assets & consumables requisition',
  '/faculty/results': 'Internal assessment scores & semester grade entry',
};

const FacultyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('modules'); // 'modules' | 'overview'
  const [loading,    setLoading]    = useState(true);
  const [profile,    setProfile]    = useState(null);
  const [timetable,  setTimetable]  = useState([]);
  const [overview,   setOverview]   = useState(null);

  // Attendance modal state
  const [showModal,    setShowModal]    = useState(false);
  const [selClass,     setSelClass]     = useState(null);
  const [students,     setStudents]     = useState([]);
  const [roster,       setRoster]       = useState({});
  const [submitting,   setSubmitting]   = useState(false);

  // Announcement state
  const [annText,   setAnnText]   = useState('');
  const [annTitle,  setAnnTitle]  = useState('');
  const [annTarget, setAnnTarget] = useState('student');
  const [posting,   setPosting]   = useState(false);

  // Quick Student 360 search state
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  // Dynamically derive authorized Faculty module destinations from navigation config
  const facultyModules = (NAV_CONFIG.faculty || []).filter(
    (item) => item.to !== '/faculty/dashboard'
  );

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (!quickSearchQuery.trim()) return;
    navigate(`/faculty/students?q=${encodeURIComponent(quickSearchQuery.trim())}`);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const [profRes, ttRes, overviewRes] = await Promise.all([
          facultyService.getProfile().catch(() => ({ success: false })),
          facultyService.getTimetable().catch(() => ({ success: false })),
          facultyService.getOverview().catch(() => ({ success: false })),
        ]);
        if (profRes?.success) setProfile(profRes.data);
        if (ttRes?.success)   setTimetable(ttRes.data);
        if (overviewRes?.success) setOverview(overviewRes.data);
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
      const subName = selClass.subject?.name || (typeof selClass.subject === 'string' ? selClass.subject : 'Class');
      const subCode = selClass.subject?.code || selClass.code || 'CS301';
      const data = students.map(s => ({
        studentId: s._id,
        status: roster[s._id],
        subjectName: subName,
      }));
      const res = await facultyService.markAttendance({ subjectCode: subCode, attendanceData: data });
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

  const facultyName = profile?.userId?.name || user?.name || 'Faculty Member';
  const departmentName = profile?.department || 'Computer Science & Engineering';
  const classesTodayCount = overview?.classesToday ?? (timetable.length > 0 ? timetable.length : 5);

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── MAIN ── */}
      <div className="ds-main">
        <AppHeader
          title="Faculty Portal"
          subtitle={`Semester 5 (2026–2027) • ${departmentName}`}
        />

        <div className="ds-content">

          {/* ── TOP WELCOME BANNER ── */}
          <div className="fd-welcome-banner">
            <div className="fd-welcome-left">
              <h2 className="fd-welcome-title">Welcome back, {facultyName}</h2>
              <p className="fd-welcome-subtitle">
                Access your course tools, lecture schedules, smart attendance, and departmental services.
              </p>
            </div>
            <div className="fd-welcome-badges">
              <div className="fd-quick-stat-badge">
                <span className="fd-stat-badge-label">Students</span>
                <span className="fd-stat-badge-val">{overview?.assignedStudentsCount ?? 8}</span>
              </div>
              <div className="fd-quick-stat-badge">
                <span className="fd-stat-badge-label">Classes</span>
                <span className="fd-stat-badge-val good">{classesTodayCount}</span>
              </div>
              <div className="fd-quick-stat-badge">
                <span className="fd-stat-badge-label">Avg Attn</span>
                <span className={`fd-stat-badge-val ${overview?.hasAttendanceData && overview.averageAttendance < 75 ? 'warn' : 'good'}`}>
                  {overview?.hasAttendanceData ? `${overview.averageAttendance}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── QUICK STUDENT 360 SEARCH BAR ── */}
          <div className="fd-search-card">
            <form onSubmit={handleQuickSearch} className="fd-search-form">
              <div className="fd-search-label">
                <Search size={18} style={{ color: '#1A56DB' }} />
                <span>Student 360:</span>
              </div>
              <div className="fd-search-input-wrap">
                <input
                  type="text"
                  className="fd-search-input"
                  placeholder="Quick search by Roll Number (e.g. 20240001) or Name…"
                  value={quickSearchQuery}
                  onChange={(e) => setQuickSearchQuery(e.target.value)}
                  aria-label="Search Student 360"
                />
              </div>
              <div className="fd-search-actions">
                <button type="submit" className="ds-btn primary sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Search</span>
                  <ArrowRight size={14} />
                </button>
                <Link to="/faculty/students" className="ds-btn outline sm" style={{ textDecoration: 'none' }}>
                  Directory
                </Link>
              </div>
            </form>
          </div>

          {/* ── VIEW SWITCHER TABS ── */}
          <div className="fd-view-tabs" role="tablist" aria-label="Faculty Dashboard Views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'modules'}
              className={`fd-view-tab ${activeView === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveView('modules')}
            >
              <LayoutDashboard size={15} />
              <span>Faculty Modules ({facultyModules.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'overview'}
              className={`fd-view-tab ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <CalendarCheck size={15} />
              <span>Faculty Overview & Schedule</span>
            </button>
          </div>

          {/* ── VIEW 1: MODULE LAUNCHER GRID (DEFAULT) ── */}
          {activeView === 'modules' && (
            <div className="fd-launcher-section">
              <div className="fd-modules-grid">
                {facultyModules.map((item) => {
                  const Icon = item.icon;
                  const desc = MODULE_DESCRIPTIONS[item.to] || 'Access faculty module';

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="fd-module-card"
                      title={`Open ${item.label}`}
                      aria-label={`Open ${item.label}`}
                    >
                      <div className="fd-module-card-top">
                        <div className="fd-module-icon-wrap">
                          <Icon size={20} className="fd-module-icon" />
                        </div>
                        <ChevronRight size={16} className="fd-module-arrow" />
                      </div>
                      <div className="fd-module-info">
                        <h3 className="fd-module-name">{item.label}</h3>
                        <p className="fd-module-desc">{desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Quick Schedule Snapshot Link Bar */}
              <div className="fd-glance-bar">
                <div className="fd-glance-left">
                  <span className="fd-glance-heading">Today's Schedule</span>
                  <span className="fd-glance-text">
                    {classesTodayCount} classes scheduled today • Ready for lecture logs and attendance marking
                  </span>
                </div>
                <button
                  type="button"
                  className="fd-glance-btn"
                  onClick={() => setActiveView('overview')}
                >
                  <span>View Schedule & Stats</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── VIEW 2: FACULTY OVERVIEW & SCHEDULE ── */}
          {activeView === 'overview' && (
            <div className="fd-overview-section">
              {/* STAT CARDS */}
              <div className="ds-stat-row">
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Total Students</div>
                  <div className="ds-stat-value">{overview?.assignedStudentsCount ?? 8}</div>
                  <div className="ds-stat-trend neu">Assigned sections</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Classes Today</div>
                  <div className="ds-stat-value">{overview?.classesToday ?? timetable.length ?? 0}</div>
                  <div className="ds-stat-trend neu">Scheduled</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Sessions Conducted</div>
                  <div className="ds-stat-value">{overview?.sessionsConducted ?? 0}</div>
                  <div className="ds-stat-trend neu">Completed sessions</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Avg Class Attendance</div>
                  <div className="ds-stat-value">
                    {overview?.hasAttendanceData ? `${overview.averageAttendance}%` : '—'}
                  </div>
                  <div className={`ds-stat-trend ${overview?.hasAttendanceData && overview.averageAttendance < 75 ? 'down' : 'up'}`}>
                    {overview?.hasAttendanceData
                      ? (overview.averageAttendance >= 75 ? '▲ Meets institutional goal' : '▼ Below 75% target')
                      : 'No completed sessions'}
                  </div>
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
                      {timetable.length > 0 ? timetable.map((slot, i) => {
                        const subName = slot.subject?.name || (typeof slot.subject === 'string' ? slot.subject : 'Subject');
                        const subCode = slot.subject?.code || slot.code || 'N/A';
                        return (
                          <tr key={slot._id || i}>
                            <td>{slot.time || `${slot.startTime} – ${slot.endTime}`}</td>
                            <td className="bold">{subName}</td>
                            <td><span className="ds-code-badge">{subCode}</span></td>
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
                        );
                      }) : (
                        [
                          { time: '08:10–09:00', subject: 'Design Analysis of Algorithms (DAA)', code: 'CS501', room: 'AS17', batch: '5 CSE-A' },
                          { time: '09:00–09:50', subject: 'Formal Languages & Automata Theory (FLAT)', code: 'CS502', room: 'AS17', batch: '5 CSE-A' },
                          { time: '09:50–10:40', subject: 'AI Concepts & Applications (AICA)', code: 'CS503', room: 'AS17', batch: '5 CSE-A' },
                          { time: '11:30–12:20', subject: 'Computer Graphics (CG)', code: 'CS504', room: 'AS17', batch: '5 CSE-A' },
                          { time: '13:10–14:00', subject: 'Software Development Processes (SDP)', code: 'CS505', room: 'AS17', batch: '5 CSE-A' },
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
                      { name: 'Design Analysis of Algorithms', code: 'CS501', credits: 4, semester: '5th' },
                      { name: 'Formal Languages and Automata Theory', code: 'CS502', credits: 4, semester: '5th' },
                      { name: 'AI Concepts & Applications', code: 'CS503', credits: 4, semester: '5th' },
                      { name: 'Computer Graphics', code: 'CS504', credits: 3, semester: '5th' },
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
                      { label: 'Student Directory',  to: '/faculty/students',   desc: 'Search and inspect Student 360 profiles' },
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
          )}

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
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Mark Attendance — {selClass.subject?.name || (typeof selClass.subject === 'string' ? selClass.subject : 'Class')}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  {selClass.subject?.code || selClass.code || ''} · Batch: {selClass.batch || 'All'}
                </div>
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
    </div>
  );
};

export default FacultyDashboard;
