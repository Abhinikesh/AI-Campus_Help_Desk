import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, BarChart2,
  Folder, Flag, MessageCircle, LogOut, ArrowLeft, Search, Filter,
  Download, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/student/dashboard' },
  { label: 'My Courses',       icon: BookOpen,        to: '/student/results'   },
  { label: 'Attendance',       icon: CalendarCheck,   to: '/student/attendance' },
  { label: 'Results & Grades', icon: BarChart2,       to: '/student/results'   },
  { label: 'Academic Drive',   icon: Folder,          to: '/student/drive'     },
  { label: 'Complaints',       icon: Flag,            to: '/student/complaints' },
  { label: 'AI Help Desk',     icon: MessageCircle,   to: '/student/ai-help'   },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AttendanceHistory = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [subjects, setSubjects] = useState([]);

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async (page = 1) => {
    try {
      setLoading(true);
      const res = await attendanceService.getStudentAttendanceHistory({
        page,
        limit: 15,
        subjectId: selectedSubject || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res?.success && res.data) {
        setRecords(res.data.records || []);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of subjects & history
    const init = async () => {
      try {
        const attRes = await attendanceService.getStudentAttendance();
        if (attRes?.success && attRes.data) {
          setSubjects(attRes.data);
        }
      } catch (e) {
        console.warn('Subject list fetch caught:', e);
      }
      fetchHistory(1);
    };
    init();
  }, [selectedSubject, selectedStatus, startDate, endDate]);

  const handleExportCSV = () => {
    if (!records.length) return;
    const headers = ['Date', 'Period', 'Subject', 'Subject Code', 'Status', 'Verification Method', 'Confidence'];
    const rows = records.map(r => [
      r.date,
      r.period,
      `"${r.subjectName}"`,
      r.subjectCode,
      r.status,
      r.verificationMethod,
      r.confidence ? `${Math.round(r.confidence * 100)}%` : 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const studentName = user?.name || 'Student';

  // Client-side search filtering
  const displayRecords = records.filter(r =>
    search ? (
      r.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
      r.subjectCode?.toLowerCase().includes(search.toLowerCase()) ||
      r.date?.includes(search)
    ) : true
  );

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
          <span className="ds-role-pill">Student Portal</span>
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

      {/* ── Main Content ── */}
      <div className="ds-main">
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/student/attendance" className="ds-btn ds-btn-secondary" style={{ padding: '4px 8px', height: 30 }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="ds-header-title">Attendance History & Audit Log</h1>
          </div>

          <div className="ds-header-right">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={handleExportCSV}
              disabled={!records.length}
            >
              <Download size={14} /> Export CSV
            </button>
            <div className="ds-avatar">{initials(studentName)}</div>
          </div>
        </header>

        <main className="ds-content">
          {/* Filter Bar */}
          <div className="ds-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search subject or date…"
                  className="ds-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, width: '100%' }}
                />
              </div>

              {/* Subject Filter */}
              <select
                className="ds-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.subject} ({s.code})</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="ds-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="present">Present Only</option>
                <option value="absent">Absent Only</option>
              </select>

              {/* Date Filters */}
              <input
                type="date"
                className="ds-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="From Date"
              />
              <input
                type="date"
                className="ds-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="To Date"
              />

              {(selectedSubject || selectedStatus !== 'all' || startDate || endDate || search) && (
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={() => {
                    setSelectedSubject('');
                    setSelectedStatus('all');
                    setStartDate('');
                    setEndDate('');
                    setSearch('');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* History Records Table */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h3 className="ds-section-title">Session Attendance Records</h3>
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                Showing {displayRecords.length} of {pagination.total} records
              </span>
            </div>

            {loading ? (
              <div className="ds-loading" style={{ height: 200 }}>
                <div className="ds-spinner" />
                <span className="ds-loading-text">Loading historical records…</span>
              </div>
            ) : displayRecords.length === 0 ? (
              <EmptyState
                title="No History Matches"
                description="No attendance records match your current filter parameters or date range."
              />
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Period</th>
                      <th>Subject Name</th>
                      <th>Code</th>
                      <th style={{ textAlign: 'center' }}>Method</th>
                      <th style={{ textAlign: 'center' }}>Confidence</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th>Record Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRecords.map((rec) => (
                      <tr key={rec._id}>
                        <td className="bold">{rec.date}</td>
                        <td>Period {rec.period}</td>
                        <td className="bold">{rec.subjectName}</td>
                        <td><span className="ds-pill gray">{rec.subjectCode}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <AttendanceStatusBadge status={rec.verificationMethod} />
                        </td>
                        <td style={{ textAlign: 'center', color: '#4B5563' }}>
                          {rec.confidence ? `${Math.round(rec.confidence * 100)}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <AttendanceStatusBadge status={rec.status} />
                        </td>
                        <td style={{ fontSize: 12, color: '#6B7280' }}>
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchHistory(pagination.page - 1)}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span style={{ fontSize: 13, color: '#4B5563' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchHistory(pagination.page + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AttendanceHistory;
