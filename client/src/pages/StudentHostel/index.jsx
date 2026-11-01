/**
 * client/src/pages/StudentHostel/index.jsx
 * Student Hostel & Accommodation Portal:
 * View Allocation, Applications, Room Transfer Requests, Maintenance Issues & Mess Dining Schedules.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import hostelService from '../../services/hostel.service';
import {
  Home,
  Building,
  Bed,
  Layers,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCw,
  Send,
  Wrench,
  Utensils,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  ChevronRight,
  Info,
  ArrowRight,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const StudentHostel = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('my_room'); // 'my_room' | 'applications' | 'transfer' | 'maintenance' | 'mess'

  // Application modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [eligibleHostels, setEligibleHostels] = useState([]);
  const [applyForm, setApplyForm] = useState({
    preferredHostels: [],
    requestedRoomType: 'any',
    distanceFromCollegeKm: '',
    medicalConditions: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
  });

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    requestedHostelId: '',
    requestedRoomType: 'any',
    reason: '',
  });

  // Maintenance complaint modal
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
  });

  // Mess menu state
  const [messMenu, setMessMenu] = useState([]);
  const [selectedHostelForMess, setSelectedHostelForMess] = useState('');
  const [messLoading, setMessLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 1. Load Student Hostel Overview
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hostelService.getStudentOverview();
      if (res.success) {
        setOverview(res.data);
        if (res.data.activeAllocation?.hostel?._id) {
          setSelectedHostelForMess(res.data.activeAllocation.hostel._id);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load hostel overview', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Load eligible hostels when opening apply modal
  const openApplyModal = async () => {
    try {
      const res = await hostelService.getHostels({ status: 'active' });
      if (res.success) {
        setEligibleHostels(res.data);
        setShowApplyModal(true);
      }
    } catch (err) {
      showToast('Failed to load eligible hostels', 'error');
    }
  };

  // Load mess menu
  const loadMessSchedule = useCallback(
    async (hostelId) => {
      if (!hostelId) return;
      try {
        setMessLoading(true);
        const res = await hostelService.getMessMenu(hostelId);
        if (res.success) {
          setMessMenu(res.data);
        }
      } catch (err) {
        showToast('Failed to load mess schedule', 'error');
      } finally {
        setMessLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (activeTab === 'mess') {
      const targetId = selectedHostelForMess || overview?.activeAllocation?.hostel?._id;
      if (targetId) {
        loadMessSchedule(targetId);
      }
    }
  }, [activeTab, selectedHostelForMess, overview, loadMessSchedule]);

  // Handle Application Submit
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        preferredHostels: applyForm.preferredHostels,
        requestedRoomType: applyForm.requestedRoomType,
        distanceFromCollegeKm: Number(applyForm.distanceFromCollegeKm) || 0,
        medicalConditions: applyForm.medicalConditions,
        emergencyContact: {
          name: applyForm.emergencyName,
          relation: applyForm.emergencyRelation,
          phone: applyForm.emergencyPhone,
        },
      };

      const res = await hostelService.createApplication(payload);
      if (res.success) {
        showToast('Hostel application submitted successfully!', 'success');
        setShowApplyModal(false);
        setApplyForm({
          preferredHostels: [],
          requestedRoomType: 'any',
          distanceFromCollegeKm: '',
          medicalConditions: '',
          emergencyName: '',
          emergencyRelation: '',
          emergencyPhone: '',
        });
        loadOverview();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Transfer Request Submit
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.reason || transferForm.reason.trim().length < 5) {
      showToast('Please provide a detailed reason (at least 5 characters)', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await hostelService.requestTransfer(transferForm);
      if (res.success) {
        showToast('Room transfer request submitted for warden review', 'success');
        setShowTransferModal(false);
        setTransferForm({ requestedHostelId: '', requestedRoomType: 'any', reason: '' });
        loadOverview();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit transfer request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Maintenance Complaint Submit
  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!complaintForm.title || !complaintForm.description) {
      showToast('Title and description are required', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await hostelService.createComplaint(complaintForm);
      if (res.success) {
        showToast('Maintenance complaint registered successfully!', 'success');
        setShowComplaintModal(false);
        setComplaintForm({ title: '', description: '', priority: 'normal' });
        loadOverview();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to register complaint', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeAlloc = overview?.activeAllocation;
  const occupancy = overview?.occupancy;

  return (
    <div className="cs-layout">
      <Sidebar />
      <div className={`cs-main-content ${isCollapsed ? 'collapsed' : ''}`}>
        <Navbar />

        <div className="cs-page-container">
          {/* ── Top Header Banner ── */}
          <div className="cs-page-header">
            <div>
              <h1 className="cs-page-title flex items-center gap-2">
                <Home className="text-blue-600" size={28} />
                Hostel & Accommodation Portal
              </h1>
              <p className="cs-page-subtitle">
                Residential building allocations, room check-in, maintenance requests & mess dining.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadOverview}
                className="cs-btn cs-btn-secondary flex items-center gap-1.5"
                title="Refresh Hostel Data"
              >
                <RotateCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Overview Metrics Strip ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="cs-card p-4 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <Building size={24} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Assigned Hostel</div>
                <div className="text-lg font-bold text-gray-800">
                  {activeAlloc?.hostel?.name || 'Not Allocated'}
                </div>
              </div>
            </div>

            <div className="cs-card p-4 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <Bed size={24} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Room & Bed</div>
                <div className="text-lg font-bold text-gray-800">
                  {activeAlloc
                    ? `Room ${activeAlloc.room?.roomNumber} • Bed ${activeAlloc.bed?.bedNumber}`
                    : 'N/A'}
                </div>
              </div>
            </div>

            <div className="cs-card p-4 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Check-in Status</div>
                <div className="text-lg font-bold text-gray-800">
                  {occupancy?.status === 'checked_in'
                    ? 'Checked In'
                    : activeAlloc
                    ? 'Allocation Confirmed'
                    : 'No Allocation'}
                </div>
              </div>
            </div>

            <div className="cs-card p-4 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Wrench size={24} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Maintenance Tickets</div>
                <div className="text-lg font-bold text-gray-800">
                  {overview?.complaints?.filter((c) => c.status !== 'resolved').length || 0} Open
                </div>
              </div>
            </div>
          </div>

          {/* ── Navigation Tabs ── */}
          <div className="flex border-b border-gray-200 mb-6 space-x-2">
            {[
              { id: 'my_room', label: 'My Accommodation', icon: Home },
              { id: 'applications', label: 'Applications', icon: Send },
              { id: 'transfer', label: 'Room Transfer', icon: RotateCw },
              { id: 'maintenance', label: 'Maintenance & Complaints', icon: Wrench },
              { id: 'mess', label: 'Mess Dining Menu', icon: Utensils },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── TAB 1: MY ACCOMMODATION ── */}
          {activeTab === 'my_room' && (
            <div>
              {loading ? (
                <div className="cs-card p-12 text-center text-gray-500">Loading accommodation details...</div>
              ) : activeAlloc ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Room & Hostel Details */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="cs-card p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                            {activeAlloc.hostel?.type} Hostel
                          </span>
                          <h2 className="text-2xl font-bold text-gray-900 mt-2">
                            {activeAlloc.hostel?.name}
                          </h2>
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin size={14} />
                            {activeAlloc.hostel?.campusLocation} • Building: {activeAlloc.hostel?.building || 'Main'}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            occupancy?.status === 'checked_in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {occupancy?.status === 'checked_in' ? 'Checked In' : 'Pending Check-in'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-gray-100 my-4">
                        <div>
                          <div className="text-xs text-gray-400">Room Number</div>
                          <div className="text-lg font-bold text-gray-800">
                            {activeAlloc.room?.roomNumber}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Floor</div>
                          <div className="text-lg font-bold text-gray-800">
                            Floor {activeAlloc.room?.floor}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Bed Number</div>
                          <div className="text-lg font-bold text-blue-600">
                            {activeAlloc.bed?.bedNumber}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Room Type</div>
                          <div className="text-lg font-bold text-gray-800 capitalize">
                            {activeAlloc.room?.roomType}
                          </div>
                        </div>
                      </div>

                      {/* Facilities */}
                      {activeAlloc.room?.facilities?.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-2">Room Amenities</div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeAlloc.room.facilities.map((fac, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 text-xs rounded-md bg-gray-100 text-gray-700"
                              >
                                {fac}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Check-in Inspection Notes */}
                      {occupancy?.checkIn?.inventoryCondition && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                          <span className="font-semibold text-gray-800">Check-in Condition: </span>
                          {occupancy.checkIn.inventoryCondition} ({occupancy.checkIn.keysIssued} keys issued)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Wardens & Quick Actions */}
                  <div className="space-y-6">
                    <div className="cs-card p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Phone size={18} className="text-blue-600" />
                        Hostel Warden Office
                      </h3>
                      {activeAlloc.hostel?.wardens?.length > 0 ? (
                        <div className="space-y-3">
                          {activeAlloc.hostel.wardens.map((warden) => (
                            <div key={warden._id} className="p-3 bg-gray-50 rounded-lg text-sm">
                              <div className="font-semibold text-gray-800">{warden.name}</div>
                              {warden.phone && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Phone size={12} /> {warden.phone}
                                </div>
                              )}
                              {warden.email && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Mail size={12} /> {warden.email}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Contact Central Hostel Office: {activeAlloc.hostel?.contactNumber || 'Ext 4101'}
                        </p>
                      )}
                    </div>

                    <div className="cs-card p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-3">Hostel Quick Actions</h3>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowTransferModal(true)}
                          className="w-full cs-btn cs-btn-secondary text-sm flex items-center justify-center gap-2 py-2"
                        >
                          <RotateCw size={14} /> Request Room Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowComplaintModal(true)}
                          className="w-full cs-btn cs-btn-secondary text-sm flex items-center justify-center gap-2 py-2"
                        >
                          <Wrench size={14} /> Report Maintenance Issue
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center max-w-xl mx-auto">
                  <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                    <Home size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Hostel Accommodation</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    You do not currently have an active hostel bed allocation for this academic year. You can apply
                    for on-campus housing below.
                  </p>
                  <button
                    type="button"
                    onClick={openApplyModal}
                    className="cs-btn cs-btn-primary flex items-center gap-2 mx-auto"
                  >
                    <Send size={16} />
                    Apply for Hostel Accommodation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: APPLICATIONS ── */}
          {activeTab === 'applications' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">My Hostel Applications</h2>
                <button
                  type="button"
                  onClick={openApplyModal}
                  className="cs-btn cs-btn-primary flex items-center gap-1.5"
                >
                  <Send size={16} />
                  New Application
                </button>
              </div>

              {overview?.applications?.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Application #</th>
                          <th className="py-3 px-4">Academic Year</th>
                          <th className="py-3 px-4">Submitted Date</th>
                          <th className="py-3 px-4">Requested Room</th>
                          <th className="py-3 px-4">Preferred Hostels</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Review Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {overview.applications.map((app) => (
                          <tr key={app._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono font-medium text-blue-600">
                              {app.applicationNumber}
                            </td>
                            <td className="py-3 px-4 text-gray-700">{app.academicYear}</td>
                            <td className="py-3 px-4 text-gray-500 text-xs">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 capitalize">{app.requestedRoomType}</td>
                            <td className="py-3 px-4 text-xs text-gray-600">
                              {app.preferredHostels?.map((h) => h.name).join(', ') || 'Any Eligible'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  app.status === 'allocated'
                                    ? 'bg-purple-100 text-purple-800'
                                    : app.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : app.status === 'waitlisted'
                                    ? 'bg-amber-100 text-amber-800'
                                    : app.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {app.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {app.reviewDetails?.rejectionReason ||
                                app.reviewDetails?.comments ||
                                (app.reviewDetails?.waitlistNumber
                                  ? `Waitlist #${app.reviewDetails.waitlistNumber}`
                                  : 'Pending review')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">
                  You have not submitted any hostel applications yet.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: ROOM TRANSFER ── */}
          {activeTab === 'transfer' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Room Transfer Requests</h2>
                  <p className="text-xs text-gray-500">
                    Submit requests to change your current room or bed assignment subject to warden review.
                  </p>
                </div>
                {activeAlloc && (
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(true)}
                    className="cs-btn cs-btn-primary flex items-center gap-1.5"
                  >
                    <RotateCw size={16} /> Request Transfer
                  </button>
                )}
              </div>

              {!activeAlloc ? (
                <div className="cs-card p-8 text-center text-gray-500">
                  You must have an active hostel bed allocation to request a room transfer.
                </div>
              ) : overview?.transferRequests?.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Request #</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Current Bed</th>
                          <th className="py-3 px-4">Requested Room Type</th>
                          <th className="py-3 px-4">Reason</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Warden Decision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {overview.transferRequests.map((tr) => (
                          <tr key={tr._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono font-medium text-blue-600">{tr.requestNumber}</td>
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {new Date(tr.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {tr.currentHostel?.code} Room {tr.currentRoom?.roomNumber} (Bed {tr.currentBed?.bedNumber})
                            </td>
                            <td className="py-3 px-4 capitalize">{tr.requestedRoomType}</td>
                            <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate">{tr.reason}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  tr.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : tr.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {tr.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {tr.review?.comments || 'Pending warden evaluation'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">
                  No room transfer requests recorded.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: MAINTENANCE & COMPLAINTS ── */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Hostel Maintenance & Complaints</h2>
                  <p className="text-xs text-gray-500">
                    Report electrical, plumbing, Wi-Fi, or cleanliness issues directly to hostel staff.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(true)}
                  className="cs-btn cs-btn-primary flex items-center gap-1.5"
                >
                  <Wrench size={16} /> Report Issue
                </button>
              </div>

              {overview?.complaints?.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Staff Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {overview.complaints.map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800">{c.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full uppercase font-semibold ${
                                  c.priority === 'urgent'
                                    ? 'bg-red-100 text-red-800'
                                    : c.priority === 'high'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {c.priority || 'Normal'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  c.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : c.status === 'in-progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {c.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-600">
                              {c.adminResponse || c.closureNotes || 'Under maintenance queue'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">
                  No maintenance complaints reported.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: MESS SCHEDULE ── */}
          {activeTab === 'mess' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">Weekly Mess Dining Schedule</h2>
              </div>

              {messLoading ? (
                <div className="cs-card p-12 text-center text-gray-500">Loading mess schedule...</div>
              ) : messMenu?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {messMenu.map((day) => (
                    <div key={day._id} className="cs-card p-5 border-t-4 border-t-blue-600">
                      <h3 className="font-bold text-base text-gray-900 border-b pb-2 mb-3">
                        {day.dayOfWeek}
                      </h3>
                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="font-semibold text-gray-700 flex items-center justify-between">
                            <span>Breakfast</span>
                            <span className="text-gray-400 font-normal">{day.breakfast?.time}</span>
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {day.breakfast?.items?.join(', ') || 'Standard Continental / South Indian'}
                          </p>
                        </div>

                        <div>
                          <div className="font-semibold text-gray-700 flex items-center justify-between">
                            <span>Lunch</span>
                            <span className="text-gray-400 font-normal">{day.lunch?.time}</span>
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {day.lunch?.items?.join(', ') || 'Rice, Roti, Dal, Sabzi, Curd'}
                          </p>
                        </div>

                        <div>
                          <div className="font-semibold text-gray-700 flex items-center justify-between">
                            <span>Evening Snacks</span>
                            <span className="text-gray-400 font-normal">{day.snacks?.time}</span>
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {day.snacks?.items?.join(', ') || 'Tea / Coffee & Snack'}
                          </p>
                        </div>

                        <div>
                          <div className="font-semibold text-gray-700 flex items-center justify-between">
                            <span>Dinner</span>
                            <span className="text-gray-400 font-normal">{day.dinner?.time}</span>
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {day.dinner?.items?.join(', ') || 'Rice, Roti, Special Sabzi, Dessert'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">
                  Mess dining schedule has not been published yet for this hostel.
                </div>
              )}
            </div>
          )}

          {/* ── MODAL: APPLY FOR HOSTEL ── */}
          {showApplyModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Apply for Hostel Accommodation</h3>
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleApplySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Preferred Hostel(s)
                    </label>
                    <select
                      className="w-full text-sm border rounded-lg p-2"
                      value={applyForm.preferredHostels[0] || ''}
                      onChange={(e) =>
                        setApplyForm({
                          ...applyForm,
                          preferredHostels: e.target.value ? [e.target.value] : [],
                        })
                      }
                      required
                    >
                      <option value="">-- Select Preferred Hostel --</option>
                      {eligibleHostels.map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name} ({h.type} • {h.genderEligibility})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Requested Room Type
                    </label>
                    <select
                      className="w-full text-sm border rounded-lg p-2"
                      value={applyForm.requestedRoomType}
                      onChange={(e) => setApplyForm({ ...applyForm, requestedRoomType: e.target.value })}
                    >
                      <option value="any">Any Available Type</option>
                      <option value="single">Single Occupancy</option>
                      <option value="double">Double Occupancy</option>
                      <option value="triple">Triple Occupancy</option>
                      <option value="quad">Quad Occupancy</option>
                      <option value="dormitory">Dormitory</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Distance from College (in KM)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="e.g. 150"
                      value={applyForm.distanceFromCollegeKm}
                      onChange={(e) => setApplyForm({ ...applyForm, distanceFromCollegeKm: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Medical Conditions or Special Needs (Optional)
                    </label>
                    <textarea
                      rows={2}
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="Any health issues or ground floor requirements"
                      value={applyForm.medicalConditions}
                      onChange={(e) => setApplyForm({ ...applyForm, medicalConditions: e.target.value })}
                    />
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-bold text-gray-800 mb-2">Emergency Contact</h4>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <input
                        type="text"
                        className="text-sm border rounded-lg p-2"
                        placeholder="Contact Name"
                        value={applyForm.emergencyName}
                        onChange={(e) => setApplyForm({ ...applyForm, emergencyName: e.target.value })}
                        required
                      />
                      <input
                        type="text"
                        className="text-sm border rounded-lg p-2"
                        placeholder="Relation (e.g. Parent)"
                        value={applyForm.emergencyRelation}
                        onChange={(e) => setApplyForm({ ...applyForm, emergencyRelation: e.target.value })}
                        required
                      />
                    </div>
                    <input
                      type="tel"
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="Emergency Phone Number"
                      value={applyForm.emergencyPhone}
                      onChange={(e) => setApplyForm({ ...applyForm, emergencyPhone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowApplyModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm flex items-center gap-1.5"
                    >
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: ROOM TRANSFER ── */}
          {showTransferModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Request Room Transfer</h3>
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Requested Room Type
                    </label>
                    <select
                      className="w-full text-sm border rounded-lg p-2"
                      value={transferForm.requestedRoomType}
                      onChange={(e) => setTransferForm({ ...transferForm, requestedRoomType: e.target.value })}
                    >
                      <option value="any">Any Room Type</option>
                      <option value="single">Single Occupancy</option>
                      <option value="double">Double Occupancy</option>
                      <option value="triple">Triple Occupancy</option>
                      <option value="quad">Quad Occupancy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Reason for Transfer (Min 5 chars)
                    </label>
                    <textarea
                      rows={3}
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="Please explain why you are requesting a change of room..."
                      value={transferForm.reason}
                      onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Submitting...' : 'Submit Transfer Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: REPORT MAINTENANCE ISSUE ── */}
          {showComplaintModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Report Maintenance Problem</h3>
                  <button
                    type="button"
                    onClick={() => setShowComplaintModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleComplaintSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Problem Summary / Title
                    </label>
                    <input
                      type="text"
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="e.g. Water leakage in washroom tap"
                      value={complaintForm.title}
                      onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Priority Level
                    </label>
                    <select
                      className="w-full text-sm border rounded-lg p-2"
                      value={complaintForm.priority}
                      onChange={(e) => setComplaintForm({ ...complaintForm, priority: e.target.value })}
                    >
                      <option value="normal">Normal (Standard repair)</option>
                      <option value="high">High (Affecting daily routine)</option>
                      <option value="urgent">Urgent (Electricity hazard / Flooding)</option>
                      <option value="low">Low (Minor cosmetic touchup)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Detailed Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full text-sm border rounded-lg p-2"
                      placeholder="Describe the problem and when it occurs..."
                      value={complaintForm.description}
                      onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowComplaintModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Registering...' : 'Register Complaint'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHostel;

