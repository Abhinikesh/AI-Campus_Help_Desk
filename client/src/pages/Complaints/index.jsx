import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { studentService } from '../../services/student.service';
import { useAuth } from '../../context/AuthContext';
import { Plus, X, ListCollapse, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import './Complaints.css';

const categoryButtons = [
  { value: 'academic', label: 'Academic', icon: '📚', color: '#3b82f6' },
  { value: 'admin', label: 'Administrative', icon: '🏢', color: '#f59e0b' },
  { value: 'hostel', label: 'Hostel', icon: '🏠', color: '#22c55e' },
  { value: 'other', label: 'Other', icon: '📋', color: '#64748b' },
];

const Complaints = () => {
  const { user } = useAuth() || {};
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('My Complaints');
  const [isRaiseModalOpen, setRaiseModalOpen] = useState(false);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({ title: '', category: 'academic', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await studentService.getComplaints();
      if (res.success) setComplaints(res.data);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = complaints.filter(c => c.status === 'pending' || c.status === 'in-progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  const handleOpenDetail = (complaint) => {
    setSelectedComplaint(complaint);
    setDetailModalOpen(true);
  };

  const handleRaiseSubmit = async (e) => {
    e.preventDefault();
    if (formData.description.length < 10) {
      showToast('❌ Description too short!');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await studentService.createComplaint(formData);
      
      if (res.success) {
        showToast('✅ Complaint submitted successfully!');
        setRaiseModalOpen(false);
        setFormData({ title: '', category: 'academic', description: '' });
        fetchComplaints();
      } else {
        showToast(`❌ ${res.message || 'Submission failed'}`);
      }
    } catch (err) {
      showToast('❌ Server error, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Fetching Complaints History...
      </div>
    );
  }

  return (
    <div className="comp-layout">
      <Navbar />

      {/* TOAST */}
      {toast && (
        <div className="comp-toast">
          {toast}
        </div>
      )}

      <main className="comp-content">
        {/* HEADER */}
        <div className="comp-header">
          <div>
            <h1 className="comp-title">Complaints & Grievances</h1>
            <p className="comp-subtitle">Raise, track and resolve your campus issues</p>
          </div>
          <button className="btn btn-primary btn-icon" onClick={() => setRaiseModalOpen(true)}>
            <Plus size={18} /> Raise New Complaint
          </button>
        </div>

        {/* STATS */}
        <section className="comp-stats">
          <div className="comp-stat-card">
            <div className="comp-stat-top">
              <span className="comp-stat-val">{complaints.length}</span>
              <ListCollapse size={24} color="#3b82f6" />
            </div>
            <div className="comp-stat-label">Total Complaints</div>
            <p className="comp-stat-sub">your complaints</p>
          </div>
          <div className="comp-stat-card">
            <div className="comp-stat-top">
              <span className="comp-stat-val text-red">{pendingCount}</span>
              <Clock size={24} color="#f87171" />
            </div>
            <div className="comp-stat-label">Pending</div>
            <p className="comp-stat-sub">awaiting action</p>
          </div>
          <div className="comp-stat-card">
            <div className="comp-stat-top">
              <span className="comp-stat-val text-green">{resolvedCount}</span>
              <CheckCircle size={24} color="#34d399" />
            </div>
            <div className="comp-stat-label">Resolved</div>
            <p className="comp-stat-sub">completed</p>
          </div>
        </section>

        {/* LIST */}
        <div className="comp-list">
          {complaints.length > 0 ? (
            complaints.map((c, i) => {
              const catObj = categoryButtons.find(b => b.value === c.category) || categoryButtons[3];
              return (
                <div key={i} className="comp-card">
                  <div className="comp-c-left">
                    <div className="comp-icon-circle" style={{ backgroundColor: `${catObj.color}20`, color: catObj.color }}>
                      {catObj.icon}
                    </div>
                  </div>

                  <div className="comp-c-mid">
                    <div className="comp-id-row">
                      <span className="comp-id">#{c._id.slice(-6).toUpperCase()}</span>
                      <span className="comp-date">• {new Date(c.createdAt).toLocaleDateString()}</span>
                      <span className="comp-cat-badge" style={{ color: catObj.color, borderColor: `${catObj.color}40` }}>{catObj.label}</span>
                    </div>
                    <h3 className="comp-card-title">{c.title}</h3>
                    <p className="comp-card-desc">{c.description}</p>
                  </div>

                  <div className="comp-c-right">
                    <div className={`comp-status-badge status-${c.status.replace('-', '')}`}>
                      {c.status === 'pending' && <span className="blink-dot"></span>}
                      {c.status === 'resolved' && <CheckCircle size={14} />}
                      {c.status.toUpperCase()}
                    </div>
                    {c.status === 'resolved' && (
                      <div className="comp-resolved-text">
                        Resolved on {new Date(c.resolvedAt).toLocaleDateString()}
                      </div>
                    )}
                    <button className="comp-view-btn" onClick={() => handleOpenDetail(c)}>View Details</button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
               <AlertCircle size={48} className="mx-auto mb-4 text-slate-600" />
               <p className="text-slate-400">You haven't raised any complaints yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* RAISE MODAL */}
      {isRaiseModalOpen && (
        <div className="modal-backdrop" onClick={() => setRaiseModalOpen(false)}>
          <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Raise New Complaint</h2>
              <button className="modal-close" onClick={() => setRaiseModalOpen(false)}><X size={20}/></button>
            </div>
            <form className="modal-form" onSubmit={handleRaiseSubmit}>
              <div className="form-group">
                <label>Title <span className="text-red">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="Brief title of the issue" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                />
              </div>
              
              <div className="form-group">
                <label>Category <span className="text-red">*</span></label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {categoryButtons.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description <span className="text-red">*</span></label>
                <textarea 
                  rows={5} 
                  required 
                  placeholder="Detailed description of your issue..." 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRaiseModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedComplaint && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Complaint #{selectedComplaint._id.slice(-6).toUpperCase()}</h2>
              <button className="modal-close" onClick={() => setDetailModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
              <div className="detail-meta">
                <span className="comp-cat-badge inline">
                   {selectedComplaint.category.toUpperCase()}
                </span>
                <div className={`comp-status-badge inline status-${selectedComplaint.status.replace('-', '')}`}>
                  {selectedComplaint.status.toUpperCase()}
                </div>
              </div>
              <h3 className="detail-title">{selectedComplaint.title}</h3>
              <p className="detail-desc">{selectedComplaint.description}</p>

              <div className="detail-timeline">
                <h4 className="timeline-title">Status Updates</h4>
                <div className="tl-item">
                  <div className="tl-dot blue"></div>
                  <div className="tl-content">
                    <span className="tl-date">{new Date(selectedComplaint.createdAt).toLocaleDateString()}</span>
                    <span className="tl-text">Complaint Received</span>
                  </div>
                </div>
                {selectedComplaint.status !== 'pending' && (
                  <div className="tl-item">
                    <div className="tl-dot gold"></div>
                    <div className="tl-content">
                      <span className="tl-date">Update</span>
                      <span className="tl-text">Currently Under Review</span>
                    </div>
                  </div>
                )}
                {selectedComplaint.status === 'resolved' && (
                  <div className="tl-item">
                    <div className="tl-dot green"></div>
                    <div className="tl-content">
                      <span className="tl-date">{new Date(selectedComplaint.resolvedAt).toLocaleDateString()}</span>
                      <span className="tl-text">Resolved & Closed</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Complaints;
