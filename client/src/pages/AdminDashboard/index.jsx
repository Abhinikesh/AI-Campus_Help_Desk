/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin.service';
import {
  LayoutDashboard, Users, UserCheck, AlertTriangle, CreditCard,
  Flag, Megaphone, Settings, MessageCircle, LogOut, Bell,
  GraduationCap, Search, ExternalLink, RefreshCw
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import '../../styles/dashboard-shared.css';
import './Admin.css';

const NAV = [
  { label: 'Dashboard',          icon: LayoutDashboard, to: '/admin/dashboard'  },
  { label: 'Student Management', icon: Users,           to: '/admin/dashboard'  },
  { label: 'Faculty Management', icon: UserCheck,       to: '/admin/dashboard'  },
  { label: 'Attendance Reports', icon: AlertTriangle,   to: '/admin/dashboard'  },
  { label: 'Fee Management',     icon: CreditCard,      to: '/admin/dashboard'  },
  { label: 'Complaints',         icon: Flag,            to: '/admin/dashboard'  },
  { label: 'Announcements',      icon: Megaphone,       to: '/admin/dashboard'  },
  { label: 'System Settings',    icon: Settings,        to: '/admin/dashboard'  },
  { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'    },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const statusPill = (status) => {
  const map = { pending: 'amber', 'in-progress': 'blue', resolved: 'green', closed: 'gray' };
  return map[status?.toLowerCase()] || 'gray';
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [stats,        setStats]        = useState(null);
  const [complaints,   setComplaints]   = useState([]);
  const [activeNav,    setActiveNav]    = useState('Dashboard');
  const [search,       setSearch]       = useState('');
  const [announcement, setAnnouncement] = useState({ title: '', body: '', target: 'student' });
  const [posting,      setPosting]      = useState(false);
  const [time,         setTime]         = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, compRes] = await Promise.all([
        adminService.getStats(),
        adminService.getComplaints(),
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
    return <div className="ds-loading"><div className="ds-spinner" /><span className="ds-loading-text">Initializing Admin Panel…</span></div>;
  }

  const adminName = user?.name || 'Admin';
  const filteredComplaints = complaints.filter(c =>
    !search || c.raisedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  // Sample student data
  const STUDENTS = [
    { roll: 'CS301001', name: 'Arjun Sharma',  branch: 'CSE', sem: '5th', att: 84, status: 'Active'   },
    { roll: 'CS301002', name: 'Priya Mehta',   branch: 'CSE', sem: '5th', att: 62, status: 'Detained' },
    { roll: 'CS301003', name: 'Rahul Gupta',   branch: 'ECE', sem: '3rd', att: 78, status: 'Active'   },
    { roll: 'CS301004', name: 'Sneha Patel',   branch: 'MBA', sem: '1st', att: 90, status: 'Active'   },
    { roll: 'CS301005', name: 'Karan Singh',   branch: 'CSE', sem: '7th', att: 55, status: 'On Leave' },
  ];

  const studentPill = (s) => ({ Active: 'green', Detained: 'red', 'On Leave': 'amber' }[s] || 'gray');

  return (
    <div className="ds-shell">
      {/* SIDEBAR */}
      <aside className="ds-sidebar">
        <Link to="/" className="ds-sidebar-logo">
          <GraduationCap size={20} color="#1A56DB" strokeWidth={1.75} />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>
        <div className="ds-user-block">
          <div className="ds-user-name">{adminName}</div>
          <span className="ds-role-pill">College Admin</span>
        </div>
        <nav className="ds-nav">
          {NAV.map(({ label, icon: Icon, to }) => (
            <Link key={label} to={to} className={`ds-nav-item${activeNav === label ? ' active' : ''}`} onClick={() => setActiveNav(label)}>
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

      {/* MAIN */}
      <div className="ds-main">
        <header className="ds-header">
          <span className="ds-header-title">{activeNav}</span>
          <div className="ds-header-right">
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{time}</span>
            <button className="ds-bell-btn"><Bell size={18} /><span className="ds-bell-dot" /></button>
            <div className="ds-avatar">{initials(adminName)}</div>
          </div>
        </header>

        <div className="ds-content">

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
              <div className="ds-stat-value">{stats?.pendingComplaints ?? complaints.filter(c => c.status === 'pending').length}</div>
              <div className="ds-stat-trend down">▼ Needs attention</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Fee Collection</div>
              <div className="ds-stat-value">Rs. 42L</div>
              <div className="ds-stat-trend up">▲ This semester</div>
            </div>
          </div>

          {/* STUDENT MANAGEMENT */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Student Management</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                  <input className="ds-input" style={{ paddingLeft: 32, width: 200 }} placeholder="Search students…" />
                </div>
                <select className="ds-select">
                  <option>All Branches</option>
                  <option>CSE</option><option>ECE</option><option>MBA</option>
                </select>
                <button className="ds-btn ghost sm">Export CSV</button>
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
                          <a href="#" style={{ fontSize: 13, color: '#1A56DB', textDecoration: 'none', fontWeight: 500 }}>View</a>
                          <a href="#" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}>Edit</a>
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
                  />
                </div>
                <select className="ds-select">
                  <option>All Status</option>
                  <option>Pending</option><option>In Progress</option><option>Resolved</option>
                </select>
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
                          <button className="ds-btn ghost sm"><ExternalLink size={13} /></button>
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
      </div>
      <ChatWidget />
    </div>
  );
};

export default AdminDashboard;
