/**
 * AdminStudentManagement/index.jsx
 *
 * Phase 3.6, Phase 3.7 & Phase 3.8 — Admin Staging Student Management,
 * Enrollment Verification & Controlled Promotion Workflow
 *
 * Connects to Batch 003 staging collections via secure admin-only APIs.
 * Displays:
 *  1. Staging Student Records: searchable, paginated list and rich detail panel.
 *  2. Enrollment Verification: independent registrar verification workflow,
 *     evidence recording, status actions (Verify, Reject, Request Review), and audit history.
 *  3. Controlled Promotion Governance: promotion eligibility evaluation,
 *     detailed preview, reasons ledger, and individual promotion confirmation modal.
 *
 * Security:
 *  - Page is only accessible via /admin/students (ProtectedRoute role="admin")
 *  - No PII (passwords, parental info) is ever displayed — the API excludes it
 *  - Strict promotion eligibility requires DOCUMENT_VERIFIED + independent evidence
 *  - No automatic User creation; offline institutional Student (enrolled_offline)
 *  - Concurrency protected & immutable audit trail recorded
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import { adminService } from '../../services/admin.service';
import {
  Users, Search, ChevronLeft, ChevronRight, RefreshCw,
  AlertCircle, CheckCircle, HelpCircle, XCircle, ClipboardList,
  BookOpen, Briefcase, Info, X, GraduationCap,
  ShieldCheck, FileCheck, FileText, Clock, AlertTriangle, UserCheck
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './AdminStudentManagement.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_ID = 'BATCH-20261112-STAGING-003';
const PAGE_LIMIT = 20;

const IDENTITY_LABELS = {
  IDENTITY_CONFIRMED:        { label: 'Confirmed',        color: 'green'  },
  IDENTITY_REQUIRES_REVIEW:  { label: 'Needs Review',     color: 'amber'  },
  IDENTITY_AMBIGUOUS:        { label: 'Ambiguous',        color: 'orange' },
  IDENTITY_INVALID:          { label: 'Invalid',          color: 'red'    },
  IDENTITY_UNMATCHED:        { label: 'Unmatched',        color: 'gray'   },
};

const REVIEW_STATUS_LABELS = {
  pending_review: { label: 'Pending',  color: 'amber' },
  resolved:       { label: 'Resolved', color: 'green' },
  rejected:       { label: 'Rejected', color: 'red'   },
  promoted:       { label: 'Promoted', color: 'blue'  },
};

const VERIFICATION_STATUS_CONFIG = {
  PENDING:         { label: 'Pending',         color: 'amber', icon: Clock },
  VERIFIED:        { label: 'Verified',        color: 'green', icon: CheckCircle },
  REJECTED:        { label: 'Rejected',        color: 'red',   icon: XCircle },
  REQUIRES_REVIEW: { label: 'Requires Review', color: 'orange', icon: AlertTriangle },
};

const EVIDENCE_TYPE_OPTIONS = [
  { value: 'REGISTRAR_ENROLLMENT_REGISTER',      label: 'Registrar Enrollment Register' },
  { value: 'OFFICIAL_SEMESTER_REGISTRATION',     label: 'Official Semester Registration' },
  { value: 'OFFICIAL_FEE_CLEARANCE',             label: 'Official Fee Clearance' },
  { value: 'INSTITUTION_ENROLLMENT_CONFIRMATION',label: 'Institution Enrollment Confirmation' },
  { value: 'OTHER',                              label: 'Other Official Registrar Record' },
];

const EVIDENCE_LEVEL_OPTIONS = [
  { value: 'REFERENCE_RECORDED', label: 'Reference Recorded' },
  { value: 'DOCUMENT_VERIFIED',  label: 'Document Verified' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdentityBadge({ classification }) {
  const info = IDENTITY_LABELS[classification] || { label: classification, color: 'gray' };
  return <span className={`ds-pill ${info.color}`}>{info.label}</span>;
}

function ReviewBadge({ status }) {
  const info = REVIEW_STATUS_LABELS[status] || { label: status, color: 'gray' };
  return <span className={`ds-pill ${info.color}`}>{info.label}</span>;
}

function VerificationBadge({ status }) {
  const config = VERIFICATION_STATUS_CONFIG[status] || { label: status, color: 'gray', icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`ds-pill ${config.color}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function InfoRow({ label, value, missing = false }) {
  return (
    <div className="sm-info-row">
      <span className="sm-info-label">{label}</span>
      <span className={`sm-info-value ${missing ? 'sm-missing' : ''}`}>
        {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
      </span>
    </div>
  );
}

// ─── Detail Panel for Staging Students (Phase 3.6) ─────────────────────────────

function StudentDetailPanel({ rollNumber, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (!rollNumber) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setActiveTab('basic');

    adminService.getStagingStudentDetail(rollNumber)
      .then(res => {
        if (res.success) setDetail(res.data);
        else setError(res.message || 'Failed to load detail');
      })
      .catch(err => {
        setError(err?.response?.data?.message || err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  }, [rollNumber]);

  if (!rollNumber) return null;

  return (
    <div className="sm-detail-panel">
      <div className="sm-detail-header">
        <div>
          <div className="sm-detail-roll">{rollNumber}</div>
          {detail && (
            <div className="sm-detail-name">{detail.studentName || 'Name not available'}</div>
          )}
        </div>
        <button className="sm-close-btn" onClick={onClose} aria-label="Close detail panel">
          <X size={18} />
        </button>
      </div>

      {loading && (
        <div className="sm-detail-loading">
          <div className="ds-spinner" style={{ width: 24, height: 24 }} />
          <span>Loading record…</span>
        </div>
      )}

      {error && !loading && (
        <div className="sm-detail-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {detail && !loading && (
        <>
          {/* Status bar */}
          <div className="sm-status-bar">
            <div className="sm-status-item">
              <span className="sm-status-label">Identity</span>
              <IdentityBadge classification={detail.identityClassification} />
            </div>
            <div className="sm-status-item">
              <span className="sm-status-label">Enrollment</span>
              <span className="ds-pill gray">Not Verified</span>
            </div>
            <div className="sm-status-item">
              <span className="sm-status-label">Batch</span>
              <span className="ds-code-badge" style={{ fontSize: 10 }}>003</span>
            </div>
            {detail.summary?.isDuplicate && (
              <div className="sm-status-item">
                <span className="ds-pill red">Duplicate Master</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="sm-tabs">
            {[
              { key: 'basic',      label: 'Basic Info',  count: detail.summary?.masterCount },
              { key: 'admission',  label: 'Admission',   count: detail.summary?.admissionCount },
              { key: 'academic',   label: 'Academic',    count: detail.summary?.academicCount },
              { key: 'internship', label: 'Internship',  count: detail.summary?.internshipCount },
            ].map(tab => (
              <button
                key={tab.key}
                className={`sm-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count > 0 && <span className="sm-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="sm-tab-content">
            {activeTab === 'basic' && (
              <div>
                <InfoRow label="Normalized Roll" value={detail.normalizedRollNumber} />
                <InfoRow label="Student Name"    value={detail.studentName} missing={!detail.studentName} />
                <InfoRow label="Source Row"      value={detail.sourceRow} />
                <InfoRow label="Review Status"   value={<ReviewBadge status={detail.reviewStatus} />} />
                <InfoRow label="Course"          value={detail.academicProfile?.course}  missing={!detail.academicProfile?.course} />
                <InfoRow label="School"          value={detail.academicProfile?.school}  missing={!detail.academicProfile?.school} />
                <InfoRow label="Batch / Year"    value={detail.academicProfile?.batch}   missing={!detail.academicProfile?.batch} />
                <InfoRow label="Section"         value={detail.academicProfile?.section} missing={!detail.academicProfile?.section} />
              </div>
            )}

            {activeTab === 'admission' && (
              <div>
                {!detail.admissionRecord ? (
                  <div className="sm-empty-tab">
                    <ClipboardList size={28} className="sm-empty-icon" />
                    <div>No admission application found for this roll number</div>
                  </div>
                ) : (
                  <div className="sm-record-card">
                    <div className="sm-record-badge">Admission Record</div>
                    <InfoRow label="App Number"       value={detail.admissionRecord.applicationNumber} />
                    <InfoRow label="Course"           value={detail.admissionRecord.course} missing={!detail.admissionRecord.course} />
                    <InfoRow label="School"           value={detail.admissionRecord.school} missing={!detail.admissionRecord.school} />
                    <InfoRow label="Admission Status" value={detail.admissionRecord.admissionStatus} />
                    <InfoRow label="Source Row"       value={detail.admissionRecord.sourceRow} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'academic' && (
              <div>
                {detail.academicRecords.length === 0 ? (
                  <div className="sm-empty-tab">
                    <GraduationCap size={28} className="sm-empty-icon" />
                    <div>No academic submissions found</div>
                  </div>
                ) : (
                  detail.academicRecords.map((rec, i) => (
                    <div key={rec._id || i} className="sm-record-card">
                      <div className="sm-record-badge">Submission #{i + 1}</div>
                      <InfoRow label="Branch"        value={rec.branch} missing={!rec.branch} />
                      <InfoRow label="10th %"        value={rec.tenthPercentage !== null ? `${rec.tenthPercentage}%` : null} missing={rec.tenthPercentage === null} />
                      <InfoRow label="12th %"        value={rec.twelfthPercentage !== null ? `${rec.twelfthPercentage}%` : null} missing={rec.twelfthPercentage === null} />
                      <InfoRow label="CGPA"          value={rec.selfReportedCgpa !== null ? rec.selfReportedCgpa.toFixed(2) : null} missing={rec.selfReportedCgpa === null} />
                      <InfoRow label="Active Reappears" value={rec.selfReportedActiveReappears} missing={rec.selfReportedActiveReappears === null} />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'internship' && (
              <div>
                {detail.internshipRecords.length === 0 ? (
                  <div className="sm-empty-tab">
                    <Briefcase size={28} className="sm-empty-icon" />
                    <div>No internship records found</div>
                  </div>
                ) : (
                  detail.internshipRecords.map((rec, i) => (
                    <div key={rec._id || i} className="sm-record-card">
                      <div className="sm-record-badge">Internship #{i + 1}</div>
                      <InfoRow label="Organization" value={rec.organizationName || 'None (Self-guided)'} missing={!rec.organizationName} />
                      <InfoRow label="Title"        value={rec.internshipTitle || null} missing={!rec.internshipTitle} />
                      <InfoRow label="Start Date"   value={rec.startDate || null} missing={!rec.startDate} />
                      <InfoRow label="Mode"         value={rec.mode || null} missing={!rec.mode} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Verification Action & Promotion Panel (Phase 3.7 & 3.8) ──────────────────

function VerificationDetailPanel({ rollNumber, onClose, onActionSuccess }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [data, setData] = useState(null);
  const [evidenceType, setEvidenceType] = useState('REGISTRAR_ENROLLMENT_REGISTER');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [evidenceLevel, setEvidenceLevel] = useState('REFERENCE_RECORDED');
  const [remarks, setRemarks] = useState('');

  // ── Phase 3.8: Promotion State ──
  const [promoPreview, setPromoPreview] = useState(null);
  const [promoConfirmModal, setPromoConfirmModal] = useState(false);
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  const loadData = useCallback(() => {
    if (!rollNumber) return;
    setLoading(true);
    setError(null);

    Promise.all([
      adminService.getEnrollmentDetail(rollNumber),
      adminService.getPromotionPreview(rollNumber),
    ])
      .then(([resDetail, resPromo]) => {
        if (resDetail.success) {
          setData(resDetail.data);
          const v = resDetail.data.verification;
          if (v) {
            if (v.evidenceType) setEvidenceType(v.evidenceType);
            if (v.evidenceReference) setEvidenceReference(v.evidenceReference);
            if (v.evidenceVerificationLevel) setEvidenceLevel(v.evidenceVerificationLevel);
            if (v.reviewerRemarks) setRemarks(v.reviewerRemarks);
          }
        } else {
          setError(resDetail.message || 'Failed to load verification details');
        }

        if (resPromo.success) {
          setPromoPreview(resPromo.data);
        }
      })
      .catch(err => {
        setError(err?.response?.data?.message || err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  }, [rollNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordEvidence = async () => {
    if (!evidenceReference.trim()) {
      setError('Please provide a document reference identifier.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await adminService.recordEnrollmentEvidence(rollNumber, {
        evidenceType,
        evidenceReference: evidenceReference.trim(),
        evidenceVerificationLevel: evidenceLevel,
        remarks: remarks.trim(),
      });
      if (res.success) {
        setActionMsg('Evidence successfully saved.');
        loadData();
        if (onActionSuccess) onActionSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to record evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!evidenceReference.trim()) {
      setError('Cannot verify enrollment without an independent evidence reference document identifier.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await adminService.approveEnrollment(rollNumber, {
        evidenceType,
        evidenceReference: evidenceReference.trim(),
        evidenceVerificationLevel: evidenceLevel,
        remarks: remarks.trim() || 'Enrollment verified against independent registrar documentation',
      });
      if (res.success) {
        setActionMsg(`Enrollment successfully VERIFIED.`);
        loadData();
        if (onActionSuccess) onActionSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to approve enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      setError('Rejection requires reviewer remarks explaining why the record is rejected.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await adminService.rejectEnrollment(rollNumber, {
        remarks: remarks.trim(),
      });
      if (res.success) {
        setActionMsg('Enrollment REJECTED.');
        loadData();
        if (onActionSuccess) onActionSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to reject enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReview = async () => {
    if (!remarks.trim()) {
      setError('Review request requires remarks specifying what requires review.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await adminService.requestEnrollmentReview(rollNumber, {
        remarks: remarks.trim(),
      });
      if (res.success) {
        setActionMsg('Status set to REQUIRES_REVIEW.');
        loadData();
        if (onActionSuccess) onActionSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to request review');
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 3.8: Execute controlled promotion
  const handleExecutePromotion = async () => {
    setPromoSubmitting(true);
    setError(null);
    try {
      const res = await adminService.promoteStudent(rollNumber);
      if (res.success) {
        setActionMsg(`Student successfully promoted to production Student collection.`);
        setPromoConfirmModal(false);
        loadData();
        if (onActionSuccess) onActionSuccess();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Promotion failed');
    } finally {
      setPromoSubmitting(false);
    }
  };

  if (!rollNumber) return null;

  const currentStatus = data?.verification?.verificationStatus || 'PENDING';
  const history = data?.verification?.auditHistory || [];
  const isAlreadyPromoted = data?.verification?.isPromoted;

  return (
    <div className="sm-detail-panel" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="sm-detail-header">
        <div>
          <div className="sm-detail-roll">{rollNumber}</div>
          <div className="sm-detail-name">
            {data?.staging?.studentName || data?.verification?.studentName || 'Student Verification'}
          </div>
        </div>
        <button className="sm-close-btn" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>

      {loading && (
        <div className="sm-detail-loading">
          <div className="ds-spinner" style={{ width: 24, height: 24 }} />
          <span>Loading verification details…</span>
        </div>
      )}

      {error && (
        <div className="sm-detail-error" style={{ margin: '12px 16px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {actionMsg && (
        <div className="sm-detail-success" style={{ margin: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', padding: '8px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={15} />
          <span>{actionMsg}</span>
        </div>
      )}

      {data && !loading && (
        <div style={{ padding: '16px' }}>
          {/* Status Bar */}
          <div className="sm-status-bar" style={{ marginBottom: 16 }}>
            <div className="sm-status-item">
              <span className="sm-status-label">Status</span>
              <VerificationBadge status={currentStatus} />
            </div>
            {isAlreadyPromoted ? (
              <div className="sm-status-item">
                <span className="sm-status-label">Production</span>
                <span className="ds-pill blue">PROMOTED</span>
              </div>
            ) : promoPreview?.eligible ? (
              <div className="sm-status-item">
                <span className="sm-status-label">Promotion</span>
                <span className="ds-pill green">ELIGIBLE</span>
              </div>
            ) : (
              <div className="sm-status-item">
                <span className="sm-status-label">Promotion</span>
                <span className="ds-pill gray">INELIGIBLE</span>
              </div>
            )}
            {data.verification?.evidenceVerificationLevel && (
              <div className="sm-status-item">
                <span className="sm-status-label">Level</span>
                <span className="ds-pill blue">{data.verification.evidenceVerificationLevel}</span>
              </div>
            )}
          </div>

          {/* ── Phase 3.8: Promotion Governance Section ── */}
          {isAlreadyPromoted ? (
            <div className="sm-promotion-box sm-promotion-promoted">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <UserCheck size={16} /> Promoted to Production Student
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Account State: <span className="ds-pill blue">enrolled_offline</span>
                {data.verification?.promotedAt && (
                  <div style={{ marginTop: 4, color: '#64748B' }}>
                    Promoted on {new Date(data.verification.promotedAt).toLocaleString('en-IN')} by {data.verification.promotedByAdminName || 'Admin'}
                  </div>
                )}
                <div style={{ marginTop: 4, color: '#64748B', fontSize: 11 }}>
                  Production Student ID: <code>{data.verification.promotedStudentId}</code>
                </div>
              </div>
            </div>
          ) : promoPreview?.eligible ? (
            <div className="sm-promotion-box sm-promotion-eligible">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <CheckCircle size={16} /> All 7 Promotion Eligibility Criteria Met
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Identity verified as <strong>DOCUMENT_VERIFIED</strong> against official institutional evidence.
                Ready for individual promotion.
              </div>
              <button
                className="ds-btn sm sm-action-btn-verify"
                style={{ marginTop: 10 }}
                onClick={() => setPromoConfirmModal(true)}
              >
                <UserCheck size={14} /> Preview & Promote to Production
              </button>
            </div>
          ) : (
            <div className="sm-promotion-box sm-promotion-ineligible">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <AlertTriangle size={16} /> Not Eligible for Production Promotion
              </div>
              <ul className="sm-reasons-list">
                {promoPreview?.reasons?.map((reason, idx) => (
                  <li key={idx} className="sm-reasons-item">{reason}</li>
                )) || <li className="sm-reasons-item">Requires DOCUMENT_VERIFIED enrollment proof.</li>}
              </ul>
            </div>
          )}

          {/* Independent Evidence Notice */}
          <div className="sm-warning-box">
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Institutional Evidence Governance:</strong> Promotion to the production Student collection requires <code>DOCUMENT_VERIFIED</code> status. <code>REFERENCE_RECORDED</code> alone never qualifies.
            </div>
          </div>

          {/* Form */}
          <div className="ds-card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#1E293B' }}>
              Record Verification Evidence
            </div>

            <div className="sm-form-group">
              <label className="sm-form-label">
                Evidence Type <span className="sm-form-label-required">*</span>
              </label>
              <select
                className="ds-select"
                style={{ width: '100%' }}
                value={evidenceType}
                onChange={e => setEvidenceType(e.target.value)}
              >
                {EVIDENCE_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="sm-form-group">
              <label className="sm-form-label">
                Evidence Document / Reference Number <span className="sm-form-label-required">*</span>
              </label>
              <input
                className="ds-input"
                style={{ width: '100%' }}
                placeholder="e.g., REG-2026-ROLL-0842 or FEE-REC-99120"
                value={evidenceReference}
                onChange={e => setEvidenceReference(e.target.value)}
              />
            </div>

            <div className="sm-form-group">
              <label className="sm-form-label">Evidence Verification Level</label>
              <select
                className="ds-select"
                style={{ width: '100%' }}
                value={evidenceLevel}
                onChange={e => setEvidenceLevel(e.target.value)}
              >
                {EVIDENCE_LEVEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="sm-form-group">
              <label className="sm-form-label">Reviewer Remarks</label>
              <textarea
                className="ds-input"
                style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                placeholder="Notes on document verification, registrar ledger page, or reasons..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="sm-action-buttons">
              <button
                className="ds-btn outline sm"
                disabled={submitting || !evidenceReference.trim()}
                onClick={handleRecordEvidence}
                title="Save evidence without changing to VERIFIED status"
              >
                <FileCheck size={14} /> Record Evidence
              </button>

              <button
                className="ds-btn sm sm-action-btn-verify"
                disabled={submitting || !evidenceReference.trim()}
                onClick={handleApprove}
                title="Mark enrollment as VERIFIED (requires independent evidence)"
              >
                <CheckCircle size={14} /> Verify & Approve
              </button>

              <button
                className="ds-btn sm sm-action-btn-review"
                disabled={submitting || !remarks.trim()}
                onClick={handleRequestReview}
                title="Flag record for further review (requires remarks)"
              >
                <AlertTriangle size={14} /> Request Review
              </button>

              <button
                className="ds-btn sm sm-action-btn-reject"
                disabled={submitting || !remarks.trim()}
                onClick={handleReject}
                title="Reject enrollment (requires remarks)"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>

          {/* Audit Trail */}
          <div className="ds-card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> Verification & Promotion History ({history.length})
            </div>

            {history.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                No actions recorded yet. Record starts in PENDING status.
              </div>
            ) : (
              <div className="sm-history-list">
                {[...history].reverse().map((entry, idx) => (
                  <div key={entry._id || idx} className="sm-history-card">
                    <div className="sm-history-head">
                      <span className="sm-history-actor">{entry.action} by {entry.actorName || 'Admin'}</span>
                      <span className="sm-history-time">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : '—'}
                      </span>
                    </div>
                    {entry.status && (
                      <div>
                        Status: <VerificationBadge status={entry.status} />
                      </div>
                    )}
                    {entry.evidenceReference && (
                      <div className="sm-history-detail">
                        Ref: <span className="ds-code-badge" style={{ fontSize: 11 }}>{entry.evidenceReference}</span> ({entry.evidenceType})
                      </div>
                    )}
                    {entry.remarks && (
                      <div className="sm-history-detail" style={{ fontStyle: 'italic', color: '#64748B' }}>
                        "{entry.remarks}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 3.8: Individual Promotion Confirmation Modal ── */}
      {promoConfirmModal && promoPreview?.candidateData && (
        <div className="sm-modal-overlay">
          <div className="sm-modal-container">
            <div className="sm-modal-header">
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={18} style={{ color: '#16A34A' }} />
                Confirm Production Student Promotion
              </div>
              <button className="sm-close-btn" onClick={() => setPromoConfirmModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sm-modal-body">
              <div className="sm-warning-box" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF', marginBottom: 14 }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Controlled Promotion Policy:</strong> Promoting this identity will create an offline institutional Student record with <code>accountStatus: 'enrolled_offline'</code>. No portal User account, password, or synthetic credentials will be created. Academic survey submissions remain untouched.
                </div>
              </div>
              <div className="sm-promotion-preview-card">
                <InfoRow label="Roll Number" value={promoPreview.candidateData.rollNumber} />
                <InfoRow label="Full Name" value={promoPreview.candidateData.fullName} />
                <InfoRow label="Program / Branch" value={promoPreview.candidateData.branch || promoPreview.candidateData.program} />
                <InfoRow label="School" value={promoPreview.candidateData.school} />
                <InfoRow label="Application #" value={promoPreview.candidateData.admissionApplicationNumber} />
                <InfoRow label="Source Batch" value={promoPreview.candidateData.sourceBatchId} />
                <InfoRow label="Account Status" value="enrolled_offline" />
                <InfoRow label="Evidence Level" value={promoPreview.verificationSummary?.level} />
                <InfoRow label="Evidence Ref" value={promoPreview.verificationSummary?.reference} />
              </div>
            </div>
            <div className="sm-modal-footer">
              <button
                className="ds-btn ghost sm"
                onClick={() => setPromoConfirmModal(false)}
                disabled={promoSubmitting}
              >
                Cancel
              </button>
              <button
                className="ds-btn sm sm-action-btn-verify"
                disabled={promoSubmitting}
                onClick={handleExecutePromotion}
              >
                {promoSubmitting ? 'Promoting…' : 'Confirm Individual Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Phase 3.9A: Enrollment Register Import Tab ───────────────────────────────

const RECON_STATUS_CONFIG = {
  PENDING:                      { label: 'Pending',          color: 'gray'   },
  CONFIRMED_MATCH:              { label: 'Confirmed Match',  color: 'green'  },
  NAME_MISMATCH_REQUIRES_REVIEW:{ label: 'Name Mismatch',   color: 'amber'  },
  DUPLICATE_REGISTER_ENTRY:     { label: 'Duplicate',        color: 'orange' },
  UNMATCHED_REGISTER_ENTRY:     { label: 'Unmatched',        color: 'red'    },
  INVALID_IDENTIFIER:           { label: 'Invalid ID',       color: 'red'    },
};

const ROW_STATUS_CONFIG = {
  VALID:                 { label: 'Valid',          color: 'green'  },
  INVALID_IDENTIFIER:    { label: 'Invalid ID',     color: 'red'    },
  MISSING_ROLL:          { label: 'Missing Roll',   color: 'red'    },
  DUPLICATE_IN_REGISTER: { label: 'Duplicate',      color: 'orange' },
};

const EVIDENCE_REVIEW_CONFIG = {
  UNREVIEWED: { label: 'Unreviewed', color: 'gray'  },
  CONFIRMED:  { label: 'Confirmed',  color: 'green' },
  REJECTED:   { label: 'Rejected',   color: 'red'   },
};

const CANONICAL_FIELDS = [
  { key: 'rollNumber',     label: 'Roll Number *', required: true },
  { key: 'studentName',    label: 'Student Name',  required: false },
  { key: 'program',        label: 'Program',       required: false },
  { key: 'branch',         label: 'Branch',        required: false },
  { key: 'semester',       label: 'Semester',      required: false },
  { key: 'section',        label: 'Section',       required: false },
  { key: 'academicYear',   label: 'Academic Year', required: false },
  { key: 'registrationId', label: 'Registration ID', required: false },
];

function ReconBadge({ status }) {
  const cfg = RECON_STATUS_CONFIG[status] || { label: status, color: 'gray' };
  return <span className={`ds-pill ${cfg.color}`}>{cfg.label}</span>;
}

function EvidenceReviewBadge({ status }) {
  const cfg = EVIDENCE_REVIEW_CONFIG[status] || { label: status, color: 'gray' };
  return <span className={`ds-pill ${cfg.color}`}>{cfg.label}</span>;
}

function RegisterImportTab() {
  // ── Upload step ──
  const [uploadPhase, setUploadPhase]       = useState('idle'); // idle | uploading | mapping | importing | done
  const [uploadError, setUploadError]       = useState('');
  const [importId, setImportId]             = useState(null);
  const [headers, setHeaders]               = useState([]);
  const [rowCount, setRowCount]             = useState(0);
  const [filename, setFilename]             = useState('');
  const [selectedFile, setSelectedFile]     = useState(null);
  const fileInputRef = useRef(null);

  // ── Mapping step ──
  const [columnMapping, setColumnMapping]   = useState({});
  const [previewRows, setPreviewRows]       = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]     = useState('');

  // ── Import result ──
  const [importSummary, setImportSummary]   = useState(null);

  // ── Rows view ──
  const [rows, setRows]                     = useState([]);
  const [rowsTotal, setRowsTotal]           = useState(0);
  const [rowsPage, setRowsPage]             = useState(1);
  const [rowsStatus, setRowsStatus]         = useState('');
  const [rowsLoading, setRowsLoading]       = useState(false);
  const [selectedRow, setSelectedRow]       = useState(null);

  // ── Evidence review form ──
  const [reviewDecision, setReviewDecision] = useState('');
  const [reviewRemarks, setReviewRemarks]   = useState('');
  const [reviewLoading, setReviewLoading]   = useState(false);
  const [reviewMsg, setReviewMsg]           = useState('');

  // ── Import history ──
  const [importList, setImportList]         = useState([]);
  const [importListLoading, setImportListLoading] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadImportHistory();
  }, []);

  async function loadImportHistory() {
    setImportListLoading(true);
    try {
      const data = await adminService.listRegisterImports({ limit: 10 });
      setImportList(data.imports || []);
    } catch { /* silent */ }
    setImportListLoading(false);
  }

  async function loadRows(id, status, page) {
    setRowsLoading(true);
    try {
      const data = await adminService.getRegisterImportRows(id, { status, page, limit: 20 });
      setRows(data.rows || []);
      setRowsTotal(data.pagination?.total || 0);
    } catch { /* silent */ }
    setRowsLoading(false);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError('');
  }

  async function handleUpload() {
    if (!selectedFile) { setUploadError('Please choose a CSV or XLSX file.'); return; }
    setUploadPhase('uploading');
    setUploadError('');
    try {
      const data = await adminService.uploadEnrollmentRegister(selectedFile);
      setImportId(data.importId);
      setHeaders(data.headers || []);
      setRowCount(data.rowCount || 0);
      setFilename(data.filename || selectedFile.name);
      setUploadPhase('mapping');
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Upload failed.');
      setUploadPhase('idle');
    }
  }

  async function handlePreview() {
    if (!columnMapping.rollNumber) { setPreviewError('Roll Number mapping is required.'); return; }
    setPreviewLoading(true); setPreviewError('');
    try {
      const data = await adminService.previewRegisterMapping(importId, columnMapping);
      setPreviewRows(data.previewRows || []);
    } catch (err) {
      setPreviewError(err?.response?.data?.message || 'Preview failed.');
    }
    setPreviewLoading(false);
  }

  async function handleImport() {
    if (!columnMapping.rollNumber) { setPreviewError('Roll Number mapping is required.'); return; }
    setUploadPhase('importing');
    try {
      const data = await adminService.executeRegisterImport(importId, columnMapping);
      setImportSummary(data.summary);
      setUploadPhase('done');
      await loadRows(importId, '', 1);
      await loadImportHistory();
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Import failed.');
      setUploadPhase('mapping');
    }
  }

  async function handleReviewSubmit(rowId) {
    if (!reviewDecision) { setReviewMsg('Select Confirm or Reject.'); return; }
    setReviewLoading(true); setReviewMsg('');
    try {
      const data = await adminService.reviewRegisterRowEvidence(rowId, { decision: reviewDecision, remarks: reviewRemarks });
      setReviewMsg(data.message || 'Review recorded.');
      // Refresh the row
      const updated = await adminService.getRegisterRowDetail(rowId);
      setSelectedRow({ ...selectedRow, ...updated.row });
      await loadRows(importId, rowsStatus, rowsPage);
    } catch (err) {
      setReviewMsg(err?.response?.data?.message || 'Review failed.');
    }
    setReviewLoading(false);
  }

  function resetToUpload() {
    setUploadPhase('idle'); setImportId(null); setHeaders([]); setRowCount(0);
    setFilename(''); setSelectedFile(null); setColumnMapping({}); setPreviewRows([]);
    setImportSummary(null); setRows([]); setSelectedRow(null); setUploadError('');
    setPreviewError(''); setReviewDecision(''); setReviewRemarks(''); setReviewMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="sm-register-root">

      {/* ── Upload Zone ── */}
      {uploadPhase === 'idle' && (
        <div className="ds-card sm-register-section">
          <div className="sm-register-section-title">
            <FileText size={18} /> Upload Enrollment Register
          </div>
          <p className="sm-register-hint">
            Upload an official enrollment register (CSV or XLSX, max 10 MB). Column names are mapped in the next step.
          </p>
          <div
            className="sm-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setSelectedFile(f); setUploadError(''); } }}
          >
            <FileText size={32} style={{ color: '#9CA3AF' }} />
            <div className="sm-upload-zone-label">
              {selectedFile ? selectedFile.name : 'Click or drag & drop CSV / XLSX file here'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          {uploadError && <div className="sm-register-error">{uploadError}</div>}
          <button className="ds-btn-primary sm-register-upload-btn" onClick={handleUpload} disabled={!selectedFile}>
            Upload File
          </button>
        </div>
      )}

      {uploadPhase === 'uploading' && (
        <div className="ds-card sm-register-section">
          <div className="sm-register-hint">Uploading and parsing file…</div>
        </div>
      )}

      {/* ── Column Mapping Step ── */}
      {uploadPhase === 'mapping' && (
        <div className="ds-card sm-register-section">
          <div className="sm-register-section-title">
            <FileCheck size={18} /> Map Columns — <span className="sm-register-filename">{filename}</span>
            <span className="sm-register-rowcount">{rowCount} data rows detected</span>
          </div>
          <p className="sm-register-hint">
            Map each canonical field to the corresponding column in your spreadsheet. Roll Number is required.
          </p>
          <div className="sm-mapping-grid">
            {CANONICAL_FIELDS.map(({ key, label }) => (
              <div key={key} className="sm-mapping-row">
                <label className="sm-mapping-label">{label}</label>
                <select
                  className="sm-mapping-select"
                  value={columnMapping[key] || ''}
                  onChange={(e) => setColumnMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {previewError && <div className="sm-register-error">{previewError}</div>}
          <div className="sm-register-actions">
            <button className="ds-btn-secondary" onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? 'Loading…' : 'Preview First 5 Rows'}
            </button>
            <button className="ds-btn-primary" onClick={handleImport} disabled={!columnMapping.rollNumber}>
              Confirm &amp; Import
            </button>
            <button className="ds-btn-ghost" onClick={resetToUpload}>Cancel</button>
          </div>

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="sm-register-preview">
              <div className="sm-register-section-title" style={{ marginTop: 16 }}>Preview</div>
              <div className="ds-table-wrapper">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {CANONICAL_FIELDS.filter((f) => columnMapping[f.key]).map((f) => (
                        <th key={f.key}>{f.label.replace(' *','')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        {CANONICAL_FIELDS.filter((f) => columnMapping[f.key]).map((f) => (
                          <td key={f.key}>{r[f.key] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadPhase === 'importing' && (
        <div className="ds-card sm-register-section">
          <div className="sm-register-hint">Importing and reconciling rows against Batch 003 staging…</div>
        </div>
      )}

      {/* ── Import Summary ── */}
      {uploadPhase === 'done' && importSummary && (
        <>
          <div className="ds-card sm-register-section">
            <div className="sm-register-section-title"><CheckCircle size={18} /> Import Complete — {filename}</div>
            <div className="sm-import-summary-row">
              <div className="sm-summary-stat"><span className="sm-summary-num">{importSummary.totalRows}</span><span className="sm-summary-lbl">Total Rows</span></div>
              <div className="sm-summary-stat green"><span className="sm-summary-num">{importSummary.confirmedMatchRows}</span><span className="sm-summary-lbl">Confirmed Match</span></div>
              <div className="sm-summary-stat amber"><span className="sm-summary-num">{importSummary.reviewRows}</span><span className="sm-summary-lbl">Name Mismatch</span></div>
              <div className="sm-summary-stat red"><span className="sm-summary-num">{importSummary.unmatchedRows}</span><span className="sm-summary-lbl">Unmatched</span></div>
              <div className="sm-summary-stat orange"><span className="sm-summary-num">{importSummary.duplicateRows}</span><span className="sm-summary-lbl">Duplicates</span></div>
              <div className="sm-summary-stat red"><span className="sm-summary-num">{importSummary.rejectedRows}</span><span className="sm-summary-lbl">Rejected</span></div>
            </div>
            <button className="ds-btn-ghost" style={{ marginTop: 12 }} onClick={resetToUpload}>Upload Another File</button>
          </div>

          {/* Rows filter + table */}
          <div className="ds-card sm-register-section">
            <div className="sm-register-section-title"><ClipboardList size={18} /> Reconciliation Results</div>
            <div className="sm-register-row-filter">
              <label>Filter by status:</label>
              <select className="sm-mapping-select" value={rowsStatus} onChange={(e) => { setRowsStatus(e.target.value); loadRows(importId, e.target.value, 1); setRowsPage(1); }}>
                <option value="">All</option>
                {Object.entries(RECON_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="ds-table-wrapper">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Row #</th>
                    <th>Roll Number</th>
                    <th>Name (Register)</th>
                    <th>Status</th>
                    <th>Evidence Review</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6B7280' }}>Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6B7280' }}>No rows</td></tr>
                  ) : rows.map((row) => (
                    <tr
                      key={row._id}
                      className={selectedRow?._id === row._id ? 'sm-row-selected' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedRow(row); setReviewDecision(''); setReviewRemarks(''); setReviewMsg(''); }}
                    >
                      <td>{row.sourceRow}</td>
                      <td><code>{row.normalizedRollNumber || '—'}</code></td>
                      <td>{row.rawStudentName || '—'}</td>
                      <td><ReconBadge status={row.reconciliationStatus} /></td>
                      <td><EvidenceReviewBadge status={row.evidenceReviewStatus} /></td>
                      <td>
                        {['CONFIRMED_MATCH','NAME_MISMATCH_REQUIRES_REVIEW'].includes(row.reconciliationStatus) && row.evidenceReviewStatus === 'UNREVIEWED' && (
                          <span className="sm-row-action-hint">Review ›</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {rowsTotal > 20 && (
              <div className="sm-pagination">
                <button className="sm-page-btn" disabled={rowsPage <= 1} onClick={() => { const p = rowsPage - 1; setRowsPage(p); loadRows(importId, rowsStatus, p); }}>
                  <ChevronLeft size={16} />
                </button>
                <span>Page {rowsPage} of {Math.ceil(rowsTotal / 20)}</span>
                <button className="sm-page-btn" disabled={rowsPage >= Math.ceil(rowsTotal / 20)} onClick={() => { const p = rowsPage + 1; setRowsPage(p); loadRows(importId, rowsStatus, p); }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Row detail / evidence review panel */}
            {selectedRow && (
              <div className="sm-detail-panel sm-register-detail-panel">
                <div className="sm-detail-panel-header">
                  <span className="sm-detail-panel-title">Row {selectedRow.sourceRow} — {selectedRow.normalizedRollNumber}</span>
                  <button className="sm-detail-close" onClick={() => setSelectedRow(null)}><X size={16} /></button>
                </div>

                <div className="sm-register-side-by-side">
                  <div className="sm-register-side">
                    <div className="sm-detail-section-label">Register Data</div>
                    <div className="sm-kv-row"><span>Roll Number</span><code>{selectedRow.rawRollNumber || '—'}</code></div>
                    <div className="sm-kv-row"><span>Name</span><span>{selectedRow.rawStudentName || '—'}</span></div>
                    <div className="sm-kv-row"><span>Program</span><span>{selectedRow.rawProgram || '—'}</span></div>
                    <div className="sm-kv-row"><span>Branch</span><span>{selectedRow.rawBranch || '—'}</span></div>
                    <div className="sm-kv-row"><span>Semester</span><span>{selectedRow.rawSemester || '—'}</span></div>
                    <div className="sm-kv-row"><span>Section</span><span>{selectedRow.rawSection || '—'}</span></div>
                    <div className="sm-kv-row"><span>Acad. Year</span><span>{selectedRow.rawAcademicYear || '—'}</span></div>
                    <div className="sm-kv-row"><span>Reg. ID</span><code>{selectedRow.rawRegistrationId || '—'}</code></div>
                  </div>
                  <div className="sm-register-side">
                    <div className="sm-detail-section-label">Batch 003 Staging Match</div>
                    {selectedRow.matchedStagingRollNumber ? (
                      <>
                        <div className="sm-kv-row"><span>Roll Number</span><code>{selectedRow.matchedStagingRollNumber}</code></div>
                        <div className="sm-kv-row"><span>Staging Name</span><span>{selectedRow.matchedStagingName || '—'}</span></div>
                      </>
                    ) : (
                      <div style={{ color: '#6B7280', fontSize: 13 }}>No staging match found</div>
                    )}
                    <div className="sm-kv-row" style={{ marginTop: 12 }}><span>Reconciliation</span><ReconBadge status={selectedRow.reconciliationStatus} /></div>
                    <div className="sm-kv-row"><span>Evidence Review</span><EvidenceReviewBadge status={selectedRow.evidenceReviewStatus} /></div>
                    {selectedRow.reviewRemarks && <div className="sm-kv-row"><span>Remarks</span><span>{selectedRow.reviewRemarks}</span></div>}
                  </div>
                </div>

                {/* Evidence review form */}
                {['CONFIRMED_MATCH','NAME_MISMATCH_REQUIRES_REVIEW'].includes(selectedRow.reconciliationStatus) && (
                  <div className="sm-register-review-form">
                    <div className="sm-detail-section-label" style={{ marginTop: 16 }}>Record Evidence Decision</div>
                    <div className="sm-register-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className={`sm-review-decision-btn ${reviewDecision === 'CONFIRMED' ? 'active-confirm' : ''}`}
                        onClick={() => setReviewDecision('CONFIRMED')}
                      >
                        <CheckCircle size={14} /> Confirm Evidence
                      </button>
                      <button
                        className={`sm-review-decision-btn ${reviewDecision === 'REJECTED' ? 'active-reject' : ''}`}
                        onClick={() => setReviewDecision('REJECTED')}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                    <textarea
                      className="sm-register-remarks"
                      placeholder="Remarks (optional)"
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      rows={2}
                    />
                    {reviewMsg && <div className={`sm-register-msg ${reviewDecision === 'REJECTED' ? 'error' : 'success'}`}>{reviewMsg}</div>}
                    <button
                      className="ds-btn-primary"
                      style={{ marginTop: 8 }}
                      onClick={() => handleReviewSubmit(selectedRow._id)}
                      disabled={reviewLoading || !reviewDecision}
                    >
                      {reviewLoading ? 'Saving…' : 'Submit Review'}
                    </button>
                    {selectedRow.linkedVerificationId && (
                      <div className="sm-register-ev-note">
                        <Info size={13} /> EnrollmentVerification updated. Use the Enrollment Verification &amp; Promotion tab to set status to VERIFIED.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Import History ── */}
      <div className="ds-card sm-register-section">
        <div className="sm-register-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><ClipboardList size={18} /> Import History</span>
          <button className="ds-btn-ghost sm-refresh-btn" onClick={loadImportHistory}><RefreshCw size={14} /></button>
        </div>
        {importListLoading ? (
          <div className="sm-register-hint">Loading…</div>
        ) : importList.length === 0 ? (
          <div className="sm-register-hint">No imports yet.</div>
        ) : (
          <div className="ds-table-wrapper">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Imported At</th>
                  <th>Admin</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Matched</th>
                  <th>Unmatched</th>
                  <th>Rejected</th>
                </tr>
              </thead>
              <tbody>
                {importList.map((imp) => (
                  <tr key={imp.importId}
                    style={{ cursor: 'pointer' }}
                    onClick={async () => {
                      setImportId(imp.importId);
                      setFilename(imp.sourceFilename);
                      setImportSummary({
                        totalRows: imp.totalRows, confirmedMatchRows: imp.confirmedMatchRows,
                        reviewRows: imp.reviewRows, unmatchedRows: imp.unmatchedRows,
                        duplicateRows: imp.duplicateRows, rejectedRows: imp.rejectedRows,
                      });
                      setUploadPhase('done');
                      await loadRows(imp.importId, '', 1);
                    }}
                  >
                    <td>{imp.sourceFilename}</td>
                    <td>{new Date(imp.importedAt).toLocaleString()}</td>
                    <td>{imp.importedByAdminName || '—'}</td>
                    <td><span className={`ds-pill ${imp.status === 'IMPORTED' ? 'green' : 'gray'}`}>{imp.status}</span></td>
                    <td>{imp.totalRows}</td>
                    <td>{imp.confirmedMatchRows}</td>
                    <td>{imp.unmatchedRows}</td>
                    <td>{imp.rejectedRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AdminStudentManagement() {
  const [activeMainTab, setActiveMainTab] = useState('staging'); // 'staging' | 'verification' | 'register'

  // ── Staging State (Phase 3.6) ──
  const [stats, setStats]           = useState(null);
  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [classification, setClassification] = useState('all');
  const [selectedRoll, setSelectedRoll]     = useState(null);

  // ── Enrollment Verification & Promotion State (Phase 3.7 & 3.8) ──
  const [verifStats, setVerifStats]           = useState(null);
  const [promoStats, setPromoStats]           = useState(null);
  const [verifications, setVerifications]     = useState([]);
  const [verifLoading, setVerifLoading]       = useState(false);
  const [verifError, setVerifError]           = useState(null);
  const [verifSearch, setVerifSearch]         = useState('');
  const [debouncedVerifSearch, setDebouncedVerifSearch] = useState('');
  const [verifStatus, setVerifStatus]         = useState('ALL');
  const [verifPage, setVerifPage]             = useState(1);
  const [verifTotalPages, setVerifTotalPages] = useState(1);
  const [verifTotal, setVerifTotal]           = useState(0);
  const [selectedVerifRoll, setSelectedVerifRoll] = useState(null);

  const searchTimer = useRef(null);
  const verifSearchTimer = useRef(null);

  // ── Load stats ──
  const loadStagingStats = () => {
    adminService.getStagingStats()
      .then(res => { if (res.success) setStats(res.data); })
      .catch(() => {});
  };

  const loadVerificationAndPromotionStats = () => {
    Promise.all([
      adminService.getEnrollmentStats(),
      adminService.getPromotionStats(),
    ])
      .then(([resVerif, resPromo]) => {
        if (resVerif.success) setVerifStats(resVerif.data);
        if (resPromo.success) setPromoStats(resPromo.data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStagingStats();
    loadVerificationAndPromotionStats();
  }, []);

  // ── Debounce Staging Search ──
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // ── Debounce Verification Search ──
  useEffect(() => {
    clearTimeout(verifSearchTimer.current);
    verifSearchTimer.current = setTimeout(() => {
      setDebouncedVerifSearch(verifSearch);
      setVerifPage(1);
    }, 350);
    return () => clearTimeout(verifSearchTimer.current);
  }, [verifSearch]);

  // ── Load Staging Students ──
  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.listStagingStudents({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_LIMIT,
        classification: classification !== 'all' ? classification : undefined,
      });
      if (res.success) {
        setStudents(res.data.students);
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages || 1);
      } else {
        setError(res.message || 'Failed to load students');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, classification]);

  useEffect(() => {
    if (activeMainTab === 'staging') {
      loadStudents();
    }
  }, [loadStudents, activeMainTab]);

  // ── Load Enrollment Verifications ──
  const loadVerifications = useCallback(async () => {
    setVerifLoading(true);
    setVerifError(null);
    try {
      const res = await adminService.listEnrollmentVerifications({
        search: debouncedVerifSearch || undefined,
        status: verifStatus !== 'ALL' ? verifStatus : undefined,
        page: verifPage,
        limit: PAGE_LIMIT,
      });
      if (res.success) {
        setVerifications(res.data.items);
        setVerifTotal(res.data.pagination.total);
        setVerifTotalPages(res.data.pagination.totalPages || 1);
      } else {
        setVerifError(res.message || 'Failed to load verifications');
      }
    } catch (err) {
      setVerifError(err?.response?.data?.message || err.message || 'Network error');
    } finally {
      setVerifLoading(false);
    }
  }, [debouncedVerifSearch, verifStatus, verifPage]);

  useEffect(() => {
    if (activeMainTab === 'verification') {
      loadVerifications();
      loadVerificationAndPromotionStats();
    }
  }, [loadVerifications, activeMainTab]);

  return (
    <div className="ds-shell">
      <Sidebar />

      <div className="ds-main">
        <header className="ds-header">
          <span className="ds-header-title">Student Management</span>
          <div className="ds-header-right">
            <span className="sm-batch-badge">{BATCH_ID}</span>
            <span className="sm-read-only-badge">BATCH 003 GOVERNANCE</span>
          </div>
        </header>

        <div className="ds-content">

          {/* ── Main Tab Navigation ── */}
          <div className="sm-main-tabs">
            <button
              className={`sm-main-tab-btn ${activeMainTab === 'staging' ? 'active' : ''}`}
              onClick={() => { setActiveMainTab('staging'); setSelectedVerifRoll(null); }}
            >
              <Users size={16} />
              Staging Student Records
            </button>
            <button
              className={`sm-main-tab-btn ${activeMainTab === 'verification' ? 'active' : ''}`}
              onClick={() => { setActiveMainTab('verification'); setSelectedRoll(null); }}
            >
              <ShieldCheck size={16} />
              Enrollment Verification & Promotion
            </button>
            <button
              className={`sm-main-tab-btn ${activeMainTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('register')}
            >
              <FileText size={16} />
              Enrollment Register Import
            </button>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: STAGING STUDENT RECORDS (PHASE 3.6)                         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeMainTab === 'staging' && (
            <>
              {/* Stat Cards */}
              {stats && (
                <div className="ds-stat-row">
                  <div className="ds-stat-card">
                    <div className="ds-stat-label">Master Records</div>
                    <div className="ds-stat-value">{stats.totalMasterRecords}</div>
                    <div className="ds-stat-trend up">Student Master (Batch 003)</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label">Admissions</div>
                    <div className="ds-stat-value">{stats.totalAdmissions}</div>
                    <div className="ds-stat-trend up">Application records</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label">Academic Submissions</div>
                    <div className="ds-stat-value">{stats.totalAcademicSubmissions}</div>
                    <div className="ds-stat-trend up">isCanonical: false for all</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label">Internship Records</div>
                    <div className="ds-stat-value">{stats.totalInternships}</div>
                    <div className="ds-stat-trend up">{stats.nullOrgInternships} null-org preserved</div>
                  </div>
                </div>
              )}

              {/* Enrollment Notice */}
              <div className="sm-enrollment-notice">
                <Info size={15} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Enrollment Not Verified.</strong> Staging records originate from student surveys and applicant tracking sheets.
                  To record official registrar proof of enrollment, switch to the{' '}
                  <button
                    onClick={() => setActiveMainTab('verification')}
                    style={{ background: 'none', border: 'none', color: '#1D4ED8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Enrollment Verification & Promotion
                  </button>{' '}
                  tab.
                </div>
              </div>

              {/* Main Workspace */}
              <div className={`sm-workspace ${selectedRoll ? 'sm-workspace--split' : ''}`}>
                <div className="sm-list-panel">
                  <div className="ds-card">
                    <div className="ds-card-header">
                      <span className="ds-section-title">Batch 003 Staging Records</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                          <input
                            className="ds-input"
                            style={{ paddingLeft: 32, width: 220 }}
                            placeholder="Search name or roll…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>

                        <select
                          className="ds-select"
                          value={classification}
                          onChange={e => { setClassification(e.target.value); setPage(1); }}
                        >
                          <option value="all">All Classifications</option>
                          <option value="IDENTITY_CONFIRMED">Confirmed</option>
                          <option value="IDENTITY_REQUIRES_REVIEW">Needs Review</option>
                          <option value="IDENTITY_AMBIGUOUS">Ambiguous</option>
                          <option value="IDENTITY_INVALID">Invalid</option>
                          <option value="IDENTITY_UNMATCHED">Unmatched</option>
                        </select>

                        <button className="ds-btn ghost sm" onClick={loadStudents}>
                          <RefreshCw size={14} /> Refresh
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="sm-error-banner">
                        <AlertCircle size={15} />
                        <span>{error}</span>
                      </div>
                    )}

                    {loading && (
                      <div className="sm-loading-rows">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="sm-skeleton-row" />
                        ))}
                      </div>
                    )}

                    {!loading && students.length === 0 && !error && (
                      <div className="sm-empty-state">
                        <Users size={36} className="sm-empty-state-icon" />
                        <div>No staging records found</div>
                      </div>
                    )}

                    {!loading && students.length > 0 && (
                      <>
                        <div className="ds-table-wrap">
                          <table className="ds-table">
                            <thead>
                              <tr>
                                <th>Row</th>
                                <th>Roll Number</th>
                                <th>Name</th>
                                <th>Identity</th>
                                <th>Acad.</th>
                                <th>Intern.</th>
                                <th>Conflicts</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {students.map(s => (
                                <tr
                                  key={s._id}
                                  className={selectedRoll === s.normalizedRollNumber ? 'sm-row-selected' : ''}
                                >
                                  <td>
                                    <span className="ds-code-badge" style={{ fontSize: 11 }}>
                                      {s.sourceRow}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="ds-code-badge">
                                      {s.normalizedRollNumber || <em style={{ color: '#9CA3AF' }}>—</em>}
                                    </span>
                                  </td>
                                  <td className="bold" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {s.studentName || <span style={{ color: '#9CA3AF' }}>—</span>}
                                  </td>
                                  <td>
                                    <IdentityBadge classification={s.identityClassification} />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {s.academicSubmissionsCount > 0
                                      ? <span className="sm-count-badge">{s.academicSubmissionsCount}</span>
                                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {s.internshipsCount > 0
                                      ? <span className="sm-count-badge">{s.internshipsCount}</span>
                                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {s.conflictsCount > 0
                                      ? <span className="sm-conflict-count">{s.conflictsCount}</span>
                                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                                  </td>
                                  <td>
                                    {s.normalizedRollNumber && (
                                      <button
                                        className="ds-btn outline sm"
                                        onClick={() => setSelectedRoll(
                                          selectedRoll === s.normalizedRollNumber ? null : s.normalizedRollNumber
                                        )}
                                      >
                                        {selectedRoll === s.normalizedRollNumber ? 'Close' : 'View'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="sm-pagination">
                          <span className="sm-pagination-info">
                            {total} record{total !== 1 ? 's' : ''} · Page {page} of {totalPages}
                          </span>
                          <div className="sm-pagination-controls">
                            <button
                              className="ds-btn ghost sm"
                              disabled={page <= 1}
                              onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <span className="sm-page-num">{page}</span>
                            <button
                              className="ds-btn ghost sm"
                              disabled={page >= totalPages}
                              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {selectedRoll && (
                  <StudentDetailPanel
                    rollNumber={selectedRoll}
                    onClose={() => setSelectedRoll(null)}
                  />
                )}
              </div>
            </>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ENROLLMENT VERIFICATION & PROMOTION WORKFLOW (PHASE 3.7/8)   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeMainTab === 'verification' && (
            <>
              {/* Stat Cards */}
              <div className="ds-stat-row">
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Pending Verification</div>
                  <div className="ds-stat-value" style={{ color: '#D97706' }}>
                    {verifStats?.pending ?? '—'}
                  </div>
                  <div className="ds-stat-trend">Requires independent evidence</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Verified Enrollments</div>
                  <div className="ds-stat-value" style={{ color: '#16A34A' }}>
                    {verifStats?.verified ?? 0}
                  </div>
                  <div className="ds-stat-trend up">Independent proof accepted</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Eligible for Promotion</div>
                  <div className="ds-stat-value" style={{ color: '#2563EB' }}>
                    {promoStats?.eligibleCount ?? 0}
                  </div>
                  <div className="ds-stat-trend up">DOCUMENT_VERIFIED & verified</div>
                </div>
                <div className="ds-stat-card">
                  <div className="ds-stat-label">Promoted to Production</div>
                  <div className="ds-stat-value" style={{ color: '#059669' }}>
                    {promoStats?.alreadyPromotedCount ?? 0}
                  </div>
                  <div className="ds-stat-trend">enrolled_offline students</div>
                </div>
              </div>

              {/* Informational Guidance Box */}
              <div className="sm-enrollment-notice" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}>
                <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Controlled Promotion Policy (Phase 3.8):</strong> Staging identities become eligible for promotion only after attaining <strong>DOCUMENT_VERIFIED</strong> status against an accepted institutional document. Promoting creates an offline institutional Student record with <code>accountStatus: 'enrolled_offline'</code>. Bulk promotion is permanently disabled.
                </div>
              </div>

              {/* Verification Workspace (Split List & Action Panel) */}
              <div className={`sm-workspace ${selectedVerifRoll ? 'sm-workspace--split' : ''}`}>
                <div className="sm-list-panel">
                  <div className="ds-card">
                    <div className="ds-card-header">
                      <span className="ds-section-title">Enrollment Verification & Promotion Ledger</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                          <input
                            className="ds-input"
                            style={{ paddingLeft: 32, width: 220 }}
                            placeholder="Search name or roll…"
                            value={verifSearch}
                            onChange={e => setVerifSearch(e.target.value)}
                          />
                        </div>

                        <select
                          className="ds-select"
                          value={verifStatus}
                          onChange={e => { setVerifStatus(e.target.value); setVerifPage(1); }}
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="PENDING">Pending</option>
                          <option value="VERIFIED">Verified</option>
                          <option value="REQUIRES_REVIEW">Requires Review</option>
                          <option value="REJECTED">Rejected</option>
                        </select>

                        <button className="ds-btn ghost sm" onClick={() => { loadVerifications(); loadVerificationAndPromotionStats(); }}>
                          <RefreshCw size={14} /> Refresh
                        </button>
                      </div>
                    </div>

                    {verifError && (
                      <div className="sm-error-banner">
                        <AlertCircle size={15} />
                        <span>{verifError}</span>
                      </div>
                    )}

                    {verifLoading && (
                      <div className="sm-loading-rows">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="sm-skeleton-row" />
                        ))}
                      </div>
                    )}

                    {!verifLoading && verifications.length === 0 && !verifError && (
                      <div className="sm-empty-state">
                        <ShieldCheck size={36} className="sm-empty-state-icon" />
                        <div>No verification records match the query</div>
                      </div>
                    )}

                    {!verifLoading && verifications.length > 0 && (
                      <>
                        <div className="ds-table-wrap">
                          <table className="ds-table">
                            <thead>
                              <tr>
                                <th>Roll Number</th>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Evidence Type / Reference</th>
                                <th>Level</th>
                                <th>Reviewer</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {verifications.map(item => (
                                <tr
                                  key={item.normalizedRollNumber}
                                  className={selectedVerifRoll === item.normalizedRollNumber ? 'sm-row-selected' : ''}
                                >
                                  <td>
                                    <span className="ds-code-badge">
                                      {item.normalizedRollNumber}
                                    </span>
                                  </td>
                                  <td className="bold" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.studentName || '—'}
                                  </td>
                                  <td>
                                    <VerificationBadge status={item.verificationStatus} />
                                  </td>
                                  <td style={{ fontSize: 12 }}>
                                    {item.evidenceReference ? (
                                      <div>
                                        <span className="ds-code-badge" style={{ fontSize: 11 }}>{item.evidenceReference}</span>
                                        <div style={{ fontSize: 10, color: '#64748B' }}>{item.evidenceType}</div>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>None</span>
                                    )}
                                  </td>
                                  <td>
                                    {item.evidenceVerificationLevel ? (
                                      <span className="ds-pill blue" style={{ fontSize: 10 }}>
                                        {item.evidenceVerificationLevel === 'REFERENCE_RECORDED' ? 'Ref. Recorded' : 'Doc. Verified'}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ fontSize: 12, color: '#475569' }}>
                                    {item.reviewerAdminName || <span style={{ color: '#94A3B8' }}>—</span>}
                                  </td>
                                  <td>
                                    <button
                                      className="ds-btn outline sm"
                                      onClick={() => setSelectedVerifRoll(
                                        selectedVerifRoll === item.normalizedRollNumber ? null : item.normalizedRollNumber
                                      )}
                                    >
                                      {selectedVerifRoll === item.normalizedRollNumber ? 'Close' : 'Review'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="sm-pagination">
                          <span className="sm-pagination-info">
                            {verifTotal} record{verifTotal !== 1 ? 's' : ''} · Page {verifPage} of {verifTotalPages}
                          </span>
                          <div className="sm-pagination-controls">
                            <button
                              className="ds-btn ghost sm"
                              disabled={verifPage <= 1}
                              onClick={() => setVerifPage(p => Math.max(1, p - 1))}
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <span className="sm-page-num">{verifPage}</span>
                            <button
                              className="ds-btn ghost sm"
                              disabled={verifPage >= verifTotalPages}
                              onClick={() => setVerifPage(p => Math.min(verifTotalPages, p + 1))}
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Action Panel */}
                {selectedVerifRoll && (
                  <VerificationDetailPanel
                    rollNumber={selectedVerifRoll}
                    onClose={() => setSelectedVerifRoll(null)}
                    onActionSuccess={() => {
                      loadVerifications();
                      loadVerificationAndPromotionStats();
                    }}
                  />
                )}
              </div>
            </>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: ENROLLMENT REGISTER IMPORT (PHASE 3.9A)                    */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeMainTab === 'register' && (
            <RegisterImportTab />
          )}

        </div>
      </div>
    </div>
  );
}
