/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { parentService } from '../../services/parent.service';
import {
  LayoutDashboard, Users, CalendarCheck, BarChart2, CreditCard,
  Flag, Phone, LogOut, Bell, GraduationCap, AlertTriangle, Mail
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import '../../styles/dashboard-shared.css';
import './Parent.css';

const NAV = [
  { label: 'Dashboard',       icon: LayoutDashboard, to: '/parent/dashboard'   },
  { label: 'My Children',     icon: Users,           to: '/parent/dashboard'   },
  { label: 'Attendance Tracker', icon: CalendarCheck, to: '/parent/dashboard'  },
  { label: 'Results',         icon: BarChart2,       to: '/parent/dashboard'   },
  { label: 'Fee Status',      icon: CreditCard,      to: '/parent/dashboard'   },
  { label: 'Complaints',      icon: Flag,            to: '/parent/dashboard'   },
  { label: 'Contact Faculty', icon: Phone,           to: '/parent/ai-help'     },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const ParentDashboard = () => {
  const { user, logout } = useAuth() || {};
  const navigate = useNavigate();
  const [loading,     setLoading]     = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [activeNav,   setActiveNav]   = useState('Dashboard');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await parentService.getStudentData();
        if (res.success) setStudentData(res.data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const calcAttendance = () => {
    if (!studentData?.attendance?.length) return 84;
    const att = studentData.attendance.reduce((s, i) => s + (i.attended || 0), 0);
    const tot = studentData.attendance.reduce((s, i) => s + (i.total || 0), 0);
    return tot > 0 ? Math.round((att / tot) * 100) : 84;
  };

  if (loading) {
    return <div className="ds-loading"><div className="ds-spinner" /><span className="ds-loading-text">Loading Student Records…</span></div>;
  }

  const parentName  = user?.name || 'Parent';
  const studentName = studentData?.studentName || 'Student';
  const attendance  = calcAttendance();
  const fees        = studentData?.fees || { due: 12000 };
  const lowSubjects = (studentData?.attendance || []).filter(s => s.total > 0 && (s.attended / s.total) * 100 < 75);

  // Sample data when API returns nothing
  const attendanceData = studentData?.attendance?.length
    ? studentData.attendance
    : [
        { subject: 'Data Structures',   total: 42, attended: 38 },
        { subject: 'Operating Systems', total: 40, attended: 28 },
        { subject: 'DBMS',              total: 38, attended: 36 },
        { subject: 'Mathematics',       total: 36, attended: 25 },
      ];

  return (
    <div className="ds-shell">
      {/* SIDEBAR */}
      <aside className="ds-sidebar">
        <Link to="/" className="ds-sidebar-logo">
          <GraduationCap size={20} color="#1A56DB" strokeWidth={1.75} />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>
        <div className="ds-user-block">
          <div className="ds-user-name">{parentName}</div>
          <span className="ds-role-pill">Parent</span>
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
          <span className="ds-header-title">Monitoring: {studentName}</span>
          <div className="ds-header-right">
            <button className="ds-bell-btn"><Bell size={18} /><span className="ds-bell-dot" /></button>
            <div className="ds-avatar">{initials(parentName)}</div>
          </div>
        </header>

        <div className="ds-content">

          {/* STAT CARDS */}
          <div className="ds-stat-row">
            <div className="ds-stat-card">
              <div className="ds-stat-label">Child Attendance</div>
              <div className="ds-stat-value">{attendance}%</div>
              <div className={`ds-stat-trend ${attendance < 75 ? 'down' : 'up'}`}>
                {attendance < 75 ? '▼ Below threshold' : '▲ Good standing'}
              </div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Upcoming Exams</div>
              <div className="ds-stat-value">2</div>
              <div className="ds-stat-trend neu">Mid-Sem approaching</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Pending Fees</div>
              <div className="ds-stat-value">Rs. {fees.due > 0 ? (fees.due / 1000).toFixed(0) + 'K' : '0'}</div>
              <div className={`ds-stat-trend ${fees.due > 0 ? 'down' : 'up'}`}>
                {fees.due > 0 ? '▼ Payment pending' : 'Cleared'}
              </div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Complaints Raised</div>
              <div className="ds-stat-value">1</div>
              <div className="ds-stat-trend neu">View status</div>
            </div>
          </div>

          {/* LOW ATTENDANCE ALERT */}
          {lowSubjects.length > 0 && (
            <div className="ds-alert warn">
              <AlertTriangle size={16} color="#D97706" />
              Low attendance detected in {lowSubjects[0].subject} — {Math.round((lowSubjects[0].attended / lowSubjects[0].total) * 100)}%
            </div>
          )}

          {/* ATTENDANCE TRACKER */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Attendance Tracker</span>
            </div>
            {attendanceData.map((s, i) => {
              const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
              const bc  = pct >= 75 ? '' : pct >= 60 ? 'warn' : 'crit';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < attendanceData.length - 1 ? '1px solid #F4F5F7' : 'none' }}>
                  <div style={{ width: 160, fontSize: 13, fontWeight: 500, color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</div>
                  <div style={{ flex: 1 }}><div className="ds-bar-track"><div className={`ds-bar-fill ${bc}`} style={{ width: `${pct}%` }} /></div></div>
                  <div style={{ width: 44, fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                </div>
              );
            })}
          </div>

          {/* FEE STATUS + CALENDAR */}
          <div className="ds-two-col">
            {/* Fee table */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Fee Status</span>
              </div>
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr><th>Fee Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {[
                      { type: 'Tuition Fee',   amount: '₹60,000', due: '30 Jun', status: 'Paid'    },
                      { type: 'Exam Fee',      amount: '₹5,000',  due: '15 Jul', status: 'Pending' },
                      { type: 'Hostel Fee',    amount: '₹12,000', due: '1 Jul',  status: 'Overdue' },
                      { type: 'Library Fee',   amount: '₹1,000',  due: '30 Jun', status: 'Paid'    },
                    ].map((f, i) => (
                      <tr key={i}>
                        <td className="bold">{f.type}</td>
                        <td>{f.amount}</td>
                        <td>{f.due}</td>
                        <td>
                          <span className={`ds-pill ${f.status === 'Paid' ? 'green' : f.status === 'Pending' ? 'amber' : 'red'}`}>
                            {f.status}
                          </span>
                        </td>
                        <td>
                          {f.status !== 'Paid' && (
                            <a href="#" className="ds-btn outline sm" style={{ textDecoration: 'none' }}>Pay Now</a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Academic calendar */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Academic Calendar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { date: 'Apr 15', event: 'Mid-Semester Exams Begin',  pill: 'blue'  },
                  { date: 'Apr 25', event: 'Parent-Teacher Meeting',     pill: 'green' },
                  { date: 'May 1',  event: 'Holiday — Spring Break',     pill: 'amber' },
                  { date: 'May 15', event: 'Final Semester Exams Start', pill: 'red'   },
                  { date: 'Jun 1',  event: 'New Session Begins',         pill: 'gray'  },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>
                    <span className={`ds-pill ${item.pill}`} style={{ minWidth: 52, justifyContent: 'center' }}>{item.date}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CONTACT DIRECTORY */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Campus Contact Directory</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { dept: 'Academic Office',  phone: '+91 98765 43210', email: 'academic@campus.edu' },
                { dept: 'Administration',   phone: '+91 98765 43211', email: 'admin@campus.edu'    },
                { dept: 'Student Affairs',  phone: '+91 98765 43212', email: 'affairs@campus.edu'  },
                { dept: 'Fee Payment',      phone: '+91 98765 43213', email: 'fees@campus.edu'     },
              ].map((c, i) => (
                <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '16px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{c.dept}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                    <Phone size={12} />{c.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1A56DB', cursor: 'pointer' }}
                    onClick={() => navigator.clipboard.writeText(c.email)}>
                    <Mail size={12} />{c.email}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      <ChatWidget />
    </div>
  );
};

export default ParentDashboard;
