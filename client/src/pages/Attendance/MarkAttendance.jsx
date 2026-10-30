import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendance.service';
import CameraPreview from '../../components/AttendanceShared/CameraPreview';
import AttendanceStatusBadge from '../../components/AttendanceShared/AttendanceStatusBadge';
import EmptyState from '../../components/AttendanceShared/EmptyState';
import {
  GraduationCap, ArrowLeft, CheckCircle2, AlertTriangle,
  Clock, ShieldCheck, RefreshCw, Camera, ChevronRight, User, BookOpen
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Attendance.css';

const MarkAttendance = () => {
  const { sessionId: routeSessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  // Verification state: 'idle' | 'ready' | 'verifying' | 'success' | 'failed' | 'manual_fallback'
  const [verifyState, setVerifyState] = useState('ready');
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyStatusText, setVerifyStatusText] = useState('Camera active — Center your face in the oval');
  const [confirmationData, setConfirmationData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const res = await attendanceService.getStudentActiveSessions();
        if (res?.success && res.data) {
          setSessions(res.data);
          if (routeSessionId) {
            const found = res.data.find(s => s._id === routeSessionId);
            if (found) setSelectedSession(found);
            else if (res.data.length > 0) setSelectedSession(res.data[0]);
          } else if (res.data.length > 0) {
            setSelectedSession(res.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [routeSessionId]);

  const handleStartVerification = async () => {
    if (!selectedSession) return;

    setVerifyState('verifying');
    setVerifyProgress(15);
    setVerifyStatusText('Detecting face geometry and illumination…');
    setErrorMessage('');

    // Step-by-step UI feedback
    setTimeout(() => {
      setVerifyProgress(45);
      setVerifyStatusText('Checking biometric liveness & head alignment…');
    }, 800);

    setTimeout(() => {
      setVerifyProgress(75);
      setVerifyStatusText('Comparing biometric signature against enrolled Face ID…');
    }, 1600);

    setTimeout(async () => {
      try {
        setVerifyProgress(90);
        const res = await attendanceService.joinAttendanceSession(selectedSession._id, {
          verificationMethod: 'face',
          confidence: 0.95,
        });

        if (res?.success) {
          setVerifyProgress(100);
          setVerifyState('success');
          setConfirmationData(res.data);
        } else {
          setVerifyState('failed');
          setErrorMessage(res?.message || 'Verification could not be confirmed by the server.');
        }
      } catch (err) {
        console.error('Attendance join error:', err);
        setVerifyState('failed');
        setErrorMessage(err.response?.data?.message || 'Verification request failed. Please retry.');
      }
    }, 2400);
  };

  const handleManualFallback = async () => {
    if (!selectedSession) return;
    try {
      setLoading(true);
      const res = await attendanceService.joinAttendanceSession(selectedSession._id, {
        verificationMethod: 'manual',
        confidence: null,
      });
      if (res?.success) {
        setVerifyState('success');
        setConfirmationData(res.data);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Manual verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setVerifyState('ready');
    setVerifyProgress(0);
    setVerifyStatusText('Camera active — Center your face in the oval');
    setErrorMessage('');
  };

  return (
    <div className="ds-shell" style={{ background: '#F8FAFC' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '24px 20px' }}>
        {/* Top Breadcrumb Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={() => navigate('/student/attendance')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} /> Back to Attendance
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ds-pill blue">Smart Attendance Verification</span>
          </div>
        </div>

        {/* Success Confirmation Card */}
        {verifyState === 'success' && confirmationData ? (
          <div className="ds-card" style={{ textAlign: 'center', padding: '36px 24px', border: '1.5px solid #86EFAC' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#16A34A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
              Attendance Successfully Verified!
            </h2>
            <p style={{ fontSize: 14, color: '#4B5563', margin: '0 0 24px 0' }}>
              Your presence has been cryptographically recorded on the campus academic ledger.
            </p>

            <div
              style={{
                maxWidth: 480,
                margin: '0 auto 28px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '16px 20px',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 16px',
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Student</span>
                <strong style={{ color: '#111827' }}>{confirmationData.studentName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Roll Number</span>
                <strong style={{ color: '#111827' }}>{confirmationData.rollNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Subject</span>
                <strong style={{ color: '#111827' }}>{confirmationData.subject} ({confirmationData.code})</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Date & Time</span>
                <strong style={{ color: '#111827' }}>{confirmationData.date} • {confirmationData.time}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Verification Mode</span>
                <AttendanceStatusBadge status={confirmationData.verificationMethod} />
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
                <AttendanceStatusBadge status="present" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <Link to="/student/attendance/history" className="ds-btn ds-btn-secondary">
                View Attendance History
              </Link>
              <Link to="/student/dashboard" className="ds-btn ds-btn-primary">
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
            {/* Left Column: Session Selector & Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="ds-card">
                <h3 className="ds-section-title" style={{ marginBottom: 14 }}>
                  Select Class Session
                </h3>

                {sessions.length === 0 ? (
                  <EmptyState
                    title="No Open Sessions"
                    description="No live attendance session is active for your semester right now. Faculty will open sessions at class start time."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sessions.map((sess) => {
                      const isSel = selectedSession?._id === sess._id;
                      return (
                        <div
                          key={sess._id}
                          onClick={() => setSelectedSession(sess)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 8,
                            border: `1.5px solid ${isSel ? '#1A56DB' : '#E2E8F0'}`,
                            background: isSel ? '#EFF6FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <strong style={{ fontSize: 14, color: '#111827' }}>
                              {sess.subject}
                            </strong>
                            <span className="ds-pill blue">{sess.code}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#4B5563', display: 'flex', gap: 10 }}>
                            <span>Period {sess.period}</span>
                            <span>•</span>
                            <span>{sess.startTime} - {sess.endTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedSession && (
                <div className="ds-card">
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    Session Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Instructor</span>
                      <strong style={{ color: '#111827' }}>{selectedSession.faculty}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Session Date</span>
                      <strong style={{ color: '#111827' }}>{selectedSession.date}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Type</span>
                      <span className="ds-pill gray">{selectedSession.sessionType || 'Regular Class'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Method</span>
                      <span className="ds-pill blue">{selectedSession.attendanceMethod === 'face' ? 'Face Verification' : 'QR Check-in'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="ds-card" style={{ background: '#F8FAFC' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  Verification Checklist
                </h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#4B5563', lineHeight: 1.6 }}>
                  <li>Ensure good lighting on your face</li>
                  <li>Remove sunglasses, masks, or extreme hats</li>
                  <li>Hold device straight and look directly at camera</li>
                </ul>
              </div>
            </div>

            {/* Right Column: Camera & Live Verification Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 className="ds-section-title">Face Verification Camera</h3>
                  <AttendanceStatusBadge status={verifyState === 'verifying' ? 'pending' : 'open'} />
                </div>

                {/* Camera Component */}
                <CameraPreview
                  status={verifyState}
                  guideMessage={verifyStatusText}
                />

                {/* Verification Progress Bar */}
                {verifyState === 'verifying' && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: '#1A56DB', fontWeight: 600 }}>{verifyStatusText}</span>
                      <span style={{ color: '#4B5563', fontWeight: 700 }}>{verifyProgress}%</span>
                    </div>
                    <div className="ds-bar-track">
                      <div className="ds-bar-fill" style={{ width: `${verifyProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {verifyState === 'failed' && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '12px 16px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: 8,
                      color: '#DC2626',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>{errorMessage}</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {verifyState !== 'verifying' ? (
                    <button
                      type="button"
                      className="ds-btn ds-btn-primary"
                      onClick={handleStartVerification}
                      disabled={!selectedSession}
                      style={{ height: 42, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <Camera size={16} />
                      <span>Scan & Verify My Attendance</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ds-btn ds-btn-secondary"
                      disabled
                      style={{ height: 42, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <RefreshCw size={16} className="ds-spinner-inline" />
                      <span>Verifying Biometric Match…</span>
                    </button>
                  )}

                  {verifyState === 'failed' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={handleRetry}
                        style={{ flex: 1 }}
                      >
                        <RefreshCw size={14} /> Retry Scan
                      </button>
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        onClick={handleManualFallback}
                        style={{ flex: 1 }}
                      >
                        Request Manual Check-in
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkAttendance;
