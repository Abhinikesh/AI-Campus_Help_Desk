import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import AttendanceSummaryCard from '../../components/AttendanceShared/AttendanceSummaryCard';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import ConfirmationDialog from '../../components/AttendanceShared/ConfirmationDialog';
import {
  GraduationCap, LayoutDashboard, Users, UserCheck, AlertTriangle,
  CreditCard, Flag, Megaphone, Settings, MessageCircle, LogOut,
  CalendarCheck, ShieldCheck, Search, Filter, Download, Trash2,
  CheckCircle2, Clock, Eye, Sliders, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const NAV = [
  { label: 'Dashboard',          icon: LayoutDashboard, to: '/admin/dashboard'  },
  { label: 'Smart Attendance',   icon: CalendarCheck,   to: '/admin/attendance' },
  { label: 'Student Management', icon: Users,           to: '/admin/dashboard'  },
  { label: 'Faculty Management', icon: UserCheck,       to: '/admin/dashboard'  },
  { label: 'Complaints',         icon: Flag,            to: '/admin/complaints' },
  { label: 'Announcements',      icon: Megaphone,       to: '/admin/dashboard'  },
  { label: 'AI Help Desk',       icon: MessageCircle,   to: '/admin/ai-help'    },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AdminAttendanceHub = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'overview' | 'sessions' | 'records' | 'biometrics' | 'analytics' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Tab Data States
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [adjustmentLogs, setAdjustmentLogs] = useState([]);
  const [selectedReportType, setSelectedReportType] = useState('department_report');
  const [exportingReport, setExportingReport] = useState(false);
  const [settings, setSettings] = useState({
    minAttendancePercent: 75,
    defaultSessionDurationMinutes: 60,
    verificationRetryLimit: 3,
    faceConfidenceThreshold: 0.65,
    allowManualOverride: true,
    biometricRetentionDays: 365,
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all');
  const [deleteTargetStudent, setDeleteTargetStudent] = useState(null);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Pagination for records
  const [recPagination, setRecPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  const fetchTabData = async (tab) => {
    try {
      setLoading(true);
      if (tab === 'overview') {
        const res = await attendanceService.getAdminOverview();
        if (res?.success) setOverview(res.data);
      } else if (tab === 'sessions') {
        const res = await attendanceService.getAdminSessions({
          status: sessionStatusFilter !== 'all' ? sessionStatusFilter : undefined,
          search: searchQuery || undefined,
        });
        if (res?.success) setSessions(res.data);
      } else if (tab === 'records') {
        const res = await attendanceService.getAdminRecords({
          page: recPagination.page,
          search: searchQuery || undefined,
        });
        if (res?.success && res.data) {
          setRecords(res.data.records || []);
          if (res.data.pagination) setRecPagination(res.data.pagination);
        }
      } else if (tab === 'biometrics') {
        const res = await attendanceService.getAdminFaceEnrollments();
        if (res?.success) setEnrollments(res.data);
      } else if (tab === 'analytics') {
        const [analyticsRes, adjRes] = await Promise.all([
          attendanceService.getAdminAnalytics(),
          attendanceService.getAdjustmentLogs({ limit: 50 }).catch(() => ({ success: false })),
        ]);
        if (analyticsRes?.success) setAnalytics(analyticsRes.data);
        if (adjRes?.success && adjRes.data) setAdjustmentLogs(adjRes.data);
      } else if (tab === 'settings') {
        const res = await attendanceService.getAdminSettings();
        if (res?.success) setSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, sessionStatusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTabData(activeTab);
  };

  const handleDeleteEnrollment = async () => {
    if (!deleteTargetStudent) return;
    try {
      await attendanceService.deleteFaceEnrollment(deleteTargetStudent.studentId);
      setDeleteTargetStudent(null);
      fetchTabData('biometrics');
    } catch (err) {
      console.error('Delete biometric error:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsSavedMsg('');
      const res = await attendanceService.updateAdminSettings(settings);
      if (res?.success) {
        setSettingsSavedMsg('Attendance parameters updated successfully across campus!');
        setTimeout(() => setSettingsSavedMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportRecords = () => {
    if (!records.length) return;
    const headers = ['Roll Number', 'Student Name', 'Class', 'Subject', 'Code', 'Date', 'Period', 'Status', 'Method'];
    const rows = records.map(r => [
      r.rollNumber,
      `"${r.studentName}"`,
      r.class,
      `"${r.subject}"`,
      r.code,
      r.date,
      r.period,
      r.status,
      r.verificationMethod,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Admin_Attendance_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReport = async () => {
    try {
      setExportingReport(true);
      await attendanceService.downloadReportCsv(selectedReportType);
    } catch (err) {
      console.error('Failed to export admin report:', err);
    } finally {
      setExportingReport(false);
    }
  };

  const adminName = user?.name || 'Administrator';
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
            <h1 className="ds-header-title">Campus Smart Attendance Administration</h1>
            <span className="ds-pill blue">Enterprise Hub</span>
          </div>

          <div className="ds-header-right">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => fetchTabData(activeTab)}
              title="Refresh Current View"
              style={{ height: 32, fontSize: 13 }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <div className="ds-avatar">{initials(adminName)}</div>
          </div>
        </header>

        <main className="ds-content">
          {/* Sub-navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: 12,
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'overview',   label: 'Overview' },
              { id: 'sessions',   label: 'Attendance Sessions' },
              { id: 'records',    label: 'Student Records' },
              { id: 'biometrics', label: 'Face Enrollment Mgmt' },
              { id: 'analytics',  label: 'Attendance Analytics' },
              { id: 'settings',   label: 'System Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`ds-btn ${activeTab === tab.id ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13, padding: '0 16px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="ds-loading">
              <div className="ds-spinner" />
              <span className="ds-loading-text">Loading Smart Attendance data…</span>
            </div>
          ) : (
            <>
              {/* ── TAB 1: OVERVIEW ── */}
              {activeTab === 'overview' && overview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="ds-stat-row">
                    <AttendanceSummaryCard
                      label="Total Sessions"
                      value={overview.totalSessions}
                      trend="Conducted this academic term"
                      trendType="neu"
                    />
                    <AttendanceSummaryCard
                      label="Active Live Sessions"
                      value={overview.activeSessions}
                      trend={overview.activeSessions > 0 ? 'Currently streaming in classrooms' : 'No active sessions'}
                      trendType={overview.activeSessions > 0 ? 'up' : 'neu'}
                      color={overview.activeSessions > 0 ? '#1A56DB' : '#6B7280'}
                    />
                    <AttendanceSummaryCard
                      label="Face ID Enrolled Students"
                      value={`${overview.totalStudentsEnrolled} / ${overview.totalStudents}`}
                      trend="Biometric consent validated"
                      trendType="up"
                      color="#16A34A"
                    />
                    <AttendanceSummaryCard
                      label="Campus Overall Attendance"
                      value={`${overview.overallAttendance}%`}
                      trend="Average across all colleges"
                      trendType="up"
                      color="#16A34A"
                    />
                  </div>

                  {/* Sessions Requiring Attention */}
                  {overview.attentionSessions?.length > 0 && (
                    <div className="ds-card" style={{ border: '1px solid #FCD34D', background: '#FFFBEB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <AlertTriangle size={18} color="#D97706" />
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400E' }}>
                          Sessions Requiring Administrative Attention
                        </h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {overview.attentionSessions.map(s => (
                          <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span><strong>{s.subject}</strong> (Instructor: {s.faculty})</span>
                            <span className="ds-pill amber">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Department-Wise Distribution */}
                  <div className="ds-two-col">
                    <div className="ds-card">
                      <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                        Department Attendance Averages
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {overview.departmentStats?.map((dept) => (
                          <div key={dept.department}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#111827' }}>{dept.department}</span>
                              <strong style={{ color: '#1A56DB' }}>{dept.attendance}%</strong>
                            </div>
                            <div className="ds-bar-track">
                              <div className="ds-bar-fill" style={{ width: `${dept.attendance}%` }} />
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                              {dept.sessions} attendance sessions recorded
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Sessions Table */}
                    <div className="ds-card">
                      <div className="ds-card-header">
                        <h3 className="ds-section-title">Recent Campus Sessions</h3>
                        <button type="button" className="ds-view-all" onClick={() => setActiveTab('sessions')}>
                          View All →
                        </button>
                      </div>
                      <div className="ds-table-wrap">
                        <table className="ds-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Subject</th>
                              <th>Faculty</th>
                              <th style={{ textAlign: 'center' }}>Present</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.recentSessions?.slice(0, 5).map((s) => (
                              <tr key={s._id}>
                                <td className="bold">{s.date}</td>
                                <td>{s.subject}</td>
                                <td>{s.faculty}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.present}/{s.total}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <AttendanceStatusBadge status={s.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 2: ATTENDANCE SESSIONS ── */}
              {activeTab === 'sessions' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <div>
                      <h3 className="ds-section-title">All Campus Class Sessions</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                        Browse, filter, and inspect verified smart attendance sessions.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <select
                        className="ds-select"
                        value={sessionStatusFilter}
                        onChange={(e) => setSessionStatusFilter(e.target.value)}
                        style={{ height: 32, fontSize: 13 }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">Live / Open</option>
                        <option value="closed">Closed</option>
                        <option value="finalized">Finalized</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Search subject or teacher…"
                        className="ds-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ height: 32, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <EmptyState
                      title="No Sessions Found"
                      description="No classroom attendance sessions match your search or filter."
                    />
                  ) : (
                    <div className="ds-table-wrap">
                      <table className="ds-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Class</th>
                            <th>Teacher</th>
                            <th style={{ textAlign: 'center' }}>Present</th>
                            <th style={{ textAlign: 'center' }}>Percentage</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s) => (
                            <tr key={s._id}>
                              <td className="bold">{s.date}</td>
                              <td>{s.time}</td>
                              <td className="bold">{s.subject} ({s.code})</td>
                              <td>{s.class}</td>
                              <td>{s.faculty}</td>
                              <td style={{ textAlign: 'center', color: '#16A34A', fontWeight: 600 }}>
                                {s.present} / {s.totalStudents}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.percentage}%</td>
                              <td style={{ textAlign: 'center' }}>
                                <AttendanceStatusBadge status={s.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: STUDENT RECORDS ── */}
              {activeTab === 'records' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <div>
                      <h3 className="ds-section-title">Student Attendance Ledger</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                        Search individual student attendance entries and verification records.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Search student or roll number…"
                        className="ds-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ height: 32, fontSize: 13 }}
                      />
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={handleExportRecords}
                        disabled={!records.length}
                        style={{ height: 32, fontSize: 13 }}
                      >
                        <Download size={13} /> Export CSV
                      </button>
                    </div>
                  </div>

                  {records.length === 0 ? (
                    <EmptyState
                      title="No Student Records Found"
                      description="No records match the requested roll number or parameters."
                    />
                  ) : (
                    <div className="ds-table-wrap">
                      <table className="ds-table">
                        <thead>
                          <tr>
                            <th>Roll Number</th>
                            <th>Student Name</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Date</th>
                            <th style={{ textAlign: 'center' }}>Period</th>
                            <th style={{ textAlign: 'center' }}>Method</th>
                            <th style={{ textAlign: 'center' }}>Confidence</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r._id}>
                              <td className="bold">{r.rollNumber}</td>
                              <td className="bold">{r.studentName}</td>
                              <td>{r.class}</td>
                              <td>{r.subject} ({r.code})</td>
                              <td>{r.date}</td>
                              <td style={{ textAlign: 'center' }}>Period {r.period}</td>
                              <td style={{ textAlign: 'center' }}>
                                <AttendanceStatusBadge status={r.verificationMethod} />
                              </td>
                              <td style={{ textAlign: 'center', color: '#4B5563' }}>
                                {r.confidence ? `${Math.round(r.confidence * 100)}%` : '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <AttendanceStatusBadge status={r.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {recPagination.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        disabled={recPagination.page <= 1}
                        onClick={() => {
                          setRecPagination(p => ({ ...p, page: p.page - 1 }));
                          fetchTabData('records');
                        }}
                      >
                        <ChevronLeft size={14} /> Previous
                      </button>
                      <span style={{ fontSize: 13, color: '#4B5563' }}>
                        Page {recPagination.page} of {recPagination.totalPages}
                      </span>
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        disabled={recPagination.page >= recPagination.totalPages}
                        onClick={() => {
                          setRecPagination(p => ({ ...p, page: p.page + 1 }));
                          fetchTabData('records');
                        }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: BIOMETRIC ENROLLMENTS ── */}
              {activeTab === 'biometrics' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <div>
                      <h3 className="ds-section-title">Biometric Consent & Enrollment Register</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                        Manage student face template enrollment and strict data privacy compliance.
                      </p>
                    </div>
                  </div>

                  <div className="ds-table-wrap">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>Branch & Sem</th>
                          <th>Email</th>
                          <th style={{ textAlign: 'center' }}>Consent Given</th>
                          <th style={{ textAlign: 'center' }}>Enrollment Status</th>
                          <th style={{ textAlign: 'center' }}>Quality Score</th>
                          <th style={{ textAlign: 'right' }}>Admin Privacy Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollments.map((enr) => (
                          <tr key={enr.studentId}>
                            <td className="bold">{enr.rollNumber}</td>
                            <td className="bold">{enr.name}</td>
                            <td>{enr.branch} - Sem {enr.semester}</td>
                            <td>{enr.email}</td>
                            <td style={{ textAlign: 'center' }}>
                              {enr.consentGiven ? (
                                <span className="ds-pill green">✓ Explicit Consent</span>
                              ) : (
                                <span className="ds-pill gray">Not Granted</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <AttendanceStatusBadge status={enr.isEnrolled ? 'enrolled' : 'not_enrolled'} />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {enr.qualityScore ? `${enr.qualityScore}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {enr.isEnrolled && (
                                <button
                                  type="button"
                                  className="ds-btn ds-btn-danger"
                                  onClick={() => setDeleteTargetStudent(enr)}
                                  style={{ height: 28, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Trash2 size={13} /> Delete Biometric
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB 5: ANALYTICS ── */}
              {activeTab === 'analytics' && analytics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Executive 8-in-1 Institutional Report Export Control */}
                  <div className="ds-card" style={{ background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Download size={18} color="#2563EB" />
                          <span>Official Academic Attendance Report Center</span>
                        </h4>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                          Export authoritative, audit-ready reports in CSV format with strict spreadsheet formula injection protection.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <select
                          className="ds-select"
                          value={selectedReportType}
                          onChange={(e) => setSelectedReportType(e.target.value)}
                          style={{ height: 36, fontSize: 13, minWidth: 260 }}
                        >
                          <option value="department_report">1. Department-Wise Attendance Report</option>
                          <option value="low_attendance_report">2. Low Attendance Student Risk Report</option>
                          <option value="faculty_report">3. Faculty Performance Report</option>
                          <option value="semester_section_report">4. Semester / Section Report</option>
                          <option value="manual_adjustment_report">5. Manual Adjustment Audit Report</option>
                          <option value="subject_wise_report">6. Subject-Wise Attendance Report</option>
                          <option value="session_wise_report">7. Session-Wise Attendance Report</option>
                          <option value="student_report">8. Student Attendance Report</option>
                        </select>

                        <button
                          type="button"
                          className="ds-btn ds-btn-primary"
                          onClick={handleExportReport}
                          disabled={exportingReport}
                          style={{ height: 36, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Download size={14} />
                          <span>{exportingReport ? 'Generating…' : 'Export CSV Report'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="ds-two-col">
                    <div className="ds-card">
                      <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                        Class-Wise Attendance Distribution
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {analytics.classWiseStats?.map((c) => (
                          <div key={c.className}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#111827' }}>{c.className}</span>
                              <strong style={{ color: c.average >= (analytics.minAttendanceThreshold || 75) ? '#16A34A' : '#DC2626' }}>
                                {c.average}%
                              </strong>
                            </div>
                            <div className="ds-bar-track">
                              <div
                                className={`ds-bar-fill ${c.average < 60 ? 'crit' : c.average < (analytics.minAttendanceThreshold || 75) ? 'warn' : ''}`}
                                style={{ width: `${Math.min(c.average, 100)}%` }}
                              />
                            </div>
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                              {c.totalStudents} enrolled • {c.below75} students below threshold
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ds-card">
                      <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                        Campus-Wide Monthly Trend
                      </h3>
                      <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginTop: 20 }}>
                        {analytics.monthlyTrends?.map((m) => (
                          <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A56DB' }}>{m.rate}%</span>
                            <div
                              style={{
                                width: 44,
                                height: `${(m.rate / 100) * 120}px`,
                                background: 'linear-gradient(180deg, #1A56DB 0%, #60A5FA 100%)',
                                borderRadius: '4px 4px 0 0',
                              }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{m.month}</span>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 14 }}>
                        University-wide average attendance across all colleges is <strong>{analytics.overallCampusAttendance || 0}%</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Academic Risk Monitoring Register (Students < 75%) */}
                  <div className="ds-card">
                    <div className="ds-card-header">
                      <div>
                        <h3 className="ds-section-title" style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={18} />
                          <span>Campus Academic Risk Register (&lt; {analytics.minAttendanceThreshold || 75}% Threshold)</span>
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                          Real-time deficit monitoring: calculated units required for examination eligibility.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={() => attendanceService.downloadReportCsv('low_attendance_report')}
                        style={{ height: 28, fontSize: 12 }}
                      >
                        <Download size={13} /> Export Risk Register
                      </button>
                    </div>

                    {(!analytics.academicRiskRegister || analytics.academicRiskRegister.length === 0) ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#16A34A', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                        <CheckCircle2 size={24} style={{ display: 'inline-block', marginBottom: 6 }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>All active students campus-wide currently satisfy the minimum {analytics.minAttendanceThreshold || 75}% attendance threshold.</p>
                      </div>
                    ) : (
                      <div className="ds-table-wrap">
                        <table className="ds-table">
                          <thead>
                            <tr>
                              <th>Roll Number</th>
                              <th>Student Name</th>
                              <th>Department</th>
                              <th>Class</th>
                              <th style={{ textAlign: 'center' }}>Units Held</th>
                              <th style={{ textAlign: 'center' }}>Attended</th>
                              <th style={{ textAlign: 'center' }}>Percentage</th>
                              <th style={{ textAlign: 'center' }}>Deficit Units</th>
                              <th style={{ textAlign: 'center' }}>Risk Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.academicRiskRegister.map((st) => (
                              <tr key={st.studentId}>
                                <td className="bold">{st.rollNumber}</td>
                                <td className="bold">{st.name}</td>
                                <td>{st.department}</td>
                                <td>Sem {st.semester} - {st.section}</td>
                                <td style={{ textAlign: 'center' }}>{st.heldAcademicUnits}</td>
                                <td style={{ textAlign: 'center', color: '#16A34A', fontWeight: 600 }}>{st.attendedAcademicUnits}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#DC2626' }}>{st.percentage}%</td>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#DC2626' }}>
                                  +{st.deficitUnits}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <AttendanceStatusBadge status={st.complianceStatus} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Manual Attendance Adjustment Transparency Table */}
                  <div className="ds-card">
                    <div className="ds-card-header">
                      <div>
                        <h3 className="ds-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ShieldCheck size={18} color="#1A56DB" />
                          <span>Manual Attendance Override Audit Trail</span>
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                          Immutable log of authorized faculty and administrator corrections with mandatory rationale.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={() => attendanceService.downloadReportCsv('manual_adjustment_report')}
                        style={{ height: 28, fontSize: 12 }}
                      >
                        <Download size={13} /> Export Audit Log
                      </button>
                    </div>

                    {(!adjustmentLogs || adjustmentLogs.length === 0) ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B7280', background: '#F8FAFC', borderRadius: 8 }}>
                        <p style={{ margin: 0 }}>No manual attendance corrections have been executed in the system.</p>
                      </div>
                    ) : (
                      <div className="ds-table-wrap">
                        <table className="ds-table">
                          <thead>
                            <tr>
                              <th>Timestamp (IST)</th>
                              <th>Student</th>
                              <th>Subject</th>
                              <th>Date & Period</th>
                              <th style={{ textAlign: 'center' }}>Previous Status</th>
                              <th style={{ textAlign: 'center' }}>Updated Status</th>
                              <th>Authorized Actor</th>
                              <th>Mandatory Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adjustmentLogs.slice(0, 25).map((log) => (
                              <tr key={log._id}>
                                <td style={{ fontSize: 12 }}>{log.timestamp}</td>
                                <td className="bold">{log.studentName} ({log.rollNumber})</td>
                                <td>{log.subjectName}</td>
                                <td>{log.sessionDate} (P{log.sessionPeriod})</td>
                                <td style={{ textAlign: 'center' }}>
                                  <AttendanceStatusBadge status={log.previousStatus} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <AttendanceStatusBadge status={log.updatedStatus} />
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600 }}>{log.actorName}</span>
                                  <span style={{ fontSize: 11, color: '#6B7280', display: 'block' }}>{log.actorRole}</span>
                                </td>
                                <td style={{ fontStyle: 'italic', color: '#374151' }}>"{log.reason}"</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 6: SETTINGS ── */}
              {activeTab === 'settings' && (
                <div className="ds-card" style={{ maxWidth: 640 }}>
                  <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                    Campus Smart Attendance Configuration
                  </h3>

                  {settingsSavedMsg && (
                    <div style={{ padding: 12, background: '#ECFDF5', border: '1px solid #86EFAC', color: '#16A34A', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                      {settingsSavedMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Minimum Attendance Threshold (%)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="100"
                        className="ds-input"
                        value={settings.minAttendancePercent}
                        onChange={(e) => setSettings({ ...settings, minAttendancePercent: Number(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                      <span style={{ fontSize: 11, color: '#64748B' }}>Students falling below this percentage receive debarment warnings.</span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Default Class Session Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="180"
                        className="ds-input"
                        value={settings.defaultSessionDurationMinutes}
                        onChange={(e) => setSettings({ ...settings, defaultSessionDurationMinutes: Number(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Face Recognition Confidence Cutoff (0.50 – 0.90)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="0.95"
                        className="ds-input"
                        value={settings.faceConfidenceThreshold}
                        onChange={(e) => setSettings({ ...settings, faceConfidenceThreshold: Number(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                      <span style={{ fontSize: 11, color: '#64748B' }}>Higher thresholds require closer biometric matches.</span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Biometric Data Retention (Days)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="1825"
                        className="ds-input"
                        value={settings.biometricRetentionDays}
                        onChange={(e) => setSettings({ ...settings, biometricRetentionDays: Number(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <button
                        type="submit"
                        className="ds-btn ds-btn-primary"
                        disabled={savingSettings}
                        style={{ height: 38, padding: '0 24px' }}
                      >
                        {savingSettings ? 'Saving Settings…' : 'Save System Settings'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Delete Biometric Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTargetStudent)}
        title="Delete Biometric Template"
        message={`Are you sure you want to delete biometric data for ${deleteTargetStudent?.name} (${deleteTargetStudent?.rollNumber})? This is logged into institutional security audits and cannot be undone without student re-enrollment.`}
        confirmLabel="Confirm Permanent Deletion"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteEnrollment}
        onCancel={() => setDeleteTargetStudent(null)}
      />
    </div>
  );
};

export default AdminAttendanceHub;
