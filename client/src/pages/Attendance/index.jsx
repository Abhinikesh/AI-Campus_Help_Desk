import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { studentService } from '../../services/student.service';
import attendanceService from '../../services/attendance.service';
import Sidebar from '../../components/Sidebar/Sidebar';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, Bell, ChevronRight,
  GraduationCap, AlertCircle, CheckCircle2, Clock, Camera,
  History, ScanFace, ArrowRight, Download, TrendingUp
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
  const [trends, setTrends] = useState([]);
  const [trendInterval, setTrendInterval] = useState('weekly');
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await attendanceService.getStudentTrends({ interval: trendInterval });
        if (res?.success && res.data?.trends) {
          setTrends(res.data.trends);
        }
      } catch (err) {
        console.error('Error fetching attendance trends:', err);
      }
    };

    fetchTrends();
  }, [trendInterval]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await attendanceService.downloadReportCsv('student_report');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const studentName = profile?.fullName || profile?.user?.name || user?.name || 'Student';
  const { isCollapsed } = useSidebar();
  const semester = profile?.semester || 5;
  const overall = summary.overall || 0;
  const minThreshold = summary.minThreshold || 75;
  const isLowAttendance = summary.hasRecords && overall < minThreshold;

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── Main Content Area ── */}
      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header Bar */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">Smart Attendance</h1>
            <span className="ds-pill blue">Semester {semester} (2026–2027)</span>
          </div>

          <div className="ds-header-right">
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={handleExport}
                disabled={exporting}
                title="Download verified student attendance report as sanitized CSV"
                style={{ height: 32, fontSize: 13 }}
              >
                <Download size={14} /> {exporting ? 'Exporting…' : 'Export Report'}
              </button>
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

            {/* Attendance Trend Visualization (Weekly / Monthly) */}
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="#1A56DB" />
                    <span>Attendance Trajectory & Trends</span>
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                    Finalized academic attendance progression tracked in Indian Standard Time (Asia/Kolkata).
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', background: '#F1F5F9', padding: 2, borderRadius: 6 }}>
                    <button
                      type="button"
                      className={`ds-btn ${trendInterval === 'weekly' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                      onClick={() => setTrendInterval('weekly')}
                      style={{ height: 28, fontSize: 12, padding: '0 10px', borderRadius: 4 }}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      className={`ds-btn ${trendInterval === 'monthly' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                      onClick={() => setTrendInterval('monthly')}
                      style={{ height: 28, fontSize: 12, padding: '0 10px', borderRadius: 4 }}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              </div>

              {trends.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B7280', background: '#F8FAFC', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>No finalized attendance sessions recorded yet for this semester.</p>
                </div>
              ) : (
                <div>
                  <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginTop: 10 }}>
                    {trends.map((t) => {
                      const hasData = t.hasData;
                      const pct = t.percentage ?? 0;
                      const barColor = !hasData
                        ? '#E2E8F0'
                        : pct >= minThreshold
                        ? 'linear-gradient(180deg, #16A34A 0%, #4ADE80 100%)'
                        : pct >= 60
                        ? 'linear-gradient(180deg, #D97706 0%, #FBBF24 100%)'
                        : 'linear-gradient(180deg, #DC2626 0%, #F87171 100%)';

                      return (
                        <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: hasData ? (pct >= minThreshold ? '#16A34A' : '#DC2626') : '#94A3B8' }}>
                            {hasData ? `${pct}%` : '—'}
                          </span>
                          <div
                            style={{
                              width: 38,
                              height: hasData ? `${Math.max(12, (pct / 100) * 110)}px` : '6px',
                              background: barColor,
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                            }}
                            title={hasData ? `${t.label}: ${pct}% (${t.attendedUnits} of ${t.heldUnits} units attended)` : `${t.label}: No classes held`}
                          />
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B', whiteSpace: 'nowrap' }}>
                            {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: '#64748B' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} /> Meets {minThreshold}%
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} /> Warning (&lt;{minThreshold}%)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} /> Critical (&lt;60%)
                      </span>
                    </div>
                    <span>Finalized Sessions Only</span>
                  </div>
                </div>
              )}
            </div>

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
                        <th style={{ textAlign: 'center' }}>Requirement</th>
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
                            <td style={{ textAlign: 'center', color: '#4B5563', fontWeight: 600 }}>
                              {minThreshold}%
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
          </main>
        )}
      </div>
    </div>
  );
};

export default AttendanceOverview;
