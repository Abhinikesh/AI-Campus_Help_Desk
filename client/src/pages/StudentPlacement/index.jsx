/**
 * client/src/pages/StudentPlacement/index.jsx
 * Comprehensive Student Placement Portal: Career Opportunities, Live Eligibility,
 * Profile & Resume Manager, Applications Tracker, Interviews, and Offer Letters.
 */
import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertTriangle,
  Upload,
  Download,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  DollarSign,
  User,
  BookOpen,
} from 'lucide-react';
import placementService from '../../services/placement.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const StudentPlacement = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('opportunities');

  // Data states
  const [profileData, setProfileData] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [resources, setResources] = useState([]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [opportunityEligibility, setOpportunityEligibility] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [respondingOffer, setRespondingOffer] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [profRes, oppsRes, appsRes, intvRes, offersRes, resRes] = await Promise.all([
        placementService.getMyProfile().catch(() => ({ data: null })),
        placementService.getOpportunities({ limit: 50 }).catch(() => ({ data: [] })),
        placementService.getMyApplications().catch(() => ({ data: [] })),
        placementService.getMyInterviewSchedule().catch(() => ({ data: [] })),
        placementService.getMyOffers().catch(() => ({ data: [] })),
        placementService.getCareerResources().catch(() => ({ data: [] })),
      ]);

      setProfileData(profRes?.data || null);
      setOpportunities(oppsRes?.data || []);
      setApplications(appsRes?.data || []);
      setInterviews(intvRes?.data || []);
      setOffers(offersRes?.data || []);
      setResources(resRes?.data || []);
    } catch (err) {
      showToast(err.message || 'Error loading placement information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOpportunity = async (opp) => {
    setSelectedOpportunity(opp);
    setOpportunityEligibility(null);
    setShowApplyModal(true);
    try {
      const res = await placementService.getOpportunityById(opp._id);
      setOpportunityEligibility(res.data?.eligibility || null);
    } catch (err) {
      console.warn('Eligibility evaluation error:', err.message);
    }
  };

  const handleApply = async () => {
    if (!selectedOpportunity) return;
    try {
      setApplying(true);
      await placementService.applyForOpportunity(selectedOpportunity._id);
      showToast('Application submitted successfully!', 'success');
      setShowApplyModal(false);
      setSelectedOpportunity(null);
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to submit application', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleUploadResume = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      showToast('Please select a PDF or DOCX resume document', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('resume', resumeFile);

    try {
      setUploadingResume(true);
      await placementService.uploadResume(formData);
      showToast('Resume uploaded successfully!', 'success');
      setShowResumeModal(false);
      setResumeFile(null);
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to upload resume', 'error');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleOfferResponse = async (responseType) => {
    if (!selectedOffer) return;
    if (responseType === 'declined' && !declineReason.trim()) {
      showToast('Please provide a reason for declining the offer', 'warning');
      return;
    }

    try {
      setRespondingOffer(true);
      await placementService.respondToOffer(selectedOffer._id, {
        response: responseType,
        declineReason,
      });
      showToast(`Offer ${responseType} successfully`, 'success');
      setShowOfferModal(false);
      setSelectedOffer(null);
      setDeclineReason('');
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update offer status', 'error');
    } finally {
      setRespondingOffer(false);
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      !searchQuery ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.company?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.opportunityCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || opp.opportunityType === filterType;
    return matchesSearch && matchesType;
  });

  const profile = profileData?.profile;
  const academicMetrics = profileData?.academicMetrics;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar />
        <main style={{ padding: '24px 32px', flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Briefcase style={{ width: 26, height: 26, color: '#4F46E5' }} />
                Placement & Career Development
              </h1>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>
                Explore campus recruitment drives, submit verified applications, and manage corporate offers.
              </p>
            </div>
            {profile?.resumeUrl ? (
              <a
                href={placementService.getResumeDownloadUrl(profile.resumeUrl)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  backgroundColor: '#EEF2FF',
                  color: '#4F46E5',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid #C7D2FE',
                }}
              >
                <Download style={{ width: 16, height: 16 }} />
                View Uploaded Resume
              </a>
            ) : (
              <button
                onClick={() => setShowResumeModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Upload style={{ width: 16, height: 16 }} />
                Upload Resume
              </button>
            )}
          </div>

          {/* Profile Completion Strip */}
          {profile && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: '16px 20px',
                border: '1px solid #E5E7EB',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#EEF2FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4F46E5',
                  }}
                >
                  <Award style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    Placement Readiness Profile ({profile.profileCompletionScore || 0}% Complete)
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                    Status:{' '}
                    <span
                      style={{
                        fontWeight: 600,
                        color: profile.registrationStatus === 'registered' ? '#059669' : '#DC2626',
                      }}
                    >
                      {profile.registrationStatus.toUpperCase()}
                    </span>{' '}
                    • Branch: {profileData?.student?.branch || 'N/A'} • Authoritative CGPA:{' '}
                    <strong style={{ color: '#111827' }}>{academicMetrics?.cgpa?.toFixed(2) || '0.00'}</strong> (Backlogs: {academicMetrics?.backlogsCount || 0})
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setShowResumeModal(true)}
                  style={{
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {profile.resumeUrl ? 'Update Resume' : 'Upload Resume'}
                </button>
                <button
                  onClick={() => setActiveTab('my_profile')}
                  style={{
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', marginBottom: 24 }}>
            {[
              { id: 'opportunities', label: 'Eligible Opportunities', count: opportunities.length },
              { id: 'applications', label: 'My Applications', count: applications.length },
              { id: 'interviews', label: 'Interview Schedule', count: interviews.length },
              { id: 'offers', label: 'Offers & Letters', count: offers.length },
              { id: 'my_profile', label: 'Placement Profile' },
              { id: 'resources', label: 'Career Resources', count: resources.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  color: activeTab === tab.id ? '#4F46E5' : '#6B7280',
                  borderBottom: activeTab === tab.id ? '2px solid #4F46E5' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 10,
                      backgroundColor: activeTab === tab.id ? '#EEF2FF' : '#F3F4F6',
                      color: activeTab === tab.id ? '#4F46E5' : '#6B7280',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* TAB 1: OPPORTUNITIES */}
              {activeTab === 'opportunities' && (
                <div>
                  {/* Search and Filters */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#9CA3AF' }} />
                      <input
                        type="text"
                        placeholder="Search by job title, company name, or opportunity code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 36px',
                          borderRadius: 8,
                          border: '1px solid #D1D5DB',
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #D1D5DB',
                        fontSize: 13,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="">All Opportunity Types</option>
                      <option value="full_time">Full-Time</option>
                      <option value="internship">Internship</option>
                      <option value="apprenticeship">Apprenticeship</option>
                    </select>
                  </div>

                  {filteredOpportunities.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <Briefcase style={{ width: 40, height: 40, color: '#9CA3AF', margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>No Opportunities Found</h3>
                      <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                        Check back soon for new corporate recruitment postings and drives.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
                      {filteredOpportunities.map((opp) => (
                        <div
                          key={opp._id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 12,
                            padding: 20,
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    backgroundColor: '#F3F4F6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#4F46E5',
                                    fontWeight: 700,
                                    fontSize: 16,
                                  }}
                                >
                                  {opp.company?.name?.[0] || 'C'}
                                </div>
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{opp.title}</div>
                                  <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Building2 style={{ width: 14, height: 14 }} />
                                    {opp.company?.name} • {opp.company?.industry}
                                  </div>
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  backgroundColor: opp.opportunityType === 'full_time' ? '#EEF2FF' : '#FEF3C7',
                                  color: opp.opportunityType === 'full_time' ? '#4F46E5' : '#D97706',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {opp.opportunityType.replace('_', ' ')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
                              <span style={{ fontSize: 12, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                                {opp.workLocation} ({opp.workMode})
                              </span>
                              {opp.compensationDisplay && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <DollarSign style={{ width: 13, height: 13 }} />
                                  {opp.compensationDisplay}
                                </span>
                              )}
                              <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                                Deadline: {new Date(opp.applicationDeadline).toLocaleDateString()}
                              </span>
                            </div>

                            <p style={{ fontSize: 13, color: '#4B5563', margin: '8px 0', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {opp.description}
                            </p>

                            {/* Eligibility Tags */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                              {opp.minimumCgpa > 0 && (
                                <span style={{ fontSize: 11, backgroundColor: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: 4 }}>
                                  Min CGPA: {opp.minimumCgpa}
                                </span>
                              )}
                              {opp.eligibleBranches && opp.eligibleBranches.length > 0 && (
                                <span style={{ fontSize: 11, backgroundColor: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: 4 }}>
                                  Branches: {opp.eligibleBranches.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenOpportunity(opp)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#4F46E5',
                                color: '#FFFFFF',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              Check Eligibility & Apply
                              <ChevronRight style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MY APPLICATIONS */}
              {activeTab === 'applications' && (
                <div>
                  {applications.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <FileText style={{ width: 40, height: 40, color: '#9CA3AF', margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>No Applications Submitted Yet</h3>
                      <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                        Explore eligible opportunities and apply to begin your campus placement process.
                      </p>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                        <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                          <tr>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>App #</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company & Role</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Applied On</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Eligibility Evaluation</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Current Status</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((app) => (
                            <tr key={app._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '14px 16px', fontWeight: 600, color: '#111827' }}>
                                {app.applicationNumber}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 600, color: '#111827' }}>{app.opportunity?.title}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>
                                  {app.opportunity?.company?.name} • {app.opportunity?.opportunityCode}
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#4B5563' }}>
                                {new Date(app.appliedAt).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: app.eligibilitySnapshot?.isEligible ? '#059669' : '#DC2626',
                                  }}
                                >
                                  {app.eligibilitySnapshot?.isEligible ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <XCircle style={{ width: 14, height: 14 }} />}
                                  CGPA: {app.eligibilitySnapshot?.evaluatedCgpa?.toFixed(2) || 'N/A'} (Backlogs: {app.eligibilitySnapshot?.evaluatedBacklogs || 0})
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    backgroundColor:
                                      app.status === 'selected' || app.status === 'offered' || app.status === 'offer_accepted'
                                        ? '#D1FAE5'
                                        : app.status === 'rejected'
                                        ? '#FEE2E2'
                                        : '#EEF2FF',
                                    color:
                                      app.status === 'selected' || app.status === 'offered' || app.status === 'offer_accepted'
                                        ? '#059669'
                                        : app.status === 'rejected'
                                        ? '#DC2626'
                                        : '#4F46E5',
                                  }}
                                >
                                  {app.status.replace(/_/g, ' ').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                {['submitted', 'under_review'].includes(app.status) && (
                                  <button
                                    onClick={async () => {
                                      const reason = window.prompt('Please enter a reason for withdrawing this application:');
                                      if (reason) {
                                        try {
                                          await placementService.withdrawApplication(app._id, reason);
                                          showToast('Application withdrawn', 'info');
                                          loadAllData();
                                        } catch (err) {
                                          showToast(err.message, 'error');
                                        }
                                      }
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 4,
                                      backgroundColor: '#FEE2E2',
                                      color: '#DC2626',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Withdraw
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

              {/* TAB 3: INTERVIEW SCHEDULE */}
              {activeTab === 'interviews' && (
                <div>
                  {interviews.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <Calendar style={{ width: 40, height: 40, color: '#9CA3AF', margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>No Scheduled Interviews</h3>
                      <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                        When you are shortlisted for assessment rounds or technical interviews, schedules will appear here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
                      {interviews.map((intv) => (
                        <div
                          key={intv._id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 12,
                            padding: 20,
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                                {intv.drive?.driveName || 'Recruitment Drive'}
                              </div>
                              <div style={{ fontSize: 13, color: '#6B7280' }}>{intv.drive?.company?.name}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                              {intv.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: '#374151', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div>
                              <strong>Venue / Link:</strong> {intv.drive?.venue || 'Campus Placement Cell / Virtual'}
                            </div>
                            {intv.drive?.interviewStartDate && (
                              <div>
                                <strong>Interview Date:</strong> {new Date(intv.drive.interviewStartDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: OFFERS & LETTERS */}
              {activeTab === 'offers' && (
                <div>
                  {offers.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <Award style={{ width: 40, height: 40, color: '#9CA3AF', margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>No Offers Yet</h3>
                      <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                        Official corporate offer letters issued by the placement office will be displayed here for your formal response.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
                      {offers.map((offer) => (
                        <div
                          key={offer._id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 12,
                            padding: 24,
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{offer.offerNumber}</span>
                              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                                {offer.company?.name}
                              </div>
                              <div style={{ fontSize: 14, color: '#4B5563' }}>{offer.opportunity?.title}</div>
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '4px 10px',
                                borderRadius: 6,
                                backgroundColor:
                                  offer.status === 'accepted' ? '#D1FAE5' : offer.status === 'declined' ? '#FEE2E2' : '#FEF3C7',
                                color:
                                  offer.status === 'accepted' ? '#059669' : offer.status === 'declined' ? '#DC2626' : '#D97706',
                              }}
                            >
                              {offer.status.toUpperCase()}
                            </span>
                          </div>

                          <div style={{ margin: '16px 0', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                            <div>
                              <strong>Package (CTC):</strong>{' '}
                              <span style={{ color: '#059669', fontWeight: 700 }}>
                                {offer.compensationDisplay || 'Disclosed in Letter'}
                              </span>
                            </div>
                            <div>
                              <strong>Role Type:</strong> {offer.employmentType?.replace(/_/g, ' ').toUpperCase()}
                            </div>
                            {offer.location && (
                              <div>
                                <strong>Location:</strong> {offer.location}
                              </div>
                            )}
                            {offer.joiningDate && (
                              <div>
                                <strong>Tentative Joining:</strong> {new Date(offer.joiningDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                            {offer.offerLetterUrl && (
                              <a
                                href={placementService.getOfferLetterDownloadUrl(offer.offerLetterUrl)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  flex: 1,
                                  padding: '8px 14px',
                                  backgroundColor: '#EEF2FF',
                                  color: '#4F46E5',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  textAlign: 'center',
                                  textDecoration: 'none',
                                  border: '1px solid #C7D2FE',
                                }}
                              >
                                View Offer Document
                              </a>
                            )}
                            {offer.status === 'issued' && (
                              <button
                                onClick={() => {
                                  setSelectedOffer(offer);
                                  setShowOfferModal(true);
                                }}
                                style={{
                                  flex: 1,
                                  padding: '8px 14px',
                                  backgroundColor: '#4F46E5',
                                  color: '#FFFFFF',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                Respond to Offer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PLACEMENT PROFILE */}
              {activeTab === 'my_profile' && profile && (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, border: '1px solid #E5E7EB', maxWidth: 800 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
                    Student Placement Profile & Skills
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                        Technical Skills (comma separated)
                      </label>
                      <input
                        type="text"
                        value={(profile.technicalSkills || []).join(', ')}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            profile: {
                              ...profile,
                              technicalSkills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            },
                          })
                        }
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                        Career Interests (comma separated)
                      </label>
                      <input
                        type="text"
                        value={(profile.careerInterests || []).join(', ')}
                        onChange={(e) =>
                          setProfileData({
                            ...profileData,
                            profile: {
                              ...profile,
                              careerInterests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            },
                          })
                        }
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <button
                      onClick={async () => {
                        try {
                          await placementService.updateMyProfile({
                            technicalSkills: profile.technicalSkills,
                            careerInterests: profile.careerInterests,
                          });
                          showToast('Profile updated successfully!', 'success');
                          loadAllData();
                        } catch (err) {
                          showToast(err.message, 'error');
                        }
                      }}
                      style={{
                        padding: '9px 18px',
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: CAREER RESOURCES */}
              {activeTab === 'resources' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {resources.map((res) => (
                      <div
                        key={res._id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 12,
                          padding: 20,
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase' }}>
                          {res.category?.replace(/_/g, ' ')}
                        </span>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 8px' }}>
                          {res.title}
                        </div>
                        <p style={{ fontSize: 13, color: '#4B5563', lineHeight: '1.4' }}>{res.description}</p>
                        {res.externalUrl && (
                          <a
                            href={res.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: '#4F46E5',
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: 'none',
                              marginTop: 10,
                            }}
                          >
                            Open Preparation Guide <ExternalLink style={{ width: 13, height: 13 }} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* APPLICATION & ELIGIBILITY MODAL */}
          {showApplyModal && selectedOpportunity && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  maxWidth: 540,
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                      Apply for {selectedOpportunity.title}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7280' }}>
                      {selectedOpportunity.company?.name} • Code: {selectedOpportunity.opportunityCode}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}
                  >
                    ×
                  </button>
                </div>

                {/* Real-time Server Eligibility Result */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    marginBottom: 16,
                    backgroundColor: opportunityEligibility?.isEligible ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${opportunityEligibility?.isEligible ? '#BBF7D0' : '#FECACA'}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      color: opportunityEligibility?.isEligible ? '#15803D' : '#B91C1C',
                    }}
                  >
                    {opportunityEligibility?.isEligible ? (
                      <>
                        <CheckCircle2 style={{ width: 18, height: 18 }} />
                        You meet all institutional eligibility requirements!
                      </>
                    ) : (
                      <>
                        <XCircle style={{ width: 18, height: 18 }} />
                        Eligibility Criteria Not Satisfied
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
                    Evaluated CGPA: <strong>{opportunityEligibility?.evaluatedCgpa?.toFixed(2) || '0.00'}</strong> (Required: {selectedOpportunity.minimumCgpa || 'None'}) • Backlogs: <strong>{opportunityEligibility?.evaluatedBacklogs || 0}</strong>
                  </div>
                  {opportunityEligibility?.reasons?.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#B91C1C' }}>
                      {opportunityEligibility.reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>
                  Your verified academic records and latest uploaded resume (<strong>{profile?.resumeOriginalName || 'Uploaded Resume'}</strong>) will be submitted to the corporate recruitment team.
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!opportunityEligibility?.isEligible || applying}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 6,
                      backgroundColor: opportunityEligibility?.isEligible ? '#4F46E5' : '#9CA3AF',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      cursor: opportunityEligibility?.isEligible && !applying ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {applying ? 'Submitting...' : 'Confirm Application'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD RESUME MODAL */}
          {showResumeModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  maxWidth: 460,
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                  Upload Placement Resume
                </h3>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
                  Supported formats: PDF, DOCX (Max size: 5 MB).
                </p>

                <form onSubmit={handleUploadResume}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    style={{ marginBottom: 16, width: '100%', fontSize: 13 }}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowResumeModal(false)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid #D1D5DB',
                        backgroundColor: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingResume}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        cursor: uploadingResume ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {uploadingResume ? 'Uploading...' : 'Upload Resume'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* OFFER RESPONSE MODAL */}
          {showOfferModal && selectedOffer && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  maxWidth: 480,
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                  Formal Offer Response
                </h3>
                <p style={{ fontSize: 13, color: '#4B5563', margin: '0 0 16px' }}>
                  Responding to offer <strong>{selectedOffer.offerNumber}</strong> from <strong>{selectedOffer.company?.name}</strong> for {selectedOffer.compensationDisplay}.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    If declining, please provide a justification:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Accepted higher offer or pursuing higher studies..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowOfferModal(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleOfferResponse('declined')}
                    disabled={respondingOffer}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      cursor: respondingOffer ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Decline Offer
                  </button>
                  <button
                    onClick={() => handleOfferResponse('accepted')}
                    disabled={respondingOffer}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      cursor: respondingOffer ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Accept Offer
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentPlacement;

