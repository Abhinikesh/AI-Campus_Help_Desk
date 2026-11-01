/**
 * client/src/pages/AdminPlacement/index.jsx
 * Comprehensive Placement Administration Desk: Corporate Master Directory,
 * Recruitment Drives, Candidate Applications, Selection Stages, Offer Verification, and CSV Analytics.
 */
import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Users,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  ChevronRight,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import placementService from '../../services/placement.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const AdminPlacement = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [metrics, setMetrics] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [offers, setOffers] = useState([]);

  // Modals
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    companyCode: '',
    industry: 'Information Technology',
    website: '',
    location: '',
    recruiterName: '',
    recruiterEmail: '',
    recruiterPhone: '',
    tier: 'tier_1',
    description: '',
  });

  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [oppForm, setOppForm] = useState({
    companyId: '',
    opportunityCode: '',
    title: '',
    description: '',
    opportunityType: 'full_time',
    workLocation: '',
    workMode: 'on_site',
    compensationDisplay: '',
    compensationPaise: 0,
    minimumCgpa: 6.5,
    maximumBacklogs: 0,
    eligibleBranches: 'CSE, IT, ECE',
    eligibleBatches: '2026',
    applicationOpeningDate: new Date().toISOString().slice(0, 10),
    applicationDeadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });

  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveForm, setDriveForm] = useState({
    driveCode: '',
    driveName: '',
    companyId: '',
    opportunityId: '',
    academicYear: '2025-2026',
    venue: 'Auditorium / Placement Hall',
    registrationStartDate: new Date().toISOString().slice(0, 10),
    registrationEndDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    instructions: '',
  });

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedAppForOffer, setSelectedAppForOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({
    compensationDisplay: '12 LPA',
    compensationPaise: 120000000,
    joiningDate: '',
    location: 'Bengaluru',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [mRes, compRes, oppRes, drvRes, appRes, offRes] = await Promise.all([
        placementService.getMetrics().catch(() => ({ data: null })),
        placementService.getCompanies({ limit: 100 }).catch(() => ({ data: [] })),
        placementService.getOpportunities({ limit: 100 }).catch(() => ({ data: [] })),
        placementService.getDrives({ limit: 100 }).catch(() => ({ data: [] })),
        placementService.getDriveApplications({ limit: 100 }).catch(() => ({ data: [] })),
        placementService.getAllOffers({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      setMetrics(mRes?.data || null);
      setCompanies(compRes?.data || []);
      setOpportunities(oppRes?.data || []);
      setDrives(drvRes?.data || []);
      setApplications(appRes?.data || []);
      setOffers(offRes?.data || []);
    } catch (err) {
      showToast(err.message || 'Error loading placement administration data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await placementService.createCompany(companyForm);
      showToast('Company registered successfully', 'success');
      setShowCompanyModal(false);
      setCompanyForm({
        name: '',
        companyCode: '',
        industry: 'Information Technology',
        website: '',
        location: '',
        recruiterName: '',
        recruiterEmail: '',
        recruiterPhone: '',
        tier: 'tier_1',
        description: '',
      });
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOpportunity = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await placementService.createOpportunity({
        ...oppForm,
        eligibleBranches: oppForm.eligibleBranches.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
        eligibleBatches: oppForm.eligibleBatches.split(',').map((s) => Number(s.trim())).filter(Boolean),
      });
      showToast('Opportunity draft created successfully', 'success');
      setShowOpportunityModal(false);
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishOpportunity = async (oppId) => {
    try {
      await placementService.publishOpportunity(oppId);
      showToast('Opportunity published and broadcast to students', 'success');
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateDrive = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await placementService.createDrive(driveForm);
      showToast('Recruitment drive scheduled and synced with calendar', 'success');
      setShowDriveModal(false);
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceApplication = async (appId, status) => {
    try {
      await placementService.updateApplicationStatus(appId, { status });
      showToast(`Application moved to ${status.replace(/_/g, ' ')}`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleIssueOffer = async (e) => {
    e.preventDefault();
    if (!selectedAppForOffer) return;
    try {
      setSubmitting(true);
      await placementService.issueOffer({
        applicationId: selectedAppForOffer._id,
        ...offerForm,
      });
      showToast('Official offer issued to candidate', 'success');
      setShowOfferModal(false);
      setSelectedAppForOffer(null);
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPlacement = async (offerId) => {
    try {
      await placementService.verifyPlacement(offerId);
      showToast('Student placement verified', 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

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
                <ShieldCheck style={{ width: 26, height: 26, color: '#4F46E5' }} />
                Placement & Training Administration
              </h1>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>
                Corporate relations, recruitment drives, applicant reviews, and verified institutional placements.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowCompanyModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid #D1D5DB',
                  cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Add Company
              </button>
              <button
                onClick={() => setShowOpportunityModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Create Job / Internship
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E7EB', marginBottom: 24 }}>
            {[
              { id: 'overview', label: 'Executive Metrics' },
              { id: 'companies', label: 'Company Directory', count: companies.length },
              { id: 'opportunities', label: 'Job Opportunities', count: opportunities.length },
              { id: 'drives', label: 'Recruitment Drives', count: drives.length },
              { id: 'applications', label: 'Applications Desk', count: applications.length },
              { id: 'offers', label: 'Offers & Verification', count: offers.length },
              { id: 'reports', label: 'CSV Reports' },
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
              {/* TAB 1: EXECUTIVE METRICS */}
              {activeTab === 'overview' && metrics && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                    <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Real Placement Rate</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                        {metrics.placementPercentage}%
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                        {metrics.verifiedPlacements} verified / {metrics.totalRegisteredStudents} registered
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Active Partner Companies</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginTop: 4 }}>
                        {metrics.activeCompaniesCount}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                        {metrics.publishedOpportunitiesCount} published openings
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Applications Processed</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#4F46E5', marginTop: 4 }}>
                        {metrics.totalApplications}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                        {metrics.shortlistedCandidates} shortlisted candidates
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Corporate Offers Issued</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                        {metrics.totalOffers}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                        {metrics.acceptedOffers} accepted by students
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
                      Upcoming Campus Recruitment Drives
                    </h3>
                    {drives.length === 0 ? (
                      <p style={{ color: '#6B7280', fontSize: 13 }}>No upcoming drives scheduled.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                        {drives.slice(0, 4).map((d) => (
                          <div key={d._id} style={{ padding: 16, borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{d.driveName}</div>
                            <div style={{ fontSize: 13, color: '#4B5563', margin: '4px 0' }}>
                              {d.company?.name} • Code: {d.driveCode}
                            </div>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>
                              Registration: {new Date(d.registrationStartDate).toLocaleDateString()} to {new Date(d.registrationEndDate).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANIES */}
              {activeTab === 'companies' && (
                <div>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Code</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company Name</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Industry</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Location</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tier</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Recruiter Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((c) => (
                          <tr key={c._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#4F46E5' }}>{c.companyCode}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{c.name}</td>
                            <td style={{ padding: '12px 16px', color: '#4B5563' }}>{c.industry}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{c.location || 'N/A'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EEF2FF', color: '#4F46E5', textTransform: 'uppercase' }}>
                                {c.tier?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: c.status === 'active' ? '#D1FAE5' : '#FEE2E2', color: c.status === 'active' ? '#059669' : '#DC2626' }}>
                                {c.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                              {c.recruiterEmail || 'Confidential'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: OPPORTUNITIES */}
              {activeTab === 'opportunities' && (
                <div>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Code</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Job Title & Company</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Package (CTC)</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Min CGPA</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Deadline</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opportunities.map((opp) => (
                          <tr key={opp._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#4F46E5' }}>{opp.opportunityCode}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{opp.title}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>{opp.company?.name}</div>
                            </td>
                            <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                              {opp.opportunityType?.replace(/_/g, ' ')}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#059669' }}>
                              {opp.compensationDisplay || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>{opp.minimumCgpa || 'None'}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                              {new Date(opp.applicationDeadline).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: opp.status === 'published' ? '#D1FAE5' : '#FEF3C7',
                                  color: opp.status === 'published' ? '#059669' : '#D97706',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {opp.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              {opp.status === 'draft' && (
                                <button
                                  onClick={() => handlePublishOpportunity(opp._id)}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#4F46E5',
                                    color: '#FFFFFF',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Publish
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: RECRUITMENT DRIVES */}
              {activeTab === 'drives' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                    <button
                      onClick={() => setShowDriveModal(true)}
                      style={{
                        padding: '8px 14px',
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
                      <Plus style={{ width: 15, height: 15 }} /> Schedule Drive
                    </button>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Code</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Drive Name</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Registration Window</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Venue</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drives.map((d) => (
                          <tr key={d._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#4F46E5' }}>{d.driveCode}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{d.driveName}</td>
                            <td style={{ padding: '12px 16px', color: '#4B5563' }}>{d.company?.name}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                              {new Date(d.registrationStartDate).toLocaleDateString()} to {new Date(d.registrationEndDate).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{d.venue}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EEF2FF', color: '#4F46E5', textTransform: 'uppercase' }}>
                                {d.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: APPLICATIONS DESK */}
              {activeTab === 'applications' && (
                <div>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>App #</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Candidate</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Job Role</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Evaluated CGPA</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Resume</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => (
                          <tr key={app._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{app.applicationNumber}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{app.student?.fullName}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>{app.student?.rollNumber} • {app.student?.branch}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#4B5563' }}>{app.opportunity?.title}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontWeight: 600, color: app.eligibilitySnapshot?.isEligible ? '#059669' : '#DC2626' }}>
                                {app.eligibilitySnapshot?.evaluatedCgpa?.toFixed(2) || 'N/A'} (Backlogs: {app.eligibilitySnapshot?.evaluatedBacklogs || 0})
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {app.resumeUrl && (
                                <a
                                  href={placementService.getResumeDownloadUrl(app.resumeUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: '#4F46E5', textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
                                >
                                  View CV
                                </a>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                {app.status.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                {app.status === 'submitted' && (
                                  <button
                                    onClick={() => handleAdvanceApplication(app._id, 'shortlisted')}
                                    style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: '#4F46E5', color: '#FFFFFF', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                                  >
                                    Shortlist
                                  </button>
                                )}
                                {app.status === 'shortlisted' && (
                                  <button
                                    onClick={() => {
                                      setSelectedAppForOffer(app);
                                      setShowOfferModal(true);
                                    }}
                                    style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: '#059669', color: '#FFFFFF', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                                  >
                                    Issue Offer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: OFFERS & VERIFICATION */}
              {activeTab === 'offers' && (
                <div>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Offer #</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Candidate</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company & Role</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Compensation</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Student Response</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Verification</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((o) => (
                          <tr key={o._id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{o.offerNumber}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{o.student?.fullName}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>{o.student?.rollNumber} • {o.student?.branch}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{o.company?.name}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>{o.opportunity?.title}</div>
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#059669' }}>
                              {o.compensationDisplay}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: o.status === 'accepted' ? '#D1FAE5' : '#FEF3C7', color: o.status === 'accepted' ? '#059669' : '#D97706' }}>
                                {o.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: o.isPlacementVerified ? '#D1FAE5' : '#F3F4F6', color: o.isPlacementVerified ? '#059669' : '#6B7280' }}>
                                {o.isPlacementVerified ? 'VERIFIED' : 'UNVERIFIED'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              {!o.isPlacementVerified && (
                                <button
                                  onClick={() => handleVerifyPlacement(o._id)}
                                  style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: '#059669', color: '#FFFFFF', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                                >
                                  Verify Placement
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: CSV REPORTS */}
              {activeTab === 'reports' && (
                <div style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, border: '1px solid #E5E7EB', maxWidth: 600 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
                    Download Placement CSV Reports (CWE-1236 Protected)
                  </h3>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: '1.4' }}>
                    All CSV streams sanitize formula injection characters (<code style={{ backgroundColor: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>=, +, -, @</code>) with a leading apostrophe to ensure secure spreadsheet viewing.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <a
                      href={placementService.getExportUrl('applications')}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '10px 16px', backgroundColor: '#F3F4F6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>Export All Student Applications</span>
                      <Download style={{ width: 16, height: 16 }} />
                    </a>
                    <a
                      href={placementService.getExportUrl('offers')}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '10px 16px', backgroundColor: '#F3F4F6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>Export Verified Corporate Offers</span>
                      <Download style={{ width: 16, height: 16 }} />
                    </a>
                    <a
                      href={placementService.getExportUrl('companies')}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '10px 16px', backgroundColor: '#F3F4F6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>Export Company Master Directory</span>
                      <Download style={{ width: 16, height: 16 }} />
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ADD COMPANY MODAL */}
          {showCompanyModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, maxWidth: 520, width: '100%', padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Add Corporate Partner</h3>
                <form onSubmit={handleCreateCompany}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Company Name *</label>
                      <input required type="text" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Company Code *</label>
                      <input required type="text" placeholder="e.g. CMP-TCS" value={companyForm.companyCode} onChange={(e) => setCompanyForm({ ...companyForm, companyCode: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Industry *</label>
                      <input required type="text" value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Location</label>
                      <input type="text" placeholder="e.g. Bengaluru" value={companyForm.location} onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Recruiter Email</label>
                      <input type="email" value={companyForm.recruiterEmail} onChange={(e) => setCompanyForm({ ...companyForm, recruiterEmail: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Tier</label>
                      <select value={companyForm.tier} onChange={(e) => setCompanyForm({ ...companyForm, tier: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF' }}>
                        <option value="tier_1">Tier 1</option>
                        <option value="tier_2">Tier 2</option>
                        <option value="dream">Dream</option>
                        <option value="super_dream">Super Dream</option>
                        <option value="mass_recruiter">Mass Recruiter</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowCompanyModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: '#4F46E5', color: '#FFF', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Saving...' : 'Register Company'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* CREATE OPPORTUNITY MODAL */}
          {showOpportunityModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, maxWidth: 560, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Post Job / Internship Opening</h3>
                <form onSubmit={handleCreateOpportunity}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Company *</label>
                      <select required value={oppForm.companyId} onChange={(e) => setOppForm({ ...oppForm, companyId: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF' }}>
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                          <option key={c._id} value={c._id}>{c.name} ({c.companyCode})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Job Code *</label>
                      <input required type="text" placeholder="e.g. JOB-2026-001" value={oppForm.opportunityCode} onChange={(e) => setOppForm({ ...oppForm, opportunityCode: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Job Title *</label>
                    <input required type="text" placeholder="e.g. Graduate Software Trainee" value={oppForm.title} onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Package Display</label>
                      <input type="text" placeholder="e.g. 10 - 12 LPA" value={oppForm.compensationDisplay} onChange={(e) => setOppForm({ ...oppForm, compensationDisplay: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Work Location *</label>
                      <input required type="text" placeholder="e.g. Pune / Hyderabad" value={oppForm.workLocation} onChange={(e) => setOppForm({ ...oppForm, workLocation: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Min CGPA</label>
                      <input type="number" step="0.1" value={oppForm.minimumCgpa} onChange={(e) => setOppForm({ ...oppForm, minimumCgpa: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Max Backlogs</label>
                      <input type="number" value={oppForm.maximumBacklogs} onChange={(e) => setOppForm({ ...oppForm, maximumBacklogs: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Eligible Branches (comma separated)</label>
                    <input type="text" value={oppForm.eligibleBranches} onChange={(e) => setOppForm({ ...oppForm, eligibleBranches: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Job Description *</label>
                    <textarea required rows={3} value={oppForm.description} onChange={(e) => setOppForm({ ...oppForm, description: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowOpportunityModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: '#4F46E5', color: '#FFF', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Creating...' : 'Create Draft'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SCHEDULE DRIVE MODAL */}
          {showDriveModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, maxWidth: 520, width: '100%', padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Schedule Recruitment Drive</h3>
                <form onSubmit={handleCreateDrive}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Drive Code *</label>
                      <input required type="text" placeholder="e.g. DRV-2026-TCS-01" value={driveForm.driveCode} onChange={(e) => setDriveForm({ ...driveForm, driveCode: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Drive Name *</label>
                      <input required type="text" placeholder="e.g. TCS Campus Hiring" value={driveForm.driveName} onChange={(e) => setDriveForm({ ...driveForm, driveName: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Company *</label>
                      <select required value={driveForm.companyId} onChange={(e) => setDriveForm({ ...driveForm, companyId: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF' }}>
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Opportunity *</label>
                      <select required value={driveForm.opportunityId} onChange={(e) => setDriveForm({ ...driveForm, opportunityId: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF' }}>
                        <option value="">Select Opportunity</option>
                        {opportunities.map((o) => (
                          <option key={o._id} value={o._id}>{o.title} ({o.opportunityCode})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Venue / Meeting Link</label>
                    <input type="text" value={driveForm.venue} onChange={(e) => setDriveForm({ ...driveForm, venue: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowDriveModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: '#4F46E5', color: '#FFF', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Scheduling...' : 'Schedule Drive'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ISSUE OFFER MODAL */}
          {showOfferModal && selectedAppForOffer && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, maxWidth: 480, width: '100%', padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Issue Corporate Offer</h3>
                <p style={{ fontSize: 13, color: '#4B5563', margin: '0 0 16px' }}>
                  Candidate: <strong>{selectedAppForOffer.student?.fullName}</strong> ({selectedAppForOffer.student?.rollNumber}) for role <strong>{selectedAppForOffer.opportunity?.title}</strong>.
                </p>
                <form onSubmit={handleIssueOffer}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Compensation Display (CTC) *</label>
                    <input required type="text" value={offerForm.compensationDisplay} onChange={(e) => setOfferForm({ ...offerForm, compensationDisplay: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Job Location</label>
                    <input type="text" value={offerForm.location} onChange={(e) => setOfferForm({ ...offerForm, location: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowOfferModal(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: '#059669', color: '#FFF', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Issuing...' : 'Issue Offer'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPlacement;

