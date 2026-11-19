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
import AppHeader from '../../components/AppHeader/AppHeader';
import { adminService } from '../../services/admin.service';
import {
  Users, Search, ChevronLeft, ChevronRight, RefreshCw,
  AlertCircle, CheckCircle, HelpCircle, XCircle, ClipboardList,
  BookOpen, Briefcase, Info, X, GraduationCap,
  ShieldCheck, FileCheck, FileText, Clock, AlertTriangle, UserCheck,
  Lock, Edit3, Save, RotateCcw, History, Mail, Phone, Calendar, UserPlus,
  Trash2, UserMinus
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
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div className="sm-info-row">
      <span className="sm-info-label">{label}</span>
      <span className={`sm-info-value ${missing ? 'sm-missing' : ''}`}>
        {isEmpty ? '—' : value}
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
                <InfoRow label="Phone Number"    value={detail.phoneNumber || detail.phone || detail.contactNumber} missing={!(detail.phoneNumber || detail.phone || detail.contactNumber)} />
                <InfoRow label="Official Email"  value={detail.officialEmail || detail.collegeEmail} missing={!(detail.officialEmail || detail.collegeEmail)} />
                <InfoRow label="Personal Email"  value={detail.personalEmail || (detail.email !== detail.officialEmail ? detail.email : null)} missing={!detail.personalEmail && !detail.email} />
                <InfoRow label="Source Row"      value={detail.sourceRow || detail.masterRecords?.[0]?.sourceRow} />
                <InfoRow label="Review Status"   value={<ReviewBadge status={detail.reviewStatus || detail.masterRecords?.[0]?.reviewStatus || 'pending_review'} />} />
                <InfoRow label="Course"          value={detail.academicProfile?.course}  missing={!detail.academicProfile?.course} />
                <InfoRow label="School"          value={detail.academicProfile?.school}  missing={!detail.academicProfile?.school} />
                <InfoRow label="Batch / Year"    value={detail.academicProfile?.batch}   missing={!detail.academicProfile?.batch} />
                <InfoRow label="Section"         value={detail.academicProfile?.section || detail.masterRecords?.[0]?.rawPayload?.Section} missing={!detail.academicProfile?.section} />
              </div>
            )}

            {activeTab === 'admission' && (
              <div>
                {(!detail.admissionRecords || detail.admissionRecords.length === 0) && !detail.admissionRecord ? (
                  <div className="sm-empty-tab">
                    <ClipboardList size={28} className="sm-empty-icon" />
                    <div>No admission application found for this roll number</div>
                  </div>
                ) : (
                  (detail.admissionRecords?.length ? detail.admissionRecords : [detail.admissionRecord]).map((adm, idx) => (
                    <div key={idx} className="sm-record-card" style={{ marginBottom: 12 }}>
                      <div className="sm-record-badge">Admission Record {detail.admissionRecords?.length > 1 ? `#${idx + 1}` : ''}</div>
                      <InfoRow label="App Number"       value={adm.applicationNumber} />
                      <InfoRow label="Student Name"     value={adm.studentName} />
                      <InfoRow label="Email"            value={adm.email} />
                      <InfoRow label="Teams ID"         value={adm.teamsId} />
                      <InfoRow label="Course"           value={adm.course} missing={!adm.course} />
                      <InfoRow label="School"           value={adm.school} missing={!adm.school} />
                      <InfoRow label="Admission Status" value={adm.admissionStatus} />
                      <InfoRow label="Source Row"       value={adm.sourceRow} />
                    </div>
                  ))
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

  // ── Local files in data/student_import/ ──
  const [localFiles, setLocalFiles]                 = useState([]);
  const [selectedLocalFile, setSelectedLocalFile]   = useState('');
  const [localFilesLoading, setLocalFilesLoading]   = useState(false);

  // Load history and local files on mount
  useEffect(() => {
    loadImportHistory();
    loadLocalFiles();
  }, []);

  async function loadLocalFiles() {
    setLocalFilesLoading(true);
    try {
      const data = await adminService.listLocalRegisterFiles();
      setLocalFiles(data.files || []);
      if (data.files && data.files.length > 0) {
        setSelectedLocalFile(data.files[0].filename);
      }
    } catch { /* silent */ }
    setLocalFilesLoading(false);
  }

  async function handleLoadLocal() {
    if (!selectedLocalFile) { setUploadError('Please choose a local file.'); return; }
    setUploadPhase('uploading');
    setUploadError('');
    try {
      const data = await adminService.loadLocalRegisterFile(selectedLocalFile);
      setImportId(data.importId);
      setHeaders(data.headers || []);
      setRowCount(data.rowCount || 0);
      setFilename(data.filename);
      setUploadPhase('mapping');
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Failed to load local file.');
      setUploadPhase('idle');
    }
  }

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
            <FileText size={18} /> Upload or Select Enrollment Register
          </div>
          <p className="sm-register-hint">
            Upload an official enrollment register (CSV, XLSX, or JSON, max 15 MB), or choose an existing local file from <code>data/student_import/</code>. Column names are mapped in the next step.
          </p>
          <div
            className="sm-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setSelectedFile(f); setUploadError(''); } }}
          >
            <FileText size={32} style={{ color: '#9CA3AF' }} />
            <div className="sm-upload-zone-label">
              {selectedFile ? selectedFile.name : 'Click or drag & drop CSV / XLSX / JSON file here'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          {uploadError && <div className="sm-register-error">{uploadError}</div>}
          <button className="ds-btn-primary sm-register-upload-btn" onClick={handleUpload} disabled={!selectedFile}>
            Upload File
          </button>

          {/* ── Local file picker from data/student_import/ ── */}
          <div className="sm-local-picker-card">
            <div className="sm-local-picker-title">
              <BookOpen size={16} /> Or select existing file from <code>data/student_import/</code>
            </div>
            <div className="sm-local-picker-row">
              <select
                className="sm-mapping-select"
                style={{ flex: 1, maxWidth: 450 }}
                value={selectedLocalFile}
                onChange={(e) => setSelectedLocalFile(e.target.value)}
                disabled={localFilesLoading || localFiles.length === 0}
              >
                {localFiles.length === 0 ? (
                  <option value="">{localFilesLoading ? 'Scanning folder…' : 'No local files available'}</option>
                ) : (
                  localFiles.map((f) => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename} ({f.fileType.toUpperCase()}, {(f.size / 1024).toFixed(1)} KB)
                    </option>
                  ))
                )}
              </select>
              <button
                className="ds-btn-secondary"
                onClick={handleLoadLocal}
                disabled={!selectedLocalFile || localFilesLoading}
              >
                Load Local File
              </button>
            </div>
          </div>
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

// ─── Canonical Students Profile Management Tab (Part 6) ──────────────────────

function CanonicalStudentsTab() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detail / Editing state
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    branch: '',
    program: '',
    course: '',
    batch: '',
    semester: '',
    section: '',
    admissionYear: '',
    school: '',
    gender: '',
    dateOfBirth: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add Student modal state
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [addFormData, setAddFormData] = useState({
    rollNumber: '',
    fullName: '',
    email: '',
    phone: '',
    branch: '',
    program: '',
    course: '',
    batch: '',
    semester: '',
    section: '',
    admissionYear: '',
    school: '',
    gender: '',
    dateOfBirth: '',
    status: 'active',
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load canonical student list
  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.getCanonicalStudents({
        search: debouncedSearch || undefined,
        branch: branchFilter || undefined,
        semester: semesterFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      if (res.success) {
        setStudents(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || res.pagination.pages || 1);
      } else {
        setError(res.message || 'Failed to load canonical students');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load canonical students');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, branchFilter, semesterFilter, statusFilter, page]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Load single student detail & audit logs
  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError(null);
    setSaveSuccess(null);
    setIsEditing(false);
    try {
      const res = await adminService.getCanonicalStudentDetail(id);
      if (res.success) {
        setStudentDetail(res.data);
        setAuditHistory(res.data.auditHistory || []);
      } else {
        setDetailError(res.message || 'Failed to fetch student details');
      }
    } catch (err) {
      setDetailError(err?.response?.data?.message || err.message || 'Failed to fetch student details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectStudent = (id) => {
    if (selectedStudentId === id) return;
    setSelectedStudentId(id);
    loadDetail(id);
  };

  const startEditing = () => {
    if (!studentDetail?.student) return;
    const s = studentDetail.student;
    setEditFormData({
      fullName: s.fullName || '',
      email: s.email || '',
      phone: s.phone || '',
      branch: s.branch || '',
      program: s.program || '',
      course: s.course || 'CSE',
      batch: s.batch || '2024/3rd',
      semester: s.semester ? String(s.semester) : '',
      section: s.section || '',
      admissionYear: s.admissionYear ? String(s.admissionYear) : '',
      school: s.school || 'School of Engineering',
      gender: s.gender || '',
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.substring(0, 10) : '',
    });
    setFormErrors({});
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setFormErrors({});
    setDetailError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setDetailError(null);
    setSaveSuccess(null);

    // Client-side validations
    const errors = {};
    if (!editFormData.fullName.trim()) {
      errors.fullName = 'Full Name is required';
    }

    if (editFormData.email && editFormData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email.trim())) {
        errors.email = 'Please provide a valid email address';
      }
    }

    if (editFormData.phone && editFormData.phone.trim()) {
      const digits = editFormData.phone.replace(/[\s\-\(\)\+]/g, '');
      if (digits.length < 10 || digits.length > 15) {
        errors.phone = 'Phone number must contain between 10 and 15 digits';
      }
    }

    if (editFormData.semester && editFormData.semester.trim()) {
      const semNum = Number(editFormData.semester);
      if (isNaN(semNum) || semNum < 1 || semNum > 10) {
        errors.semester = 'Semester must be a number between 1 and 10';
      }
    }

    if (editFormData.admissionYear && editFormData.admissionYear.trim()) {
      const yearNum = Number(editFormData.admissionYear);
      if (isNaN(yearNum) || yearNum < 1990 || yearNum > 2100) {
        errors.admissionYear = 'Admission year must be a valid 4-digit year';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: editFormData.fullName.trim(),
        email: editFormData.email.trim() || null,
        phone: editFormData.phone.trim() || null,
        branch: editFormData.branch.trim() || null,
        program: editFormData.program.trim() || null,
        course: editFormData.course.trim() || null,
        batch: editFormData.batch.trim() || null,
        semester: editFormData.semester ? Number(editFormData.semester) : null,
        section: editFormData.section.trim() || null,
        admissionYear: editFormData.admissionYear ? Number(editFormData.admissionYear) : null,
        school: editFormData.school.trim() || null,
        gender: editFormData.gender || '',
        dateOfBirth: editFormData.dateOfBirth || null,
      };

      const res = await adminService.updateCanonicalStudentProfile(selectedStudentId, payload);
      if (res.success) {
        setSaveSuccess('Student profile updated successfully. Audit log recorded.');
        setIsEditing(false);
        // Refresh detail & student in list
        await loadDetail(selectedStudentId);
        loadStudents();
      } else {
        setDetailError(res.message || 'Failed to update student profile');
      }
    } catch (err) {
      setDetailError(err?.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    setAddFormErrors({});
    setAddError(null);

    const errors = {};
    if (!addFormData.rollNumber || !addFormData.rollNumber.trim()) {
      errors.rollNumber = 'Roll Number is required';
    } else if (/^\d{10}$/.test(addFormData.rollNumber.trim())) {
      errors.rollNumber = 'A 10-digit mobile phone number cannot be used as a roll number';
    }
    if (!addFormData.fullName || !addFormData.fullName.trim() || addFormData.fullName.trim().length < 2) {
      errors.fullName = 'Full Name is required (minimum 2 characters)';
    }
    if (addFormData.email && addFormData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(addFormData.email.trim())) {
        errors.email = 'Please provide a valid email address';
      }
    }
    if (addFormData.phone && addFormData.phone.trim()) {
      const digits = addFormData.phone.replace(/[\s\-\(\)\+]/g, '');
      if (digits.length < 10 || digits.length > 15) {
        errors.phone = 'Phone number must contain between 10 and 15 digits';
      }
    }
    if (addFormData.semester && String(addFormData.semester).trim()) {
      const semNum = Number(addFormData.semester);
      if (isNaN(semNum) || semNum < 1 || semNum > 10) {
        errors.semester = 'Semester must be between 1 and 10';
      }
    }
    if (addFormData.admissionYear && String(addFormData.admissionYear).trim()) {
      const yearNum = Number(addFormData.admissionYear);
      if (isNaN(yearNum) || yearNum < 1990 || yearNum > 2050) {
        errors.admissionYear = 'Admission year must be between 1990 and 2050';
      }
    }

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }

    setAddSaving(true);
    try {
      const payload = {
        rollNumber: addFormData.rollNumber.trim().toUpperCase(),
        fullName: addFormData.fullName.trim(),
        email: addFormData.email.trim() || null,
        phone: addFormData.phone.trim() || null,
        branch: addFormData.branch.trim() || null,
        program: addFormData.program.trim() || null,
        course: addFormData.course.trim() || null,
        batch: addFormData.batch.trim() || null,
        semester: addFormData.semester ? Number(addFormData.semester) : null,
        section: addFormData.section ? addFormData.section.trim().toUpperCase() : null,
        admissionYear: addFormData.admissionYear ? Number(addFormData.admissionYear) : null,
        school: addFormData.school.trim() || null,
        gender: addFormData.gender || '',
        dateOfBirth: addFormData.dateOfBirth || null,
        status: addFormData.status || 'active',
      };

      const res = await adminService.createCanonicalStudent(payload);
      if (res.success) {
        setIsAddingStudent(false);
        setSaveSuccess(`Student "${payload.fullName}" (${payload.rollNumber}) created successfully.`);
        await loadStudents();
        if (res.data?._id) {
          handleSelectStudent(res.data._id);
        }
      } else {
        setAddError(res.message || 'Failed to create student');
      }
    } catch (err) {
      setAddError(err?.response?.data?.message || err.message || 'Failed to create student');
    } finally {
      setAddSaving(false);
    }
  };

  const handleStatusChange = async (studentId, newStatus) => {
    if (!studentId || !newStatus) return;
    setStatusUpdating(true);
    setDetailError(null);
    setSaveSuccess(null);
    try {
      const res = await adminService.updateCanonicalStudentStatus(studentId, newStatus);
      if (res.success) {
        setSaveSuccess(`Status updated to "${newStatus}" successfully.`);
        if (studentDetail?.student) {
          setStudentDetail((prev) => ({
            ...prev,
            student: { ...prev.student, status: newStatus },
          }));
        }
        loadStudents();
        loadDetail(studentId);
      } else {
        setDetailError(res.message || 'Failed to update student status');
      }
    } catch (err) {
      setDetailError(err?.response?.data?.message || err.message || 'Failed to update student status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudentId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await adminService.deleteCanonicalStudent(selectedStudentId);
      if (res.success) {
        setIsDeleting(false);
        setSelectedStudentId(null);
        setStudentDetail(null);
        setSaveSuccess(res.message || 'Student record deleted successfully.');
        loadStudents();
      } else {
        setDeleteError(res.message || 'Failed to delete student record');
      }
    } catch (err) {
      setDeleteError(err?.response?.data?.message || err.message || 'Failed to delete student record');
    } finally {
      setDeleteLoading(false);
    }
  };

  const student = studentDetail?.student;
  const user = studentDetail?.user;

  return (
    <div className="sm-canonical-wrapper">
      {/* Search and Filters Bar */}
      <div className="ds-card" style={{ marginBottom: 16 }}>
        <div className="ds-card-header" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                className="ds-input"
                style={{ width: '100%', paddingLeft: 36, height: 38, fontSize: 13 }}
                placeholder="Search real dataset by name, roll, phone, email, course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="ds-select"
              style={{ height: 38, fontSize: 13 }}
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="IT">IT</option>
              <option value="EE">EE</option>
            </select>

            <select
              className="ds-select"
              style={{ height: 38, fontSize: 13 }}
              value={semesterFilter}
              onChange={(e) => { setSemesterFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>

            <select
              className="ds-select"
              style={{ height: 38, fontSize: 13 }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="graduated">Graduated</option>
              <option value="alumni">Alumni</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="ds-btn primary sm"
              title="Add Student"
              onClick={() => {
                setAddFormData({
                  rollNumber: '',
                  fullName: '',
                  email: '',
                  phone: '',
                  branch: '',
                  program: '',
                  course: '',
                  batch: '',
                  semester: '',
                  section: '',
                  admissionYear: '',
                  school: '',
                  gender: '',
                  dateOfBirth: '',
                  status: 'active',
                });
                setAddFormErrors({});
                setAddError(null);
                setIsAddingStudent(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              <UserPlus size={14} />
              Add Student
            </button>

            <button
              className="ds-btn ghost sm"
              title="Refresh List"
              onClick={loadStudents}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="sm-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Layout: Table on Left, Profile View/Edit on Right */}
      <div className={`sm-workspace ${selectedStudentId ? 'sm-workspace--split' : ''}`}>
        {/* Table Panel */}
        <div className="sm-list-panel">
          <div className="ds-card">
            <div className="ds-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <span className="ds-section-title">Enrolled Students ({total})</span>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Page {page} of {totalPages || 1}
              </span>
            </div>
            <div className="sm-canonical-table-wrap">
              <table className="sm-canonical-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Roll Number</th>
                    <th style={{ minWidth: 170 }}>Student Name</th>
                    <th style={{ minWidth: 140 }}>Course / Branch</th>
                    <th style={{ width: 110 }}>Sem & Sec</th>
                    <th style={{ minWidth: 160 }}>Contact</th>
                    <th style={{ width: 90 }}>Status</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && students.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                        <RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
                        Loading enrolled student records...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        No enrolled student records found matching the search criteria.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const isSelected = selectedStudentId === s._id;
                      return (
                        <tr
                          key={s._id}
                          className={isSelected ? 'selected' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSelectStudent(s._id)}
                        >
                          <td>
                            <code style={{ fontWeight: 600, color: '#1E293B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
                              {s.rollNumber}
                            </code>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{s.fullName}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{s.school || 'School of Engineering'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: 13, color: '#334155' }}>{s.course || s.program || 'CSE'}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{s.batch ? `${s.batch} • ` : ''}{s.branch || 'CSE'}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: 13, color: '#334155' }}>
                              {s.semester ? `Sem ${s.semester}` : '—'}
                              {s.section ? ` (${s.section})` : ''}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, color: s.email ? '#334155' : '#94A3B8' }}>
                              {s.email || 'No email'}
                            </div>
                            <div style={{ fontSize: 11, color: s.phone ? '#64748B' : '#94A3B8' }}>
                              {s.phone || 'No phone'}
                            </div>
                          </td>
                          <td>
                            <span className={`ds-pill ${s.status === 'active' ? 'green' : s.status === 'suspended' ? 'amber' : s.status === 'withdrawn' ? 'red' : s.status === 'alumni' || s.status === 'graduated' ? 'blue' : 'gray'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="ds-btn ghost sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStudent(s._id);
                              }}
                              style={{
                                background: isSelected ? '#EFF6FF' : undefined,
                                borderColor: isSelected ? '#3B82F6' : undefined,
                                color: isSelected ? '#1D4ED8' : undefined,
                              }}
                            >
                              {isSelected ? 'Viewing' : 'View / Edit'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="sm-pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0' }}>
                <span className="sm-pagination-info" style={{ fontSize: 12, color: '#64748B' }}>
                  Showing {students.length} of {total} enrolled students
                </span>
                <div className="sm-pagination-controls" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="ds-btn ghost sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="sm-page-num" style={{ fontWeight: 600, fontSize: 12, color: '#1E293B', padding: '0 8px' }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    className="ds-btn ghost sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedStudentId && (
          <div className="sm-detail-panel" style={{ flex: '1', minWidth: 320 }}>
            {detailLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
                Loading profile details...
              </div>
            ) : !student ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                Student record not found.
              </div>
            ) : (
              <>
                <div className="sm-detail-panel-header" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {student.fullName}
                      <span className={`ds-pill ${student.status === 'active' ? 'green' : student.status === 'suspended' ? 'amber' : student.status === 'withdrawn' ? 'red' : student.status === 'graduated' || student.status === 'alumni' ? 'blue' : 'gray'}`}>
                        {student.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <code style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>
                        {student.rollNumber}
                      </code>
                      <span className="sm-badge-locked">
                        <Lock size={10} /> Roll Number Immutable
                      </span>
                    </div>
                  </div>
                  <button
                    className="sm-detail-close"
                    onClick={() => { setSelectedStudentId(null); setStudentDetail(null); }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Administrative Status & Lifecycle Management */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', marginTop: 10, marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Manage Status:</span>
                    <select
                      className="ds-select"
                      style={{ height: 30, fontSize: 12, padding: '2px 8px' }}
                      value={student.status}
                      disabled={statusUpdating}
                      onChange={(e) => handleStatusChange(student._id, e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                      <option value="graduated">Graduated</option>
                      <option value="alumni">Alumni</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>

                    {student.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student._id, 'inactive')}
                        disabled={statusUpdating}
                        title="Deactivate student account"
                        className="sm-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#B45309', borderColor: '#FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <UserMinus size={13} /> Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student._id, 'active')}
                        disabled={statusUpdating}
                        title="Reactivate student account"
                        className="sm-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#15803D', borderColor: '#BBF7D0', background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <UserCheck size={13} /> Reactivate
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {statusUpdating && (
                      <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} className="animate-spin" /> Updating...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setIsDeleting(true); setDeleteError(null); }}
                      title="Permanently remove student record (strictly checks dependencies)"
                      className="sm-btn-secondary"
                      style={{ padding: '3px 8px', fontSize: 11, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>

                {/* Identity & Lifecycle Protection Banner */}
                <div className="sm-profile-guard-banner">
                  <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Institutional Identity & Integrity Safeguard</strong>
                    <div style={{ marginTop: 2 }}>
                      Roll Number and Enrollment Status cannot be modified from profile editing. Academic progression and enrollment verification are strictly governed through institutional Registrar workflows.
                    </div>
                  </div>
                </div>

                {saveSuccess && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={15} />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {detailError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={15} />
                    <span>{detailError}</span>
                  </div>
                )}

                {/* VIEW MODE */}
                {!isEditing ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <button
                        className="sm-btn-save"
                        onClick={startEditing}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        <Edit3 size={14} />
                        Edit Permitted Profile Fields
                      </button>
                    </div>

                    <div className="sm-detail-section-label">Academic Placement</div>
                    <div className="sm-kv-row"><span>School / College</span><span>{student.school || 'School of Engineering'}</span></div>
                    <div className="sm-kv-row"><span>Course</span><span>{student.course || 'CSE'}</span></div>
                    <div className="sm-kv-row"><span>Batch / Year</span><span>{student.batch || '2024/3rd'}</span></div>
                    <div className="sm-kv-row"><span>Program</span><span>{student.program || 'B.Tech'}</span></div>
                    <div className="sm-kv-row"><span>Branch</span><span>{student.branch || 'CSE'}</span></div>
                    <div className="sm-kv-row"><span>Semester</span><span>{student.semester ? `Semester ${student.semester}` : <span style={{ color: '#94A3B8' }}>Not Set</span>}</span></div>
                    <div className="sm-kv-row"><span>Section</span><span>{student.section || <span style={{ color: '#94A3B8' }}>Not Set</span>}</span></div>
                    <div className="sm-kv-row"><span>Admission Year</span><span>{student.admissionYear || 2024}</span></div>

                    <div className="sm-detail-section-label" style={{ marginTop: 16 }}>Contact Information</div>
                    <div className="sm-kv-row">
                      <span>Registered Gmail / Email</span>
                      <span>
                        {student.email ? (
                          <>
                            {student.email}
                            {student.email.toLowerCase().endsWith('@gmail.com') ? (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                Gmail Login Enabled
                              </span>
                            ) : (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                                Non-Gmail
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Not Set (Click Edit to Fill)</span>
                        )}
                      </span>
                    </div>
                    <div className="sm-kv-row">
                      <span>Contact Phone</span>
                      <span>{student.phone || <span style={{ color: '#94A3B8' }}>Not Set (Click Edit to Fill)</span>}</span>
                    </div>

                    <div className="sm-detail-section-label" style={{ marginTop: 16 }}>Personal Demographics</div>
                    <div className="sm-kv-row"><span>Gender</span><span style={{ textTransform: 'capitalize' }}>{student.gender || <span style={{ color: '#94A3B8' }}>Not Set</span>}</span></div>
                    <div className="sm-kv-row"><span>Date of Birth</span><span>{student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : <span style={{ color: '#94A3B8' }}>Not Set</span>}</span></div>

                    <div className="sm-detail-section-label" style={{ marginTop: 16 }}>Portal Account Linkage</div>
                    <div className="sm-kv-row">
                      <span>Linked Portal Account</span>
                      <span>
                        {user ? (
                          <span style={{ color: '#16A34A', fontWeight: 600 }}>
                            Yes ({user.role}) — {user.email}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B' }}>
                            Unlinked (Offline Institutional Record)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="sm-kv-row">
                      <span>Account Lifecycle</span>
                      <span><code>{student.accountStatus}</code></span>
                    </div>

                    {/* Audit History */}
                    <div className="sm-audit-section">
                      <div className="sm-audit-title">
                        <History size={15} />
                        Profile Change Audit Trail
                      </div>
                      {auditHistory.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                          No administrative profile edits recorded yet.
                        </div>
                      ) : (
                        auditHistory.map((item, idx) => (
                          <div key={idx} className="sm-audit-item">
                            <div className="sm-audit-header">
                              <span className="sm-audit-actor">{item.performedBy?.name || item.performedBy?.email || 'Administrator'}</span>
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#475569' }}>
                              Modified fields:
                            </div>
                            <div className="sm-audit-tag-list">
                              {(item.details?.modifiedFields || item.details?.updatedFields || []).map((f, fIdx) => (
                                <span key={fIdx} className="sm-audit-tag">{f}</span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <form onSubmit={handleSave} className="sm-profile-form">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Edit3 size={14} className="text-blue-600" />
                      Edit Permitted Profile Information
                    </div>

                    <div className="sm-profile-form-grid">
                      {/* Immutable Roll Number */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">
                          Roll Number
                          <span className="sm-badge-locked"><Lock size={10} /> Locked</span>
                        </label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={student.rollNumber}
                          disabled
                        />
                      </div>

                      {/* Immutable Status */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">
                          Enrollment Status
                          <span className="sm-badge-locked"><Lock size={10} /> Locked</span>
                        </label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={student.status}
                          disabled
                        />
                      </div>

                      {/* Full Name */}
                      <div className="sm-form-group full-width">
                        <label className="sm-form-label">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          className={`sm-form-input ${formErrors.fullName ? 'has-error' : ''}`}
                          value={editFormData.fullName}
                          onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                          placeholder="e.g. Rahul Sharma"
                        />
                        {formErrors.fullName && <div className="sm-input-error-msg">{formErrors.fullName}</div>}
                      </div>

                      {/* Registered Personal Gmail */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">
                          Registered Personal Gmail (Student Login)
                          {editFormData.email && editFormData.email.trim().toLowerCase().endsWith('@gmail.com') && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: '#16A34A', fontWeight: 500 }}>
                              ● Eligible for Login
                            </span>
                          )}
                        </label>
                        <input
                          type="email"
                          className={`sm-form-input ${formErrors.email ? 'has-error' : ''}`}
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          placeholder="student@gmail.com"
                        />
                        <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 3 }}>
                          Student login requires a personal @gmail.com address matching their roll number.
                        </span>
                        {formErrors.email && <div className="sm-input-error-msg">{formErrors.email}</div>}
                      </div>

                      {/* Phone Number */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Phone Number (10–15 digits)</label>
                        <input
                          type="tel"
                          className={`sm-form-input ${formErrors.phone ? 'has-error' : ''}`}
                          value={editFormData.phone}
                          onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          placeholder="e.g. 9876543210"
                        />
                        {formErrors.phone && <div className="sm-input-error-msg">{formErrors.phone}</div>}
                      </div>

                      {/* Program */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Program</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.program}
                          onChange={(e) => setEditFormData({ ...editFormData, program: e.target.value })}
                          placeholder="e.g. B.Tech"
                        />
                      </div>

                      {/* Branch */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Branch / Department</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.branch}
                          onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                          placeholder="e.g. CSE"
                        />
                      </div>

                      {/* Semester */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Semester (1–10)</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          className={`sm-form-input ${formErrors.semester ? 'has-error' : ''}`}
                          value={editFormData.semester}
                          onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })}
                          placeholder="e.g. 5"
                        />
                        {formErrors.semester && <div className="sm-input-error-msg">{formErrors.semester}</div>}
                      </div>

                      {/* Section */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Section</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.section}
                          onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                          placeholder="e.g. A"
                        />
                      </div>

                      {/* Admission Year */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Admission Year</label>
                        <input
                          type="number"
                          className={`sm-form-input ${formErrors.admissionYear ? 'has-error' : ''}`}
                          value={editFormData.admissionYear}
                          onChange={(e) => setEditFormData({ ...editFormData, admissionYear: e.target.value })}
                          placeholder="e.g. 2024"
                        />
                        {formErrors.admissionYear && <div className="sm-input-error-msg">{formErrors.admissionYear}</div>}
                      </div>

                      {/* School */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">School / College</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.school}
                          onChange={(e) => setEditFormData({ ...editFormData, school: e.target.value })}
                          placeholder="e.g. School of Engineering"
                        />
                      </div>

                      {/* Course */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Course</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.course}
                          onChange={(e) => setEditFormData({ ...editFormData, course: e.target.value })}
                          placeholder="e.g. CSE"
                        />
                      </div>

                      {/* Batch / Year */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Batch / Year</label>
                        <input
                          type="text"
                          className="sm-form-input"
                          value={editFormData.batch}
                          onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
                          placeholder="e.g. 2024/3rd"
                        />
                      </div>

                      {/* Gender */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Gender</label>
                        <select
                          className="sm-form-input"
                          value={editFormData.gender}
                          onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                        >
                          <option value="">Unspecified</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Date of Birth */}
                      <div className="sm-form-group">
                        <label className="sm-form-label">Date of Birth</label>
                        <input
                          type="date"
                          className="sm-form-input"
                          value={editFormData.dateOfBirth}
                          onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="sm-form-actions">
                      <button
                        type="button"
                        className="sm-btn-cancel"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="sm-btn-save"
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            Save Profile Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {isAddingStudent && (
        <div className="sm-modal-overlay">
          <div className="sm-modal-container" style={{ maxWidth: 640 }}>
            <div className="sm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} style={{ color: '#2563EB' }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>Add Enrolled Student</span>
              </div>
              <button
                className="sm-detail-close"
                onClick={() => setIsAddingStudent(false)}
                disabled={addSaving}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit}>
              <div className="sm-modal-body">
                {addError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={15} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="sm-profile-form-grid">
                  <div className="sm-form-group">
                    <label className="sm-form-label">Roll Number *</label>
                    <input
                      type="text"
                      className={`sm-form-input ${addFormErrors.rollNumber ? 'has-error' : ''}`}
                      placeholder="e.g. 1/24/SET/BCS/001"
                      value={addFormData.rollNumber}
                      onChange={(e) => setAddFormData({ ...addFormData, rollNumber: e.target.value })}
                    />
                    {addFormErrors.rollNumber && <div className="sm-input-error-msg">{addFormErrors.rollNumber}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Status</label>
                    <select
                      className="sm-form-input"
                      value={addFormData.status}
                      onChange={(e) => setAddFormData({ ...addFormData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                      <option value="graduated">Graduated</option>
                      <option value="alumni">Alumni</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  <div className="sm-form-group full-width">
                    <label className="sm-form-label">Full Name *</label>
                    <input
                      type="text"
                      className={`sm-form-input ${addFormErrors.fullName ? 'has-error' : ''}`}
                      placeholder="e.g. Ankit Verma"
                      value={addFormData.fullName}
                      onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })}
                    />
                    {addFormErrors.fullName && <div className="sm-input-error-msg">{addFormErrors.fullName}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Email (Personal Gmail for Login)</label>
                    <input
                      type="email"
                      className={`sm-form-input ${addFormErrors.email ? 'has-error' : ''}`}
                      placeholder="e.g. ankit@gmail.com"
                      value={addFormData.email}
                      onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                    />
                    {addFormErrors.email && <div className="sm-input-error-msg">{addFormErrors.email}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Phone Number (10–15 digits)</label>
                    <input
                      type="tel"
                      className={`sm-form-input ${addFormErrors.phone ? 'has-error' : ''}`}
                      placeholder="e.g. 9876543210"
                      value={addFormData.phone}
                      onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    />
                    {addFormErrors.phone && <div className="sm-input-error-msg">{addFormErrors.phone}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Program</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. B.Tech"
                      value={addFormData.program}
                      onChange={(e) => setAddFormData({ ...addFormData, program: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Branch / Department</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. CSE"
                      value={addFormData.branch}
                      onChange={(e) => setAddFormData({ ...addFormData, branch: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Course</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. CSE"
                      value={addFormData.course}
                      onChange={(e) => setAddFormData({ ...addFormData, course: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Batch / Year</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. 2024/3rd"
                      value={addFormData.batch}
                      onChange={(e) => setAddFormData({ ...addFormData, batch: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Semester (1–10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className={`sm-form-input ${addFormErrors.semester ? 'has-error' : ''}`}
                      placeholder="e.g. 1"
                      value={addFormData.semester}
                      onChange={(e) => setAddFormData({ ...addFormData, semester: e.target.value })}
                    />
                    {addFormErrors.semester && <div className="sm-input-error-msg">{addFormErrors.semester}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Section</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. A"
                      value={addFormData.section}
                      onChange={(e) => setAddFormData({ ...addFormData, section: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Admission Year</label>
                    <input
                      type="number"
                      className={`sm-form-input ${addFormErrors.admissionYear ? 'has-error' : ''}`}
                      placeholder="e.g. 2024"
                      value={addFormData.admissionYear}
                      onChange={(e) => setAddFormData({ ...addFormData, admissionYear: e.target.value })}
                    />
                    {addFormErrors.admissionYear && <div className="sm-input-error-msg">{addFormErrors.admissionYear}</div>}
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">School / College</label>
                    <input
                      type="text"
                      className="sm-form-input"
                      placeholder="e.g. School of Engineering"
                      value={addFormData.school}
                      onChange={(e) => setAddFormData({ ...addFormData, school: e.target.value })}
                    />
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Gender</label>
                    <select
                      className="sm-form-input"
                      value={addFormData.gender}
                      onChange={(e) => setAddFormData({ ...addFormData, gender: e.target.value })}
                    >
                      <option value="">Unspecified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="sm-form-group">
                    <label className="sm-form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="sm-form-input"
                      value={addFormData.dateOfBirth}
                      onChange={(e) => setAddFormData({ ...addFormData, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="sm-modal-footer">
                <button
                  type="button"
                  className="sm-btn-cancel"
                  onClick={() => setIsAddingStudent(false)}
                  disabled={addSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sm-btn-save"
                  disabled={addSaving}
                >
                  {addSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Create Student Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {isDeleting && student && (
        <div className="sm-modal-overlay">
          <div className="sm-modal-container" style={{ maxWidth: 480 }}>
            <div className="sm-modal-header" style={{ borderBottom: '1px solid #FEE2E2', background: '#FEF2F2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#DC2626' }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#991B1B' }}>Confirm Student Removal</span>
              </div>
              <button
                className="sm-detail-close"
                onClick={() => { setIsDeleting(false); setDeleteError(null); }}
                disabled={deleteLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sm-modal-body" style={{ padding: '16px 20px' }}>
              {deleteError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{deleteError}</span>
                </div>
              )}

              <p style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>
                Are you sure you want to permanently delete student record <strong>{student.rollNumber}</strong> ({student.fullName})?
              </p>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                <strong style={{ color: '#0F172A' }}>Safe Deletion Safeguard:</strong>
                <p style={{ margin: '4px 0 0 0' }}>
                  A student record can only be permanently removed if they have zero historical dependencies (no attendance records, biometric face vectors, marks, fees, complaints, or submissions).
                </p>
                <p style={{ margin: '6px 0 0 0', color: '#64748B' }}>
                  If historical records exist, deactivating the student by changing their status to <em>Inactive</em> or <em>Withdrawn</em> is required instead to maintain institutional compliance.
                </p>
              </div>
            </div>

            <div className="sm-modal-footer">
              <button
                type="button"
                className="sm-btn-cancel"
                onClick={() => { setIsDeleting(false); setDeleteError(null); }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn-save"
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
                onClick={handleDeleteStudent}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Checking dependencies & deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Confirm Permanent Deletion
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AdminStudentManagement() {
  const [activeMainTab, setActiveMainTab] = useState('canonical'); // 'canonical' | 'staging' | 'verification' | 'register'

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
        <AppHeader
          title="Student Management"
          extraRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sm-batch-badge">{BATCH_ID}</span>
              <span className="sm-read-only-badge">BATCH 003 GOVERNANCE</span>
            </div>
          }
        />

        <div className="ds-content">

          {/* ── Main Tab Navigation ── */}
          <div className="sm-main-tabs">
            <button
              className={`sm-main-tab-btn ${activeMainTab === 'canonical' ? 'active' : ''}`}
              onClick={() => { setActiveMainTab('canonical'); setSelectedRoll(null); setSelectedVerifRoll(null); }}
            >
              <GraduationCap size={16} />
              Enrolled Students (Profile Management)
            </button>
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
          {/* TAB 0: ENROLLED STUDENTS PROFILE MANAGEMENT (PART 6)               */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeMainTab === 'canonical' && (
            <CanonicalStudentsTab />
          )}

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
