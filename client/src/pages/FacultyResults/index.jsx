/**
 * client/src/pages/FacultyResults/index.jsx
 * Comprehensive Examination Management, Roster Marks Entry, Review & Publication Hub.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import examService from '../../services/exam.service';
import assignmentService from '../../services/assignment.service';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Plus,
  Save,
  Send,
  CheckCheck,
  Edit,
  X,
  Search,
  Users,
  Award,
  Layers,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const FacultyResults = () => {
  const { user } = useAuth();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [marksState, setMarksState] = useState({}); // { [studentId]: { marksObtained, isAbsent, feedback } }
  const [isSaving, setIsSaving] = useState(false);
  const [searchRoster, setSearchRoster] = useState('');

  // Schedule Exam Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [taughtSubjects, setTaughtSubjects] = useState([]);
  const [examForm, setExamForm] = useState({
    title: '',
    examinationType: 'mid_semester',
    academicYear: '2026-2027',
    department: 'CSE',
    semester: 4,
    section: 'All',
    subject: '',
    date: '',
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    durationMinutes: 180,
    maximumMarks: 100,
    passingMarks: 40,
    room: 'Hall 101',
    venue: 'Main Campus Examination Hall',
    instructions: 'Bring your student identity card and examination pass.',
  });

  // Correction Modal
  const [correctionModal, setCorrectionModal] = useState(null); // { markId, studentName, currentMarks, currentAbsent }
  const [correctionMarks, setCorrectionMarks] = useState('');
  const [correctionAbsent, setCorrectionAbsent] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const fetchExamsList = useCallback(async () => {
    try {
      setLoading(true);
      const [examsRes, subjectsRes] = await Promise.all([
        examService.getFacultyExams(),
        assignmentService.getFacultyTaughtSubjects(),
      ]);

      if (examsRes.success) {
        setExams(examsRes.data);
        if (examsRes.data.length > 0 && !selectedExamId) {
          setSelectedExamId(examsRes.data[0]._id);
        }
      }
      if (subjectsRes.success && subjectsRes.data.length > 0) {
        setTaughtSubjects(subjectsRes.data);
        if (!examForm.subject) {
          setExamForm((prev) => ({
            ...prev,
            subject: subjectsRes.data[0]._id,
            department: subjectsRes.data[0].branch || 'CSE',
            semester: subjectsRes.data[0].semester || 4,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load examinations:', err);
      if (showToast) showToast('Failed to load examinations', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedExamId, examForm.subject, showToast]);

  useEffect(() => {
    fetchExamsList();
  }, [fetchExamsList]);

  // Load roster whenever selectedExamId changes
  const loadRoster = useCallback(async (examId) => {
    if (!examId) return;
    try {
      setRosterLoading(true);
      const res = await examService.getExamRoster(examId);
      if (res.success) {
        setRosterData(res.data);
        // Initialize marksState from existing marks
        const state = {};
        res.data.roster.forEach((item) => {
          state[item.studentId] = {
            marksObtained: item.marks?.marksObtained !== null && item.marks?.marksObtained !== undefined
              ? String(item.marks.marksObtained)
              : '',
            isAbsent: Boolean(item.marks?.isAbsent),
            feedback: item.marks?.feedback || '',
            markId: item.marks?.markId || null,
          };
        });
        setMarksState(state);
      }
    } catch (err) {
      console.error('Failed to load exam roster:', err);
      if (showToast) showToast('Failed to load exam roster', 'error');
    } finally {
      setRosterLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedExamId) {
      loadRoster(selectedExamId);
    }
  }, [selectedExamId, loadRoster]);

  const handleMarkChange = (studentId, field, value) => {
    setMarksState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examForm.title.trim()) {
      if (showToast) showToast('Exam title is required', 'error');
      return;
    }
    if (!examForm.subject) {
      if (showToast) showToast('Please select a subject', 'error');
      return;
    }
    if (!examForm.date) {
      if (showToast) showToast('Examination date is required', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const res = await examService.createExam(examForm);
      if (res.success) {
        if (showToast) showToast('Examination scheduled successfully!', 'success');
        setShowScheduleModal(false);
        fetchExamsList();
        setSelectedExamId(res.data._id);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to schedule exam';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedExamId || !rosterData) return;
    const max = rosterData.exam?.maximumMarks || 100;

    const payloadMarks = [];
    for (const st of rosterData.roster) {
      const entry = marksState[st.studentId];
      if (!entry) continue;

      if (!entry.isAbsent && entry.marksObtained !== '') {
        const val = Number(entry.marksObtained);
        if (isNaN(val) || val < 0 || val > max) {
          if (showToast) {
            showToast(`Marks for ${st.fullName} must be between 0 and ${max}`, 'error');
          }
          return;
        }
      }

      payloadMarks.push({
        student: st.studentId,
        marksObtained: entry.isAbsent ? null : (entry.marksObtained !== '' ? Number(entry.marksObtained) : null),
        isAbsent: entry.isAbsent,
        feedback: entry.feedback || '',
      });
    }

    try {
      setIsSaving(true);
      const res = await examService.saveDraftMarks(selectedExamId, { marks: payloadMarks });
      if (res.success) {
        if (showToast) showToast(res.message || 'Draft marks saved successfully', 'success');
        loadRoster(selectedExamId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save draft marks';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedExamId) return;
    try {
      setIsSaving(true);
      await handleSaveDraft();
      const res = await examService.submitMarksForReview(selectedExamId);
      if (res.success) {
        if (showToast) showToast('Marks submitted for administrative review!', 'success');
        fetchExamsList();
        loadRoster(selectedExamId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit marks for review';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedExamId) return;
    try {
      setIsSaving(true);
      const res = await examService.reviewAndApproveMarks(selectedExamId);
      if (res.success) {
        if (showToast) showToast('Examination marks approved!', 'success');
        fetchExamsList();
        loadRoster(selectedExamId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Approval failed';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishResults = async () => {
    if (!selectedExamId) return;
    try {
      setIsSaving(true);
      const res = await examService.publishExamResults(selectedExamId);
      if (res.success) {
        if (showToast) showToast('Results published to student portal!', 'success');
        fetchExamsList();
        loadRoster(selectedExamId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Publication failed';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openCorrection = (st) => {
    const entry = marksState[st.studentId];
    setCorrectionModal({
      markId: entry?.markId,
      studentName: st.fullName,
      studentId: st.studentId,
      currentMarks: entry?.marksObtained || '',
      currentAbsent: entry?.isAbsent || false,
    });
    setCorrectionMarks(entry?.marksObtained || '');
    setCorrectionAbsent(entry?.isAbsent || false);
    setCorrectionReason('');
  };

  const handleSaveCorrection = async () => {
    if (!correctionModal?.markId) {
      if (showToast) showToast('Cannot correct: Mark record is missing', 'error');
      return;
    }
    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      if (showToast) showToast('Mandatory reason (min 5 chars) is required', 'error');
      return;
    }

    try {
      setIsCorrecting(true);
      const res = await examService.correctPublishedMark(correctionModal.markId, {
        newMarks: correctionAbsent ? null : Number(correctionMarks),
        newIsAbsent: correctionAbsent,
        reason: correctionReason.trim(),
      });
      if (res.success) {
        if (showToast) showToast('Mark corrected and student notified!', 'success');
        setCorrectionModal(null);
        loadRoster(selectedExamId);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Correction failed';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsCorrecting(false);
    }
  };

  const selectedExam = exams.find((e) => e._id === selectedExamId);

  // Metrics
  const totalExams = exams.length;
  const pendingEvaluation = exams.filter((e) => e.evaluationStatus === 'marks_pending').length;
  const inReview = exams.filter((e) => e.evaluationStatus === 'submitted_for_review').length;
  const publishedExams = exams.filter((e) => e.evaluationStatus === 'published').length;

  const filteredRoster = rosterData?.roster?.filter((st) =>
    searchRoster
      ? st.fullName?.toLowerCase().includes(searchRoster.toLowerCase()) ||
        st.rollNumber?.toLowerCase().includes(searchRoster.toLowerCase())
      : true
  ) || [];

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
                <GraduationCap className="text-blue-600" size={28} />
                Examination Management & Marks Entry Hub
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure exam schedules, enter student marks on roster, review grades, and publish official results.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <Plus size={18} /> Schedule Examination
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Calendar size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalExams}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Scheduled Exams</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{pendingEvaluation}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Marks Pending</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{inReview}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Review</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{publishedExams}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Results</div>
              </div>
            </div>
          </div>

          {/* Exam Selection & Toolbar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex-1 w-full md:w-auto flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Select Examination:
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full md:w-96 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {exams.map((ex) => (
                  <option key={ex._id} value={ex._id}>
                    {ex.title} ({ex.subject?.code} - {ex.department} Sem {ex.semester})
                  </option>
                ))}
              </select>
            </div>

            {selectedExam && (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    selectedExam.evaluationStatus === 'published'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : selectedExam.evaluationStatus === 'approved'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : selectedExam.evaluationStatus === 'submitted_for_review'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  Status: {selectedExam.evaluationStatus.replace(/_/g, ' ')}
                </span>

                {selectedExam.evaluationStatus !== 'published' && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Save size={14} /> Save Draft
                  </button>
                )}

                {['marks_pending', 'correction_requested'].includes(selectedExam.evaluationStatus) && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSubmitForReview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                  >
                    <Send size={14} /> Submit for Review
                  </button>
                )}

                {user?.role === 'admin' && selectedExam.evaluationStatus === 'submitted_for_review' && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleApprove}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                  >
                    <CheckCircle size={14} /> Approve Marks
                  </button>
                )}

                {(user?.role === 'admin' || selectedExam.evaluationStatus === 'approved') &&
                  selectedExam.evaluationStatus !== 'published' && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handlePublishResults}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                    >
                      <CheckCheck size={14} /> Publish Results
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* Student Roster Marks Entry Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedExam?.title || 'Examination Roster'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Max Marks: <strong>{selectedExam?.maximumMarks || 100}</strong> • Passing: <strong>{selectedExam?.passingMarks || 40}</strong> • Total Enrolled: <strong>{rosterData?.roster?.length || 0}</strong>
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Filter student or roll no..."
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {rosterLoading ? (
              <div className="p-12 text-center text-slate-400">Loading student roster and marks...</div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No students found matching current filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Roll No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3 text-center">Absent?</th>
                      <th className="px-4 py-3 text-center">Marks Obtained (Max {selectedExam?.maximumMarks || 100})</th>
                      <th className="px-4 py-3 text-center">Percentage</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoster.map((st) => {
                      const entry = marksState[st.studentId] || { marksObtained: '', isAbsent: false };
                      const max = selectedExam?.maximumMarks || 100;
                      const passing = selectedExam?.passingMarks || 40;
                      const numVal = entry.marksObtained !== '' ? Number(entry.marksObtained) : null;
                      const isOver = numVal !== null && (numVal < 0 || numVal > max);
                      const pct = numVal !== null && max > 0 ? ((numVal / max) * 100).toFixed(1) : null;
                      const isPublished = selectedExam?.evaluationStatus === 'published';

                      return (
                        <tr key={st.studentId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-xs text-slate-800">
                            {st.rollNumber}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {st.fullName}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {st.branch} Sem {st.semester} ({st.section})
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={entry.isAbsent}
                              disabled={isPublished}
                              onChange={(e) => handleMarkChange(st.studentId, 'isAbsent', e.target.checked)}
                              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.isAbsent ? (
                              <span className="text-xs font-bold text-rose-600 px-2.5 py-1 rounded bg-rose-50 border border-rose-200">
                                ABSENT
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={max}
                                disabled={isPublished}
                                value={entry.marksObtained}
                                onChange={(e) => handleMarkChange(st.studentId, 'marksObtained', e.target.value)}
                                placeholder="0"
                                className={`w-24 text-center px-2 py-1 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 ${
                                  isOver
                                    ? 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-200'
                                    : 'border-slate-300 bg-white text-slate-900 focus:ring-blue-200'
                                }`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-bold text-slate-700">
                            {entry.isAbsent ? '—' : pct ? `${pct}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.isAbsent ? (
                              <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-rose-100 text-rose-700">F</span>
                            ) : pct ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                                Number(pct) >= 80 ? 'bg-emerald-100 text-emerald-800' : Number(pct) >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {Number(pct) >= 90 ? 'O' : Number(pct) >= 80 ? 'A+' : Number(pct) >= 70 ? 'A' : Number(pct) >= 60 ? 'B+' : Number(pct) >= 50 ? 'B' : Number(pct) >= 40 ? 'C' : 'F'}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.isAbsent ? (
                              <span className="text-xs font-semibold text-rose-600">Absent</span>
                            ) : numVal !== null ? (
                              numVal >= passing ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                                  <CheckCircle size={13} /> Pass
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-rose-600 flex items-center justify-center gap-1">
                                  <AlertTriangle size={13} /> Fail
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPublished && (
                              <button
                                type="button"
                                onClick={() => openCorrection(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                              >
                                <Edit size={12} /> Correct
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SCHEDULE EXAMINATION MODAL ── */}
          {showScheduleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="text-blue-600" size={20} />
                    Schedule New Examination
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateExam} className="p-6 overflow-y-auto space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Examination Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mid-Semester Examination Spring 2026"
                      value={examForm.title}
                      onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assigned Subject *
                      </label>
                      <select
                        required
                        value={examForm.subject}
                        onChange={(e) => {
                          const sub = taughtSubjects.find((s) => s._id === e.target.value);
                          setExamForm({
                            ...examForm,
                            subject: e.target.value,
                            department: sub?.branch || examForm.department,
                            semester: sub?.semester || examForm.semester,
                          });
                        }}
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        Examination Type
                      </label>
                      <select
                        value={examForm.examinationType}
                        onChange={(e) => setExamForm({ ...examForm, examinationType: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="mid_semester">Mid-Semester Examination</option>
                        <option value="end_semester">End-Semester Examination</option>
                        <option value="internal_assessment">Internal Assessment</option>
                        <option value="practical">Practical / Lab Examination</option>
                        <option value="quiz">Class Quiz / Assessment</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={examForm.date}
                        onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time *</label>
                      <input
                        type="text"
                        placeholder="10:00 AM"
                        value={examForm.startTime}
                        onChange={(e) => setExamForm({ ...examForm, startTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">End Time *</label>
                      <input
                        type="text"
                        placeholder="01:00 PM"
                        value={examForm.endTime}
                        onChange={(e) => setExamForm({ ...examForm, endTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Maximum Marks *</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={examForm.maximumMarks}
                        onChange={(e) => setExamForm({ ...examForm, maximumMarks: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Marks *</label>
                      <input
                        type="number"
                        min="0"
                        max={examForm.maximumMarks}
                        value={examForm.passingMarks}
                        onChange={(e) => setExamForm({ ...examForm, passingMarks: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Venue / Room</label>
                      <input
                        type="text"
                        placeholder="Hall 101"
                        value={examForm.room}
                        onChange={(e) => setExamForm({ ...examForm, room: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Instructions</label>
                    <textarea
                      rows={2}
                      value={examForm.instructions}
                      onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? 'Scheduling...' : 'Schedule Exam'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── AUDITED CORRECTION MODAL ── */}
          {correctionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Edit className="text-amber-600" size={18} />
                    Audited Grade Correction
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCorrectionModal(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="text-xs text-slate-600 mb-4 space-y-1">
                  <div>Student: <strong>{correctionModal.studentName}</strong></div>
                  <div>Current Score: <strong>{correctionModal.currentAbsent ? 'Absent' : correctionModal.currentMarks}</strong></div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={correctionAbsent}
                      onChange={(e) => setCorrectionAbsent(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    Mark as Absent
                  </label>

                  {!correctionAbsent && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        New Marks (Max {selectedExam?.maximumMarks || 100}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={selectedExam?.maximumMarks || 100}
                        value={correctionMarks}
                        onChange={(e) => setCorrectionMarks(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mandatory Correction Reason (Audited) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Recount verified after re-evaluation of question 3b."
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 mt-5">
                  <button
                    type="button"
                    onClick={() => setCorrectionModal(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isCorrecting}
                    onClick={handleSaveCorrection}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {isCorrecting ? 'Recording...' : 'Record Correction & Republish'}
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

export default FacultyResults;
