import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, ArrowLeft,
  AlertTriangle, CheckCircle2, TrendingUp, BarChart2, Download, Filter, ShieldCheck
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
  const [selectedSubject, setSelectedSubject] = useState('');
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState({
    subjectStats: [],
    lowAttendanceList: [],
    monthlyTrends: [],
    manualAdjustments: [],
    classAverage: 83,
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedSubject) params.subjectId = selectedSubject;
      const res = await attendanceService.getFacultyReports(params);
      if (res?.success && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedSubject]);

  const handleExportCsv = async (reportType = 'faculty_report') => {
    try {
      setExporting(true);
      const filters = {};
      if (selectedSubject) filters.subjectId = selectedSubject;
      await attendanceService.downloadReportCsv(reportType, filters);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
    } finally {
      setExporting(false);
    }
  };

  const facultyName = user?.name || 'Professor';
  const { isCollapsed } = useSidebar();

  return (
    <div className="ds-shell">
      {/* ── UNIFIED COLLAPSIBLE SIDEBAR ── */}
      <Sidebar />

      {/* ── Main Content ── */}
      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/faculty/attendance" className="ds-btn ds-btn-secondary" style={{ padding: '4px 8px', height: 30 }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="ds-header-title">Attendance Analytics & Trend Reports</h1>
          </div>

          <div className="ds-header-right">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => handleExportCsv('faculty_report')}
              disabled={exporting}
              title="Download verified faculty report as CSV"
              style={{ height: 32, fontSize: 13 }}
            >
              <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
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
            {/* Subject Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Filter size={16} color="#4B5563" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Filter by Subject:</span>
                <select
                  className="ds-select"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  style={{ height: 32, fontSize: 13, minWidth: 220 }}
                >
                  <option value="">All Authorized Subjects</option>
                  {reportData.subjectStats?.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.name} ({s.code}) — Sem {s.semester}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 12, color: '#6B7280' }}>
                Showing statistics for <strong>{reportData.assignedStudentsCount || 0}</strong> assigned students
              </div>
            </div>
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

                {reportData.lowAttendanceList.length > 0 && (
                  <button
                    type="button"
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleExportCsv('low_attendance_report')}
                    disabled={exporting}
                    style={{ height: 28, fontSize: 12 }}
                  >
                    <Download size={13} /> Export Risk Register
                  </button>
                )}
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
                        <th style={{ textAlign: 'center' }}>Deficit Units</th>
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
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#DC2626' }}>
                            +{st.deficitUnits || 0}
                          </td>
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

            {/* Manual Attendance Adjustment Transparency Ledger */}
            {reportData.manualAdjustments && reportData.manualAdjustments.length > 0 && (
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <h3 className="ds-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="#1A56DB" />
                      <span>Manual Attendance Correction Audit History</span>
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                      Complete transparency ledger of overrides with authorized actor and mandatory justification.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleExportCsv('manual_adjustment_report')}
                    disabled={exporting}
                    style={{ height: 28, fontSize: 12 }}
                  >
                    <Download size={13} /> Export Adjustments
                  </button>
                </div>

                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Timestamp (IST)</th>
                        <th>Student Roll No</th>
                        <th>Student Name</th>
                        <th style={{ textAlign: 'center' }}>Previous Status</th>
                        <th style={{ textAlign: 'center' }}>Updated Status</th>
                        <th>Authorized Actor</th>
                        <th>Mandatory Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.manualAdjustments.map((adj) => (
                        <tr key={adj._id}>
                          <td>{adj.timestamp}</td>
                          <td className="bold">{adj.rollNumber}</td>
                          <td>{adj.studentName}</td>
                          <td style={{ textAlign: 'center' }}>
                            <AttendanceStatusBadge status={adj.previousStatus} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <AttendanceStatusBadge status={adj.updatedStatus} />
                          </td>
                          <td>{adj.actorName}</td>
                          <td style={{ color: '#4B5563', fontStyle: 'italic' }}>"{adj.reason}"</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

export default AttendanceReports;
