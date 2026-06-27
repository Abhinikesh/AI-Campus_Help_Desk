import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getFiles, uploadFile, downloadFile, shareFile, deleteFile } from '../../services/drive.service';
import {
  Search, Upload, Download, Share2, Trash2, Grid, List,
  ChevronRight, ChevronDown, FileText, Folder, X, Loader2
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Drive.css';

/* ── Category tree ───────────────────────────────────────── */
const FOLDERS = [
  { key: 'all',         label: 'All Files' },
  { key: 'notes',       label: 'Notes'     },
  { key: 'papers',      label: 'Question Papers' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'manuals',     label: 'Lab Manuals' },
  { key: 'syllabus',    label: 'Syllabus'  },
];

/* ── File type config ─────────────────────────────────────── */
const FILE_TYPE = {
  PDF:  { color: '#DC2626', bg: '#FEF2F2' },
  DOC:  { color: '#1A56DB', bg: '#EFF6FF' },
  PPT:  { color: '#D97706', bg: '#FFFBEB' },
  XLS:  { color: '#16A34A', bg: '#F0FDF4' },
  ZIP:  { color: '#7C3AED', bg: '#F5F3FF' },
  IMG:  { color: '#0891B2', bg: '#ECFEFF' },
  FILE: { color: '#6B7280', bg: '#F4F5F7' },
};

const FileIcon = ({ type, size = 32 }) => {
  const t = FILE_TYPE[type] || FILE_TYPE.FILE;
  return (
    <div style={{ width: size, height: size, background: t.bg, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <FileText size={size * 0.5} color={t.color} strokeWidth={1.75} />
    </div>
  );
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* ── Dummy fallback ───────────────────────────────────────── */
const DUMMY = [
  { _id:'1', name:'Data_Structures_Unit1.pdf',    subject:'CS201', category:'notes',   semester:'Sem 3', size:2411724, type:'PDF', downloads:24, createdAt:'2026-04-01', uploaderName:'Dr. Sharma' },
  { _id:'2', name:'DBMS_Complete_Notes.pdf',      subject:'CS203', category:'notes',   semester:'Sem 3', size:4300800, type:'PDF', downloads:18, createdAt:'2026-03-28', uploaderName:'Dr. Iyer'   },
  { _id:'3', name:'Web_Dev_React_Guide.pdf',      subject:'CS205', category:'notes',   semester:'Sem 3', size:1887437, type:'PDF', downloads:31, createdAt:'2026-03-25', uploaderName:'Prof. Mehta' },
  { _id:'4', name:'OS_Memory_Management.pdf',     subject:'CS209', category:'notes',   semester:'Sem 4', size:3355443, type:'PDF', downloads:12, createdAt:'2026-03-20', uploaderName:'Dr. Sharma' },
  { _id:'5', name:'DS_MidSem_2025.pdf',           subject:'CS201', category:'papers',  semester:'Sem 3', size:913408,  type:'PDF', downloads:45, createdAt:'2026-03-15', uploaderName:'Admin'      },
  { _id:'6', name:'DBMS_EndSem_2024.pdf',         subject:'CS203', category:'papers',  semester:'Sem 3', size:1153434, type:'PDF', downloads:38, createdAt:'2026-03-10', uploaderName:'Admin'      },
];

/* ════════════════════════════════════════════════════════════ */
const Drive = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [files,       setFiles]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [category,    setCategory]    = useState('all');
  const [search,      setSearch]      = useState('');
  const [viewMode,    setViewMode]    = useState('grid'); // 'grid' | 'list'
  const [showUpload,  setShowUpload]  = useState(false);
  const [downloading, setDownloading] = useState({});
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploadForm,  setUploadForm]  = useState({ file:null, subject:'', category:'notes', semester:'Sem 4', description:'' });

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFiles(category, search);
      setFiles(data.files || []);
    } catch {
      setFiles(DUMMY);
    } finally { setLoading(false); }
  }, [category, search]);

  useEffect(() => {
    const t = setTimeout(fetchFiles, 300);
    return () => clearTimeout(t);
  }, [fetchFiles]);

  const handleDownload = async (file) => {
    try {
      setDownloading(p => ({ ...p, [file._id]: true }));
      await downloadFile(file._id, file.name);
      showToast(`Downloaded: ${file.name}`, 'success');
    } catch { showToast('Download failed.', 'error'); }
    finally { setDownloading(p => ({ ...p, [file._id]: false })); }
  };

  const handleShare = async (file) => {
    try {
      const data = await shareFile(file._id);
      await navigator.clipboard.writeText(data.shareLink);
      showToast('Share link copied.', 'success');
    } catch { showToast('Could not copy link.', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deleteFile(id);
      setFiles(p => p.filter(f => f._id !== id));
      showToast('File deleted.', 'success');
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file)             { showToast('Please select a file.', 'error'); return; }
    if (!uploadForm.subject.trim())   { showToast('Please enter subject name.', 'error'); return; }
    try {
      setUploading(true); setUploadPct(0);
      const fd = new FormData();
      Object.entries(uploadForm).forEach(([k, v]) => v && fd.append(k, v));
      const data = await uploadFile(fd, setUploadPct);
      setFiles(p => [data.file, ...p]);
      setShowUpload(false);
      setUploadForm({ file:null, subject:'', category:'notes', semester:'Sem 4', description:'' });
      showToast(`${data.file.name} uploaded successfully.`, 'success');
    } catch { showToast('Upload failed.', 'error'); }
    finally { setUploading(false); setUploadPct(0); }
  };

  const totalGB   = (files.reduce((a, f) => a + (f.size||0), 0) / 1073741824).toFixed(2);
  const usedPct   = Math.min((totalGB / 5) * 100, 100).toFixed(0);
  const canDelete = (f) => user?.name === f.uploaderName || user?.role === 'admin' || user?.role === 'faculty';

  /* Breadcrumb */
  const folderLabel = FOLDERS.find(f => f.key === category)?.label || 'All Files';

  return (
    <div className="drive-page">

      {/* ── LEFT: Folder tree ── */}
      <aside className="drive-sidebar">
        <div className="drive-sidebar-header">Academic Drive</div>
        <nav style={{ padding: '8px 8px' }}>
          {FOLDERS.map(({ key, label }) => (
            <button
              key={key}
              className={`drive-folder-item${category === key ? ' active' : ''}`}
              onClick={() => setCategory(key)}
            >
              <Folder size={14} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {/* Storage bar */}
        <div className="drive-storage">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:'#6B7280' }}>
            <span>{totalGB} GB used</span>
            <span>{files.length} files</span>
          </div>
          <div className="ds-bar-track"><div className="ds-bar-fill" style={{ width:`${usedPct}%` }} /></div>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>5 GB total</div>
        </div>
      </aside>

      {/* ── RIGHT: File area ── */}
      <div className="drive-main">
        {/* Top bar */}
        <div className="drive-topbar">
          <div className="drive-breadcrumb">
            <span>Drive</span>
            <ChevronRight size={13} color="#9CA3AF" />
            <span className="drive-breadcrumb-active">{folderLabel}</span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }} />
              <input
                className="ds-input"
                style={{ paddingLeft:32, width:200 }}
                placeholder="Search files…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* View toggle */}
            <div className="drive-view-toggle">
              <button className={`drive-view-btn${viewMode==='grid'?' active':''}`} onClick={()=>setViewMode('grid')}><Grid size={15}/></button>
              <button className={`drive-view-btn${viewMode==='list'?' active':''}`} onClick={()=>setViewMode('list')}><List size={15}/></button>
            </div>
            {(user?.role === 'faculty' || user?.role === 'admin') && (
              <button className="ds-btn primary" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload File
              </button>
            )}
          </div>
        </div>

        {/* File content */}
        {loading ? (
          <div className="ds-empty">
            <div className="ds-spinner" style={{ margin:'0 auto 12px' }} />
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div className="ds-empty">
            <Folder size={32} />
            No files in this folder.
            {(user?.role === 'faculty' || user?.role === 'admin') && (
              <button className="ds-btn primary" style={{ marginTop:12 }} onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload File
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="drive-grid">
            {files.map(file => (
              <div key={file._id} className="drive-file-card">
                <div className="drive-file-top">
                  <FileIcon type={file.type} />
                  {canDelete(file) && (
                    <button className="drive-delete-btn" onClick={() => handleDelete(file._id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="drive-file-name" title={file.name}>{file.name}</div>
                <div className="drive-file-meta">{file.subject} · {file.semester}</div>
                <div className="drive-file-stats">
                  <span>{formatSize(file.size)}</span>
                  <span>{formatDate(file.createdAt)}</span>
                </div>
                <div className="drive-file-actions">
                  <button
                    className={`ds-btn outline sm${downloading[file._id] ? ' disabled' : ''}`}
                    onClick={() => handleDownload(file)}
                    disabled={downloading[file._id]}
                  >
                    <Download size={13} /> {downloading[file._id] ? 'Downloading…' : 'Download'}
                  </button>
                  <button className="ds-btn ghost sm" onClick={() => handleShare(file)} title="Copy share link">
                    <Share2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr><th>File</th><th>Subject</th><th>Size</th><th>Uploaded</th><th>Downloads</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file._id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <FileIcon type={file.type} size={24} />
                        <span style={{ fontWeight:500, color:'#111827', fontSize:13 }}>{file.name}</span>
                      </div>
                    </td>
                    <td>{file.subject}</td>
                    <td>{formatSize(file.size)}</td>
                    <td style={{ color:'#6B7280' }}>{formatDate(file.createdAt)}</td>
                    <td>{file.downloads || 0}</td>
                    <td>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="ds-btn outline sm" onClick={() => handleDownload(file)} disabled={downloading[file._id]}>
                          <Download size={13} /> Download
                        </button>
                        <button className="ds-btn ghost sm" onClick={() => handleShare(file)}><Share2 size={13} /></button>
                        {canDelete(file) && (
                          <button className="ds-btn danger-ghost sm" onClick={() => handleDelete(file._id)}><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Upload modal ── */}
      {showUpload && (
        <div className="drive-modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="drive-modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'#111827' }}>Upload File</span>
              <button className="ds-btn ghost sm" onClick={() => setShowUpload(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpload} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Drop zone */}
              <div
                className="drive-dropzone"
                onClick={() => document.getElementById('driveFileInput').click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadForm(p=>({...p, file:f})); }}
              >
                <input id="driveFileInput" type="file" hidden
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.png"
                  onChange={e => { const f=e.target.files[0]; if(f) setUploadForm(p=>({...p,file:f})); }}
                />
                {uploadForm.file ? (
                  <div style={{ textAlign:'center' }}>
                    <FileText size={24} color="#1A56DB" style={{ margin:'0 auto 8px' }} />
                    <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{uploadForm.file.name}</div>
                    <div style={{ fontSize:12, color:'#6B7280' }}>{formatSize(uploadForm.file.size)}</div>
                  </div>
                ) : (
                  <div style={{ textAlign:'center' }}>
                    <Upload size={24} color="#9CA3AF" style={{ margin:'0 auto 8px' }} />
                    <div style={{ fontSize:13, color:'#6B7280' }}>Click to upload or drag & drop</div>
                    <div style={{ fontSize:12, color:'#9CA3AF', marginTop:4 }}>PDF, DOC, PPT, XLS, ZIP, IMG (max 50MB)</div>
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="comp-label">Subject *</label>
                  <input className="ds-input" style={{ width:'100%' }} type="text" placeholder="e.g. Data Structures"
                    value={uploadForm.subject} required
                    onChange={e => setUploadForm(p=>({...p, subject:e.target.value}))} />
                </div>
                <div>
                  <label className="comp-label">Category *</label>
                  <select className="ds-select" style={{ width:'100%' }} value={uploadForm.category}
                    onChange={e => setUploadForm(p=>({...p, category:e.target.value}))}>
                    <option value="notes">Notes</option>
                    <option value="papers">Question Papers</option>
                    <option value="assignments">Assignments</option>
                    <option value="manuals">Lab Manuals</option>
                    <option value="syllabus">Syllabus</option>
                  </select>
                </div>
                <div>
                  <label className="comp-label">Semester</label>
                  <select className="ds-select" style={{ width:'100%' }} value={uploadForm.semester}
                    onChange={e => setUploadForm(p=>({...p, semester:e.target.value}))}>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Sem ${s}`}>Semester {s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="comp-label">Description (optional)</label>
                <textarea className="ds-textarea" rows={3} placeholder="Brief description…"
                  value={uploadForm.description}
                  onChange={e => setUploadForm(p=>({...p, description:e.target.value}))} />
              </div>

              {uploading && (
                <div>
                  <div className="ds-bar-track"><div className="ds-bar-fill" style={{ width:`${uploadPct}%`, transition:'width 0.3s' }} /></div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:4, textAlign:'right' }}>{uploadPct}%</div>
                </div>
              )}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="ds-btn ghost" onClick={() => setShowUpload(false)} disabled={uploading}>Cancel</button>
                <button type="submit" className="ds-btn primary" disabled={uploading || !uploadForm.file}>
                  {uploading ? `Uploading ${uploadPct}%…` : <><Upload size={14} /> Upload File</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drive;
