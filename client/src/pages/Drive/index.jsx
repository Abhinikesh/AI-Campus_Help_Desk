import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getFiles, uploadFile,
  downloadFile, shareFile, deleteFile
} from '../../services/drive.service';
import './Drive.css';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'notes', label: 'Notes' },
  { key: 'papers', label: 'Question Papers' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'manuals', label: 'Lab Manuals' },
  { key: 'syllabus', label: 'Syllabus' },
];

const FILE_ICONS = {
  PDF: { icon: '📄', color: '#ef4444' },
  DOC: { icon: '📝', color: '#3b82f6' },
  PPT: { icon: '📊', color: '#f97316' },
  XLS: { icon: '📈', color: '#22c55e' },
  ZIP: { icon: '🗜', color: '#8b5cf6' },
  IMG: { icon: '🖼', color: '#06b6d4' },
  FILE: { icon: '📁', color: '#94a3b8' },
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export default function Drive() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null,
    subject: '',
    category: 'notes',
    semester: 'Sem 4',
    description: ''
  });

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFiles(category, search);
      setFiles(data.files || []);
    } catch (err) {
      // Fallback to dummy data if API fails
      setFiles(getDummyFiles());
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(fetchFiles, 300);
    return () => clearTimeout(timer);
  }, [fetchFiles]);

  const handleDownload = async (file) => {
    try {
      setDownloading(prev => ({ ...prev, [file._id]: true }));
      await downloadFile(file._id, file.name);
      showToast(`Downloaded: ${file.name}`, 'success');
    } catch (err) {
      showToast('Download failed. Please try again.', 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [file._id]: false }));
    }
  };

  const handleShare = async (file) => {
    try {
      const data = await shareFile(file._id);
      await navigator.clipboard.writeText(data.shareLink);
      showToast('Share link copied to clipboard! 🔗', 'success');
    } catch (err) {
      showToast('Could not copy link. Try again.', 'error');
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deleteFile(fileId);
      setFiles(prev => prev.filter(f => f._id !== fileId));
      showToast('File deleted successfully', 'success');
    } catch (err) {
      showToast('Delete failed. Try again.', 'error');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      showToast('Please select a file', 'error');
      return;
    }
    if (!uploadForm.subject.trim()) {
      showToast('Please enter subject name', 'error');
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('subject', uploadForm.subject);
      formData.append('category', uploadForm.category);
      formData.append('semester', uploadForm.semester);
      formData.append('description', uploadForm.description);
      const data = await uploadFile(formData, setUploadProgress);
      setFiles(prev => [data.file, ...prev]);
      setShowUpload(false);
      setUploadForm({
        file: null, subject: '',
        category: 'notes', semester: 'Sem 4', description: ''
      });
      showToast(`✅ ${data.file.name} uploaded successfully!`, 'success');
    } catch (err) {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const usedGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
  const usedPercent = Math.min((usedGB / 5) * 100, 100).toFixed(0);

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container">

        {/* Header */}
        <div className="drive-header">
          <div>
            <h1 className="drive-title">📁 Academic Drive</h1>
            <p className="drive-subtitle">
              Access, upload and share campus resources
            </p>
          </div>
          <div className="drive-header-actions">
            <div className="drive-search">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search files, subjects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              onClick={() => setShowUpload(true)}
            >
              + Upload File
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="drive-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`drive-tab ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Storage Bar */}
        <div className="storage-bar card">
          <div className="storage-info">
            <span>Used {usedGB} GB of 5 GB</span>
            <span>{files.length} files</span>
          </div>
          <div className="storage-track">
            <div
              className="storage-fill"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>

        {/* Files Grid */}
        {loading ? (
          <div className="drive-loading">
            <div className="spinner" />
            <p>Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="drive-empty">
            <span>📂</span>
            <h3>No files found</h3>
            <p>Upload your first file to get started</p>
            <button
              className="btn-primary"
              onClick={() => setShowUpload(true)}
            >
              + Upload File
            </button>
          </div>
        ) : (
          <div className="files-grid">
            {files.map(file => {
              const fileType = FILE_ICONS[file.type] || FILE_ICONS.FILE;
              const isDownloading = downloading[file._id];
              const canDelete = user?.name === file.uploaderName ||
                                user?.role === 'admin';
              return (
                <div key={file._id} className="file-card card">
                  <div className="file-card-top">
                    <div
                      className="file-icon"
                      style={{ color: fileType.color }}
                    >
                      {fileType.icon}
                    </div>
                    {canDelete && (
                      <button
                        className="file-delete-btn"
                        onClick={() => handleDelete(file._id)}
                        title="Delete file"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  <h3 className="file-name" title={file.name}>
                    {file.name}
                  </h3>
                  <p className="file-meta">
                    {file.subject} • {file.semester}
                  </p>
                  <div className="file-stats">
                    <span>{formatSize(file.size)}</span>
                    <span>{formatDate(file.createdAt)}</span>
                  </div>
                  {file.downloads > 0 && (
                    <p className="file-downloads">
                      ⬇ {file.downloads} downloads
                    </p>
                  )}
                  <div className="file-actions">
                    <button
                      className={`btn-download ${isDownloading ? 'loading' : ''}`}
                      onClick={() => handleDownload(file)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? '⏳ Downloading...' : '⬇ Download'}
                    </button>
                    <button
                      className="btn-share"
                      onClick={() => handleShare(file)}
                      title="Copy share link"
                    >
                      🔗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div
            className="modal-overlay"
            onClick={e => {
              if (e.target === e.currentTarget) setShowUpload(false);
            }}
          >
            <div className="upload-modal card">
              <div className="modal-header">
                <h2>📤 Upload File</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowUpload(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpload}>
                {/* File Drop Zone */}
                <div
                  className="file-dropzone"
                  onClick={() =>
                    document.getElementById('fileInput').click()
                  }
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setUploadForm(p => ({ ...p, file: f }));
                  }}
                >
                  <input
                    id="fileInput"
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.jpg,.png"
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f) setUploadForm(p => ({ ...p, file: f }));
                    }}
                  />
                  {uploadForm.file ? (
                    <div className="file-selected">
                      <span>📄</span>
                      <p>{uploadForm.file.name}</p>
                      <small>
                        {formatSize(uploadForm.file.size)}
                      </small>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span>☁️</span>
                      <p>Click or drag & drop file here</p>
                      <small>
                        PDF, DOC, PPT, XLS, ZIP, IMG (max 50MB)
                      </small>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="upload-form-grid">
                  <div className="form-group">
                    <label>Subject Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Data Structures"
                      value={uploadForm.subject}
                      onChange={e => setUploadForm(p => ({
                        ...p, subject: e.target.value
                      }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={uploadForm.category}
                      onChange={e => setUploadForm(p => ({
                        ...p, category: e.target.value
                      }))}
                    >
                      <option value="notes">Notes</option>
                      <option value="papers">Question Papers</option>
                      <option value="assignments">Assignments</option>
                      <option value="manuals">Lab Manuals</option>
                      <option value="syllabus">Syllabus</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Semester</label>
                    <select
                      value={uploadForm.semester}
                      onChange={e => setUploadForm(p => ({
                        ...p, semester: e.target.value
                      }))}
                    >
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <option key={s} value={`Sem ${s}`}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Description (optional)</label>
                    <textarea
                      placeholder="Brief description of this file..."
                      rows={3}
                      value={uploadForm.description}
                      onChange={e => setUploadForm(p => ({
                        ...p, description: e.target.value
                      }))}
                    />
                  </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowUpload(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={uploading || !uploadForm.file}
                  >
                    {uploading
                      ? `Uploading ${uploadProgress}%...`
                      : '📤 Upload File'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fallback dummy data
function getDummyFiles() {
  return [
    { _id: '1', name: 'Data_Structures_Unit1.pdf',
      subject: 'CS201', category: 'notes',
      semester: 'Sem 3', size: 2411724,
      type: 'PDF', downloads: 24,
      createdAt: new Date('2026-04-01') },
    { _id: '2', name: 'DBMS_Complete_Notes.pdf',
      subject: 'CS203', category: 'notes',
      semester: 'Sem 3', size: 4300800,
      type: 'PDF', downloads: 18,
      createdAt: new Date('2026-03-28') },
    { _id: '3', name: 'Web_Dev_React_Guide.pdf',
      subject: 'CS205', category: 'notes',
      semester: 'Sem 3', size: 1887437,
      type: 'PDF', downloads: 31,
      createdAt: new Date('2026-03-25') },
    { _id: '4', name: 'OS_Memory_Management.pdf',
      subject: 'CS209', category: 'notes',
      semester: 'Sem 4', size: 3355443,
      type: 'PDF', downloads: 12,
      createdAt: new Date('2026-03-20') },
    { _id: '5', name: 'DS_MidSem_2025.pdf',
      subject: 'CS201', category: 'papers',
      semester: 'Sem 3', size: 913408,
      type: 'PDF', downloads: 45,
      createdAt: new Date('2026-03-15') },
    { _id: '6', name: 'DBMS_EndSem_2024.pdf',
      subject: 'CS203', category: 'papers',
      semester: 'Sem 3', size: 1153434,
      type: 'PDF', downloads: 38,
      createdAt: new Date('2026-03-10') },
  ];
}
