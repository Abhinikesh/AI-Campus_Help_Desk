import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import timetableService from '../../services/timetable.service';
import calendarService from '../../services/calendar.service';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  Clock, MapPin, Camera, Calendar, CheckCircle2, AlertCircle,
  BookOpen, Filter, CalendarDays, Layers
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

const FacultyTimetable = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();

  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'calendar'
  const [selectedDay, setSelectedDay] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ttRes, calRes] = await Promise.all([
          timetableService.getFacultyTimetable().catch(() => ({ success: false, data: [] })),
          calendarService.getCalendarEvents().catch(() => ({ success: false, data: [] })),
        ]);

        if (ttRes?.success && ttRes.data) {
          setTimetable(ttRes.data);
        }
        if (calRes?.success && calRes.data) {
          setCalendarEvents(calRes.data);
        }
      } catch (err) {
        console.error('Error fetching faculty timetable or calendar:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const facultyName = user?.name || 'Professor';

  // Filter timetable by day
  const filteredTimetable = selectedDay === 'all'
    ? timetable
    : timetable.filter(t => t.dayOfWeek === selectedDay);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="ds-pill green">Official</span>;
      case 'draft':
        return <span className="ds-pill amber">Draft</span>;
      case 'updated':
        return <span className="ds-pill blue">Rescheduled</span>;
      case 'cancelled':
        return <span className="ds-pill red">Cancelled</span>;
      default:
        return <span className="ds-pill neu">{status || 'Scheduled'}</span>;
    }
  };

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
            <h1 className="ds-header-title">Faculty Timetable & Academic Calendar</h1>
            <span className="ds-pill blue">Semester 5 (2026–2027)</span>
          </div>

          <div className="ds-header-right">
            <Link to="/faculty/attendance" className="ds-btn ds-btn-primary" style={{ height: 32, fontSize: 13 }}>
              Attendance Portal
            </Link>
            <div className="ds-avatar">{initials(facultyName)}</div>
          </div>
        </header>

        {loading ? (
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading teaching schedule & academic events…</span>
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
                <span>Weekly Teaching Timetable ({timetable.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`ds-btn ${activeTab === 'calendar' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CalendarDays size={15} />
                <span>Integrated Academic Calendar ({calendarEvents.length})</span>
              </button>
            </div>

            {activeTab === 'timetable' && (
              <div className="ds-card">
                <div className="ds-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 className="ds-section-title">Assigned Lecture Periods & Laboratory Blocks</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                      Click "Launch Smart Attendance" on any scheduled class to initiate facial biometric verification.
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
                    title="No Timetable Entries Found"
                    description={
                      selectedDay === 'all'
                        ? "No teaching slots have been scheduled for your profile this semester."
                        : `No lectures or labs scheduled on ${DAYS.find(d => d.id === selectedDay)?.label}.`
                    }
                  />
                ) : (
                  <div className="ds-table-wrap">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Day of Week</th>
                          <th>Period / Time</th>
                          <th>Subject Code</th>
                          <th>Subject Name</th>
                          <th>Venue / Hall</th>
                          <th>Cohort</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Smart Attendance</th>
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
                                Period {tt.period || 1} {tt.periodCount > 1 ? `(${tt.periodCount} hrs block)` : ''}
                              </span>
                            </td>
                            <td><span className="ds-pill blue">{tt.subject?.code}</span></td>
                            <td className="bold">{tt.subject?.name}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563' }}>
                                <MapPin size={13} />
                                <span>{tt.room || 'TBA'}</span>
                              </div>
                            </td>
                            <td>
                              {tt.department || tt.subject?.branch || 'CSE'} - Sem {tt.semester || tt.subject?.semester || 5} (Sec {tt.section || 'A'})
                            </td>
                            <td>{getStatusBadge(tt.status)}</td>
                            <td style={{ textAlign: 'right' }}>
                              {tt.status === 'cancelled' ? (
                                <span style={{ fontSize: 12, color: '#EF4444', fontStyle: 'italic' }}>Cancelled</span>
                              ) : (
                                <Link
                                  to={`/faculty/attendance`}
                                  className="ds-btn ds-btn-secondary"
                                  style={{
                                    height: 28,
                                    fontSize: 12,
                                    padding: '0 10px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Camera size={13} />
                                  <span>Start Attendance</span>
                                </Link>
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

            {activeTab === 'calendar' && (
              <div className="ds-card">
                <div className="ds-card-header">
                  <div>
                    <h3 className="ds-section-title">Institutional Academic Calendar & Key Dates</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>
                      Synchronized institutional events, scheduled examinations, assignment deadlines, and official holidays.
                    </p>
                  </div>
                </div>

                {calendarEvents.length === 0 ? (
                  <EmptyState
                    title="No Calendar Events"
                    description="No institutional events, examinations, or holidays have been scheduled yet."
                  />
                ) : (
                  <div className="ds-table-wrap">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Date / Duration</th>
                          <th>Category</th>
                          <th>Event Title</th>
                          <th>Venue</th>
                          <th>Audience</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calendarEvents.map((ev) => (
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
                                <span className="ds-pill purple">Examination</span>
                              ) : ev.category === 'assignment' ? (
                                <span className="ds-pill amber">Assignment</span>
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
                            <td>
                              <span style={{ textTransform: 'capitalize', fontSize: 12 }}>
                                {ev.audience || 'All'}
                              </span>
                            </td>
                            <td style={{ fontSize: 13, color: '#4B5563', maxWidth: 300 }}>
                              {ev.description || '—'}
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

export default FacultyTimetable;
