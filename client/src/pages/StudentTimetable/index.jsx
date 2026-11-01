import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import timetableService from '../../services/timetable.service';
import calendarService from '../../services/calendar.service';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  Clock, MapPin, Calendar, BookOpen, GraduationCap,
  CalendarDays, User, Filter, AlertCircle, FileText
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const DAYS = [
  { id: 'all', label: 'Entire Week' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

const StudentTimetable = () => {
  const { user } = useAuth();
  const { isCollapsed } = useSidebar();

  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState([]);
  const [cohort, setCohort] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'calendar'
  const [selectedDay, setSelectedDay] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ttRes, calRes] = await Promise.all([
          timetableService.getStudentTimetable().catch(() => ({ success: false, data: [] })),
          calendarService.getCalendarEvents().catch(() => ({ success: false, data: [] })),
        ]);

        if (ttRes?.success && ttRes.data) {
          setTimetable(ttRes.data);
          setCohort(ttRes.cohort);
        }
        if (calRes?.success && calRes.data) {
          setCalendarEvents(calRes.data);
        }
      } catch (err) {
        console.error('Error fetching student timetable or calendar:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const studentName = user?.name || 'Student';

  // Filter timetable by day
  const filteredTimetable = selectedDay === 'all'
    ? timetable
    : timetable.filter(t => t.dayOfWeek === selectedDay);

  // Filter calendar events
  const filteredCalendarEvents = calendarEvents.filter(ev => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'examination') return ev.category === 'examination' || ev.eventType?.includes('exam');
    if (categoryFilter === 'assignment') return ev.category === 'assignment' || ev.eventType?.includes('assignment');
    if (categoryFilter === 'holiday') return ev.eventType?.includes('holiday');
    if (categoryFilter === 'academic') return ev.category === 'institutional';
    return true;
  });

  return (
    <div className="ds-shell">
      <Sidebar />

      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">Class Timetable & Academic Calendar</h1>
            <span className="ds-pill blue">
              {cohort ? `${cohort.department} Sem ${cohort.semester} (Sec ${cohort.section})` : 'Semester 5 • CSE'}
            </span>
          </div>

          <div className="ds-header-right">
            <Link to="/student/attendance" className="ds-btn ds-btn-primary" style={{ height: 32, fontSize: 13 }}>
              Attendance Overview
            </Link>
            <div className="ds-avatar">{initials(studentName)}</div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading student timetable & academic schedule…</span>
          </div>
        ) : (
          <main className="ds-content">
            {/* View Switcher Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setActiveTab('timetable')}
                className={`ds-btn ${activeTab === 'timetable' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <BookOpen size={15} />
                <span>Weekly Lecture Timetable ({timetable.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`ds-btn ${activeTab === 'calendar' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CalendarDays size={15} />
                <span>Academic Calendar & Key Deadlines ({calendarEvents.length})</span>
              </button>
            </div>

            {/* TAB 1: WEEKLY TIMETABLE */}
            {activeTab === 'timetable' && (
              <div className="ds-card">
                <div className="ds-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 className="ds-section-title">Classroom Schedule & Lecture Periods</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                      Official published timetable for your branch, semester, and section.
                    </p>
                  </div>

                  {/* Day of Week Filter Buttons */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {DAYS.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDay(d.id)}
                        className={`ds-btn ${selectedDay === d.id ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                        style={{ height: 28, fontSize: 12, padding: '0 10px' }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTimetable.length === 0 ? (
                  <EmptyState
                    title="No Classes Scheduled"
                    description={
                      selectedDay === 'all'
                        ? "No published classes found for your cohort. Check back once the semester timetable is released."
                        : `No lectures or labs scheduled on ${DAYS.find(d => d.id === selectedDay)?.label}.`
                    }
                  />
                ) : (
                  <div className="ds-table-wrap">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Period & Time</th>
                          <th>Subject Code</th>
                          <th>Subject Name</th>
                          <th>Instructor</th>
                          <th>Venue / Hall</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTimetable.map((tt) => (
                          <tr key={tt._id}>
                            <td className="bold">{tt.dayName || 'Monday'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E293B' }}>
                                <Clock size={13} color="#1A56DB" />
                                <span>{tt.time || `${tt.startTime} - ${tt.endTime}`}</span>
                              </div>
                              <span style={{ fontSize: 11, color: '#6B7280' }}>
                                Period {tt.period || 1} {tt.periodCount > 1 ? `(${tt.periodCount} hrs)` : ''}
                              </span>
                            </td>
                            <td><span className="ds-pill blue">{tt.subject?.code}</span></td>
                            <td className="bold">{tt.subject?.name}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#374151' }}>
                                <User size={13} />
                                <span>{tt.faculty?.name || 'Faculty Member'}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563' }}>
                                <MapPin size={13} />
                                <span>{tt.room || 'TBA'}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`ds-pill ${tt.sessionType === 'Lab' ? 'purple' : 'neu'}`}>
                                {tt.sessionType || 'Lecture'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACADEMIC CALENDAR & DEADLINES */}
            {activeTab === 'calendar' && (
              <div className="ds-card">
                <div className="ds-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 className="ds-section-title">Academic Calendar, Examinations & Deadlines</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                      Aggregated schedule of upcoming examinations, assignment due dates, holidays, and campus events.
                    </p>
                  </div>

                  {/* Category Filter Pills */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: 'All Items' },
                      { id: 'examination', label: 'Examinations' },
                      { id: 'assignment', label: 'Assignment Deadlines' },
                      { id: 'holiday', label: 'Holidays' },
                      { id: 'academic', label: 'Campus Events' },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`ds-btn ${categoryFilter === cat.id ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                        style={{ height: 28, fontSize: 12, padding: '0 10px' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredCalendarEvents.length === 0 ? (
                  <EmptyState
                    title="No Events Found"
                    description="No events match your current filter selection."
                  />
                ) : (
                  <div className="ds-table-wrap">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Event / Assessment Title</th>
                          <th>Venue</th>
                          <th>Details & Instructions</th>
                          <th style={{ textAlign: 'right' }}>Portal Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCalendarEvents.map((ev) => (
                          <tr key={ev.id || ev._id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600, color: '#1E293B' }}>
                                {new Date(ev.startDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              {ev.startTime && (
                                <span style={{ fontSize: 11, color: '#6B7280' }}>
                                  {ev.startTime} - {ev.endTime}
                                </span>
                              )}
                            </td>
                            <td>
                              {ev.category === 'examination' ? (
                                <span className="ds-pill purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <GraduationCap size={12} />
                                  <span>Examination</span>
                                </span>
                              ) : ev.category === 'assignment' ? (
                                <span className="ds-pill amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <FileText size={12} />
                                  <span>Assignment Due</span>
                                </span>
                              ) : ev.eventType?.includes('holiday') ? (
                                <span className="ds-pill red">Holiday</span>
                              ) : (
                                <span className="ds-pill blue">Academic</span>
                              )}
                            </td>
                            <td className="bold">{ev.title}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563' }}>
                                <MapPin size={13} />
                                <span>{ev.venue || 'Campus Wide'}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 13, color: '#4B5563', maxWidth: 300 }}>
                              {ev.description || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {ev.category === 'examination' ? (
                                <Link
                                  to="/student/exams"
                                  className="ds-btn ds-btn-secondary"
                                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                                >
                                  View Exam
                                </Link>
                              ) : ev.category === 'assignment' ? (
                                <Link
                                  to="/student/assignments"
                                  className="ds-btn ds-btn-secondary"
                                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                                >
                                  Submit Work
                                </Link>
                              ) : (
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Institutional</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

export default StudentTimetable;

