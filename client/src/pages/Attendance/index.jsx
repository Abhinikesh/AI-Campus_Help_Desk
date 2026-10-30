import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/student.service';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, AlertCircle, CheckCircle2, Clock, Camera,
  History, ScanFace, ArrowRight
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Attendance.css';

const NAV = [
  { label: 'Dashboard',         icon: LayoutDashboard, to: '/student/dashboard' },
  { label: 'My Courses',        icon: BookOpen,        to: '/student/results'   },
  { label: 'Attendance',        icon: CalendarCheck,   to: '/student/attendance' },
  { label: 'Results & Grades',  icon: BarChart2,       to: '/student/results'   },
  { label: 'Academic Drive',    icon: Folder,          to: '/student/drive'     },
  { label: 'Complaints',        icon: Flag,            to: '/student/complaints' },
  { label: 'AI Help Desk',      icon: MessageCircle,   to: '/student/ai-help'   },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AttendanceOverview = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [summary, setSummary] = useState({
    overall: 0,
    totalClasses: 0,
    totalAttended: 0,
    totalMissed: 0,
    minThreshold: 75,
    hasRecords: false,
    activeSessions: [],
    recentHistory: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profRes, attRes] = await Promise.all([
          studentService.getProfile().catch(() => ({ success: false })),
          attendanceService.getStudentAttendance().catch(() => ({ success: false })),
        ]);

        if (profRes?.success) setProfile(profRes.data);
        if (attRes?.success) {
          setSubjects(attRes.data || []);
          if (attRes.summary) setSummary(attRes.summary);
        }
      } catch (err) {
        console.error('Error fetching attendance data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const studentName = profile?.fullName || profile?.user?.name || user?.name || 'Student';
  const semester = profile?.semester || 4;
  const overall = summary.overall || 0;
  const minThreshold = summary.minThreshold || 75;
  const isLowAttendance = summary.hasRecords && overall < minThreshold;

  return (
    <div className="ds-shell">
      {/* ── Sidebar ── */}
      <aside className="ds-sidebar">
        <Link to="/student/dashboard" className="ds-sidebar-logo">
          <GraduationCap size={24} color="#1A56DB" />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>

        <div className="ds-user-block">
          <div className="ds-user-name">{studentName}</div>
          <span className="ds-role-pill">Student • Sem {semester}</span>
        </div>

        <nav className="ds-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === '/student/attendance';
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

      {/* ── Main Content Area ── */}
      <div className="ds-main">
        {/* Header Bar */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">Smart Attendance</h1>
            <span className="ds-pill blue">Semester {semester} (2025–2026)</span>
          </div>

          <div className="ds-header-right">
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/student/attendance/history" className="ds-btn ds-btn-secondary" style={{ height: 32, fontSize: 13 }}>
                <History size={14} /> History
              </Link>
              <Link to="/student/attendance/face-registration" className="ds-btn ds-btn-secondary" style={{ height: 32, fontSize: 13 }}>
                <ScanFace size={14} /> Face ID
              </Link>
            </div>
            <div className="ds-avatar" title={studentName}>
              {initials(studentName)}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading Smart Attendance…</span>
          </div>
        ) : (
          <main className="ds-content">
            {/* Warning Banner ONLY if records exist and attendance < threshold */}
            {isLowAttendance && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  color: '#991B1B',
                  fontSize: 14,
                }}
              >
                <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong>Attendance Alert:</strong> Your overall attendance is <strong>{overall}%</strong>, which is below the mandatory <strong>{minThreshold}%</strong> minimum requirement. You risk examination debarment if unrectified.
                </div>
              </div>
            )}

            {/* Stat Cards Row */}
            <div className="ds-stat-row">
              <AttendanceSummaryCard
                label="Overall Attendance"
                value={`${overall}%`}
                trend={summary.hasRecords ? (overall >= minThreshold ? 'Meets 75% criterion' : 'Below 75% threshold') : 'No classes held'}
                trendType={summary.hasRecords ? (overall >= minThreshold ? 'up' : 'down') : 'neu'}
                color={summary.hasRecords ? (overall >= minThreshold ? '#16A34A' : '#DC2626') : '#6B7280'}
              />
              <AttendanceSummaryCard
                label="Total Classes Held"
                value={summary.totalClasses}
                trend="All academic subjects"
                trendType="neu"
              />
              <AttendanceSummaryCard
                label="Classes Attended"
                value={summary.totalAttended}
                trend={summary.hasRecords ? `${Math.round((summary.totalAttended / (summary.totalClasses || 1)) * 100)}% presence` : '—'}
                trendType="up"
                color="#16A34A"
              />
              <AttendanceSummaryCard
                label="Classes Missed"
                value={summary.totalMissed}
                trend={summary.totalMissed > 0 ? `${summary.totalMissed} absences recorded` : 'Perfect attendance'}
                trendType={summary.totalMissed > 5 ? 'down' : 'neu'}
                color={summary.totalMissed > 5 ? '#DC2626' : '#6B7280'}
              />
            </div>

            {/* Active Attendance Sessions (Live Smart Check-in CTA) */}
            {summary.activeSessions && summary.activeSessions.length > 0 && (
              <div className="ds-card" style={{ border: '1px solid #BFDBFE', background: '#F0F7FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', animation: 'pulseScan 1.5s infinite' }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E40AF' }}>
                      Live Attendance Session Active Now
                    </h3>
                  </div>
                  <span className="ds-pill blue">Period {summary.activeSessions[0].period}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#FFFFFF', padding: '14px 18px', borderRadius: 8, border: '1px solid #DBEAFE' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {summary.activeSessions[0].subject} ({summary.activeSessions[0].code})
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#4B5563' }}>
                      Faculty: <strong>{summary.activeSessions[0].faculty}</strong> • Time: <strong>{summary.activeSessions[0].startTime} - {summary.activeSessions[0].endTime}</strong>
                    </p>
                  </div>

                  <div>
                    {summary.activeSessions[0].isJoined ? (
                      <span className="ds-pill green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}>
                        <CheckCircle2 size={15} /> Attendance Marked Present
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ds-btn ds-btn-primary"
                        onClick={() => navigate(`/student/attendance/mark/${summary.activeSessions[0]._id}`)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <Camera size={16} />
                        <span>Join & Verify Face</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subject-Wise Attendance Table */}
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Subject-Wise Attendance Breakdown</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Track course-level attendance against the {minThreshold}% institutional policy.
                  </p>
                </div>
                <Link to="/student/attendance/history" className="ds-view-all">
                  View Full History →
                </Link>
              </div>

              {subjects.length === 0 ? (
                <EmptyState
                  title="No Subjects Enrolled"
                  description="Your academic curriculum has not been configured with subjects for this semester."
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Subject Name</th>
                        <th>Code</th>
                        <th>Faculty</th>
                        <th style={{ textAlign: 'center' }}>Total Classes</th>
                        <th style={{ textAlign: 'center' }}>Attended</th>
                        <th style={{ textAlign: 'center' }}>Missed</th>
                        <th style={{ width: 140 }}>Progress</th>
                        <th style={{ textAlign: 'center' }}>Percentage</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((sub) => {
                        const pct = sub.percentage;
                        const isNoClass = sub.total === 0;
                        const barColorClass = isNoClass ? '' : pct < 60 ? 'crit' : pct < minThreshold ? 'warn' : '';

                        return (
                          <tr key={sub._id}>
                            <td className="bold">{sub.subject}</td>
                            <td><span className="ds-pill gray">{sub.code}</span></td>
                            <td style={{ color: '#4B5563' }}>{sub.facultyName || 'Faculty'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{sub.total}</td>
                            <td style={{ textAlign: 'center', color: '#16A34A', fontWeight: 600 }}>{sub.attended}</td>
                            <td style={{ textAlign: 'center', color: sub.missed > 0 ? '#DC2626' : '#6B7280', fontWeight: 600 }}>{sub.missed}</td>
                            <td>
                              <div className="ds-bar-track">
                                <div
                                  className={`ds-bar-fill ${barColorClass}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: isNoClass ? '#6B7280' : pct >= minThreshold ? '#16A34A' : '#DC2626' }}>
                              {isNoClass ? '—' : `${pct}%`}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <AttendanceStatusBadge status={sub.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Visual Subject Progress Cards (Circular Gauge) */}
            {subjects.length > 0 && (
              <div>
                <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                  Course Progress Rings
                </h3>
                <div className="attendance-grid">
                  {subjects.map((sub) => {
                    const pct = sub.percentage;
                    const isLow = sub.total > 0 && pct < minThreshold;
                    const ringColor = sub.total === 0 ? '#9CA3AF' : isLow ? '#DC2626' : '#16A34A';

                    return (
                      <div key={sub._id} className={`attendance-card ${isLow ? 'warning-card' : ''}`}>
                        <div className="att-card-header">
                          <h4 className="att-subject-name">{sub.subject}</h4>
                          <span className="att-subject-code">{sub.code}</span>
                        </div>

                        <div className="progress-ring-container-large">
                          <svg className="progress-ring-large" viewBox="0 0 100 100">
                            <circle className="ring-bg" cx="50" cy="50" r="40" />
                            <circle
                              className="ring-progress"
                              style={{ stroke: ringColor }}
                              cx="50"
                              cy="50"
                              r="40"
                              strokeDasharray="251.2"
                              strokeDashoffset={sub.total === 0 ? 251.2 : 251.2 * (1 - pct / 100)}
                            />
                            <text x="50" y="55" className="ring-text-large">
                              {sub.total === 0 ? 'N/A' : `${pct}%`}
                            </text>
                          </svg>
                        </div>

                        <div className="att-stats">
                          <p className="att-ratio">
                            {sub.attended} attended of {sub.total} conducted
                          </p>
                          {isLow && (
                            <div className="att-classes-needed">
                              ⚠️ Need next {Math.max(1, Math.ceil((minThreshold * sub.total - 100 * sub.attended) / (100 - minThreshold)))} classes to reach {minThreshold}%
                            </div>
                          )}
                        </div>

                        <div className="att-trend">
                          <span style={{ color: ringColor, fontWeight: 600 }}>
                            {sub.total === 0 ? 'No sessions conducted' : pct >= minThreshold ? '✓ On Track' : '⚠️ Attention Required'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

export default AttendanceOverview;
