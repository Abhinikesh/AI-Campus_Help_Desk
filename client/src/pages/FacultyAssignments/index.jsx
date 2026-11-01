/**
 * client/src/pages/FacultyAssignments/index.jsx
 * Faculty assignment authoring, submission auditing, evaluation, and grade publishing.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useToast } from '../../context/ToastContext';
import assignmentService from '../../services/assignment.service';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Users,
  Award,
  ChevronRight,
  X,
  ExternalLink,
  Send,
  Eye,
  Calendar,
  Layers,
  HelpCircle,
  CheckCheck,
} from 'lucide-react';

const FacultyAssignments = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    publishedAssignments: 0,
    activeAssignments: 0,
    closedAssignments: 0,
    totalSubmissionsReceived: 0,
    totalEvaluated: 0,
    pendingEvaluations: 0,
  });

  const [taughtSubjects, setTaughtSubjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionsModal, setSubmissionsModal] = useState(false);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Evaluation state for active submission
  const [evaluatingSubmissionId, setEvaluatingSubmissionId] = useState(null);
  const [evalMarks, setEvalMarks] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Create Assignment Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    department: 'CSE',
    semester: 4,
    section: 'All',
    maximumMarks: 50,
    assignmentType: 'homework',
    dueDate: '',
    latePolicy: 'allowed',
    gracePeriodMinutes: 0,
    status: 'published',
  });
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, assignRes, subjectsRes] = await Promise.all([
        assignmentService.getFacultyDashboard(),
        assignmentService.getFacultyAssignments({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery || undefined,
        }),
        assignmentService.getFacultyTaughtSubjects(),
      ]);

      if (dashRes.success) setStats(dashRes.data);
      if (assignRes.success) setAssignments(assignRes.data);
      if (subjectsRes.success) {
        setTaughtSubjects(subjectsRes.data);
        if (subjectsRes.data.length > 0 && !formData.subject) {
          setFormData((prev) => ({
            ...prev,
            subject: subjectsRes.data[0]._id,
            department: subjectsRes.data[0].branch || 'CSE',
            semester: subjectsRes.data[0].semester || 4,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load faculty assignments', err);
      if (showToast) showToast('Failed to load assignments', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      if (showToast) showToast('Assignment title is required', 'error');
      return;
    }
    if (!formData.subject) {
      if (showToast) showToast('Please select an assigned subject', 'error');
      return;
    }
    if (!formData.dueDate) {
      if (showToast) showToast('Submission deadline is required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = new FormData();
      Object.keys(formData).forEach((key) => {
        payload.append(key, formData[key]);
      });

      for (let i = 0; i < attachmentFiles.length; i++) {
        payload.append('attachments', attachmentFiles[i]);
      }

      const res = await assignmentService.createAssignment(payload);
      if (res.success) {
        if (showToast) showToast('Assignment created successfully', 'success');
        setShowCreateModal(false);
        setAttachmentFiles([]);
        setFormData({
          title: '',
          description: '',
          subject: taughtSubjects[0]?._id || '',
          department: taughtSubjects[0]?.branch || 'CSE',
          semester: taughtSubjects[0]?.semester || 4,
          section: 'All',
          maximumMarks: 50,
          assignmentType: 'homework',
          dueDate: '',
          latePolicy: 'allowed',
          gracePeriodMinutes: 0,
          status: 'published',
        });
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error creating assignment', err);
      const msg = err.response?.data?.message || 'Failed to create assignment';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSubmissionsModal = async (assignment) => {
    setSelectedAssignment(assignment);
    setSubmissionsModal(true);
    setEvaluatingSubmissionId(null);
    setSubmissionsLoading(true);
    try {
      const res = await assignmentService.getAssignmentSubmissions(assignment._id);
      if (res.success) {
        setSubmissionsList(res.data);
      }
    } catch (err) {
      console.error('Failed to load submissions', err);
      if (showToast) showToast('Failed to load submissions', 'error');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handlePublishAssignment = async (id) => {
    try {
      const res = await assignmentService.publishAssignment(id);
      if (res.success) {
        if (showToast) showToast('Assignment published to students', 'success');
        fetchDashboardData();
      }
    } catch (err) {
      if (showToast) showToast('Failed to publish assignment', 'error');
    }
  };

  const handleCloseAssignment = async (id) => {
    try {
      const res = await assignmentService.closeAssignment(id);
      if (res.success) {
        if (showToast) showToast('Assignment closed for submissions', 'info');
        fetchDashboardData();
      }
    } catch (err) {
      if (showToast) showToast('Failed to close assignment', 'error');
    }
  };

  const startGrading = (sub) => {
    setEvaluatingSubmissionId(sub._id);
    setEvalMarks(sub.marksAwarded !== null ? String(sub.marksAwarded) : '');
    setEvalFeedback(sub.feedback || '');
  };

  const handleSaveEvaluation = async (submissionId) => {
    if (evalMarks === '' || isNaN(Number(evalMarks))) {
      if (showToast) showToast('Please enter valid numeric marks', 'error');
      return;
    }
    const marksNum = Number(evalMarks);
    if (marksNum < 0 || marksNum > (selectedAssignment?.maximumMarks || 100)) {
      if (showToast) {
        showToast(`Marks must be between 0 and ${selectedAssignment?.maximumMarks}`, 'error');
      }
      return;
    }

    try {
      setSavingEvaluation(true);
      const res = await assignmentService.evaluateSubmission(submissionId, {
        marksAwarded: marksNum,
        feedback: evalFeedback,
      });

      if (res.success) {
        if (showToast) showToast('Evaluation recorded successfully', 'success');
        // Update local list
        setSubmissionsList((prev) =>
          prev.map((s) => (s._id === submissionId ? { ...s, ...res.data } : s))
        );
        setEvaluatingSubmissionId(null);
        fetchDashboardData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save evaluation';
      if (showToast) showToast(msg, 'error');
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handlePublishResult = async (submissionId) => {
    try {
      const res = await assignmentService.publishSubmissionResult(submissionId);
      if (res.success) {
        if (showToast) showToast('Evaluation results published to student!', 'success');
        setSubmissionsList((prev) =>
          prev.map((s) => (s._id === submissionId ? { ...s, isResultPublished: true } : s))
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to publish results';
      if (showToast) showToast(msg, 'error');
    }
  };

  const handleDownloadAttachment = async (assignmentId, attachment) => {
    try {
      await assignmentService.downloadAttachment(assignmentId, attachment._id, attachment.name);
    } catch (err) {
      if (showToast) showToast('Failed to download attachment', 'error');
    }
  };

  const handleDownloadSubmissionFile = async (submissionId, file) => {
    try {
      await assignmentService.downloadSubmissionFile(submissionId, file._id, file.name);
    } catch (err) {
      if (showToast) showToast('Failed to download student file', 'error');
    }
  };

  const formatDateIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto mt-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <BookOpen className="text-blue-600" size={28} />
                Coursework & Assignment Management
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Author assignments, review student submissions with version histories, evaluate, and publish academic grades.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <Plus size={18} /> Create Assignment
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalAssignments}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Assignments</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.activeAssignments}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active & Due</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalSubmissionsReceived}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Submissions Received</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Award size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.pendingEvaluations}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Needs Evaluation</div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'published', label: 'Published' },
                { id: 'draft', label: 'Drafts' },
                { id: 'closed', label: 'Closed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Assignments List */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 text-slate-500">
              <BookOpen className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-semibold text-slate-700">No assignments found</p>
              <p className="text-xs text-slate-400 mt-1">
                Create a new assignment or adjust your filter selection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assignments.map((item) => {
                const isOverdue = new Date(item.dueDate) < new Date();
                return (
                  <div
                    key={item._id}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {item.subject?.code || 'N/A'} • {item.subject?.name || 'Subject'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                            {item.department} Sem {item.semester} {item.section !== 'All' ? `(${item.section})` : ''}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              item.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : item.status === 'draft'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Max Marks: <strong className="text-slate-800">{item.maximumMarks}</strong>
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mt-2 tracking-tight">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>

                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} className="text-slate-400" />
                            Due: <strong className={isOverdue ? 'text-rose-600' : 'text-slate-700'}>{formatDateIST(item.dueDate)}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers size={14} className="text-slate-400" />
                            Late Policy: <span className="capitalize">{item.latePolicy}</span>
                          </span>
                          {item.attachments?.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              <FileText size={14} />
                              {item.attachments.length} file{item.attachments.length > 1 ? 's' : ''} attached
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                        {item.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handlePublishAssignment(item._id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            Publish
                          </button>
                        )}
                        {item.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => handleCloseAssignment(item._id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                          >
                            Close
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openSubmissionsModal(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Eye size={14} />
                          Submissions & Evaluation
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CREATE ASSIGNMENT MODAL ── */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="text-blue-600" size={20} />
                    Create New Coursework Assignment
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateAssignment} className="p-6 overflow-y-auto space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assignment Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lab 4: B-Tree Index Implementation"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Subject *
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => {
                        const sel = taughtSubjects.find((s) => s._id === e.target.value);
                        setFormData({
                          ...formData,
                          subject: e.target.value,
                          department: sel?.branch || formData.department,
                          semester: sel?.semester || formData.semester,
                        });
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {taughtSubjects.map((sub) => (
                        <option key={sub._id} value={sub._id}>
                          {sub.code} — {sub.name} ({sub.branch || 'CSE'}, Sem {sub.semester})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Instructions & Problem Statement *
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Specify requirements, submission expectations, and grading criteria..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={formData.semester}
                        onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                      <input
                        type="text"
                        placeholder="All or A/B"
                        value={formData.section}
                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Max Marks *</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={formData.maximumMarks}
                        onChange={(e) => setFormData({ ...formData, maximumMarks: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                      <select
                        value={formData.assignmentType}
                        onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="homework">Homework</option>
                        <option value="project">Project</option>
                        <option value="lab_report">Lab Report</option>
                        <option value="quiz_takehome">Take-home Quiz</option>
                        <option value="case_study">Case Study</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date & Time *</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Late Policy</label>
                      <select
                        value={formData.latePolicy}
                        onChange={(e) => setFormData({ ...formData, latePolicy: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="allowed">Allowed (Marked Late)</option>
                        <option value="none">Strict (No Late Submissions)</option>
                        <option value="grace_period">Grace Period Only</option>
                      </select>
                    </div>
                    {formData.latePolicy === 'grace_period' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Grace Period (Minutes)</label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.gracePeriodMinutes}
                          onChange={(e) => setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) })}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Attachment uploads */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reference Material Attachments (PDF, DOCX, ZIP, Max 5 files, 25MB each)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setAttachmentFiles(Array.from(e.target.files))}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status"
                        value="published"
                        checked={formData.status === 'published'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Publish immediately
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status"
                        value="draft"
                        checked={formData.status === 'draft'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Save as Draft
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Create Assignment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── SUBMISSIONS & EVALUATION MODAL ── */}
          {submissionsModal && selectedAssignment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Users className="text-blue-600" size={20} />
                      Student Submissions — {selectedAssignment.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Max Marks: {selectedAssignment.maximumMarks} • Due: {formatDateIST(selectedAssignment.dueDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmissionsModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {submissionsLoading ? (
                    <div className="p-12 text-center text-slate-400">Loading student submissions...</div>
                  ) : submissionsList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                      No student submissions received yet.
                    </div>
                  ) : (
                    submissionsList.map((sub) => {
                      const isGradingThis = evaluatingSubmissionId === sub._id;
                      return (
                        <div
                          key={sub._id}
                          className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {sub.student?.user?.name || 'Student'}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  ({sub.student?.rollNo || 'Roll N/A'})
                                </span>
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">
                                  v{sub.version}
                                </span>
                                {sub.isLate ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-700">
                                    Late Submission
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                                    On-Time
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Submitted on: {formatDateIST(sub.submittedAt)}
                              </div>
                            </div>

                            {/* Marks & Status summary */}
                            <div className="flex items-center gap-2">
                              {sub.marksAwarded !== null ? (
                                <div className="text-right">
                                  <span className="text-sm font-bold text-slate-900">
                                    {sub.marksAwarded} / {selectedAssignment.maximumMarks}
                                  </span>
                                  <div className="text-[11px] font-semibold text-slate-500">
                                    {sub.isResultPublished ? (
                                      <span className="text-emerald-600 flex items-center gap-1 justify-end">
                                        <CheckCheck size={12} /> Published
                                      </span>
                                    ) : (
                                      <span className="text-amber-600">Draft (Unpublished)</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending Evaluation
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Student Text Note */}
                          {sub.textResponse && (
                            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                              <span className="font-semibold text-slate-900 block mb-0.5">Student Remarks:</span>
                              {sub.textResponse}
                            </div>
                          )}

                          {/* Submitted files list */}
                          {sub.submissionFiles?.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {sub.submissionFiles.map((file) => (
                                <button
                                  key={file._id}
                                  type="button"
                                  onClick={() => handleDownloadSubmissionFile(sub._id, file)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                                >
                                  <Download size={12} /> {file.name}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Evaluation / Feedback Form */}
                          {isGradingThis ? (
                            <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                              <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-800">
                                  Marks (Max {selectedAssignment.maximumMarks}):
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedAssignment.maximumMarks}
                                  value={evalMarks}
                                  onChange={(e) => setEvalMarks(e.target.value)}
                                  className="w-24 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1">
                                  Faculty Feedback & Evaluation Notes:
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Provide constructive academic feedback to the student..."
                                  value={evalFeedback}
                                  onChange={(e) => setEvalFeedback(e.target.value)}
                                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEvaluatingSubmissionId(null)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingEvaluation}
                                  onClick={() => handleSaveEvaluation(sub._id)}
                                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                                >
                                  {savingEvaluation ? 'Saving...' : 'Save Evaluation'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                              <div className="text-xs text-slate-600">
                                {sub.feedback && (
                                  <div>
                                    <span className="font-semibold text-slate-800">Feedback: </span>
                                    {sub.feedback}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startGrading(sub)}
                                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                >
                                  {sub.marksAwarded !== null ? 'Re-grade' : 'Grade Submission'}
                                </button>

                                {sub.marksAwarded !== null && !sub.isResultPublished && (
                                  <button
                                    type="button"
                                    onClick={() => handlePublishResult(sub._id)}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                  >
                                    Publish Result
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FacultyAssignments;

