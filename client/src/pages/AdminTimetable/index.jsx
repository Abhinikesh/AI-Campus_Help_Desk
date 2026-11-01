import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import timetableService from '../../services/timetable.service';
import calendarService from '../../services/calendar.service';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  Calendar, Clock, Plus, CheckCircle, AlertTriangle, Send,
  Layers, Filter, MapPin, X, BookOpen, CalendarDays, History, ShieldAlert
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
];

const AdminTimetable = () => {
  const { user } = useAuth();
  const { isCollapsed } = useSidebar();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [versions, setVersions] = useState([]);
  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'calendar' | 'versions'

  // Filters
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState(5);
  const [section, setSection] = useState('A');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newEntry, setNewEntry] = useState({
    subject: '',
    faculty: '',
    department: 'CSE',
    semester: 5,
    section: 'A',
    dayOfWeek: 1,
    period: 1,
    periodCount: 1,
    startTime: '09:00',
    endTime: '10:00',
    room: 'Hall 301',
    sessionType: 'Lecture',
  });

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventType: 'holiday_college',
    startDate: '',
    endDate: '',
    isAllDay: true,
    audience: 'all',
    venue: 'Campus Wide',
  });

  const [publishNotes, setPublishNotes] = useState('Semester 5 official schedule release');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ttRes, calRes, verRes] = await Promise.all([
        timetableService.getTimetableEntries({ department, semester, section }).catch(() => ({ success: false, data: [] })),
        calendarService.getCalendarEvents().catch(() => ({ success: false, data: [] })),
        timetableService.getTimetableVersions({ department, semester, section }).catch(() => ({ success: false, data: [] })),
      ]);

      if (ttRes?.success && ttRes.data) setEntries(ttRes.data);
      if (calRes?.success && calRes.data) setCalendarEvents(calRes.data);
      if (verRes?.success && verRes.data) setVersions(verRes.data);
    } catch (err) {
      console.error('Error fetching admin timetable data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [department, semester, section]);

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    setConflictError(null);
    setSubmitting(true);
    try {
      const res = await timetableService.createTimetableEntry({
        ...newEntry,
        department,
        semester: Number(semester),
        section,
      });
      if (res?.success) {
        setShowAddModal(false);
        fetchData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create timetable slot';
      setConflictError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await calendarService.createCalendarEvent(newEvent);
      if (res?.success) {
        setShowEventModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishTimetable = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await timetableService.publishTimetable({
        academicYear: '2026-2027',
        department,
        semester: Number(semester),
        section,
        notes: publishNotes,
      });
      if (res?.success) {
        setShowPublishModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to publish timetable');
    } finally {
      setSubmitting(false);
    }
  };

  const draftCount = entries.filter(e => e.status === 'draft' || e.status === 'updated').length;
  const publishedCount = entries.filter(e => e.status === 'published').length;

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
          <div>
            <h1 className="ds-header-title">Scheduling & Academic Calendar Hub</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7280' }}>
              Institution-wide weekly timetable authoring, conflict checking & academic events
            </p>
          </div>

          <div className="ds-header-right">
            <button
              type="button"
              onClick={() => setShowEventModal(true)}
              className="ds-btn ds-btn-secondary"
              style={{ height: 32, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CalendarDays size={14} />
              <span>+ Add Calendar Event</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="ds-btn ds-btn-primary"
              style={{ height: 32, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              <span>+ Add Class Slot</span>
            </button>
            <div className="ds-avatar">{initials(user?.name || 'Admin')}</div>
          </div>
        </header>

        <main className="ds-content">
          {/* Top Metric Cards */}
          <div className="ds-stat-row">
            <div className="ds-stat-card">
              <div className="ds-stat-label">Total Scheduled Slots</div>
              <div className="ds-stat-value">{entries.length}</div>
              <div className="ds-stat-trend neu">{department} Sem {semester} (Sec {section})</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Published / Official</div>
              <div className="ds-stat-value">{publishedCount}</div>
              <div className="ds-stat-trend up">▲ Live on student portals</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Draft / Pending Release</div>
              <div className="ds-stat-value">{draftCount}</div>
              <div className={`ds-stat-trend ${draftCount > 0 ? 'warn' : 'neu'}`}>
                {draftCount > 0 ? 'Requires publication' : 'All published'}
              </div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Active Academic Events</div>
              <div className="ds-stat-value">{calendarEvents.length}</div>
              <div className="ds-stat-trend neu">Holidays & Assessments</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab('timetable')}
                className={`ds-btn ${activeTab === 'timetable' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13 }}
              >
                Weekly Timetable ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`ds-btn ${activeTab === 'calendar' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13 }}
              >
                Academic Calendar ({calendarEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('versions')}
                className={`ds-btn ${activeTab === 'versions' ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
                style={{ height: 34, fontSize: 13 }}
              >
                Version History ({versions.length})
              </button>
            </div>

            {/* Cohort Selectors */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="MECH">MECH</option>
                <option value="CIVIL">CIVIL</option>
              </select>

              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>

              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>

              {draftCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPublishModal(true)}
                  className="ds-btn ds-btn-primary"
                  style={{ height: 32, fontSize: 13, background: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={13} />
                  <span>Publish Version ({draftCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: WEEKLY TIMETABLE */}
          {activeTab === 'timetable' && (
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Cohort Weekly Lecture Timetable</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                    Scheduled classes for {department} Semester {semester} Section {section}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="ds-loading"><div className="ds-spinner" /></div>
              ) : entries.length === 0 ? (
                <EmptyState
                  title="No Timetable Slots Configured"
                  description={`No classes scheduled yet for ${department} Sem ${semester} Sec ${section}. Use "+ Add Class Slot" to build the timetable.`}
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Period & Time</th>
                        <th>Subject</th>
                        <th>Faculty</th>
                        <th>Room</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry._id}>
                          <td className="bold">{entry.dayName || 'Monday'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={13} color="#1A56DB" />
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#6B7280' }}>Period {entry.period || 1}</span>
                          </td>
                          <td>
                            <span className="ds-pill blue" style={{ marginRight: 6 }}>{entry.subject?.code}</span>
                            <span className="bold">{entry.subject?.name}</span>
                          </td>
                          <td>{entry.faculty?.name || 'Assigned Instructor'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563' }}>
                              <MapPin size={13} />
                              <span>{entry.room || 'TBA'}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`ds-pill ${entry.sessionType === 'Lab' ? 'purple' : 'neu'}`}>
                              {entry.sessionType || 'Lecture'}
                            </span>
                          </td>
                          <td>
                            {entry.status === 'published' ? (
                              <span className="ds-pill green">Published</span>
                            ) : entry.status === 'updated' ? (
                              <span className="ds-pill blue">Updated</span>
                            ) : entry.status === 'cancelled' ? (
                              <span className="ds-pill red">Cancelled</span>
                            ) : (
                              <span className="ds-pill amber">Draft</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {entry.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const reason = prompt('Enter cancellation reason (min 5 characters):');
                                  if (reason && reason.trim().length >= 5) {
                                    await timetableService.cancelTimetableEntry(entry._id, { reason });
                                    fetchData();
                                  }
                                }}
                                className="ds-btn ds-btn-secondary"
                                style={{ height: 26, fontSize: 11, padding: '0 8px', color: '#EF4444' }}
                              >
                                Cancel Slot
                              </button>
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

          {/* TAB 2: ACADEMIC CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Institutional Academic Events & Holidays</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                    Scheduled institutional milestones, examination windows, and official holidays
                  </p>
                </div>
              </div>

              {calendarEvents.length === 0 ? (
                <EmptyState
                  title="No Academic Events"
                  description="Use '+ Add Calendar Event' above to schedule institutional holidays or academic deadlines."
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Date Window</th>
                        <th>Type</th>
                        <th>Title</th>
                        <th>Venue</th>
                        <th>Audience</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarEvents.map((ev) => (
                        <tr key={ev.id || ev._id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600 }}>
                              {new Date(ev.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td>
                            {ev.eventType?.includes('holiday') ? (
                              <span className="ds-pill red">Holiday</span>
                            ) : ev.category === 'examination' ? (
                              <span className="ds-pill purple">Examination</span>
                            ) : ev.category === 'assignment' ? (
                              <span className="ds-pill amber">Assignment</span>
                            ) : (
                              <span className="ds-pill blue">Institutional</span>
                            )}
                          </td>
                          <td className="bold">{ev.title}</td>
                          <td>{ev.venue || 'Campus Wide'}</td>
                          <td><span style={{ textTransform: 'capitalize' }}>{ev.audience || 'All'}</span></td>
                          <td style={{ fontSize: 13, color: '#4B5563', maxWidth: 320 }}>{ev.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TIMETABLE VERSIONS */}
          {activeTab === 'versions' && (
            <div className="ds-card">
              <div className="ds-card-header">
                <div>
                  <h3 className="ds-section-title">Archived Timetable Versions & Release Audits</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                    Forensic version history and publication logs for {department} Sem {semester} Sec {section}
                  </p>
                </div>
              </div>

              {versions.length === 0 ? (
                <EmptyState
                  title="No Published Versions Yet"
                  description="Publish a timetable version using 'Publish Version' button to create an audited snapshot."
                />
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Published Date</th>
                        <th>Published By</th>
                        <th>Total Slots</th>
                        <th>Release Notes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((ver) => (
                        <tr key={ver._id}>
                          <td className="bold">
                            <span className="ds-pill blue">Version {ver.versionNumber}</span>
                          </td>
                          <td>{new Date(ver.publishedAt).toLocaleString('en-IN')}</td>
                          <td>{ver.publishedBy?.name || 'Administrator'}</td>
                          <td>{ver.entryCount} classes</td>
                          <td>{ver.notes || '—'}</td>
                          <td><span className="ds-pill green">Official Release</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD TIMETABLE ENTRY */}
      {showAddModal && (
        <div className="ds-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="ds-modal-header">
              <h3 className="ds-section-title">Schedule New Class Slot</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="ds-close-btn"><X size={18} /></button>
            </div>

            {conflictError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #F87171', color: '#991B1B', padding: '10px 14px', borderRadius: 6, margin: '12px 16px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Scheduling Conflict Detected:</strong>
                  <div style={{ marginTop: 2 }}>{conflictError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateEntry} className="ds-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="ds-label">Subject ID / Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 60d0fe... or Subject ID"
                    value={newEntry.subject}
                    onChange={(e) => setNewEntry({ ...newEntry, subject: e.target.value })}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label className="ds-label">Faculty User ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 60d0fe... or User ID"
                    value={newEntry.faculty}
                    onChange={(e) => setNewEntry({ ...newEntry, faculty: e.target.value })}
                    className="ds-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="ds-label">Day of Week *</label>
                  <select
                    value={newEntry.dayOfWeek}
                    onChange={(e) => setNewEntry({ ...newEntry, dayOfWeek: Number(e.target.value) })}
                    className="ds-input"
                  >
                    {DAYS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ds-label">Period Number *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newEntry.period}
                    onChange={(e) => setNewEntry({ ...newEntry, period: Number(e.target.value) })}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label className="ds-label">Period Count</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={newEntry.periodCount}
                    onChange={(e) => setNewEntry({ ...newEntry, periodCount: Number(e.target.value) })}
                    className="ds-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="ds-label">Start Time (HH:mm) *</label>
                  <input
                    type="text"
                    required
                    placeholder="09:00"
                    value={newEntry.startTime}
                    onChange={(e) => setNewEntry({ ...newEntry, startTime: e.target.value })}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label className="ds-label">End Time (HH:mm) *</label>
                  <input
                    type="text"
                    required
                    placeholder="10:00"
                    value={newEntry.endTime}
                    onChange={(e) => setNewEntry({ ...newEntry, endTime: e.target.value })}
                    className="ds-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="ds-label">Room / Lecture Hall *</label>
                  <input
                    type="text"
                    required
                    placeholder="Hall 301"
                    value={newEntry.room}
                    onChange={(e) => setNewEntry({ ...newEntry, room: e.target.value })}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label className="ds-label">Session Type</label>
                  <select
                    value={newEntry.sessionType}
                    onChange={(e) => setNewEntry({ ...newEntry, sessionType: e.target.value })}
                    className="ds-input"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab Practical</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>
              </div>

              <div className="ds-modal-footer" style={{ marginTop: 20 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="ds-btn ds-btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary">
                  {submitting ? 'Checking Conflicts…' : 'Schedule Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACADEMIC CALENDAR EVENT */}
      {showEventModal && (
        <div className="ds-modal-backdrop" onClick={() => setShowEventModal(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="ds-modal-header">
              <h3 className="ds-section-title">Create Academic Calendar Event</h3>
              <button type="button" onClick={() => setShowEventModal(false)} className="ds-close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateEvent} className="ds-modal-body">
              <div>
                <label className="ds-label">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Holidays, Mid-Term Break"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="ds-input"
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="ds-label">Event Type *</label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                  className="ds-input"
                >
                  <option value="holiday_college">College Holiday</option>
                  <option value="holiday_national">National Holiday</option>
                  <option value="holiday_academic">Academic Recess</option>
                  <option value="college_event">College Event / Symposium</option>
                  <option value="workshop_seminar">Workshop / Seminar</option>
                  <option value="examination_period">Examination Period</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="ds-label">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label className="ds-label">End Date *</label>
                  <input
                    type="date"
                    required
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="ds-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label className="ds-label">Audience *</label>
                  <select
                    value={newEvent.audience}
                    onChange={(e) => setNewEvent({ ...newEvent, audience: e.target.value })}
                    className="ds-input"
                  >
                    <option value="all">Everyone (Campus Wide)</option>
                    <option value="students">Students Only</option>
                    <option value="faculty">Faculty Only</option>
                  </select>
                </div>
                <div>
                  <label className="ds-label">Venue</label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                    className="ds-input"
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="ds-label">Description</label>
                <textarea
                  rows="3"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="ds-input"
                  placeholder="Optional details or announcements regarding this event..."
                />
              </div>

              <div className="ds-modal-footer" style={{ marginTop: 20 }}>
                <button type="button" onClick={() => setShowEventModal(false)} className="ds-btn ds-btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary">
                  {submitting ? 'Saving…' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PUBLISH TIMETABLE VERSION */}
      {showPublishModal && (
        <div className="ds-modal-backdrop" onClick={() => setShowPublishModal(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="ds-modal-header">
              <h3 className="ds-section-title">Publish Official Timetable Version</h3>
              <button type="button" onClick={() => setShowPublishModal(false)} className="ds-close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handlePublishTimetable} className="ds-modal-body">
              <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                Publishing will make all <strong>{draftCount}</strong> draft and updated slots for{' '}
                <strong>{department} Sem {semester} (Sec {section})</strong> live on student timetables and dispatch real-time alerts.
              </p>

              <div style={{ marginTop: 12 }}>
                <label className="ds-label">Release Version Notes</label>
                <input
                  type="text"
                  required
                  value={publishNotes}
                  onChange={(e) => setPublishNotes(e.target.value)}
                  className="ds-input"
                />
              </div>

              <div className="ds-modal-footer" style={{ marginTop: 20 }}>
                <button type="button" onClick={() => setShowPublishModal(false)} className="ds-btn ds-btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary" style={{ background: '#10B981' }}>
                  {submitting ? 'Publishing…' : 'Confirm & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTimetable;

