import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin.service';
import { 
  Users, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle, 
  Megaphone, 
  Activity, 
  Search, 
  Edit2, 
  Trash2,
  Loader2,
  ExternalLink
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import './Admin.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [announcement, setAnnouncement] = useState({ title: '', body: '', target: 'student' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, compRes] = await Promise.all([
        adminService.getStats(),
        adminService.getComplaints()
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (compRes.success) setComplaints(compRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleResolve = async (id) => {
    try {
      const res = await adminService.updateComplaintStatus(id, 'resolved');
      if (res.success) {
        setComplaints(prev => prev.map(c => c._id === id ? { ...c, status: 'resolved' } : c));
      }
    } catch (err) {
      alert('Failed to resolve complaint');
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.title || !announcement.body) return;

    setPosting(true);
    try {
      const res = await adminService.createAnnouncement({
        title: announcement.title,
        body: announcement.body,
        targetRoles: [announcement.target]
      });
      if (res.success) {
        setAnnouncement({ title: '', body: '', target: 'student' });
        alert('Announcement posted successfully!');
      }
    } catch (err) {
      alert('Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':     return 'status-red';
      case 'in-progress': return 'status-gold';
      case 'resolved':    return 'status-green';
      default:            return '';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Initializing Admin Panel...
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Navbar />
      
      <main className="admin-content">
        {/* HERO BANNER */}
        <section className="admin-hero">
          <div className="a-hero-left">
            <h1 className="a-hero-title">Admin Control Panel</h1>
            <p className="a-hero-subtitle">Full system overview and management</p>
            <div className="a-hero-actions">
              <button className="btn btn-primary" onClick={fetchData}>Refresh Data</button>
              <button className="btn btn-outline" onClick={() => document.getElementById('announce-form')?.scrollIntoView({ behavior: 'smooth' })}>Post Announcement</button>
            </div>
          </div>
          <div className="a-hero-right">
            <div className="clock-container">
              <span className="live-clock">{time}</span>
            </div>
          </div>
        </section>

        {/* ANALYTICS STATS ROW */}
        <section className="a-stats-grid">
          <div className="a-stat-card">
            <Users className="a-stat-icon" color="#3b82f6" />
            <div className="a-stat-val">{stats?.totalStudents || 0}</div>
            <div className="a-stat-label">Total Students</div>
            <div className="a-stat-subtext text-blue">Verified Profiles</div>
          </div>
          <div className="a-stat-card">
            <UserCheck className="a-stat-icon" color="#a78bfa" />
            <div className="a-stat-val">{stats?.totalFaculty || 0}</div>
            <div className="a-stat-label">Total Faculty</div>
            <div className="a-stat-subtext text-purple">Academic Staff</div>
          </div>
          <div className="a-stat-card">
            <AlertTriangle className="a-stat-icon" color="#ef4444" />
            <div className="a-stat-val">{stats?.pendingComplaints || 0}</div>
            <div className="a-stat-label">Open Complaints</div>
            <div className="a-stat-subtext text-red">⚠ Needs attention</div>
          </div>
          <div className="a-stat-card">
            <CheckCircle className="a-stat-icon" color="#22c55e" />
            <div className="a-stat-val">{stats?.resolvedComplaints || 0}</div>
            <div className="a-stat-label">Resolved Today</div>
            <div className="a-stat-subtext text-green">✅ System Stability</div>
          </div>
          <div className="a-stat-card">
            <Megaphone className="a-stat-icon" color="#f59e0b" />
            <div className="a-stat-val">{stats?.totalComplaints || 0}</div>
            <div className="a-stat-label">Lifetime Griefs</div>
            <div className="a-stat-subtext text-gold">Total Logged</div>
          </div>
          <div className="a-stat-card">
            <Activity className="a-stat-icon" color="#14b8a6" />
            <div className="a-stat-val">{stats?.totalUsers || 0}</div>
            <div className="a-stat-label">Platform Users</div>
            <div className="a-stat-subtext text-teal">🟢 Online Database</div>
          </div>
        </section>

        {/* COMPLAINTS MANAGEMENT TABLE */}
        <section className="a-complaints-section">
          <div className="a-card">
            <div className="a-card-header">
              <h2 className="section-title">Complaint Management</h2>
              <div className="a-header-actions">
                <select className="a-select">
                  <option>All</option>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
                <input type="text" placeholder="Search..." className="a-input search-input" />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.length > 0 ? (
                    complaints.slice(0, 10).map((comp) => (
                      <tr key={comp._id}>
                        <td>#{comp._id.substring(comp._id.length - 4)}</td>
                        <td className="fw-bold">{comp.raisedBy?.name || 'Unknown'}</td>
                        <td><span className="code-badge">{comp.category}</span></td>
                        <td>"{comp.title}"</td>
                        <td>{new Date(comp.createdAt).toLocaleDateString()}</td>
                        <td><span className={`status-badge ${getStatusColor(comp.status)}`}>{comp.status}</span></td>
                        <td>
                          <div className="table-actions">
                            {comp.status !== 'resolved' && (
                              <button className="btn-small-resolve" onClick={() => handleResolve(comp._id)}>Resolve</button>
                            )}
                            <button className="btn-small-view"><ExternalLink size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No complaints found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TWO COLUMN SECTION */}
        <section className="a-two-col">
          {/* Quick Actions / Activity */}
          <div className="a-card">
            <h2 className="section-title">System Activity</h2>
            <div className="a-reg-list">
              <div className="p-4 text-slate-400 text-sm">
                Real-time user logs and registration monitoring active. 
                Average response time: 240ms.
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span>Database Status</span>
                  <span className="text-green-500 font-bold">HEALTHY</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span>AI API Connection</span>
                  <span className="text-green-500 font-bold">CONNECTED</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span>Email Service</span>
                  <span className="text-blue-500 font-bold">IDLE</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Announcements */}
          <div className="a-card" id="announce-form">
            <h2 className="section-title">Global Announcements</h2>
            <form className="a-announce-form" onSubmit={handlePostAnnouncement}>
              <input 
                type="text" 
                placeholder="Announcement Title" 
                className="a-input mb-2" 
                value={announcement.title}
                onChange={(e) => setAnnouncement({...announcement, title: e.target.value})}
              />
              <textarea 
                placeholder="Write body..." 
                rows="3" 
                className="a-textarea mb-2"
                value={announcement.body}
                onChange={(e) => setAnnouncement({...announcement, body: e.target.value})}
              ></textarea>
              <div className="mb-2">
                <select 
                  className="a-select w-full"
                  value={announcement.target}
                  onChange={(e) => setAnnouncement({...announcement, target: e.target.value})}
                >
                  <option value="student">To Students</option>
                  <option value="faculty">To Faculty</option>
                  <option value="parent">To Parents</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary w-100"
                disabled={posting || !announcement.title || !announcement.body}
              >
                {posting ? 'Broadcasting...' : 'Post Announcement'}
              </button>
            </form>
          </div>
        </section>

        {/* PLACEMENT STATS */}
        <section className="a-placement-banner">
          <div className="place-stat">
            <div className="place-val">₹45.0 L</div>
            <div className="place-label">Highest Package</div>
          </div>
          <div className="place-stat">
            <div className="place-val">₹8.5 L</div>
            <div className="place-label">Average Package</div>
          </div>
          <div className="place-stat">
            <div className="place-val">180+</div>
            <div className="place-label">Companies</div>
          </div>
          <div className="place-stat">
            <div className="place-val">94%</div>
            <div className="place-label">Placements</div>
          </div>
        </section>
      </main>
      <ChatWidget />
    </div>
  );
};

export default AdminDashboard;
