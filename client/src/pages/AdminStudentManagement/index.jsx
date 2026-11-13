/**
 * AdminStudentManagement/index.jsx
 *
 * Phase 3.6 — Admin Staging Student Management
 *
 * Connects to Batch 003 staging collections via secure admin-only APIs.
 * Displays a searchable, paginated list of staging records and a full
 * detail panel for any selected student.
 *
 * Security:
 *  - Page is only accessible via /admin/students (ProtectedRoute role="admin")
 *  - No PII (passwords, parental info) is ever displayed — the API excludes it
 *  - No production Student creation or identity merge actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import { adminService } from '../../services/admin.service';
import {
  Users, Search, ChevronLeft, ChevronRight, RefreshCw,
  AlertCircle, CheckCircle, HelpCircle, XCircle, ClipboardList,
  BookOpen, Briefcase, Info, X, GraduationCap,
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

const ACADEMIC_ELIGIBILITY_LABELS = {
  CONSISTENT_PENDING_VERIFICATION:  { label: 'Consistent — Pending Verification', color: 'green'  },
  CONFLICTING_REQUIRES_ADJUDICATION: { label: 'Conflicting — Needs Adjudication', color: 'red'    },
  IDENTITY_REQUIRES_REVIEW:         { label: 'Identity Under Review',             color: 'amber'  },
  ACADEMIC_DATA_INCOMPLETE:         { label: 'Incomplete Data',                   color: 'gray'   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdentityBadge({ classification }) {
  const info = IDENTITY_LABELS[classification] || { label: classification, color: 'gray' };
  return <span className={`ds-pill ${info.color}`}>{info.label}</span>;
}

function ReviewBadge({ status }) {
  const info = REVIEW_STATUS_LABELS[status] || { label: status, color: 'gray' };
  return <span className={`ds-pill ${info.color}`}>{info.label}</span>;
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

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="sm-section-header">
      <Icon size={16} className="sm-section-icon" />
      <span className="sm-section-title">{title}</span>
      {count !== undefined && (
        <span className="sm-section-count">{count}</span>
      )}
    </div>
  );
}

function FieldComplete({ value, label }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  return (
    <div className={`sm-field-complete ${hasValue ? 'present' : 'absent'}`} title={label}>
      {hasValue ? <CheckCircle size={12} /> : <XCircle size={12} />}
      <span>{label}</span>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

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
            {/* ── Basic Info Tab ── */}
            {activeTab === 'basic' && (
              <div>
                {detail.masterRecords.map((rec, i) => (
                  <div key={rec._id} className="sm-record-card">
                    {detail.masterRecords.length > 1 && (
                      <div className="sm-record-badge">Master Record #{i + 1}</div>
                    )}
                    <InfoRow label="Roll Number"    value={rec.normalizedRollNumber} />
                    <InfoRow label="Raw Identifier" value={rec.rawIdentifier} />
                    <InfoRow label="Student Name"   value={rec.studentName} />
                    <InfoRow label="Source Sheet"   value={rec.sourceSheet} />
                    <InfoRow label="Source Row"     value={rec.sourceRow} />
                    <InfoRow label="Review Status"  value={
                      <ReviewBadge status={rec.reviewStatus} />
                    } />
                    {rec.reviewNotes && (
                      <InfoRow label="Review Notes" value={rec.reviewNotes} />
                    )}
                    {rec.conflictCandidates && rec.conflictCandidates.length > 0 && (
                      <div className="sm-conflicts">
                        <div className="sm-conflicts-title">
                          <AlertCircle size={13} style={{ color: '#D97706' }} />
                          Conflict Candidates ({rec.conflictCandidates.length})
                        </div>
                        {rec.conflictCandidates.map((cc, j) => (
                          <div key={j} className="sm-conflict-item">
                            <span className="sm-conflict-field">{cc.field}</span>
                            <span className="sm-conflict-raw">{cc.rawValue}</span>
                            {cc.parsedCandidates?.length > 0 && (
                              <span className="sm-conflict-candidates">
                                → {cc.parsedCandidates.join(' | ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Raw payload preview — sanitized by API */}
                    {rec.rawPayload && Object.keys(rec.rawPayload).length > 0 && (
                      <details className="sm-raw-payload">
                        <summary>Source Row Payload ({Object.keys(rec.rawPayload).length} fields)</summary>
                        <div className="sm-raw-payload-grid">
                          {Object.entries(rec.rawPayload).map(([k, v]) => (
                            <div key={k} className="sm-raw-payload-row">
                              <span className="sm-raw-key">{k}</span>
                              <span className="sm-raw-val">{String(v ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Admission Tab ── */}
            {activeTab === 'admission' && (
              <div>
                {detail.admissionRecords.length === 0 ? (
                  <div className="sm-empty-tab">
                    <HelpCircle size={28} className="sm-empty-icon" />
                    <div>No admission application found for this student</div>
                    <div className="sm-empty-sub">
                      Identity may be UNMATCHED. Manual verification required.
                    </div>
                  </div>
                ) : (
                  detail.admissionRecords.map((rec, i) => (
                    <div key={rec._id} className="sm-record-card">
                      {detail.admissionRecords.length > 1 && (
                        <div className="sm-record-badge">Application #{i + 1}</div>
                      )}
                      <InfoRow label="Application Number" value={rec.applicationNumber} />
                      <InfoRow label="Student Name"       value={rec.studentName} />
                      <InfoRow label="Course"             value={rec.course} missing={!rec.course} />
                      <InfoRow label="School"             value={rec.school} missing={!rec.school} />
                      <InfoRow label="Date of Reporting"  value={rec.dateOfReporting} missing={!rec.dateOfReporting} />
                      <InfoRow label="Status"             value={
                        <span className={`ds-pill ${rec.admissionStatus === 'enrolled' ? 'green' : rec.admissionStatus === 'duplicate_flagged' ? 'red' : 'amber'}`}>
                          {rec.admissionStatus}
                        </span>
                      } />
                      <InfoRow label="Source Row" value={rec.sourceRow} />
                      {rec.reviewNotes && (
                        <InfoRow label="Review Notes" value={rec.reviewNotes} />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Academic Tab ── */}
            {activeTab === 'academic' && (
              <div>
                {/* Summary banner */}
                {detail.summary?.academic && (
                  <div className="sm-academic-summary">
                    <div className="sm-academic-summary-row">
                      <span>Eligibility</span>
                      {(() => {
                        const e = ACADEMIC_ELIGIBILITY_LABELS[detail.summary.academic.eligibility];
                        return e
                          ? <span className={`ds-pill ${e.color}`}>{e.label}</span>
                          : <span className="ds-pill gray">{detail.summary.academic.eligibility}</span>;
                      })()}
                    </div>
                    <div className="sm-academic-summary-row">
                      <span>Submissions</span>
                      <span className="sm-info-value">{detail.summary.academic.submissionCount}</span>
                    </div>
                    {detail.summary.academic.hasConflict && (
                      <div className="sm-conflict-banner">
                        <AlertCircle size={13} />
                        CGPA conflict detected across submissions — adjudication required.
                      </div>
                    )}
                    <div className="sm-academic-quick">
                      <div className="sm-quick-stat">
                        <div className="sm-quick-val">
                          {detail.summary.academic.latestCgpa !== null
                            ? detail.summary.academic.latestCgpa.toFixed(2)
                            : '—'}
                        </div>
                        <div className="sm-quick-label">Self-Reported CGPA</div>
                      </div>
                      <div className="sm-quick-stat">
                        <div className="sm-quick-val">
                          {detail.summary.academic.latestTenth !== null
                            ? `${detail.summary.academic.latestTenth}%`
                            : '—'}
                        </div>
                        <div className="sm-quick-label">10th %</div>
                      </div>
                      <div className="sm-quick-stat">
                        <div className="sm-quick-val">
                          {detail.summary.academic.latestTwelfth !== null
                            ? `${detail.summary.academic.latestTwelfth}%`
                            : '—'}
                        </div>
                        <div className="sm-quick-label">12th %</div>
                      </div>
                    </div>
                    <div className="sm-notice">
                      <Info size={12} />
                      All submissions are self-reported. <strong>isCanonical: false</strong> for all.
                      Not verified against official marksheets.
                    </div>
                  </div>
                )}

                {detail.academicRecords.length === 0 ? (
                  <div className="sm-empty-tab">
                    <GraduationCap size={28} className="sm-empty-icon" />
                    <div>No academic submissions found</div>
                  </div>
                ) : (
                  detail.academicRecords.map((rec, i) => (
                    <div key={rec._id} className="sm-record-card">
                      <div className="sm-record-badge">
                        Submission #{i + 1}
                        {rec.isCanonical && <span className="sm-canonical-badge">Canonical</span>}
                      </div>
                      <InfoRow label="Source Row"           value={rec.sourceRow} />
                      <InfoRow label="Branch"               value={rec.branch}         missing={!rec.branch} />
                      <InfoRow label="10th %"               value={rec.tenthPercentage !== null ? `${rec.tenthPercentage}%` : null} missing={rec.tenthPercentage === null} />
                      <InfoRow label="10th Board"           value={rec.tenthBoard}      missing={!rec.tenthBoard} />
                      <InfoRow label="12th %"               value={rec.twelfthPercentage !== null ? `${rec.twelfthPercentage}%` : null} missing={rec.twelfthPercentage === null} />
                      <InfoRow label="12th Board"           value={rec.twelfthBoard}    missing={!rec.twelfthBoard} />
                      <InfoRow label="Self-Reported CGPA"   value={rec.selfReportedCgpa !== null ? rec.selfReportedCgpa.toFixed(2) : null} missing={rec.selfReportedCgpa === null} />
                      <InfoRow label="Active Reappears"     value={rec.selfReportedActiveReappears} missing={rec.selfReportedActiveReappears === null} />
                      <InfoRow label="Dead Reappears"       value={rec.selfReportedDeadReappears}   missing={rec.selfReportedDeadReappears === null} />
                      {rec.reappearSubjects?.length > 0 && (
                        <InfoRow label="Reappear Subjects"  value={rec.reappearSubjects.join(', ')} />
                      )}
                      <InfoRow label="Submission Time"      value={rec.submissionTimestamp ? new Date(rec.submissionTimestamp).toLocaleString('en-IN') : null} missing={!rec.submissionTimestamp} />
                      <InfoRow label="Review Status"        value={<ReviewBadge status={rec.reviewStatus} />} />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Internship Tab ── */}
            {activeTab === 'internship' && (
              <div>
                {/* Summary */}
                {detail.summary?.internship && (
                  <div className="sm-internship-summary">
                    <div className="sm-internship-summary-row">
                      <span>Records</span>
                      <span className="sm-info-value">{detail.summary.internship.count}</span>
                    </div>
                    <div className="sm-internship-summary-row">
                      <span>Field Completeness</span>
                      <span className="sm-info-value">{detail.summary.internship.completenessPercent}%</span>
                    </div>
                    {detail.summary.internship.hasNullOrg && (
                      <div className="sm-null-org-banner">
                        <AlertCircle size={13} />
                        {detail.summary.internship.nullOrgCount} record(s) have no organization name
                        (preserved as self-guided/independent internship).
                      </div>
                    )}
                  </div>
                )}

                {detail.internshipRecords.length === 0 ? (
                  <div className="sm-empty-tab">
                    <Briefcase size={28} className="sm-empty-icon" />
                    <div>No internship records found</div>
                  </div>
                ) : (
                  detail.internshipRecords.map((rec, i) => (
                    <div key={rec._id} className="sm-record-card">
                      <div className="sm-record-badge">Internship #{i + 1}</div>

                      {/* Field completeness indicators */}
                      <div className="sm-field-completeness">
                        <FieldComplete value={rec.organizationName}  label="Org" />
                        <FieldComplete value={rec.internshipTitle}    label="Title" />
                        <FieldComplete value={rec.startDate}         label="Start Date" />
                        <FieldComplete value={rec.mode}              label="Mode" />
                        <FieldComplete value={rec.stipendProvided !== null ? rec.stipendProvided : null} label="Stipend" />
                      </div>

                      <InfoRow label="Organization"   value={rec.organizationName || null}     missing={!rec.organizationName} />
                      <InfoRow label="Title"          value={rec.internshipTitle || null}      missing={!rec.internshipTitle} />
                      <InfoRow label="Start Date"     value={rec.startDate || null}            missing={!rec.startDate} />
                      <InfoRow label="Mode"           value={rec.mode || null}                 missing={!rec.mode} />
                      <InfoRow label="Stipend"        value={
                        rec.stipendProvided === true
                          ? `Yes${rec.monthlyStipendAmount ? ` — ₹${rec.monthlyStipendAmount}/mo` : ''}`
                          : rec.stipendProvided === false
                          ? 'No'
                          : null
                      } missing={rec.stipendProvided === null} />
                      <InfoRow label="Placement Done" value={
                        rec.placementDone === true ? 'Yes' : rec.placementDone === false ? 'No' : null
                      } missing={rec.placementDone === null} />
                      <InfoRow label="Branch"         value={rec.branch}        missing={!rec.branch} />
                      <InfoRow label="Section"        value={rec.section}       missing={!rec.section} />
                      <InfoRow label="Linkage Status" value={rec.linkageStatus} />
                      <InfoRow label="Source Row"     value={rec.sourceRow} />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStudentManagement() {
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

  const searchTimer = useRef(null);

  // ── Load stats ──────────────────────────────────────────────────────────────
  useEffect(() => {
    adminService.getStagingStats()
      .then(res => { if (res.success) setStats(res.data); })
      .catch(() => {});
  }, []);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // ── Load students ───────────────────────────────────────────────────────────
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

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="ds-shell">
      <Sidebar />

      <div className="ds-main">
        <header className="ds-header">
          <span className="ds-header-title">Student Management</span>
          <div className="ds-header-right">
            <span className="sm-batch-badge">{BATCH_ID}</span>
            <span className="sm-read-only-badge">READ-ONLY STAGING</span>
          </div>
        </header>

        <div className="ds-content">

          {/* ── Stat Cards ── */}
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

          {/* ── Enrollment Notice ── */}
          <div className="sm-enrollment-notice">
            <Info size={15} style={{ flexShrink: 0 }} />
            <div>
              <strong>Enrollment Not Verified.</strong> All {stats?.totalMasterRecords ?? 0} staging
              records originate from student surveys and an applicant tracking sheet — not from an
              authoritative University Registrar enrollment roll. No production Student records will
              be created until independent registrar verification is provided.{' '}
              <span className="sm-no-action-label">No promotion actions are available in this view.</span>
            </div>
          </div>

          {/* ── Main table + detail panel ── */}
          <div className={`sm-workspace ${selectedRoll ? 'sm-workspace--split' : ''}`}>

            {/* ── List Panel ── */}
            <div className="sm-list-panel">
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-section-title">Batch 003 Staging Records</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search */}
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

                    {/* Classification filter */}
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

                {/* Error state */}
                {error && (
                  <div className="sm-error-banner">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Loading skeleton */}
                {loading && (
                  <div className="sm-loading-rows">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="sm-skeleton-row" />
                    ))}
                  </div>
                )}

                {/* Table */}
                {!loading && students.length === 0 && !error && (
                  <div className="sm-empty-state">
                    <Users size={36} className="sm-empty-state-icon" />
                    <div>No staging records found</div>
                    {debouncedSearch && (
                      <div className="sm-empty-sub">Try a different search term or clear the filter.</div>
                    )}
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
                                  {s.normalizedRollNumber || <em style={{ color: '#9CA3AF', fontStyle: 'italic' }}>—</em>}
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

                    {/* Pagination */}
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

            {/* ── Detail Panel ── */}
            {selectedRoll && (
              <StudentDetailPanel
                rollNumber={selectedRoll}
                onClose={() => setSelectedRoll(null)}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

