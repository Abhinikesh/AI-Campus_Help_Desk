/**
 * client/src/pages/AdminHR/index.jsx
 * Centralized Institutional HR, Employee Directory, Leave Administration & Workforce Desk.
 */
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Search,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  Briefcase,
  Building,
  Bell,
  Sliders,
  X,
  Edit,
  Award
} from 'lucide-react';
import hrService from '../../services/hr.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const AdminHR = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Metrics
  const [metrics, setMetrics] = useState({
    workforce: { total: 0, active: 0, probation: 0, pendingOnboarding: 0, byCategory: {}, byDepartment: [] },
    leaves: { pending: 0, approved: 0 },
    todayAttendance: { present: 0, late: 0, on_leave: 0, half_day: 0, absent: 0 }
  });

  // Data lists
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [attendanceRoster, setAttendanceRoster] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Search & Filters
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('pending');
  const [rosterDate, setRosterDate] = useState(new Date().toISOString().split('T')[0]);

  // Modals
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
  const [showReviewLeaveModal, setShowReviewLeaveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewComments, setReviewComments] = useState('');
  const [showAttendanceCorrectionModal, setShowAttendanceCorrectionModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [correctionData, setCorrectionData] = useState({ status: 'present', reason: '' });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Form states
  const [newEmp, setNewEmp] = useState({
    firstName: '',
    lastName: '',
    officialEmail: '',
    employeeCategory: 'teaching_faculty',
    department: '',
    designation: '',
    employmentType: 'permanent',
    employmentStatus: 'active',
    joiningDate: new Date().toISOString().split('T')[0],
    phone: '',
    workLocation: 'Main Campus'
  });

  const [newPolicy, setNewPolicy] = useState({
    name: '',
    code: '',
    description: '',
    annualEntitlement: 12,
    applicableCategory: 'all',
    accrualFrequency: 'annual',
    maxConsecutiveDays: 14,
    minNoticeDays: 2,
    carryForwardMax: 5,
    allowNegativeBalance: false
  });

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
    priority: 'medium'
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [mRes, dRes, desRes, polRes, appRes, annRes] = await Promise.all([
        hrService.getDashboardMetrics(),
        hrService.getDepartments(),
        hrService.getDesignations(),
        hrService.getLeavePolicies(),
        hrService.getLeaveApplications({ status: leaveStatusFilter }),
        hrService.getAnnouncements()
      ]);

      if (mRes.success) setMetrics(mRes.data);
      if (dRes.success) setDepartments(dRes.data);
      if (desRes.success) setDesignations(desRes.data);
      if (polRes.success) setLeavePolicies(polRes.data);
      if (appRes.success) setLeaveApplications(appRes.data);
      if (annRes.success) setAnnouncements(annRes.data);
    } catch (err) {
      showToast(err.message || 'Error fetching HR dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await hrService.getEmployees({
        search: empSearch,
        department: empDeptFilter,
        employmentStatus: empStatusFilter
      });
      if (res.success) setEmployees(res.data);
    } catch (err) {
      showToast(err.message || 'Error loading employee directory', 'error');
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await hrService.getAttendanceRoster({ date: rosterDate });
      if (res.success) setAttendanceRoster(res.data);
    } catch (err) {
      showToast(err.message || 'Error loading attendance roster', 'error');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'attendance') fetchRoster();
  }, [activeTab, empSearch, empDeptFilter, empStatusFilter, rosterDate]);

  useEffect(() => {
    if (activeTab === 'leaves') {
      hrService.getLeaveApplications({ status: leaveStatusFilter }).then((res) => {
        if (res.success) setLeaveApplications(res.data);
      });
    }
  }, [activeTab, leaveStatusFilter]);

  // Handlers
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.createEmployee(newEmp);
      if (res.success) {
        showToast(`Employee ${res.data.employeeId} created successfully!`, 'success');
        setShowAddEmpModal(false);
        fetchEmployees();
        fetchDashboardData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleVerifyOnboarding = async (empId) => {
    try {
      const res = await hrService.verifyOnboarding(empId);
      if (res.success) {
        showToast('Onboarding verified successfully', 'success');
        fetchEmployees();
        fetchDashboardData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleConfirmProbation = async (empId) => {
    try {
      const res = await hrService.confirmProbation(empId);
      if (res.success) {
        showToast('Employee probation confirmed', 'success');
        fetchEmployees();
        fetchDashboardData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.createLeavePolicy(newPolicy);
      if (res.success) {
        showToast('Leave policy created successfully', 'success');
        setShowAddPolicyModal(false);
        const polRes = await hrService.getLeavePolicies();
        if (polRes.success) setLeavePolicies(polRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleReviewLeave = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    try {
      const res = await hrService.reviewLeaveApplication(selectedLeave._id, {
        action: reviewAction,
        comments: reviewComments,
        rejectionReason: reviewAction === 'reject' ? reviewComments : undefined
      });
      if (res.success) {
        showToast(`Leave application ${reviewAction}d successfully`, 'success');
        setShowReviewLeaveModal(false);
        setSelectedLeave(null);
        setReviewComments('');
        const appRes = await hrService.getLeaveApplications({ status: leaveStatusFilter });
        if (appRes.success) setLeaveApplications(appRes.data);
        fetchDashboardData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCorrectAttendance = async (e) => {
    e.preventDefault();
    if (!selectedAttendance) return;

    try {
      const res = await hrService.correctAttendance(selectedAttendance._id, {
        status: correctionData.status,
        reason: correctionData.reason
      });
      if (res.success) {
        showToast('Attendance corrected with audit log', 'success');
        setShowAttendanceCorrectionModal(false);
        setSelectedAttendance(null);
        fetchRoster();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.createAnnouncement(newAnnouncement);
      if (res.success) {
        showToast('HR announcement published', 'success');
        setShowAnnouncementModal(false);
        setNewAnnouncement({ title: '', content: '', targetAudience: 'all', priority: 'medium' });
        const annRes = await hrService.getAnnouncements();
        if (annRes.success) setAnnouncements(annRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                Institutional HR & Workforce Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Centralized employee master directory, leaves, attendance, and administrative workforce operations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={hrService.exportEmployeesCsvUrl()}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                download
              >
                <Download className="w-4 h-4" />
                Export Employees
              </a>
              <a
                href={hrService.exportLeavesCsvUrl()}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                download
              >
                <Download className="w-4 h-4" />
                Export Leaves
              </a>
              <button
                onClick={() => setShowAddEmpModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Staff</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {metrics.workforce.total}
              </p>
              <span className="text-xs text-slate-400">{metrics.workforce.active} active</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">On Probation</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {metrics.workforce.probation}
              </p>
              <span className="text-xs text-slate-400">Pending review</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Onboarding Queue</span>
                <UserCheck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                {metrics.workforce.pendingOnboarding}
              </p>
              <span className="text-xs text-slate-400">Pending verification</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Leaves</span>
                <Calendar className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {metrics.leaves.pending}
              </p>
              <span className="text-xs text-slate-400">{metrics.leaves.approved} approved</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Present Today</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {metrics.todayAttendance.present + metrics.todayAttendance.late}
              </p>
              <span className="text-xs text-slate-400">{metrics.todayAttendance.on_leave} on approved leave</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: Briefcase },
              { id: 'employees', label: 'Employee Directory', icon: Users },
              { id: 'leaves', label: 'Leave Management', icon: Calendar },
              { id: 'attendance', label: 'Attendance Roster', icon: Clock },
              { id: 'announcements', label: 'HR Announcements', icon: Bell }
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

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  Headcount by Department
                </h3>
                <div className="space-y-3">
                  {metrics.workforce.byDepartment.length === 0 ? (
                    <p className="text-sm text-slate-400">No department statistics available</p>
                  ) : (
                    metrics.workforce.byDepartment.map((d, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                        <span className="font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                          {d.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-500" />
                  Staff Category Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(metrics.workforce.byCategory).length === 0 ? (
                    <p className="text-sm text-slate-400">No category breakdown available</p>
                  ) : (
                    Object.entries(metrics.workforce.byCategory).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center text-sm capitalize">
                        <span className="text-slate-600 dark:text-slate-300">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                          {count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYEE DIRECTORY */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, employee ID, or official email..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={empDeptFilter}
                  onChange={(e) => setEmpDeptFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={empStatusFilter}
                  onChange={(e) => setEmpStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="suspended">Suspended</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Department</th>
                      <th className="p-3 font-medium">Designation</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Onboarding</th>
                      <th className="p-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No employee records found
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="p-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {emp.employeeId} • {emp.officialEmail}
                            </div>
                          </td>
                          <td className="p-3">{emp.department?.name || '—'}</td>
                          <td className="p-3">{emp.designation?.title || '—'}</td>
                          <td className="p-3 capitalize">{emp.employeeCategory?.replace(/_/g, ' ')}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded font-medium ${
                                emp.employmentStatus === 'active' || emp.employmentStatus === 'confirmed'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : emp.employmentStatus === 'probation'
                                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {emp.employmentStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded font-medium ${
                                emp.onboardingStatus === 'verified'
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {emp.onboardingStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {emp.onboardingStatus !== 'verified' && (
                              <button
                                onClick={() => handleVerifyOnboarding(emp._id)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded transition-colors"
                              >
                                Verify
                              </button>
                            )}
                            {emp.employmentStatus === 'probation' && (
                              <button
                                onClick={() => handleConfirmProbation(emp._id)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs rounded transition-colors"
                              >
                                Confirm
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

          {/* TAB 3: LEAVE MANAGEMENT */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {['pending', 'approved', 'rejected', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setLeaveStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        leaveStatusFilter === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAddPolicyModal(true)}
                  className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Leave Policy
                </button>
              </div>

              {/* Leave Applications Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-medium">App #</th>
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Leave Policy</th>
                      <th className="p-3 font-medium">Duration</th>
                      <th className="p-3 font-medium">Days</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {leaveApplications.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No leave applications with status "{leaveStatusFilter}"
                        </td>
                      </tr>
                    ) : (
                      leaveApplications.map((app) => (
                        <tr key={app._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="p-3 font-mono text-xs">{app.applicationNumber}</td>
                          <td className="p-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {app.employee?.firstName} {app.employee?.lastName}
                            </div>
                            <div className="text-xs text-slate-400">{app.employee?.employeeId}</div>
                          </td>
                          <td className="p-3">{app.policy?.name || 'General Leave'}</td>
                          <td className="p-3 text-xs">
                            {new Date(app.startDate).toLocaleDateString()} to{' '}
                            {new Date(app.endDate).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-semibold">{app.totalDays}</td>
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
                                onClick={() => {
                                  setSelectedLeave(app);
                                  setShowReviewLeaveModal(true);
                                }}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-medium rounded transition-colors"
                              >
                                Review
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Active Leave Policies Section */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Institutional Leave Policies</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {leavePolicies.map((pol) => (
                    <div
                      key={pol._id}
                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-900 dark:text-white">{pol.name}</span>
                        <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                          {pol.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{pol.description || 'Institutional leave benefit'}</p>
                      <div className="mt-3 flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Annual Quota:</span>
                        <span className="font-semibold">{pol.annualEntitlement} days</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mt-1">
                        <span>Max Consecutive:</span>
                        <span>{pol.maxConsecutiveDays} days</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE ROSTER */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={rosterDate}
                  onChange={(e) => setRosterDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500">
                  Showing recorded attendance and approved leave sync for selected date
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Department</th>
                      <th className="p-3 font-medium">Check-In</th>
                      <th className="p-3 font-medium">Check-Out</th>
                      <th className="p-3 font-medium">Hours</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Correct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {attendanceRoster.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No attendance records found for {rosterDate}
                        </td>
                      </tr>
                    ) : (
                      attendanceRoster.map((att) => (
                        <tr key={att._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="p-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {att.employee?.firstName} {att.employee?.lastName}
                            </div>
                            <div className="text-xs text-slate-400">{att.employee?.employeeId}</div>
                          </td>
                          <td className="p-3">{att.employee?.department?.name || '—'}</td>
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
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedAttendance(att);
                                setCorrectionData({ status: att.status, reason: '' });
                                setShowAttendanceCorrectionModal(true);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs rounded flex items-center gap-1 ml-auto"
                            >
                              <Edit className="w-3 h-3" />
                              Correct
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">Official HR notifications, policy updates, and staff circulars.</p>
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publish Announcement
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((ann) => (
                  <div
                    key={ann._id}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-line">{ann.content}</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between text-xs text-slate-400">
                      <span>Audience: {ann.targetAudience.replace(/_/g, ' ')}</span>
                      <span>{new Date(ann.publishDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODAL: ADD EMPLOYEE */}
          {showAddEmpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Add Institutional Employee</h3>
                  <button onClick={() => setShowAddEmpModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmp.firstName}
                        onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmp.lastName}
                        onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Official Email *</label>
                    <input
                      type="email"
                      required
                      value={newEmp.officialEmail}
                      onChange={(e) => setNewEmp({ ...newEmp, officialEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                      <select
                        value={newEmp.employeeCategory}
                        onChange={(e) => setNewEmp({ ...newEmp, employeeCategory: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="teaching_faculty">Teaching Faculty</option>
                        <option value="non_teaching_staff">Non-Teaching Staff</option>
                        <option value="administrative_staff">Administrative Staff</option>
                        <option value="technical_staff">Technical Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Joining Date *</label>
                      <input
                        type="date"
                        required
                        value={newEmp.joiningDate}
                        onChange={(e) => setNewEmp({ ...newEmp, joiningDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department *</label>
                      <select
                        required
                        value={newEmp.department}
                        onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Designation *</label>
                      <select
                        required
                        value={newEmp.designation}
                        onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="">Select Designation</option>
                        {designations.map((des) => (
                          <option key={des._id} value={des._id}>
                            {des.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAddEmpModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Create Employee
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: REVIEW LEAVE */}
          {showReviewLeaveModal && selectedLeave && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Review Leave Application</h3>
                  <button onClick={() => setShowReviewLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-750 p-3 rounded-lg text-xs space-y-1 mb-4">
                  <div>
                    <span className="font-semibold">Applicant:</span> {selectedLeave.employee?.firstName}{' '}
                    {selectedLeave.employee?.lastName} ({selectedLeave.employee?.employeeId})
                  </div>
                  <div>
                    <span className="font-semibold">Duration:</span> {selectedLeave.totalDays} day(s) [
                    {new Date(selectedLeave.startDate).toLocaleDateString()} -{' '}
                    {new Date(selectedLeave.endDate).toLocaleDateString()}]
                  </div>
                  <div>
                    <span className="font-semibold">Reason:</span> {selectedLeave.reason}
                  </div>
                </div>

                <form onSubmit={handleReviewLeave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Decision</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="approve"
                          checked={reviewAction === 'approve'}
                          onChange={() => setReviewAction('approve')}
                        />
                        <span className="text-emerald-600 font-medium">Approve</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="reject"
                          checked={reviewAction === 'reject'}
                          onChange={() => setReviewAction('reject')}
                        />
                        <span className="text-rose-600 font-medium">Reject</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {reviewAction === 'approve' ? 'Comments (Optional)' : 'Rejection Reason *'}
                    </label>
                    <textarea
                      required={reviewAction === 'reject'}
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder={reviewAction === 'approve' ? 'Approved by HR' : 'Provide clear justification...'}
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowReviewLeaveModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 text-white text-sm font-medium rounded-lg ${
                        reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: ATTENDANCE CORRECTION */}
          {showAttendanceCorrectionModal && selectedAttendance && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Audit-Logged Attendance Correction</h3>
                  <button
                    onClick={() => setShowAttendanceCorrectionModal(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCorrectAttendance} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Status</label>
                    <select
                      value={correctionData.status}
                      onChange={(e) => setCorrectionData({ ...correctionData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="half_day">Half Day</option>
                      <option value="on_leave">On Leave</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mandatory Audit Reason *
                    </label>
                    <textarea
                      required
                      placeholder="e.g. Approved biometric sensor malfunction / official off-campus duty"
                      value={correctionData.reason}
                      onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAttendanceCorrectionModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Save Correction
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: PUBLISH ANNOUNCEMENT */}
          {showAnnouncementModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Publish HR Announcement</h3>
                  <button onClick={() => setShowAnnouncementModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Content *</label>
                    <textarea
                      required
                      rows="4"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Audience</label>
                      <select
                        value={newAnnouncement.targetAudience}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, targetAudience: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="all">All Personnel</option>
                        <option value="teaching_faculty">Teaching Faculty</option>
                        <option value="non_teaching">Non-Teaching Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                      <select
                        value={newAnnouncement.priority}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Publish
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

export default AdminHR;

