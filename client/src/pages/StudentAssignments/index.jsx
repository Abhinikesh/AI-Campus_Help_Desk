/**
 * client/src/pages/StudentAssignments/index.jsx
 * Student coursework dashboard: view assignments, submit files, track versioned submissions & view grades.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useToast } from '../../context/ToastContext';
import assignmentService from '../../services/assignment.service';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  Download,
  FileText,
  Award,
  Search,
  Filter,
  X,
  Send,
  Eye,
  CheckCheck,
  History,
  FileCheck,
} from 'lucide-react';

const StudentAssignments = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, submitted, evaluated
  const [searchQuery, setSearchQuery] = useState('');

  // Submission Drawer / Modal state
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentDetail, setAssignmentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Form submission state
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [studentText, setStudentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await assignmentService.getStudentAssignments({
        filter: filter === 'all' ? undefined : filter,
        search: searchQuery || undefined,
      });
      if (res.success) {
        setAssignments(res.data);
      }
    } catch (err) {
      console.error('Failed to load assignments', err);
      if (showToast) showToast('Failed to load assignments', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery, showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const openSubmitDrawer = async (item) => {
    setSelectedAssignment(item);
    setShowSubmitModal(true);
    setSubmissionFiles([]);
    setStudentText('');
    setDetailLoading(true);

    try {
      const res = await assignmentService.getStudentAssignmentDetails(item._id);
      if (res.success) {
        setAssignmentDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to load assignment details', err);
      if (showToast) showToast('Failed to load assignment details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (submissionFiles.length === 0 && !studentText.trim()) {
      if (showToast) showToast('Please attach at least one file or enter text remarks', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      if (studentText.trim()) {
        formData.append('textResponse', studentText.trim());
      }
      for (let i = 0; i < submissionFiles.length; i++) {
        formData.append('files', submissionFiles[i]);
      }

      const res = await assignmentService.submitAssignment(selectedAssignment._id, formData);
      if (res.success) {
        if (showToast) {
          showToast(
            res.data.isLate
              ? 'Assignment submitted (Recorded as Late)'
              : 'Assignment submitted successfully!',
            'success'
          );
        }
        setShowSubmitModal(false);
        fetchAssignments();
      }
    } catch (err) {
      console.error('Submission failed', err);
      const msg = err.response?.data?.message || 'Failed to submit assignment';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAttachment = async (assignmentId, attachment) => {
    try {
      await assignmentService.downloadAttachment(assignmentId, attachment._id, attachment.name);
    } catch (err) {
      if (showToast) showToast('Failed to download file', 'error');
    }
  };

  const handleDownloadSubmissionFile = async (submissionId, file) => {
    try {
      await assignmentService.downloadSubmissionFile(submissionId, file._id, file.name);
    } catch (err) {
      if (showToast) showToast('Failed to download submission file', 'error');
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

  // Metrics computation
  const totalCount = assignments.length;
  const pendingCount = assignments.filter((a) => !a.submission).length;
  const submittedCount = assignments.filter((a) => a.submission && !a.submission.isResultPublished).length;
  const evaluatedCount = assignments.filter((a) => a.submission?.isResultPublished).length;

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
                My Assignments & Coursework
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                View coursework requirements, download instructions, upload submissions with revision history, and view grades.
              </p>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Assignments</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Submissions</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Upload size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{submittedCount}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Submitted / Reviewing</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Award size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{evaluatedCount}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Graded & Published</div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              {[
                { id: 'all', label: 'All Tasks' },
                { id: 'pending', label: 'Pending' },
                { id: 'submitted', label: 'Submitted' },
                { id: 'evaluated', label: 'Graded' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filter === tab.id
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
                placeholder="Search coursework..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Assignment Cards */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 text-slate-500">
              <BookOpen className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-semibold text-slate-700">No assignments found</p>
              <p className="text-xs text-slate-400 mt-1">You are all caught up with your coursework!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assignments.map((item) => {
                const isOverdue = new Date(item.dueDate) < new Date();
                const sub = item.submission;
                const isEvaluated = sub?.isResultPublished;

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
                          <span className="text-xs text-slate-500 font-medium">
                            Faculty: {item.faculty?.name || 'Faculty Instructor'}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            Max: <strong className="text-slate-800">{item.maximumMarks} pts</strong>
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mt-2 tracking-tight">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>

                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} className="text-slate-400" />
                            Due: <strong className={isOverdue ? 'text-rose-600' : 'text-slate-700'}>{formatDateIST(item.dueDate)}</strong>
                          </span>
                          <span className="capitalize">
                            Policy: {item.latePolicy === 'allowed' ? 'Late Submissions Allowed' : item.latePolicy === 'none' ? 'Strict Deadline' : 'Grace Period Allowed'}
                          </span>
                          {item.attachments?.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              <FileText size={14} />
                              {item.attachments.length} reference file{item.attachments.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status & CTA */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-end lg:self-center">
                        <div>
                          {isEvaluated ? (
                            <div className="text-right">
                              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Score: {sub.marksAwarded} / {item.maximumMarks}
                              </span>
                            </div>
                          ) : sub ? (
                            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Submitted v{sub.version} {sub.isLate ? '(Late)' : ''}
                            </span>
                          ) : (
                            <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${isOverdue ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {isOverdue ? 'Overdue' : 'Pending Submission'}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openSubmitDrawer(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
                        >
                          {sub ? 'View / Resubmit' : 'View & Submit'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SUBMISSION DRAWER / MODAL ── */}
          {showSubmitModal && selectedAssignment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="text-blue-600" size={20} />
                      {selectedAssignment.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedAssignment.subject?.code} • Due: {formatDateIST(selectedAssignment.dueDate)} • Max {selectedAssignment.maximumMarks} Marks
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  {detailLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading coursework instructions...</div>
                  ) : (
                    <>
                      {/* Instructions */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Instructions & Problem Description
                        </h4>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {assignmentDetail?.assignment?.description || selectedAssignment.description}
                        </div>
                      </div>

                      {/* Reference Attachments from Faculty */}
                      {selectedAssignment.attachments?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Faculty Reference Materials
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedAssignment.attachments.map((att) => (
                              <button
                                key={att._id}
                                type="button"
                                onClick={() => handleDownloadAttachment(selectedAssignment._id, att)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors"
                              >
                                <Download size={14} /> {att.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Current Submission & Grade Banner */}
                      {assignmentDetail?.submission && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <FileCheck className="text-emerald-600" size={16} />
                              Your Submission (Version {assignmentDetail.submission.version})
                            </span>
                            <span className="text-xs text-slate-400">
                              Submitted: {formatDateIST(assignmentDetail.submission.submittedAt)}
                            </span>
                          </div>

                          {/* Evaluated Marks */}
                          {assignmentDetail.submission.isResultPublished && (
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-800">Evaluated Score:</span>
                                <span className="text-sm font-extrabold text-emerald-900">
                                  {assignmentDetail.submission.marksAwarded} / {selectedAssignment.maximumMarks}
                                </span>
                              </div>
                              {assignmentDetail.submission.feedback && (
                                <p className="text-xs text-emerald-700 mt-1">
                                  <strong>Faculty Feedback:</strong> {assignmentDetail.submission.feedback}
                                </p>
                              )}
                            </div>
                          )}

                          {assignmentDetail.submission.textResponse && (
                            <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                              <strong>Remarks:</strong> {assignmentDetail.submission.textResponse}
                            </p>
                          )}

                          {assignmentDetail.submission.submissionFiles?.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {assignmentDetail.submission.submissionFiles.map((f) => (
                                <button
                                  key={f._id}
                                  type="button"
                                  onClick={() => handleDownloadSubmissionFile(assignmentDetail.submission._id, f)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                                >
                                  <Download size={12} /> {f.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Upload Form */}
                      <form onSubmit={handleSubmitAssignment} className="space-y-4 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {assignmentDetail?.submission ? 'Upload New Revision' : 'Upload Submission Work'}
                        </h4>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Attach Work Files (PDF, DOCX, ZIP, JPG, PNG - Max 5 files, 25MB each)
                          </label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => setSubmissionFiles(Array.from(e.target.files))}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Notes / Answers / Commentary
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Add any remarks or written answer text..."
                            value={studentText}
                            onChange={(e) => setStudentText(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowSubmitModal(false)}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                          >
                            {isSubmitting
                              ? 'Uploading...'
                              : assignmentDetail?.submission
                              ? 'Submit New Version'
                              : 'Submit Coursework'}
                          </button>
                        </div>
                      </form>
                    </>
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

export default StudentAssignments;

