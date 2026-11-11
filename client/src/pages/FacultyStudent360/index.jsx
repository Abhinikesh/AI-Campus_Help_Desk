/**
 * client/src/pages/FacultyStudent360/index.jsx
 * Faculty Student 360 Profile — Strictly Four Main Sections.
 * Section 1 (Basic Profile) restricted ONLY to Roll Number, Phone Number, and Class.
 * Sections 2-4 display verified Academic Details, Marks & Results, and Timetable.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import { facultyService } from '../../services/faculty.service';
import {
  ArrowLeft, User, BookOpen, Award, Calendar,
  AlertTriangle, ShieldAlert, FileText, CheckCircle, Clock
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import '../../styles/theme.css';
import './FacultyStudent360.css';

const TABS = [
  { id: 'basic',     label: 'Basic Profile',    Icon: User     },
  { id: 'academic',  label: 'Academic Details', Icon: BookOpen },
  { id: 'marks',     label: 'Marks & Results',  Icon: Award    },
  { id: 'timetable', label: 'Timetable',        Icon: Calendar },
];

const FacultyStudent360 = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('basic');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // 403, 404, or generic message
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage('');

    try {
      const res = await facultyService.getStudent360(id);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorStatus('error');
        setErrorMessage(res.message || 'Failed to load Student 360 profile');
      }
    } catch (err) {
      const status = err.response?.status;
      setErrorStatus(status || 'error');
      setErrorMessage(
        status === 403
          ? 'Access Denied: You are not authorized to view this student profile. Faculty access is strictly limited to students in your assigned teaching courses.'
          : status === 404
          ? 'Student Not Found: The requested student record does not exist.'
          : err.response?.data?.message || err.message || 'Failed to connect to server'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [id]);

  return (
    <div className="ds-shell">
      <Sidebar />

      <div className="ds-main">
        {/* Top Header */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/faculty/students" className="f360-back-btn" title="Back to Search">
              <ArrowLeft size={16} />
              <span>Back to Directory</span>
            </Link>
            <span className="ds-pill blue">Student 360 Profile</span>
          </div>
          {data?.basicProfile?.rollNumber && (
            <div className="ds-header-right">
              <span className="ds-code-badge">{data.basicProfile.rollNumber}</span>
            </div>
          )}
        </header>

        <div className="ds-content">
          {/* Loading State */}
          {loading && (
            <div className="f360-loading-box">
              <div className="ds-spinner" />
              <span className="ds-loading-text">Loading verified Student 360 records…</span>
            </div>
          )}

          {/* Error / Unauthorized State */}
          {!loading && errorStatus && (
            <div className="f360-error-card">
              <div className="f360-error-icon-box">
                {errorStatus === 403 ? <ShieldAlert size={36} color="#DC2626" /> : <AlertTriangle size={36} color="#D97706" />}
              </div>
              <h2 className="f360-error-title">
                {errorStatus === 403 ? 'Access Restricted' : errorStatus === 404 ? 'Student Not Found' : 'Error Loading Profile'}
              </h2>
              <p className="f360-error-desc">{errorMessage}</p>
              <div className="f360-error-actions">
                <Link to="/faculty/students" className="ds-btn primary sm" style={{ textDecoration: 'none' }}>
                  Return to Student Directory
                </Link>
                {errorStatus !== 403 && errorStatus !== 404 && (
                  <button className="ds-btn outline sm" onClick={loadProfile}>
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Valid Profile Content */}
          {!loading && !errorStatus && data && (
            <>
              {/* Profile Overview Card */}
              <div className="f360-profile-banner">
                <div className="f360-avatar-large">
                  <User size={32} color="#1A56DB" />
                </div>
                <div className="f360-banner-meta">
                  <div className="f360-banner-top">
                    <h1 className="f360-student-roll">Roll No: {data.basicProfile?.rollNumber || 'N/A'}</h1>
                    <span className="ds-pill green">Enrolled</span>
                  </div>
                  <div className="f360-banner-sub">
                    <span>Class: <strong>{data.basicProfile?.class || 'Not specified'}</strong></span>
                  </div>
                </div>
              </div>

              {/* 4 Accessible Tabs */}
              <div className="f360-tabs-bar">
                {TABS.map((tab) => {
                  const Icon = tab.Icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`f360-tab-btn${isActive ? ' active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── SECTION 1: BASIC PROFILE ── */}
              {activeTab === 'basic' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Basic Profile</span>
                    <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>
                      Authoritative student identification fields
                    </span>
                  </div>
                  <div className="f360-fields-grid">
                    <div className="f360-field-item">
                      <span className="f360-field-label">University Roll Number</span>
                      <span className="f360-field-value bold">
                        {data.basicProfile?.rollNumber || <span className="f360-null">Not provided</span>}
                      </span>
                    </div>

                    <div className="f360-field-item">
                      <span className="f360-field-label">Phone Number</span>
                      <span className="f360-field-value">
                        {data.basicProfile?.phoneNumber || <span className="f360-null">Not provided</span>}
                      </span>
                    </div>

                    <div className="f360-field-item">
                      <span className="f360-field-label">Class</span>
                      <span className="f360-field-value">
                        {data.basicProfile?.class || <span className="f360-null">Not specified</span>}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION 2: ACADEMIC DETAILS ── */}
              {activeTab === 'academic' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Academic Details</span>
                    <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>
                      Session: {data.academicDetails?.academicSession || '2026-2027'}
                    </span>
                  </div>

                  <div className="f360-academic-meta-grid">
                    <div className="f360-meta-item">
                      <span className="f360-meta-label">Programme</span>
                      <span className="f360-meta-val">{data.academicDetails?.programme || 'B.Tech'}</span>
                    </div>
                    <div className="f360-meta-item">
                      <span className="f360-meta-label">Department</span>
                      <span className="f360-meta-val">{data.academicDetails?.department || 'CSE'}</span>
                    </div>
                    <div className="f360-meta-item">
                      <span className="f360-meta-label">Semester & Section</span>
                      <span className="f360-meta-val">
                        Semester {data.academicDetails?.semester ?? '—'} ({data.academicDetails?.section || 'Sec A'})
                      </span>
                    </div>
                    <div className="f360-meta-item">
                      <span className="f360-meta-label">Curriculum Scope</span>
                      <span className="f360-meta-val">{data.academicDetails?.enrollmentBasis || 'Departmental'}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <h3 className="f360-subheading">Enrolled Curriculum Subjects</h3>
                    {data.academicDetails?.enrolledSubjects?.length === 0 ? (
                      <div className="cs-empty-state">
                        <div className="cs-empty-icon"><BookOpen size={24} /></div>
                        <div className="cs-empty-title">No Enrolled Subjects</div>
                        <div className="cs-empty-desc">No curriculum subjects were found matching this student's branch and semester.</div>
                      </div>
                    ) : (
                      <div className="ds-table-wrap">
                        <table className="ds-table">
                          <thead>
                            <tr>
                              <th>Subject Code</th>
                              <th>Subject Name</th>
                              <th>Credits</th>
                              <th>Type</th>
                              <th>Assigned Faculty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.academicDetails?.enrolledSubjects?.map((sub, i) => (
                              <tr key={i}>
                                <td><span className="ds-code-badge">{sub.code}</span></td>
                                <td className="bold">{sub.name}</td>
                                <td>{sub.credits != null ? sub.credits : '—'}</td>
                                <td><span className="ds-pill blue">{sub.subjectType || 'Theory'}</span></td>
                                <td>{sub.assignedFaculty || <span className="f360-null">Unassigned</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SECTION 3: MARKS & RESULTS ── */}
              {activeTab === 'marks' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Marks & Results</span>
                    {data.marksAndResults?.status === 'published' && data.marksAndResults?.sgpa != null && (
                      <span className="ds-pill green">Official SGPA: {data.marksAndResults.sgpa} / 10</span>
                    )}
                  </div>

                  {data.marksAndResults?.status !== 'published' || data.marksAndResults?.subjectMarks?.length === 0 ? (
                    <div className="cs-empty-state">
                      <div className="cs-empty-icon"><Award size={28} /></div>
                      <div className="cs-empty-title">Evaluation in Progress</div>
                      <div className="cs-empty-desc">
                        {data.marksAndResults?.message || 'Marks have not been published for this examination.'}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="ds-table-wrap">
                        <table className="ds-table">
                          <thead>
                            <tr>
                              <th>Subject Code</th>
                              <th>Subject Name</th>
                              <th>Evaluation Component</th>
                              <th>Internal (30)</th>
                              <th>External (70)</th>
                              <th>Total Marks</th>
                              <th>Grade</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.marksAndResults.subjectMarks.map((m, i) => (
                              <tr key={i}>
                                <td><span className="ds-code-badge">{m.subjectCode || '—'}</span></td>
                                <td className="bold">{m.subjectName || 'Course'}</td>
                                <td>{m.examTitle || 'Semester Exam'}</td>
                                <td>{m.internalMarks != null ? m.internalMarks : '—'}</td>
                                <td>{m.externalMarks != null ? m.externalMarks : '—'}</td>
                                <td>
                                  <strong>{m.marksObtained != null ? m.marksObtained : '—'}</strong>
                                  <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}> / {m.maxMarks || 100}</span>
                                </td>
                                <td><span className="ds-pill blue bold">{m.grade || '—'}</span></td>
                                <td>
                                  <span className={`ds-pill ${m.isPassed ? 'green' : 'red'}`}>
                                    {m.isPassed ? 'Pass' : 'Pending / Fail'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── SECTION 4: TIMETABLE ── */}
              {activeTab === 'timetable' && (
                <div className="ds-card">
                  <div className="ds-card-header">
                    <span className="ds-section-title">Published Class Timetable</span>
                    <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>
                      Weekly Monday – Friday Schedule
                    </span>
                  </div>

                  {data.timetable?.slots?.length === 0 ? (
                    <div className="cs-empty-state">
                      <div className="cs-empty-icon"><Calendar size={28} /></div>
                      <div className="cs-empty-title">No Timetable Scheduled</div>
                      <div className="cs-empty-desc">
                        {data.timetable?.message || 'No published timetable available for this section.'}
                      </div>
                    </div>
                  ) : (
                    <div className="ds-table-wrap">
                      <table className="ds-table">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Period</th>
                            <th>Time Slot</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Faculty</th>
                            <th>Subgroup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.timetable.slots.map((slot, i) => (
                            <tr key={i}>
                              <td className="bold">{slot.day}</td>
                              <td>{slot.periodNumber ? `Period ${slot.periodNumber}` : '—'}</td>
                              <td><span className="f360-time-badge"><Clock size={12} /> {slot.time || `${slot.startTime} – ${slot.endTime}`}</span></td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className="bold">{slot.subjectName || 'Class'}</span>
                                  <span style={{ fontSize: 11, color: 'var(--cs-text-muted)' }}>{slot.subjectCode}</span>
                                </div>
                              </td>
                              <td><span className="ds-code-badge">{slot.room || 'TBA'}</span></td>
                              <td>{slot.facultyName || <span className="f360-null">Unassigned</span>}</td>
                              <td><span className="ds-pill gray">{slot.subgroup || 'All'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyStudent360;
