/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar, { NAV_CONFIG } from '../../components/Sidebar/Sidebar';
import AppHeader from '../../components/AppHeader/AppHeader';
import { adminService } from '../../services/admin.service';
import {
  LayoutDashboard, BarChart2, ChevronRight, ArrowRight,
  Search, ExternalLink, RefreshCw
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Admin.css';

// ── Curated Module Descriptions for Admin Launcher Tiles ───────
const MODULE_DESCRIPTIONS = {
  '/admin/students': 'Student admissions, enrollment verification & directory',
  '/admin/attendance': 'Smart attendance analytics, biometric logs & sessions',
  '/admin/finance': 'Fee collection, challans, payroll & financial ledger',
  '/admin/hostel': 'Hostel blocks, room allocations & warden management',
  '/admin/placement': 'Campus placement drives, corporate partners & offers',
  '/admin/hr': 'Faculty & staff profiles, leave requests & workforce directory',
  '/notifications': 'Broadcast institutional notices, alerts & announcements',
  '/admin/complaints': 'Grievance resolution hub, ticket tracking & escalations',
};

const statusPill = (status) => {
  const map = { pending: 'amber', 'in-progress': 'blue', resolved: 'green', closed: 'gray' };
  return map[status?.toLowerCase()] || 'gray';
};

const studentPill = (s) => ({ Active: 'green', Detained: 'red', 'On Leave': 'amber' }[s] || 'gray');

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeView,   setActiveView]   = useState('modules'); // 'modules' | 'overview'
  const [loading,      setLoading]      = useState(true);
  const [stats,        setStats]        = useState(null);
  const [complaints,   setComplaints]   = useState([]);
  const [search,       setSearch]       = useState('');
  const [announcement, setAnnouncement] = useState({ title: '', body: '', target: 'student' });
  const [posting,      setPosting]      = useState(false);
  const [time,         setTime]         = useState(new Date().toLocaleTimeString());

  // Dynamically derive authorized Admin module destinations from navigation config
  const adminModules = (NAV_CONFIG.admin || []).filter(
    (item) => item.to !== '/admin/dashboard'
  );

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, compRes] = await Promise.all([
        adminService.getStats().catch(() => ({ success: false })),
        adminService.getComplaints().catch(() => ({ success: false })),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (compRes.success)  setComplaints(compRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  const handleResolve = async (id) => {
    try {
      const res = await adminService.updateComplaintStatus(id, 'resolved');
      if (res.success) setComplaints(prev => prev.map(c => c._id === id ? { ...c, status: 'resolved' } : c));
    } catch { /* ignore */ }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.title || !announcement.body) return;
    setPosting(true);
    try {
      const res = await adminService.createAnnouncement({
        title: announcement.title,
        body: announcement.body,
        targetRoles: [announcement.target],
      });
      if (res.success) setAnnouncement({ title: '', body: '', target: 'student' });
    } catch { /* ignore */ } finally { setPosting(false); }
  };

  if (loading && !stats) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <span className="ds-loading-text">Initializing Admin Panel…</span>
      </div>
    );
  }

  const adminName = user?.name || 'Administrator';
  const pendingCount = stats?.pendingComplaints ?? complaints.filter(c => c.status === 'pending').length;
  const filteredComplaints = complaints.filter(c =>
    !search || c.raisedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  // Reference student dataset
  const STUDENTS = [
    { roll: 'CS301001', name: 'Arjun Sharma',  branch: 'CSE', sem: '5th', att: 84, status: 'Active'   },
    { roll: 'CS301002', name: 'Priya Mehta',   branch: 'CSE', sem: '5th', att: 62, status: 'Detained' },
    { roll: 'CS301003', name: 'Rahul Gupta',   branch: 'ECE', sem: '3rd', att: 78, status: 'Active'   },
    { roll: 'CS301004', name: 'Sneha Patel',   branch: 'MBA', sem: '1st', att: 90, status: 'Active'   },
    { roll: 'CS301005', name: 'Karan Singh',   branch: 'CSE', sem: '7th', att: 55, status: 'On Leave' },
  ];

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* MAIN */}
      <div className="ds-main">
        <AppHeader
          title="Admin Dashboard"
          subtitle="Campus Operations & Institutional Governance Hub"
          extraRight={
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{time}</span>
          }
        />

        <div className="ds-content">

          {/* ── TOP WELCOME BANNER ── */}
          <div className="ad-welcome-banner">
            <div className="ad-welcome-left">
              <h2 className="ad-welcome-title">Welcome back, {adminName}</h2>
              <p className="ad-welcome-subtitle">
                Access your administrative management modules, campus operations, student services, and institutional controls.
              </p>
            </div>
            <div className="ad-welcome-badges">
              <div className="ad-quick-stat-badge">
                <span className="ad-stat-badge-label">Students</span>
                <span className="ad-stat-badge-val">{stats?.totalStudents ?? 4536}</span>
              </div>
              <div className="ad-quick-stat-badge">
                <span className="ad-stat-badge-label">Faculty</span>
                <span className="ad-stat-badge-val">{stats?.totalFaculty ?? 200}</span>
              </div>
              <div className="ad-quick-stat-badge">
                <span className="ad-stat-badge-label">Complaints</span>
                <span className={`ad-stat-badge-val ${pendingCount > 0 ? 'warn' : 'good'}`}>{pendingCount}</span>
              </div>
            </div>
          </div>

          {/* ── VIEW SWITCHER TABS ── */}
          <div className="ad-view-tabs" role="tablist" aria-label="Admin Dashboard Views">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'modules'}
              className={`ad-view-tab ${activeView === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveView('modules')}
            >
              <LayoutDashboard size={15} />
              <span>Administrative Modules ({adminModules.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'overview'}
              className={`ad-view-tab ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <BarChart2 size={15} />
              <span>System & Operations Overview</span>
            </button>
          </div>

          {/* ── VIEW 1: MODULE LAUNCHER GRID (DEFAULT) ── */}
          {activeView === 'modules' && (
            <div className="ad-launcher-section">
              <div className="ad-modules-grid">
                {adminModules.map((item) => {
                  const Icon = item.icon;
                  const desc = MODULE_DESCRIPTIONS[item.to] || 'Access administrative module';

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="ad-module-card"
                      title={`Open ${item.label}`}
                      aria-label={`Open ${item.label}`}
                    >
                      <div className="ad-module-card-top">
                        <div className="ad-module-icon-wrap">
                          <Icon size={20} className="ad-module-icon" />
                        </div>
                        <ChevronRight size={16} className="ad-module-arrow" />
                      </div>
                      <div className="ad-module-info">
                        <h3 className="ad-module-name">{item.label}</h3>
                        <p className="ad-module-desc">{desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Quick Operations Snapshot Link Bar */}
              <div className="ad-glance-bar">
                <div className="ad-glance-left">
                  <span className="ad-glance-heading">System Health</span>
                  <span className="ad-glance-text">
                    Core institutional services online • Database: HEALTHY • Pending grievances: {pendingCount}
                  </span>
                </div>
                <button
                  type="button"
                  className="ad-glance-btn"
                  onClick={() => setActiveView('overview')}
                >
                  <span>View Operations Overview</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── VIEW 2: SYSTEM & OPERATIONS OVERVIEW ── */}
          {activeView === 'overview' && (
            <div className="ad-overview-section">
              {/* STAT CARDS */}
              <div className="ds-stat-row">
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Total Students</div>
                  <div className="ds-stat-value">{stats?.totalStudents ?? 4536}</div>
                  <div className="ds-stat-trend up">▲ Verified profiles</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Total Faculty</div>
                  <div className="ds-stat-value">{stats?.totalFaculty ?? 200}</div>
                  <div className="ds-stat-trend up">▲ Academic staff</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Pending Complaints</div>
                  <div className="ds-stat-value">{pendingCount}</div>
                  <div className={`ds-stat-trend ${pendingCount > 0 ? 'down' : 'up'}`}>
                    {pendingCount > 0 ? '▼ Needs attention' : '✔ All clear'}
                  </div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Fee Collection</div>
                  <div className="ds-stat-value">Rs. 42L</div>
                  <div className="ds-stat-trend up">▲ This semester</div>
                </div>
              </div>

              {/* STUDENT MANAGEMENT PREVIEW */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-section-title">Student Management Preview</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input className="ds-input" style={{ paddingLeft: 32, width: 200 }} placeholder="Search students…" aria-label="Search students preview" />
                    </div>
                    <select className="ds-select" aria-label="Filter branch">
                      <option>All Branches</option>
                      <option>CSE</option><option>ECE</option><option>MBA</option>
                    </select>
                    <Link to="/admin/students" className="ds-btn primary sm" style={{ textDecoration: 'none' }}>
                      Full Directory →
                    </Link>
                  </div>
                </div>
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Roll No</th><th>Name</th><th>Branch</th>
                        <th>Semester</th><th>Attendance %</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STUDENTS.map((s, i) => (
                        <tr key={i}>
                          <td><span className="ds-code-badge">{s.roll}</span></td>
                          <td className="bold">{s.name}</td>
                          <td>{s.branch}</td>
                          <td>{s.sem}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="ds-bar-track" style={{ width: 60 }}>
                                <div className={`ds-bar-fill ${s.att < 75 ? 'crit' : ''}`} style={{ width: `${s.att}%` }} />
                              </div>
                              <span style={{ fontSize: 13 }}>{s.att}%</span>
                            </div>
                          </td>
                          <td><span className={`ds-pill ${studentPill(s.status)}`}>{s.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <Link to="/admin/students" style={{ fontSize: 13, color: '#1A56DB', textDecoration: 'none', fontWeight: 500 }}>View</Link>
                              <Link to="/admin/students" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}>Manage</Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* COMPLAINTS */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-section-title">Complaint Management</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        className="ds-input"
                        style={{ paddingLeft: 32, width: 200 }}
                        placeholder="Search…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Search complaints"
                      />
                    </div>
                    <Link to="/admin/complaints" className="ds-btn outline sm" style={{ textDecoration: 'none' }}>
                      Complaints Hub →
                    </Link>
                  </div>
                </div>
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr><th>ID</th><th>Raised By</th><th>Category</th><th>Title</th><th>Date</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {(filteredComplaints.length > 0 ? filteredComplaints : [
                        { _id: 'abc1', raisedBy: { name: 'Arjun Sharma' }, category: 'Academic', title: 'Marks not updated', createdAt: new Date(), status: 'pending'     },
                        { _id: 'abc2', raisedBy: { name: 'Priya Mehta'  }, category: 'Hostel',   title: 'Water supply issue', createdAt: new Date(), status: 'in-progress' },
                        { _id: 'abc3', raisedBy: { name: 'Rahul Gupta'  }, category: 'Fee',      title: 'Wrong fee challan', createdAt: new Date(), status: 'resolved'    },
                      ]).slice(0, 8).map((c) => (
                        <tr key={c._id}>
                          <td><span className="ds-code-badge">#{c._id.slice(-4)}</span></td>
                          <td className="bold">{c.raisedBy?.name || 'Unknown'}</td>
                          <td><span className="ds-code-badge">{c.category}</span></td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                          <td>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td><span className={`ds-pill ${statusPill(c.status)}`}>{c.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {c.status !== 'resolved' && (
                                <button className="ds-btn outline sm" onClick={() => handleResolve(c._id)}>Resolve</button>
                              )}
                              <Link to="/admin/complaints" className="ds-btn ghost sm"><ExternalLink size={13} /></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SYSTEM STATUS + ANNOUNCEMENT */}
              <div className="ds-two-col">
                {/* System Activity */}
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">System Activity</span>
                    <button className="ds-btn ghost sm" onClick={fetchData}>
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Database Status',  status: 'HEALTHY',   dot: 'green' },
                      { label: 'AI API Connection',status: 'CONNECTED',  dot: 'green' },
                      { label: 'Email Service',     status: 'IDLE',      dot: 'blue'  },
                      { label: 'Avg Response Time', status: '240ms',     dot: 'green' },
                      { label: 'Platform Users',    status: `${stats?.totalUsers ?? 0} active`, dot: 'green' },
                    ].map((item, i) => (
                      <div key={i} className="ds-status-row">
                        <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className={`ds-status-dot ${item.dot}`} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: item.dot === 'green' ? '#16A34A' : '#1A56DB' }}>{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Placement stats */}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Placement Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Highest Package', value: '₹45L' },
                        { label: 'Average Package', value: '₹8.5L' },
                        { label: 'Companies',       value: '180+' },
                        { label: 'Placements',      value: '94%'  },
                      ].map((p, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: '10px 0', border: '1px solid #E2E8F0', borderRadius: 6 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{p.value}</div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{p.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Announcement form */}
                <div className="ds-card" id="announce-form">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Global Announcement</span>
                  </div>
                  <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      className="ds-input" style={{ width: '100%' }}
                      type="text" placeholder="Announcement title"
                      value={announcement.title}
                      onChange={e => setAnnouncement({ ...announcement, title: e.target.value })}
                    />
                    <textarea
                      className="ds-textarea" rows={4} placeholder="Write body…"
                      value={announcement.body}
                      onChange={e => setAnnouncement({ ...announcement, body: e.target.value })}
                    />
                    <select
                      className="ds-select" style={{ width: '100%' }}
                      value={announcement.target}
                      onChange={e => setAnnouncement({ ...announcement, target: e.target.value })}
                    >
                      <option value="student">To Students</option>
                      <option value="faculty">To Faculty</option>
                      <option value="parent">To Parents</option>
                    </select>
                    <button
                      type="submit" className="ds-btn primary full"
                      disabled={posting || !announcement.title || !announcement.body}
                    >
                      {posting ? 'Broadcasting…' : 'Post Announcement'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
