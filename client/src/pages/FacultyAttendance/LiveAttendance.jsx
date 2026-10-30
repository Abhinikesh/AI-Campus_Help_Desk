import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendance.service';
import CameraPreview from '../../components/AttendanceShared/CameraPreview';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import ConfirmationDialog from '../../components/AttendanceShared/ConfirmationDialog';
import {
  GraduationCap, ArrowLeft, Clock, CheckCircle2, AlertTriangle,
  StopCircle, Lock, Search, RefreshCw, UserCheck, UserX,
  Camera, ShieldCheck, Eye, Edit3, X
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import '../../components/AttendanceShared/AttendanceShared.css';

const LiveAttendance = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, present: 0, pending: 0, absent: 0, needsReview: 0 });

  // Elapsed timer state
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Filters & search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Simulated classroom face detection boxes on the live video stream
  const [boundingBoxes, setBoundingBoxes] = useState([
    { x: 22, y: 30, w: 20, h: 28, label: 'Arjun S. (94%)' },
    { x: 58, y: 34, w: 20, h: 28, label: 'Abhinikesh (92%)' },
  ]);

  const fetchSession = async () => {
    try {
      const res = await attendanceService.getSessionDetails(sessionId);
      if (res?.success && res.data) {
        setSession(res.data.session);
        setRoster(res.data.roster || []);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error fetching live session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // Poll for live attendance updates every 5 seconds if session is open
    const interval = setInterval(() => {
      if (session?.status === 'open') {
        fetchSession();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, session?.status]);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleManualToggle = async (attendanceId, newStatus) => {
    try {
      setActionLoading(true);
      await attendanceService.updateStudentAttendance({
        attendanceId,
        status: newStatus,
        note: `Manual override by ${user?.name || 'Faculty'}`,
      });
      fetchSession();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseSession = async () => {
    try {
      setActionLoading(true);
      await attendanceService.closeSession(sessionId);
      setShowCloseModal(false);
      fetchSession();
    } catch (err) {
      console.error('Error closing session:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeSession = async () => {
    try {
      setActionLoading(true);
      await attendanceService.finalizeSession(sessionId);
      setShowFinalizeModal(false);
      fetchSession();
    } catch (err) {
      console.error('Error finalizing session:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRoster = roster.filter(s => {
    const matchesSearch = search ? (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase())
    ) : true;

    const matchesStatus = statusFilter !== 'all' ? s.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const isFinalized = session?.status === 'finalized';
  const isClosed = session?.status === 'closed' || isFinalized;

  return (
    <div className="ds-shell" style={{ background: '#F8FAFC' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '20px 24px' }}>
        {/* Top Control Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 20,
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => navigate('/faculty/attendance')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32 }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  {session?.subject?.name || 'Class Session'}
                </h2>
                <span className="ds-pill blue">{session?.subject?.code || 'CS'}</span>
                <AttendanceStatusBadge status={session?.status || 'open'} />
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Class: <strong>{session?.branch || 'CSE'}-{session?.semester || 4} ({session?.section || 'A'})</strong> • Period {session?.period} • {session?.date}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#F1F5F9',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                color: '#1E293B',
              }}
            >
              <Clock size={15} color={isClosed ? '#64748B' : '#2563EB'} />
              <span>{isClosed ? 'Session Ended' : `Active: ${formatTimer(secondsElapsed)}`}</span>
            </div>

            {!isClosed && (
              <button
                type="button"
                className="ds-btn ds-btn-danger"
                onClick={() => setShowCloseModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34 }}
              >
                <StopCircle size={15} /> Stop Session
              </button>
            )}

            {!isFinalized && (
              <button
                type="button"
                className="ds-btn ds-btn-primary"
                onClick={() => setShowFinalizeModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34 }}
              >
                <Lock size={14} /> Finalize Attendance
              </button>
            )}
          </div>
        </div>

        {/* Live Counters */}
        <div className="ds-stat-row" style={{ marginBottom: 20 }}>
          <div className="ds-stat-card" style={{ borderLeft: '3px solid #1A56DB' }}>
            <div className="ds-stat-label">Total Students</div>
            <div className="ds-stat-value">{stats.totalStudents}</div>
            <div className="ds-stat-trend neu">Registered Roster</div>
          </div>

          <div className="ds-stat-card" style={{ borderLeft: '3px solid #16A34A' }}>
            <div className="ds-stat-label">Present</div>
            <div className="ds-stat-value" style={{ color: '#16A34A' }}>{stats.present}</div>
            <div className="ds-stat-trend up">
              {stats.totalStudents > 0 ? `${Math.round((stats.present / stats.totalStudents) * 100)}% attendance` : '0%'}
            </div>
          </div>

          <div className="ds-stat-card" style={{ borderLeft: '3px solid #D97706' }}>
            <div className="ds-stat-label">Pending Scan</div>
            <div className="ds-stat-value" style={{ color: '#D97706' }}>{stats.pending}</div>
            <div className="ds-stat-trend neu">Awaiting verification</div>
          </div>

          <div className="ds-stat-card" style={{ borderLeft: '3px solid #DC2626' }}>
            <div className="ds-stat-label">Needs Review / Absent</div>
            <div className="ds-stat-value" style={{ color: '#DC2626' }}>
              {stats.needsReview + stats.absent}
            </div>
            <div className="ds-stat-trend down">Requires manual review</div>
          </div>
        </div>

        {/* Main Work Area: Left = Camera Stream, Right = Live Roster */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
          {/* Left: Classroom Camera Stream & Face Recognition Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ds-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="ds-section-title">Classroom Optical Feed</h3>
                <span className="ds-pill blue">
                  <ShieldCheck size={13} style={{ marginRight: 4 }} /> AI Sensor Live
                </span>
              </div>

              {/* Classroom Camera */}
              <CameraPreview
                status={isClosed ? 'ready' : 'verifying'}
                isClassroomMode={true}
                boundingBoxes={boundingBoxes}
                guideMessage="Scanning classroom seating area…"
              />

              <div style={{ marginTop: 14, background: '#F8FAFC', padding: 12, borderRadius: 8, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                <strong>Continuous Scan Active:</strong> Facial recognition engine detects enrolled students in frame and streams verified matches to the roster ledger on the right.
              </div>
            </div>
          </div>

          {/* Right: Live Recognized Student List */}
          <div className="ds-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div className="ds-card-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="ds-section-title">Student Attendance Roster</h3>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {filteredRoster.length} of {roster.length} students displayed
                </span>
              </div>
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={fetchSession}
                title="Refresh Live Data"
                style={{ padding: '4px 8px', height: 28 }}
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search student or roll number…"
                  className="ds-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, width: '100%', height: 32, fontSize: 13 }}
                />
              </div>

              <select
                className="ds-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: 32, fontSize: 13 }}
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="pending">Pending</option>
                <option value="absent">Absent</option>
                <option value="review">Needs Review</option>
              </select>
            </div>

            {/* Live Student List Container */}
            <div
              style={{
                flex: 1,
                maxHeight: 460,
                overflowY: 'auto',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
              }}
            >
              {filteredRoster.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  No students match your filter criteria.
                </div>
              ) : (
                filteredRoster.map((st) => (
                  <div key={st._id} className="live-roster-item">
                    <div className="live-roster-info">
                      <div className="live-roster-avatar">
                        {st.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="live-roster-details">
                        <h5>{st.name}</h5>
                        <div className="live-roster-sub">
                          Roll: <strong>{st.rollNumber}</strong> • {st.branch}
                          {st.confidence && <span> • Match: {Math.round(st.confidence * 100)}%</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AttendanceStatusBadge status={st.status} />

                      {/* Manual correction dropdown / buttons */}
                      {!isFinalized && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {st.status !== 'present' ? (
                            <button
                              type="button"
                              className="ds-btn ds-btn-secondary"
                              onClick={() => handleManualToggle(st._id, 'present')}
                              title="Mark Present"
                              disabled={actionLoading}
                              style={{ padding: '4px 6px', height: 26, color: '#16A34A' }}
                            >
                              <UserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ds-btn ds-btn-secondary"
                              onClick={() => handleManualToggle(st._id, 'absent')}
                              title="Mark Absent"
                              disabled={actionLoading}
                              style={{ padding: '4px 6px', height: 26, color: '#DC2626' }}
                            >
                              <UserX size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="ds-btn ds-btn-secondary"
                            onClick={() => setSelectedStudentDetail(st)}
                            title="Inspect Details"
                            style={{ padding: '4px 6px', height: 26 }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Student Details Inspection Modal */}
      {selectedStudentDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 10,
              width: '100%',
              maxWidth: 420,
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Student Verification Record</h4>
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 18px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><span style={{ color: '#64748B' }}>Full Name:</span> <strong>{selectedStudentDetail.name}</strong></div>
              <div><span style={{ color: '#64748B' }}>Roll Number:</span> <strong>{selectedStudentDetail.rollNumber}</strong></div>
              <div><span style={{ color: '#64748B' }}>Current Status:</span> <AttendanceStatusBadge status={selectedStudentDetail.status} /></div>
              <div><span style={{ color: '#64748B' }}>Method:</span> <AttendanceStatusBadge status={selectedStudentDetail.verificationMethod} /></div>
              <div><span style={{ color: '#64748B' }}>Match Confidence:</span> <strong>{selectedStudentDetail.confidence ? `${Math.round(selectedStudentDetail.confidence * 100)}%` : 'Manual mark'}</strong></div>
              <div><span style={{ color: '#64748B' }}>Timestamp:</span> <strong>{new Date(selectedStudentDetail.verifiedAt).toLocaleTimeString()}</strong></div>
              {selectedStudentDetail.isManualOverride && (
                <div style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, color: '#92400E', fontSize: 12 }}>
                  ⚠️ Manually adjusted: {selectedStudentDetail.overrideNote || 'Faculty correction'}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 18px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="ds-btn ds-btn-primary" onClick={() => setSelectedStudentDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Session Dialog */}
      <ConfirmationDialog
        isOpen={showCloseModal}
        title="Stop Live Attendance Session"
        message="Are you sure you want to stop this live attendance session? Any students remaining in 'Pending' will be marked as Absent. You can still manually review and adjust records before finalizing."
        confirmLabel="Stop Session"
        cancelLabel="Keep Running"
        isDestructive={false}
        onConfirm={handleCloseSession}
        onCancel={() => setShowCloseModal(false)}
      />

      {/* Finalize Session Dialog */}
      <ConfirmationDialog
        isOpen={showFinalizeModal}
        title="Finalize Attendance Records"
        message="Finalizing will permanently lock these attendance records into the institutional academic registry. Any further changes will require admin audit authorization."
        confirmLabel="Lock & Finalize"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleFinalizeSession}
        onCancel={() => setShowFinalizeModal(false)}
      />
    </div>
  );
};

export default LiveAttendance;
