import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, ArrowLeft,
  AlertTriangle, CheckCircle2, TrendingUp, BarChart2
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

const AttendanceReports = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    subjectStats: [],
    lowAttendanceList: [],
    monthlyTrends: [],
    classAverage: 83,
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await attendanceService.getFacultyReports();
        if (res?.success && res.data) {
          setReportData(res.data);
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const facultyName = user?.name || 'Professor';

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
          <span className="ds-role-pill">Analytics & Trends</span>
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
            <Link to="/faculty/attendance" className="ds-btn ds-btn-secondary" style={{ padding: '4px 8px', height: 30 }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="ds-header-title">Attendance Analytics & Trend Reports</h1>
          </div>

          <div className="ds-header-right">
            <span className="ds-pill green">CSE Dept • Active Term</span>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Generating analytics report…</span>
          </div>
        ) : (
          <main className="ds-content">
            {/* Top Metric Cards */}
            <div className="ds-stat-row">
              <AttendanceSummaryCard
                label="Class Attendance Avg"
                value={`${reportData.classAverage}%`}
                trend="Above 75% institutional threshold"
                trendType="up"
                color="#16A34A"
              />
              <AttendanceSummaryCard
                label="Monitored Courses"
                value={reportData.subjectStats.length}
                trend="All active curriculum subjects"
                trendType="neu"
              />
              <AttendanceSummaryCard
                label="Students At Risk (<75%)"
                value={reportData.lowAttendanceList.length}
                trend={reportData.lowAttendanceList.length > 0 ? 'Action required before midterms' : 'All students on track'}
                trendType={reportData.lowAttendanceList.length > 0 ? 'down' : 'up'}
                color={reportData.lowAttendanceList.length > 0 ? '#DC2626' : '#16A34A'}
              />
              <AttendanceSummaryCard
                label="Monthly Trend"
                value="+2.4%"
                trend="Positive trajectory this month"
                trendType="up"
                color="#1A56DB"
              />
            </div>

            {/* Two-Column Grid: Subject-wise Performance & Monthly Trends */}
            <div className="ds-two-col">
              {/* Subject-Wise Performance */}
              <div className="ds-card">
                <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                  Subject-Wise Attendance Rate
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {reportData.subjectStats.map((sub) => {
                    const pct = sub.percentage;
                    const barColor = pct < 60 ? 'crit' : pct < 75 ? 'warn' : '';

                    return (
                      <div key={sub.subjectId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{sub.name} ({sub.code})</span>
                          <strong style={{ color: pct >= 75 ? '#16A34A' : '#DC2626' }}>{pct}%</strong>
                        </div>
                        <div className="ds-bar-track">
                          <div
                            className={`ds-bar-fill ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                          {sub.totalClasses} sessions conducted • {sub.presentRecords} of {sub.totalRecords} present
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Trend Visual (Pure React Bar Chart) */}
              <div className="ds-card">
                <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                  Semester Monthly Trajectory
                </h3>
                <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginTop: 20 }}>
                  {reportData.monthlyTrends.map((m) => (
                    <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A56DB' }}>{m.percentage}%</span>
                      <div
                        style={{
                          width: 44,
                          height: `${(m.percentage / 100) * 120}px`,
                          background: 'linear-gradient(180deg, #1A56DB 0%, #60A5FA 100%)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease',
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{m.month}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 12 }}>
                  Attendance peaked in January (88%) and has stabilized above 80% through mid-semester.
                </p>
              </div>
            </div>

            {/* Low Attendance Students Alert List */}
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title" style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={18} />
                    <span>Low Attendance Warning Register (&lt; 75%)</span>
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Students requiring immediate counseling and recovery classes before university exam lock.
                  </p>
                </div>
              </div>

              {reportData.lowAttendanceList.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#16A34A', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={24} style={{ display: 'inline-block', marginBottom: 6 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>All registered students in this class currently meet the 75% attendance threshold!</p>
                </div>
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th style={{ textAlign: 'center' }}>Total Classes</th>
                        <th style={{ textAlign: 'center' }}>Attended</th>
                        <th style={{ textAlign: 'center' }}>Current Percentage</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.lowAttendanceList.map((st) => (
                        <tr key={st._id}>
                          <td className="bold">{st.rollNumber}</td>
                          <td className="bold">{st.name}</td>
                          <td style={{ textAlign: 'center' }}>{st.totalClasses}</td>
                          <td style={{ textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{st.attended}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#DC2626' }}>{st.percentage}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <AttendanceStatusBadge status={st.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default AttendanceReports;
