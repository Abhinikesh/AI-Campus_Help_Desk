import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import attendanceService from '../../services/attendance.service';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, ArrowLeft,
  Search, Download, Eye, ChevronRight
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

const FacultyAttendanceRecords = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await attendanceService.getFacultyRecords({
        subjectId: selectedSubject || undefined,
        date: selectedDate || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });

      if (res?.success && res.data) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of subjects
    const init = async () => {
      try {
        const ttRes = await attendanceService.getFacultyTimetable();
        if (ttRes?.success && ttRes.data) {
          const map = {};
          ttRes.data.forEach(t => {
            if (t.subject?._id) map[t.subject._id] = t.subject;
          });
          setSubjects(Object.values(map));
        }
      } catch (e) {
        console.warn('Subject list fetch error:', e);
      }
      fetchRecords();
    };
    init();
  }, [selectedSubject, selectedDate, selectedStatus]);

  const handleExportCSV = () => {
    if (!records.length) return;
    const headers = ['Date', 'Subject', 'Code', 'Class', 'Total Students', 'Present', 'Absent', 'Percentage', 'Status'];
    const rows = records.map(r => [
      r.date,
      `"${r.subject}"`,
      r.code,
      r.class,
      r.totalStudents,
      r.present,
      r.absent,
      `${r.percentage}%`,
      r.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Faculty_Attendance_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const facultyName = user?.name || 'Professor';
  const { isCollapsed } = useSidebar();

  const filtered = records.filter(r =>
    search ? (
      r.subject?.toLowerCase().includes(search.toLowerCase()) ||
      r.code?.toLowerCase().includes(search.toLowerCase()) ||
      r.class?.toLowerCase().includes(search.toLowerCase()) ||
      r.date?.includes(search)
    ) : true
  );

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
            <h1 className="ds-header-title">Faculty Attendance Records</h1>
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
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        <main className="ds-content">
          {/* Filters Bar */}
          <div className="ds-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search subject, class or date…"
                  className="ds-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, width: '100%' }}
                />
              </div>

              <select
                className="ds-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>

              <select
                className="ds-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Session Statuses</option>
                <option value="open">Live / Open</option>
                <option value="closed">Closed</option>
                <option value="finalized">Finalized</option>
              </select>

              <input
                type="date"
                className="ds-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />

              {(selectedSubject || selectedStatus !== 'all' || selectedDate || search) && (
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={() => {
                    setSelectedSubject('');
                    setSelectedStatus('all');
                    setSelectedDate('');
                    setSearch('');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h3 className="ds-section-title">Conducted Attendance Sessions</h3>
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                {filtered.length} total sessions recorded
              </span>
            </div>

            {loading ? (
              <div className="ds-loading" style={{ height: 200 }}>
                <div className="ds-spinner" />
                <span className="ds-loading-text">Loading records…</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No Attendance Records Found"
                description="No historical attendance sessions match the current query criteria."
              />
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject Name</th>
                      <th>Code</th>
                      <th>Class</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th style={{ textAlign: 'center' }}>Attendance %</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r._id}>
                        <td className="bold">{r.date}</td>
                        <td className="bold">{r.subject}</td>
                        <td><span className="ds-pill gray">{r.code}</span></td>
                        <td>{r.class}</td>
                        <td style={{ textAlign: 'center' }}>{r.totalStudents}</td>
                        <td style={{ textAlign: 'center', color: '#16A34A', fontWeight: 600 }}>{r.present}</td>
                        <td style={{ textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{r.absent}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.percentage}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <AttendanceStatusBadge status={r.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            to={`/faculty/attendance/live/${r._id}`}
                            className="ds-btn ds-btn-secondary"
                            style={{ height: 28, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Eye size={12} /> View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default FacultyAttendanceRecords;
