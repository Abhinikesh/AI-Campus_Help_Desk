import { useState, useEffect } from 'react';
import { studentService } from '../../services/student.service';
import {
  Plus, X, CheckCircle, Clock, AlertCircle, Loader2,
  ChevronDown, Paperclip
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Complaints.css';

const CATEGORIES = [
  'Academic', 'Infrastructure', 'Faculty',
  'Administration', 'Hostel', 'Other'
];

const statusMeta = {
  pending:     { pill: 'amber', label: 'Open'        },
  'in-progress':{ pill: 'blue',  label: 'In Progress' },
  resolved:    { pill: 'green', label: 'Resolved'    },
  closed:      { pill: 'gray',  label: 'Closed'      },
};

/* Simple toast */
const Toast = ({ msg, type, onClose }) => (
  <div className={`comp-toast comp-toast-${type}`}>
    {type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
    <span>{msg}</span>
    <button onClick={onClose}><X size={13} /></button>
  </div>
);

/* Detail drawer */
const DetailDrawer = ({ complaint, onClose }) => {
  if (!complaint) return null;
  const sm = statusMeta[complaint.status] || statusMeta.pending;
  return (
    <div className="comp-drawer-overlay" onClick={onClose}>
      <div className="comp-drawer" onClick={e => e.stopPropagation()}>
        <div className="comp-drawer-header">
          <span className="comp-drawer-id">#{complaint._id.slice(-6).toUpperCase()}</span>
          <button className="ds-btn ghost sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="comp-drawer-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <span className={`ds-pill ${sm.pill}`}>{sm.label}</span>
            <span className="ds-code-badge">{complaint.category}</span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{complaint.title}</h3>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>{complaint.description}</p>

          {complaint.adminResponse && (
            <div className="ds-alert info" style={{ marginBottom: 20 }}>
              <strong>Admin Response:</strong> {complaint.adminResponse}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Status Timeline
          </div>
          <div className="ds-stepper" style={{ gap: 0 }}>
            {[
              { label: 'Complaint Received', done: true, date: new Date(complaint.createdAt).toLocaleDateString('en-IN') },
              { label: 'Under Review',       done: complaint.status !== 'pending', date: 'In progress' },
              { label: 'Resolved & Closed',  done: complaint.status === 'resolved' || complaint.status === 'closed', date: complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleDateString('en-IN') : 'Pending' },
            ].map((step, i, arr) => (
              <div key={i}>
                <div className="ds-step">
                  <div className="ds-step-left">
                    <div className={`ds-step-circle ${step.done ? 'done' : ''}`}>
                      {step.done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    {i < arr.length - 1 && <div className={`ds-step-connector ${step.done ? 'done' : ''}`} />}
                  </div>
                  <div className="ds-step-body">
                    <div className={`ds-step-title ${step.done ? 'done' : 'pending'}`}>{step.label}</div>
                    <div className="ds-step-desc">{step.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════ */
const Complaints = () => {
  const [complaints,   setComplaints]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [toast,        setToast]        = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData,     setFormData]     = useState({ title: '', category: 'Academic', description: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await studentService.getComplaints();
      if (res.success) setComplaints(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.description.length < 10) {
      showToast('Description must be at least 10 characters.', 'error'); return;
    }
    try {
      setIsSubmitting(true);
      const res = await studentService.createComplaint({
        ...formData, category: formData.category.toLowerCase()
      });
      if (res.success) {
        showToast('Complaint submitted successfully.');
        setShowForm(false);
        setFormData({ title: '', category: 'Academic', description: '' });
        fetchComplaints();
      } else {
        showToast(res.message || 'Submission failed.', 'error');
      }
    } catch { showToast('Server error. Please try again.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const pending  = complaints.filter(c => c.status === 'pending' || c.status === 'in-progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <span className="ds-loading-text">Loading complaints…</span>
      </div>
    );
  }

  return (
    <div className="comp-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page header */}
      <div className="comp-page-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Complaints & Grievances</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Raise, track and resolve your campus issues</p>
        </div>
        <button className="ds-btn primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Raise New Complaint
        </button>
      </div>

      {/* Stats */}
      <div className="ds-stat-row">
        <div className="ds-stat-card">
          <div className="ds-stat-label">Total Complaints</div>
          <div className="ds-stat-value">{complaints.length}</div>
          <div className="ds-stat-trend neu">All time</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">Pending / In Progress</div>
          <div className="ds-stat-value">{pending}</div>
          <div className={`ds-stat-trend ${pending > 0 ? 'down' : 'up'}`}>{pending > 0 ? 'Awaiting action' : 'All clear'}</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">Resolved</div>
          <div className="ds-stat-value">{resolved}</div>
          <div className="ds-stat-trend up">Completed</div>
        </div>
        <div className="ds-stat-card">
          <div className="ds-stat-label">Resolution Rate</div>
          <div className="ds-stat-value">{complaints.length ? Math.round((resolved / complaints.length) * 100) : 0}%</div>
          <div className="ds-stat-trend up">Avg. 3 days</div>
        </div>
      </div>

      {/* Raise form (inline card, not modal) */}
      {showForm && (
        <div className="ds-card" style={{ maxWidth: 600 }}>
          <div className="ds-card-header">
            <span className="ds-section-title">Raise a Complaint</span>
            <button className="ds-btn ghost sm" onClick={() => setShowForm(false)}><X size={15} /></button>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="comp-label">Category</label>
              <select className="ds-select" style={{ width: '100%', height: 42 }}
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="comp-label">Subject <span style={{ color: '#DC2626' }}>*</span></label>
              <input className="ds-input" style={{ width: '100%' }}
                type="text" placeholder="Brief title of your complaint"
                value={formData.title} required
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="comp-label">Description <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea className="ds-textarea" rows={5}
                placeholder="Describe your complaint in detail…"
                value={formData.description} required
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            {/* File attach zone */}
            <div className="comp-drop-zone">
              <Paperclip size={16} color="#9CA3AF" />
              <span>Click to upload or drag & drop</span>
              <span className="comp-drop-sub">PDF, JPG, PNG up to 5MB</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="ds-btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="ds-btn primary" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 size={15} style={{ animation: 'dspin 0.7s linear infinite' }} /> Submitting…</> : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complaints table */}
      <div className="ds-card">
        <div className="ds-card-header">
          <span className="ds-section-title">My Complaints</span>
        </div>
        {complaints.length === 0 ? (
          <div className="ds-empty">
            <AlertCircle size={32} />
            No complaints raised yet.
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>ID</th><th>Subject</th><th>Category</th>
                  <th>Submitted</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => {
                  const sm = statusMeta[c.status] || statusMeta.pending;
                  return (
                    <tr key={c._id}>
                      <td><span className="ds-code-badge">#{c._id.slice(-6).toUpperCase()}</span></td>
                      <td className="bold" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                      <td><span className="ds-code-badge">{c.category}</span></td>
                      <td style={{ color: '#6B7280' }}>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td><span className={`ds-pill ${sm.pill}`}>{sm.label}</span></td>
                      <td>
                        <button className="ds-btn outline sm" onClick={() => setSelected(c)}>
                          View Details
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

      {/* Detail drawer */}
      {selected && <DetailDrawer complaint={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default Complaints;
