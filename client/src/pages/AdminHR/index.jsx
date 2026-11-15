/**
 * client/src/pages/AdminHR/index.jsx
 * Centralized Institutional HR, Employee Directory, Leave Administration & Workforce Desk.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Award,
  GraduationCap,
  Lock,
  ShieldCheck,
  History,
  Save,
  RefreshCw
} from 'lucide-react';
import hrService from '../../services/hr.service';
import { adminService } from '../../services/admin.service';
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

  // Faculty Profile Management State (Part 6)
  const [facultyList, setFacultyList] = useState([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyDeptFilter, setFacultyDeptFilter] = useState('');
  const [facultyTotal, setFacultyTotal] = useState(0);
  const [facultyPage, setFacultyPage] = useState(1);
  const [selectedFacultyId, setSelectedFacultyId] = useState(null);
  const [facultyDetail, setFacultyDetail] = useState(null);
  const [facultyDetailLoading, setFacultyDetailLoading] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [facultyForm, setFacultyForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
  });
  const [facultyFormErrors, setFacultyFormErrors] = useState({});
  const [facultySaving, setFacultySaving] = useState(false);
  const [facultySaveSuccess, setFacultySaveSuccess] = useState(null);

  const fetchFaculty = useCallback(async () => {
    setFacultyLoading(true);
    try {
      const res = await adminService.getFacultyList({
        search: facultySearch || undefined,
        department: facultyDeptFilter || undefined,
        page: facultyPage,
        limit: 15,
      });
      if (res.success) {
        setFacultyList(res.data);
        setFacultyTotal(res.pagination.total);
      }
    } catch (err) {
      showToast(err.message || 'Error loading faculty profiles', 'error');
    } finally {
      setFacultyLoading(false);
    }
  }, [facultySearch, facultyDeptFilter, facultyPage, showToast]);

  useEffect(() => {
    if (activeTab === 'faculty') {
      fetchFaculty();
    }
  }, [activeTab, fetchFaculty]);

  const handleOpenFaculty = async (id) => {
    setSelectedFacultyId(id);
    setFacultyDetailLoading(true);
    setFacultySaveSuccess(null);
    setFacultyFormErrors({});
    setShowFacultyModal(true);
    try {
      const res = await adminService.getFacultyDetail(id);
      if (res.success) {
        setFacultyDetail(res.data);
        const fac = res.data.faculty;
        setFacultyForm({
          name: fac.user?.name || '',
          email: fac.user?.email || '',
          phone: fac.phone || '',
          department: fac.department || '',
          designation: fac.designation || '',
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch faculty details', 'error');
    } finally {
      setFacultyDetailLoading(false);
    }
  };

  const handleSaveFacultyProfile = async (e) => {
    e.preventDefault();
    setFacultyFormErrors({});
    setFacultySaveSuccess(null);

    const errors = {};
    if (facultyForm.name && !facultyForm.name.trim()) {
      errors.name = 'Name cannot be empty';
    }
    if (facultyForm.email && facultyForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(facultyForm.email.trim())) {
        errors.email = 'Please provide a valid email address';
      }
    }
    if (facultyForm.phone && facultyForm.phone.trim()) {
      const digits = facultyForm.phone.replace(/[\s\-\(\)\+]/g, '');
      if (digits.length < 10 || digits.length > 15) {
        errors.phone = 'Phone must be between 10 and 15 digits';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFacultyFormErrors(errors);
      return;
    }

    setFacultySaving(true);
    try {
      const payload = {
        name: facultyForm.name ? facultyForm.name.trim() : undefined,
        email: facultyForm.email ? facultyForm.email.trim() : undefined,
        phone: facultyForm.phone ? facultyForm.phone.trim() : undefined,
        department: facultyForm.department ? facultyForm.department.trim() : undefined,
        designation: facultyForm.designation ? facultyForm.designation.trim() : undefined,
      };

      const res = await adminService.updateFacultyProfile(selectedFacultyId, payload);
      if (res.success) {
        setFacultySaveSuccess('Faculty profile updated successfully. Audit log recorded.');
        showToast('Faculty profile updated successfully', 'success');
        const refreshed = await adminService.getFacultyDetail(selectedFacultyId);
        if (refreshed.success) {
          setFacultyDetail(refreshed.data);
        }
        fetchFaculty();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to update faculty profile';
      setFacultyFormErrors({ form: msg });
      showToast(msg, 'error');
    } finally {
      setFacultySaving(false);
    }
  };

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
    <div className="cs-portal-shell overflow-hidden font-sans">
      <Sidebar />
      <div className="cs-portal-main overflow-hidden">
        
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-7 h-7 text-indigo-600" />
                Institutional HR & Workforce Management
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Centralized employee master directory, leaves, attendance, and administrative workforce operations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={hrService.exportEmployeesCsvUrl()}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 hover shadow-sm"
                download
              >
                <Download className="w-4 h-4" />
                Export Employees
              </a>
              <a
                href={hrService.exportLeavesCsvUrl()}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 hover shadow-sm"
                download
              >
                <Download className="w-4 h-4" />
                Export Leaves
              </a>
              <button
                onClick={() => setShowAddEmpModal(true)}
                className="px-4 py-2 bg-indigo-600 hover text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Staff</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {metrics.workforce.total}
              </p>
              <span className="text-xs text-slate-400">{metrics.workforce.active} active</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">On Probation</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                {metrics.workforce.probation}
              </p>
              <span className="text-xs text-slate-400">Pending review</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Onboarding Queue</span>
                <UserCheck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {metrics.workforce.pendingOnboarding}
              </p>
              <span className="text-xs text-slate-400">Pending verification</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pending Leaves</span>
                <Calendar className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {metrics.leaves.pending}
              </p>
              <span className="text-xs text-slate-400">{metrics.leaves.approved} approved</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Present Today</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {metrics.todayAttendance.present + metrics.todayAttendance.late}
              </p>
              <span className="text-xs text-slate-400">{metrics.todayAttendance.on_leave} on approved leave</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: Briefcase },
              { id: 'employees', label: 'Employee Directory', icon: Users },
              { id: 'faculty', label: 'Faculty Profiles', icon: GraduationCap },
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
                      ? 'border-indigo-600 text-indigo-600  '
                      : 'border-transparent text-slate-500 hover '
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
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  Headcount by Department
                </h3>
                <div className="space-y-3">
                  {metrics.workforce.byDepartment.length === 0 ? (
                    <p className="text-sm text-slate-400">No department statistics available</p>
                  ) : (
                    metrics.workforce.byDepartment.map((d, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{d.name}</span>
                        <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {d.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-500" />
                  Staff Category Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(metrics.workforce.byCategory).length === 0 ? (
                    <p className="text-sm text-slate-400">No category breakdown available</p>
                  ) : (
                    Object.entries(metrics.workforce.byCategory).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center text-sm capitalize">
                        <span className="text-slate-600">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
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
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={empDeptFilter}
                  onChange={(e) => setEmpDeptFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
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
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
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

              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Department</th>
                      <th className="p-3 font-medium">Designation</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Onboarding</th>
                      <th className="p-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No employee records found
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp._id} className="hover">
                          <td className="p-3">
                            <div className="font-medium text-slate-900">
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
                                  ? 'bg-emerald-50  text-emerald-600 '
                                  : emp.employmentStatus === 'probation'
                                  ? 'bg-amber-50  text-amber-600 '
                                  : 'bg-rose-50  text-rose-600 '
                              }`}
                            >
                              {emp.employmentStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-xs rounded font-medium ${
                                emp.onboardingStatus === 'verified'
                                  ? 'bg-blue-50  text-blue-600 '
                                  : 'bg-slate-100  text-slate-600 '
                              }`}
                            >
                              {emp.onboardingStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {emp.onboardingStatus !== 'verified' && (
                              <button
                                onClick={() => handleVerifyOnboarding(emp._id)}
                                className="px-2 py-1 bg-blue-50 hover text-blue-700 text-xs rounded transition-colors"
                              >
                                Verify
                              </button>
                            )}
                            {emp.employmentStatus === 'probation' && (
                              <button
                                onClick={() => handleConfirmProbation(emp._id)}
                                className="px-2 py-1 bg-emerald-50 hover text-emerald-700 text-xs rounded transition-colors"
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
                          : 'bg-white  border border-slate-200  text-slate-600 '
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAddPolicyModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Leave Policy
                </button>
              </div>

              {/* Leave Applications Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="p-3 font-medium">App #</th>
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Leave Policy</th>
                      <th className="p-3 font-medium">Duration</th>
                      <th className="p-3 font-medium">Days</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leaveApplications.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No leave applications with status "{leaveStatusFilter}"
                        </td>
                      </tr>
                    ) : (
                      leaveApplications.map((app) => (
                        <tr key={app._id} className="hover">
                          <td className="p-3 font-mono text-xs">{app.applicationNumber}</td>
                          <td className="p-3">
                            <div className="font-medium text-slate-900">
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
                                  ? 'bg-emerald-50  text-emerald-600 '
                                  : app.status === 'pending'
                                  ? 'bg-amber-50  text-amber-600 '
                                  : 'bg-rose-50  text-rose-600 '
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
                                className="px-3 py-1 bg-indigo-50 hover text-indigo-700 text-xs font-medium rounded transition-colors"
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
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-3">Institutional Leave Policies</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {leavePolicies.map((pol) => (
                    <div
                      key={pol._id}
                      className="p-4 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-900">{pol.name}</span>
                        <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {pol.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{pol.description || 'Institutional leave benefit'}</p>
                      <div className="mt-3 flex justify-between text-xs text-slate-600">
                        <span>Annual Quota:</span>
                        <span className="font-semibold">{pol.annualEntitlement} days</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 mt-1">
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
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  Showing recorded attendance and approved leave sync for selected date
                </span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="p-3 font-medium">Employee</th>
                      <th className="p-3 font-medium">Department</th>
                      <th className="p-3 font-medium">Check-In</th>
                      <th className="p-3 font-medium">Check-Out</th>
                      <th className="p-3 font-medium">Hours</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Correct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {attendanceRoster.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No attendance records found for {rosterDate}
                        </td>
                      </tr>
                    ) : (
                      attendanceRoster.map((att) => (
                        <tr key={att._id} className="hover">
                          <td className="p-3">
                            <div className="font-medium text-slate-900">
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
                                  ? 'bg-emerald-50  text-emerald-600 '
                                  : att.status === 'late'
                                  ? 'bg-amber-50  text-amber-600 '
                                  : att.status === 'on_leave'
                                  ? 'bg-blue-50  text-blue-600 '
                                  : 'bg-rose-50  text-rose-600 '
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
                              className="px-2 py-1 bg-slate-100 hover text-slate-700 text-xs rounded flex items-center gap-1 ml-auto"
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
                  className="px-3 py-1.5 bg-indigo-600 hover text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publish Announcement
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((ann) => (
                  <div
                    key={ann._id}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-slate-900">{ann.title}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded font-medium uppercase ${
                          ann.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-700  '
                            : 'bg-indigo-50 text-indigo-700  '
                        }`}
                      >
                        {ann.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 whitespace-pre-line">{ann.content}</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                      <span>Audience: {ann.targetAudience.replace(/_/g, ' ')}</span>
                      <span>{new Date(ann.publishDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: FACULTY PROFILES (PART 6) */}
          {activeTab === 'faculty' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="flex-1 flex gap-3 w-full">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search faculty by name, employee ID, official email, or department..."
                      value={facultySearch}
                      onChange={(e) => setFacultySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={facultyDeptFilter}
                    onChange={(e) => setFacultyDeptFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                  >
                    <option value="">All Departments</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                    <option value="IT">IT</option>
                    <option value="EE">EE</option>
                  </select>
                </div>

                <button
                  onClick={fetchFaculty}
                  disabled={facultyLoading}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 hover flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${facultyLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Faculty Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="p-3 font-medium">Employee ID</th>
                      <th className="p-3 font-medium">Faculty Member</th>
                      <th className="p-3 font-medium">Department</th>
                      <th className="p-3 font-medium">Designation</th>
                      <th className="p-3 font-medium">Contact Phone</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {facultyLoading && facultyList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-indigo-600" />
                          Loading faculty profiles...
                        </td>
                      </tr>
                    ) : facultyList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-400">
                          No faculty records found matching criteria
                        </td>
                      </tr>
                    ) : (
                      facultyList.map((fac) => (
                        <tr key={fac._id} className="hover">
                          <td className="p-3">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {fac.employeeId}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-slate-900">
                              {fac.user?.name || '—'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {fac.user?.email || '—'}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-800">{fac.department || '—'}</span>
                          </td>
                          <td className="p-3 text-slate-600">{fac.designation || '—'}</td>
                          <td className="p-3 text-slate-600">
                            {fac.phone ? (
                              <span>{fac.phone}</span>
                            ) : (
                              <span className="text-slate-400 italic">Not Set</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 text-xs rounded font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {fac.user?.role || 'faculty'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleOpenFaculty(fac._id)}
                              className="px-2.5 py-1 text-xs font-medium bg-slate-50 hover text-slate-700 border border-slate-300 rounded transition-colors inline-flex items-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-600" />
                              View & Edit
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

          {/* MODAL: ADD EMPLOYEE */}
          {showAddEmpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Add Institutional Employee</h3>
                  <button onClick={() => setShowAddEmpModal(false)} className="text-slate-400 hover">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmp.firstName}
                        onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmp.lastName}
                        onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Official Email *</label>
                    <input
                      type="email"
                      required
                      value={newEmp.officialEmail}
                      onChange={(e) => setNewEmp({ ...newEmp, officialEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                      <select
                        value={newEmp.employeeCategory}
                        onChange={(e) => setNewEmp({ ...newEmp, employeeCategory: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="teaching_faculty">Teaching Faculty</option>
                        <option value="non_teaching_staff">Non-Teaching Staff</option>
                        <option value="administrative_staff">Administrative Staff</option>
                        <option value="technical_staff">Technical Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Joining Date *</label>
                      <input
                        type="date"
                        required
                        value={newEmp.joiningDate}
                        onChange={(e) => setNewEmp({ ...newEmp, joiningDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Department *</label>
                      <select
                        required
                        value={newEmp.department}
                        onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
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
                      <label className="block text-xs font-medium text-slate-700 mb-1">Designation *</label>
                      <select
                        required
                        value={newEmp.designation}
                        onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
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

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddEmpModal(false)}
                      className="px-4 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover text-white text-sm font-medium rounded-lg"
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
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Review Leave Application</h3>
                  <button onClick={() => setShowReviewLeaveModal(false)} className="text-slate-400 hover">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 mb-4">
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">Decision</label>
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {reviewAction === 'approve' ? 'Comments (Optional)' : 'Rejection Reason *'}
                    </label>
                    <textarea
                      required={reviewAction === 'reject'}
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder={reviewAction === 'approve' ? 'Approved by HR' : 'Provide clear justification...'}
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowReviewLeaveModal(false)}
                      className="px-4 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 text-white text-sm font-medium rounded-lg ${
                        reviewAction === 'approve' ? 'bg-emerald-600 hover' : 'bg-rose-600 hover'
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
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Audit-Logged Attendance Correction</h3>
                  <button
                    onClick={() => setShowAttendanceCorrectionModal(false)}
                    className="text-slate-400 hover"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCorrectAttendance} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New Status</label>
                    <select
                      value={correctionData.status}
                      onChange={(e) => setCorrectionData({ ...correctionData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="half_day">Half Day</option>
                      <option value="on_leave">On Leave</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mandatory Audit Reason *
                    </label>
                    <textarea
                      required
                      placeholder="e.g. Approved biometric sensor malfunction / official off-campus duty"
                      value={correctionData.reason}
                      onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAttendanceCorrectionModal(false)}
                      className="px-4 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover text-white text-sm font-medium rounded-lg"
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
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Publish HR Announcement</h3>
                  <button onClick={() => setShowAnnouncementModal(false)} className="text-slate-400 hover">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Content *</label>
                    <textarea
                      required
                      rows="4"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
                      <select
                        value={newAnnouncement.targetAudience}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, targetAudience: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="all">All Personnel</option>
                        <option value="teaching_faculty">Teaching Faculty</option>
                        <option value="non_teaching">Non-Teaching Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                      <select
                        value={newAnnouncement.priority}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(false)}
                      className="px-4 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover text-white text-sm font-medium rounded-lg"
                    >
                      Publish
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: VIEW & EDIT FACULTY PROFILE */}
          {showFacultyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      Faculty Profile Management
                    </h3>
                    {facultyDetail?.faculty && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {facultyDetail.faculty.employeeId}
                        </span>
                        <span className="text-xs text-slate-500">
                          {facultyDetail.faculty.user?.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowFacultyModal(false); setFacultyDetail(null); }}
                    className="text-slate-400 hover"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Safeguard Alert */}
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 mb-4 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Institutional Identity & Role Protection:</strong> Employee ID and Authorization Role are immutable. Administrative profile management permits updating contact and academic assignment details only. All updates are logged in the institutional audit ledger.
                  </div>
                </div>

                {facultySaveSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 mb-4">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{facultySaveSuccess}</span>
                  </div>
                )}

                {facultyFormErrors.form && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 mb-4">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{facultyFormErrors.form}</span>
                  </div>
                )}

                {facultyDetailLoading ? (
                  <div className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-indigo-600" />
                    Loading faculty profile...
                  </div>
                ) : (
                  <form onSubmit={handleSaveFacultyProfile} className="space-y-4">
                    {/* Read-Only Protected Fields */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <label className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                          Employee ID
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        </label>
                        <input
                          type="text"
                          value={facultyDetail?.faculty?.employeeId || ''}
                          disabled
                          className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                          System Role
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        </label>
                        <input
                          type="text"
                          value={facultyDetail?.faculty?.user?.role || 'faculty'}
                          disabled
                          className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono cursor-not-allowed capitalize"
                        />
                      </div>
                    </div>

                    {/* Permitted Editable Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Faculty Full Name</label>
                        <input
                          type="text"
                          value={facultyForm.name}
                          onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            facultyFormErrors.name ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                          }`}
                          placeholder="Dr. Priya Mehta"
                        />
                        {facultyFormErrors.name && (
                          <p className="text-xs text-rose-600 mt-1">{facultyFormErrors.name}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Official Email</label>
                          <input
                            type="email"
                            value={facultyForm.email}
                            onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              facultyFormErrors.email ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                            }`}
                            placeholder="faculty@campussphere.edu"
                          />
                          {facultyFormErrors.email && (
                            <p className="text-xs text-rose-600 mt-1">{facultyFormErrors.email}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Contact Phone</label>
                          <input
                            type="tel"
                            value={facultyForm.phone}
                            onChange={(e) => setFacultyForm({ ...facultyForm, phone: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              facultyFormErrors.phone ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                            }`}
                            placeholder="e.g. 9876543210"
                          />
                          {facultyFormErrors.phone && (
                            <p className="text-xs text-rose-600 mt-1">{facultyFormErrors.phone}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                          <input
                            type="text"
                            value={facultyForm.department}
                            onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. CSE"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                          <input
                            type="text"
                            value={facultyForm.designation}
                            onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Associate Professor"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Audit History */}
                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        Profile Change Audit Trail
                      </h4>
                      {(!facultyDetail?.auditHistory || facultyDetail.auditHistory.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No administrative profile edits recorded yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {facultyDetail.auditHistory.map((item, idx) => (
                            <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                              <div className="flex justify-between font-medium text-slate-700">
                                <span>{item.performedBy?.name || item.performedBy?.email || 'Administrator'}</span>
                                <span className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(item.details?.modifiedFields || item.details?.updatedFields || []).map((f, fIdx) => (
                                  <span key={fIdx} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px]">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => { setShowFacultyModal(false); setFacultyDetail(null); }}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                        disabled={facultySaving}
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={facultySaving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {facultySaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            Save Profile Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminHR;

