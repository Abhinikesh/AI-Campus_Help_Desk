/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import { adminService } from '../../services/admin.service';
import {
  CheckCircle, Clock, AlertCircle, Loader2,
  X, Search, Filter, RefreshCw, MessageSquare,
  User, Mail, Calendar, Send, ShieldCheck, ChevronRight
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import '../Complaints/Complaints.css';

const CATEGORIES = [
  'All Categories',
  'academic',
  'faculty',
  'infrastructure',
  'hostel',
  'transport',
  'admin',
  'other'
];

const statusMeta = {
  pending:      { pill: 'amber', label: 'Open / Pending' },
  'in-progress':{ pill: 'blue',  label: 'In Progress'    },
  resolved:     { pill: 'green', label: 'Resolved'       },
  closed:       { pill: 'gray',  label: 'Closed'         },
};

const AdminComplaints = () => {
  const { user } = useAuth();
  const [complaints,   setComplaints]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'in-progress' | 'resolved'
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selected,     setSelected]     = useState(null); // active complaint for review
  const [toast,        setToast]        = useState(null);

  // Resolution form state inside the review drawer
  const [updatingStatus, setUpdatingStatus] = useState('pending');
  const [adminResponseText, setAdminResponseText] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchComplaints = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await adminService.getComplaints();
      if (res.success && Array.isArray(res.data)) {
        setComplaints(res.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to fetch complaints', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // When a complaint is opened in drawer, populate its current values
  const openDetailDrawer = (complaint) => {
    setSelected(complaint);
    setUpdatingStatus(complaint.status || 'pending');
    setAdminResponseText(complaint.adminResponse || '');
  };

  const closeDetailDrawer = () => {
    setSelected(null);
    setSavingResolution(false);
  };

  // Submit official resolution and status update
  const handleSaveResolution = async (e) => {
    e.preventDefault();
    if (!selected) return;

    if (updatingStatus === 'resolved' && !adminResponseText.trim()) {
      showToast('A resolution response is required when resolving a complaint.', 'error');
      return;
    }

    try {
      setSavingResolution(true);
      const res = await adminService.updateComplaintStatus(
        selected._id,
        updatingStatus,
        adminResponseText.trim()
      );

      if (res.success) {
        showToast(`Complaint #${selected._id.slice(-6).toUpperCase()} updated successfully!`);
        // Update local state
        setComplaints((prev) =>
          prev.map((c) => (c._id === selected._id ? { ...c, status: updatingStatus, adminResponse: adminResponseText.trim() } : c))
        );
        setSelected((prev) => prev ? { ...prev, status: updatingStatus, adminResponse: adminResponseText.trim() } : null);
      } else {
        showToast(res.message || 'Failed to update resolution', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error updating complaint', 'error');
    } finally {
      setSavingResolution(false);
    }
  };

  // Filtered complaints calculation
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'All Categories' && c.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Search query filter (matches title, description, id, raiser name, raiser email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const descMatch = (c.description || '').toLowerCase().includes(q);
        const idMatch = (c._id || '').toLowerCase().includes(q);
        const nameMatch = (c.raisedBy?.name || '').toLowerCase().includes(q);
        const emailMatch = (c.raisedBy?.email || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !idMatch && !nameMatch && !emailMatch) {
          return false;
        }
      }

      return true;
    });
  }, [complaints, statusFilter, categoryFilter, searchQuery]);

  // Aggregate stats
  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === 'pending').length;
  const inProgressCount = complaints.filter((c) => c.status === 'in-progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="ds-shell">
        <Sidebar />
        <div className="ds-main">
          <div className="ds-loading">
            <div className="ds-spinner" />
            <span className="ds-loading-text">Loading institutional complaints hub…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-shell">
      <Sidebar />

      <div className="ds-main">
        {/* Toast Notification */}
        {toast && (
          <div className={`comp-toast comp-toast-${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            <span>{toast.msg}</span>
            <button onClick={() => setToast(null)}><X size={13} /></button>
          </div>
        )}

        {/* Header */}
        <header className="ds-header">
          <div className="ds-header-left">
            <div className="ds-title-row">
              <h1 className="ds-header-title">Complaints & Grievance Hub</h1>
              <span className="ds-pill blue">Grievance Desk</span>
            </div>
            <p className="ds-header-sub">
              Review, investigate, and resolve grievances submitted by students and faculty across campus.
            </p>
          </div>

          <div className="ds-header-right">
            <button
              onClick={() => fetchComplaints(true)}
              className="ds-btn ghost sm"
              disabled={refreshing}
              title="Refresh complaints"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Stat Cards */}
        <div className="ds-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Total Campus Complaints</div>
            <div className="ds-stat-value">{totalCount}</div>
            <div className="ds-stat-trend">Institutional log</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Pending Review</div>
            <div className="ds-stat-value" style={{ color: pendingCount > 0 ? '#D97706' : '#111827' }}>
              {pendingCount}
            </div>
            <div className="ds-stat-trend warn">Requires attention</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">In Progress</div>
            <div className="ds-stat-value" style={{ color: '#2563EB' }}>
              {inProgressCount}
            </div>
            <div className="ds-stat-trend">Under active investigation</div>
          </div>
          <div className="ds-stat-card">
            <div className="ds-stat-label">Resolved & Closed</div>
            <div className="ds-stat-value" style={{ color: '#059669' }}>
              {resolvedCount}
            </div>
            <div className="ds-stat-trend up">{resolutionRate}% resolution rate</div>
          </div>
        </div>

        {/* Complaints Management Card */}
        <div className="ds-card">
          <div className="ds-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="ds-section-title">Received Complaints ({filteredComplaints.length})</span>
            </div>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Status Pill Tabs */}
              <div style={{ display: 'flex', background: '#F3F4F6', padding: 3, borderRadius: 8, gap: 2 }}>
                {[
                  { id: 'all',         label: `All (${totalCount})` },
                  { id: 'pending',     label: `Open (${pendingCount})` },
                  { id: 'in-progress', label: `In Progress (${inProgressCount})` },
                  { id: 'resolved',    label: `Resolved (${resolvedCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    style={{
                      border: 'none',
                      background: statusFilter === tab.id ? '#FFFFFF' : 'transparent',
                      color: statusFilter === tab.id ? '#1A56DB' : '#4B5563',
                      fontWeight: statusFilter === tab.id ? 600 : 500,
                      fontSize: 12,
                      padding: '5px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      boxShadow: statusFilter === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Category Dropdown */}
              <select
                className="ds-select"
                style={{ height: 34, fontSize: 13, minWidth: 140 }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All Categories' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>

              {/* Search Box */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9CA3AF' }} />
                <input
                  type="text"
                  className="ds-input"
                  style={{ height: 34, paddingLeft: 30, fontSize: 13, minWidth: 200 }}
                  placeholder="Search complaints or raiser…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Complaints Table */}
          {filteredComplaints.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#F3F4F6', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                No complaints found
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 400, margin: '0 auto' }}>
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'All Categories'
                  ? 'No complaints match the selected filter criteria. Try adjusting your search or filters.'
                  : 'All complaints across the institution have been cleared and resolved.'}
              </div>
            </div>
          ) : (
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Complaint ID</th>
                    <th style={{ minWidth: 180 }}>Raised By</th>
                    <th style={{ minWidth: 240 }}>Subject & Details</th>
                    <th style={{ width: 120 }}>Category</th>
                    <th style={{ width: 130 }}>Date Filed</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map((c) => {
                    const sm = statusMeta[c.status] || statusMeta.pending;
                    const raiserName = c.raisedBy?.name || 'Campus Student';
                    const raiserEmail = c.raisedBy?.email || '';
                    const raiserRole = c.raisedBy?.role || 'student';

                    return (
                      <tr key={c._id} className="hover">
                        <td>
                          <span className="ds-code-badge" style={{ fontWeight: 600 }}>
                            #{c._id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                              {raiserName}
                            </span>
                            {c.raisedBy?.loginId && (
                              <span style={{ color: '#2563EB', fontSize: 11, fontWeight: 600 }}>
                                Roll: {c.raisedBy.loginId}
                              </span>
                            )}
                            <span style={{ color: '#6B7280', fontSize: 12 }}>
                              {raiserEmail}
                            </span>
                            <span style={{ marginTop: 2 }}>
                              <span className="ds-pill gray" style={{ fontSize: 10, padding: '1px 6px' }}>
                                {raiserRole.toUpperCase()}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 14 }}>
                              {c.title}
                            </span>
                            <span style={{ color: '#64748B', fontSize: 12, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {c.description}
                            </span>
                            {c.adminResponse && (
                              <span style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={12} /> Response Recorded
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="ds-pill blue" style={{ textTransform: 'capitalize' }}>
                            {c.category}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#475569', fontSize: 13 }}>
                            {new Date(c.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`ds-pill ${sm.pill}`}>
                            {sm.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => openDetailDrawer(c)}
                            className="ds-btn ghost sm"
                            style={{ color: '#1A56DB', fontWeight: 600 }}
                          >
                            Review & Resolve
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Review & Resolution Drawer */}
        {selected && (
          <div className="comp-drawer-overlay" onClick={closeDetailDrawer}>
            <div className="comp-drawer" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div className="comp-drawer-header">
                <div>
                  <span className="comp-drawer-id">
                    Complaint #{selected._id.slice(-6).toUpperCase()}
                  </span>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    Filed on {new Date(selected.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>
                <button className="ds-btn ghost sm" onClick={closeDetailDrawer}>
                  <X size={16} />
                </button>
              </div>

              <div className="comp-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Complainant Identity Card */}
                <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                    Complainant Details
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                      {(selected.raisedBy?.name || 'S')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 14 }}>
                        {selected.raisedBy?.name || 'Student / Campus Member'}
                      </div>
                      {selected.raisedBy?.loginId && (
                        <div style={{ color: '#2563EB', fontSize: 12, fontWeight: 600 }}>
                          Roll Number: {selected.raisedBy.loginId}
                        </div>
                      )}
                      <div style={{ color: '#64748B', fontSize: 12 }}>
                        {selected.raisedBy?.email || 'No email registered'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complaint Content */}
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span className="ds-pill blue" style={{ textTransform: 'capitalize' }}>
                      {selected.category}
                    </span>
                    <span className={`ds-pill ${statusMeta[selected.status]?.pill || 'gray'}`}>
                      {statusMeta[selected.status]?.label || selected.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                    {selected.title}
                  </h3>
                  <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', whiteSpace: 'pre-wrap' }}>
                    {selected.description}
                  </div>
                </div>

                {/* Resolution & Investigation Panel */}
                <form onSubmit={handleSaveResolution} style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color="#1A56DB" />
                    <span>Administrative Investigation & Resolution</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Update Resolution Status *
                    </label>
                    <select
                      className="ds-select"
                      style={{ width: '100%', height: 38 }}
                      value={updatingStatus}
                      onChange={(e) => setUpdatingStatus(e.target.value)}
                    >
                      <option value="pending">Open / Under Review</option>
                      <option value="in-progress">In Progress (Active Investigation)</option>
                      <option value="resolved">Resolved & Closed</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Official Resolution Response *
                    </label>
                    <textarea
                      className="ds-textarea"
                      rows={4}
                      style={{ width: '100%', fontSize: 13 }}
                      placeholder="Write the official response or action taken for this grievance. The student will be notified immediately…"
                      value={adminResponseText}
                      onChange={(e) => setAdminResponseText(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                      This response will be visible to the student in their Complaints portal and will trigger an in-app notice.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      type="button"
                      className="ds-btn ghost sm"
                      onClick={closeDetailDrawer}
                      disabled={savingResolution}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ds-btn primary sm"
                      disabled={savingResolution}
                    >
                      {savingResolution ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Save & Send Resolution</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminComplaints;
