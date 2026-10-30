import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/faculty.service';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, LayoutDashboard, BookOpen, CalendarCheck, Users,
  Megaphone, Folder, Flag, MessageCircle, LogOut, ArrowLeft,
  Search, Award, Download
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

const FacultyResults = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const res = await facultyService.getStudents();
        if (res?.success && res.data) {
          setStudents(res.data);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const facultyName = user?.name || 'Professor';

  const mockMarks = [
    { code: 'CS201', subject: 'Data Structures', marks: 88, grade: 'A' },
    { code: 'CS202', subject: 'DBMS', marks: 82, grade: 'A' },
    { code: 'CS203', subject: 'Operating Systems', marks: 91, grade: 'A+' },
    { code: 'CS205', subject: 'Computer Networks', marks: 78, grade: 'B+' },
    { code: 'CS207', subject: 'Web Development', marks: 85, grade: 'A' },
  ];

  const filtered = students.filter(s =>
    search ? (
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ) : true
  );

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
          <span className="ds-role-pill">Academic Assessment</span>
        </div>

        <nav className="ds-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === '/faculty/results';
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
            <Link to="/faculty/dashboard" className="ds-btn ds-btn-secondary" style={{ padding: '4px 8px', height: 30 }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="ds-header-title">Student Examination & Grade Records</h1>
          </div>

          <div className="ds-header-right">
            <span className="ds-pill blue">CSE Dept • Semester 4</span>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        <main className="ds-content">
          <div className="ds-card">
            <div className="ds-card-header">
              <div>
                <h3 className="ds-section-title">Enrolled Students Grade Ledger</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                  Mid-semester and continuous assessment grades.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Search student or roll number…"
                  className="ds-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ height: 32, fontSize: 13 }}
                />
              </div>
            </div>

            {loading ? (
              <div className="ds-loading" style={{ height: 200 }}>
                <div className="ds-spinner" />
                <span className="ds-loading-text">Loading student records…</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No Students Found"
                description="No student records match the search filter."
              />
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Branch & Section</th>
                      <th style={{ textAlign: 'center' }}>CS201 (DSA)</th>
                      <th style={{ textAlign: 'center' }}>CS202 (DBMS)</th>
                      <th style={{ textAlign: 'center' }}>CS203 (OS)</th>
                      <th style={{ textAlign: 'center' }}>CS205 (Networks)</th>
                      <th style={{ textAlign: 'center' }}>CS207 (Web)</th>
                      <th style={{ textAlign: 'center' }}>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((st, i) => {
                      const marks = [
                        [88, 82, 91, 78, 85],
                        [92, 85, 88, 80, 90],
                        [75, 70, 78, 72, 80],
                        [85, 88, 84, 82, 86],
                        [90, 92, 88, 85, 91],
                        [72, 68, 74, 70, 75],
                        [84, 86, 82, 80, 88],
                        [78, 75, 80, 74, 82],
                      ][i % 8];

                      const avg = Math.round(marks.reduce((a, b) => a + b, 0) / marks.length);

                      return (
                        <tr key={st._id}>
                          <td className="bold">{st.rollNumber}</td>
                          <td className="bold">{st.fullName || st.user?.name}</td>
                          <td>{st.branch} ({st.section})</td>
                          <td style={{ textAlign: 'center' }}>{marks[0]}</td>
                          <td style={{ textAlign: 'center' }}>{marks[1]}</td>
                          <td style={{ textAlign: 'center' }}>{marks[2]}</td>
                          <td style={{ textAlign: 'center' }}>{marks[3]}</td>
                          <td style={{ textAlign: 'center' }}>{marks[4]}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#1A56DB' }}>
                            {avg}%
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
      </div>
    </div>
  );
};

export default FacultyResults;
