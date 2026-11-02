/**
 * client/src/pages/FacultyHR/index.jsx
 * Faculty and Employee HR Self-Service Portal: Profile, Leave Requisitions,
 * Daily Attendance Check-in, Documents, and HR Announcements.
 */
import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  Clock,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Building,
  Briefcase,
  Bell,
  Check
} from 'lucide-react';
import hrService from '../../services/hr.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const FacultyHR = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaves');

  // State
  const [profile, setProfile] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [policies, setPolicies] = useState([]);

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Forms
  const [leaveForm, setLeaveForm] = useState({
    policy: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayType: 'first_half',
    reason: '',
    contactDuringLeave: ''
  });

  const [docForm, setDocForm] = useState({
    documentType: 'qualification',
    title: '',
    file: null,
    notes: ''
  });

  const fetchSelfServiceData = async () => {
    try {
      setLoading(true);
      const [pRes, bRes, aRes, polRes, annRes] = await Promise.all([
        hrService.getMyProfile(),
        hrService.getMyLeaveBalances(),
        hrService.getMyLeaveApplications(),
        hrService.getLeavePolicies(),
        hrService.getAnnouncements()
      ]);

      if (pRes.success) {
        setProfile(pRes.data);
        // Load documents for this profile
        const dRes = await hrService.getEmployeeDocuments(pRes.data._id);
        if (dRes.success) setDocuments(dRes.data);
      }
      if (bRes.success) setLeaveBalances(bRes.data);
      if (aRes.success) setLeaveApplications(aRes.data);
      if (polRes.success) setPolicies(polRes.data);
      if (annRes.success) setAnnouncements(annRes.data);

      const attRes = await hrService.getMyAttendance();
      if (attRes.success) setAttendanceRecords(attRes.data);
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfServiceData();
  }, []);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.applyForLeave(leaveForm);
      if (res.success) {
        showToast(`Leave application ${res.data.applicationNumber} submitted successfully!`, 'success');
        setShowApplyModal(false);
        setLeaveForm({
          policy: '',
          startDate: '',
          endDate: '',
          isHalfDay: false,
          halfDayType: 'first_half',
          reason: '',
          contactDuringLeave: ''
        });
        const aRes = await hrService.getMyLeaveApplications();
        if (aRes.success) setLeaveApplications(aRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) return;
    try {
      const res = await hrService.cancelLeaveApplication(id);
      if (res.success) {
        showToast('Leave application cancelled', 'success');
        const aRes = await hrService.getMyLeaveApplications();
        if (aRes.success) setLeaveApplications(aRes.data);
        const bRes = await hrService.getMyLeaveBalances();
        if (bRes.success) setLeaveBalances(bRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCheckIn = async () => {
    try {
      const res = await hrService.checkIn();
      if (res.success) {
        showToast('Daily check-in recorded successfully!', 'success');
        const attRes = await hrService.getMyAttendance();
        if (attRes.success) setAttendanceRecords(attRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCheckOut = async () => {
    try {
      const res = await hrService.checkOut();
      if (res.success) {
        showToast('Daily check-out recorded successfully!', 'success');
        const attRes = await hrService.getMyAttendance();
        if (attRes.success) setAttendanceRecords(attRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!profile || !docForm.file) return;

    try {
      const formData = new FormData();
      formData.append('employeeId', profile._id);
      formData.append('documentType', docForm.documentType);
      formData.append('title', docForm.title);
      formData.append('file', docForm.file);
      formData.append('notes', docForm.notes);

      const res = await hrService.uploadDocument(formData);
      if (res.success) {
        showToast('Document uploaded successfully!', 'success');
        setShowUploadModal(false);
        setDocForm({ documentType: 'qualification', title: '', file: null, notes: '' });
        const dRes = await hrService.getEmployeeDocuments(profile._id);
        if (dRes.success) setDocuments(dRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAcknowledgeAnnouncement = async (id) => {
    try {
      const res = await hrService.acknowledgeAnnouncement(id);
      if (res.success) {
        showToast('Announcement acknowledged', 'success');
        const annRes = await hrService.getAnnouncements();
        if (annRes.success) setAnnouncements(annRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  // Determine today's attendance state
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords.find(
    (a) => new Date(a.date).toISOString().split('T')[0] === todayStr
  );

  return (
    <div className="cs-portal-shell overflow-hidden font-sans">
      <Sidebar />
      <div className="cs-portal-main overflow-hidden">
        
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Employee Header Profile Card */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl shadow-inner">
                {profile ? `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}` : <User className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {profile ? `${profile.firstName} ${profile.lastName}` : user?.name || 'Employee Portal'}
                  <span className="px-2 py-0.5 text-xs rounded font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    {profile?.employmentStatus || 'Active'}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                  <span>ID: <strong className="text-slate-700 dark:text-slate-300">{profile?.employeeId || 'EMP-XXXX'}</strong></span>
                  <span>•</span>
                  <span>{profile?.designation?.title || 'Faculty / Staff'}</span>
                  <span>•</span>
                  <span>{profile?.department?.name || 'Department'}</span>
                </p>
              </div>
            </div>

            {/* Attendance Check-in Action */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-750 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <Clock className="w-5 h-5 text-indigo-500" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Today: {todayRecord ? todayRecord.status?.toUpperCase() : 'Not Checked In'}
                </div>
                <div className="text-slate-400">
                  {todayRecord?.checkIn
                    ? `In: ${new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Check-in before grace period'}
                </div>
              </div>

              {!todayRecord?.checkIn ? (
                <button
                  onClick={handleCheckIn}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Check In
                </button>
              ) : !todayRecord?.checkOut ? (
                <button
                  onClick={handleCheckOut}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Check Out
                </button>
              ) : (
                <span className="px-2 py-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6">
            {[
              { id: 'leaves', label: 'My Leave Balances & Requests', icon: Calendar },
              { id: 'attendance', label: 'My Attendance Logs', icon: Clock },
              { id: 'documents', label: 'My Documents', icon: FileText },
              { id: 'announcements', label: 'HR Circulars', icon: Bell }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: LEAVES */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              {/* Leave Balances Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {leaveBalances.map((b) => (
                  <div
                    key={b._id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {b.policy?.name || 'Leave Quota'}
                      </span>
                      <span className="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                        {b.policy?.code}
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {b.currentBalance}
                      </span>
                      <span className="text-xs text-slate-400">/ {b.openingBalance} days left</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Used: <strong className="text-slate-600 dark:text-slate-300">{b.used}</strong> days
                    </div>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 dark:text-white">My Leave Applications</h3>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Apply for Leave
                </button>
              </div>

              {/* Leave Applications Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-medium">Application #</th>
                      <th className="p-3 font-medium">Leave Policy</th>
                      <th className="p-3 font-medium">Dates</th>
                      <th className="p-3 font-medium">Duration</th>
                      <th className="p-3 font-medium">Reason</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {leaveApplications.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No leave applications recorded
                        </td>
                      </tr>
                    ) : (
                      leaveApplications.map((app) => (
                        <tr key={app._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="p-3 font-mono text-xs">{app.applicationNumber}</td>
                          <td className="p-3 font-medium">{app.policy?.name || 'Leave'}</td>
                          <td className="p-3 text-xs">
                            {new Date(app.startDate).toLocaleDateString()} to{' '}
                            {new Date(app.endDate).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-semibold">
                            {app.totalDays} day(s) {app.isHalfDay && '(Half Day)'}
                          </td>
                          <td className="p-3 text-xs text-slate-500 max-w-xs truncate">{app.reason}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded font-medium ${
                                app.status === 'approved'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : app.status === 'pending'
                                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {app.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {app.status === 'pending' && (
                              <button
                                onClick={() => handleCancelLeave(app._id)}
                                className="px-2 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded font-medium"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Attendance Records</h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Check-In</th>
                      <th className="p-3 font-medium">Check-Out</th>
                      <th className="p-3 font-medium">Working Hours</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-400">
                          No attendance records found
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((att) => (
                        <tr key={att._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="p-3 font-medium">{new Date(att.date).toLocaleDateString()}</td>
                          <td className="p-3 text-xs">
                            {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 text-xs">
                            {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 font-mono text-xs">{att.workingHours || 0} hrs</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded font-medium ${
                                att.status === 'present'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : att.status === 'late'
                                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : att.status === 'on_leave'
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {att.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-400">{att.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">Official employment documents, identity proofs, and credentials.</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Document
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {documents.length === 0 ? (
                  <div className="col-span-3 p-6 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-xl border">
                    No documents uploaded yet
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">{doc.title}</span>
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                            doc.isVerified
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'
                          }`}
                        >
                          {doc.isVerified ? 'Verified' : 'Pending Verification'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 capitalize">{doc.documentType?.replace(/_/g, ' ')}</p>
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                        <a
                          href={hrService.downloadDocumentUrl(doc._id)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
                          download
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((ann) => {
                  const isAcked = ann.acknowledgedBy?.some((a) => a.user?.toString() === user?.id?.toString());
                  return (
                    <div
                      key={ann._id}
                      className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-slate-900 dark:text-white">{ann.title}</h4>
                        <span
                          className={`px-2 py-0.5 text-xs rounded font-medium uppercase ${
                            ann.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          }`}
                        >
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line">{ann.content}</p>
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                        <span className="text-slate-400">{new Date(ann.publishDate).toLocaleDateString()}</span>
                        {isAcked ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-medium">
                            <Check className="w-3.5 h-3.5" /> Acknowledged
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledgeAnnouncement(ann._id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded font-medium transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODAL: APPLY FOR LEAVE */}
          {showApplyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Apply for Leave</h3>
                  <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleApplyLeave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Leave Policy *
                    </label>
                    <select
                      required
                      value={leaveForm.policy}
                      onChange={(e) => setLeaveForm({ ...leaveForm, policy: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="">Select Leave Policy</option>
                      {policies.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.code}) — {p.annualEntitlement} days/yr
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
                      <input
                        type="date"
                        required
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="halfDay"
                      checked={leaveForm.isHalfDay}
                      onChange={(e) => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
                    />
                    <label htmlFor="halfDay" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Half Day Application (0.5 days)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reason *</label>
                    <textarea
                      required
                      rows="3"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Contact During Leave (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Phone number or delegate"
                      value={leaveForm.contactDuringLeave}
                      onChange={(e) => setLeaveForm({ ...leaveForm, contactDuringLeave: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowApplyModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Submit Application
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: UPLOAD DOCUMENT */}
          {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Upload Employment Document</h3>
                  <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUploadDocument} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Type *
                    </label>
                    <select
                      value={docForm.documentType}
                      onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="qualification">Academic Qualification</option>
                      <option value="identity_proof">Identity Proof (Aadhaar / Passport)</option>
                      <option value="experience_cert">Experience Certificate</option>
                      <option value="contract">Employment Contract</option>
                      <option value="other">Other Credential</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Master's Degree Certificate"
                      value={docForm.title}
                      onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      File (PDF, PNG, JPG) *
                    </label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      onChange={(e) => setDocForm({ ...docForm, file: e.target.files[0] })}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Upload
                    </button>
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

export default FacultyHR;

