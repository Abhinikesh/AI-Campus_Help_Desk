/**
 * client/src/pages/AdminHostel/index.jsx
 * Admin & Warden Hostel Administration Hub:
 * Inventory (Hostels/Rooms/Beds), Applications Review Queue, Bed Allocation,
 * Circulation Desk (Check-In/Check-Out), Transfer Approvals, Maintenance Hub, Policy & CSV Exports.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import hostelService from '../../services/hostel.service';
import {
  Building,
  Home,
  Bed,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  RotateCw,
  Send,
  Wrench,
  Download,
  Settings,
  X,
  Phone,
  Mail,
  UserCheck,
  LogOut,
  AlertTriangle,
  Info,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const AdminHostel = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  // 'inventory' | 'applications' | 'allocations' | 'circulation' | 'transfers' | 'maintenance' | 'policy'

  // Hostels & Inventory state
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);

  // Modals state
  const [showAddHostelModal, setShowAddHostelModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showAddBedModal, setShowAddBedModal] = useState(false);

  // Forms
  const [hostelForm, setHostelForm] = useState({
    name: '',
    code: '',
    type: 'boys',
    genderEligibility: 'male',
    building: '',
    campusLocation: 'Main Campus',
    contactNumber: '',
  });

  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    floor: 0,
    roomType: 'double',
    capacity: 2,
    facilities: 'Attached Washroom, Study Table',
  });

  const [bedForm, setBedForm] = useState({
    roomId: '',
    bedNumber: '',
  });

  // Applications Review state
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('approved');
  const [reviewComments, setReviewComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [waitlistNumber, setWaitlistNumber] = useState('');

  // Allocation state
  const [allocations, setAllocations] = useState([]);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    applicationId: '',
    studentId: '',
    hostelId: '',
    roomId: '',
    bedId: '',
  });
  const [availableBedsForAlloc, setAvailableBedsForAlloc] = useState([]);

  // Circulation Desk state (Check-in / Check-out)
  const [circulationMode, setCirculationMode] = useState('check_in'); // 'check_in' | 'check_out'
  const [activeOccupancies, setActiveOccupancies] = useState([]);
  const [checkInForm, setCheckInForm] = useState({
    allocationId: '',
    inventoryCondition: 'Pristine condition',
    keysIssued: 1,
    notes: '',
  });
  const [checkOutForm, setCheckOutForm] = useState({
    allocationId: '',
    roomCondition: 'Good condition',
    keysReturned: true,
    damageFee: 0,
    clearanceStatus: 'cleared',
    clearanceNotes: '',
  });

  // Transfers state
  const [transfers, setTransfers] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferDecision, setTransferDecision] = useState('approved');
  const [transferComments, setTransferComments] = useState('');
  const [transferTarget, setTransferTarget] = useState({
    newHostelId: '',
    newRoomId: '',
    newBedId: '',
  });

  // Maintenance state
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintStatus, setComplaintStatus] = useState('in-progress');
  const [adminResponse, setAdminResponse] = useState('');

  // Policy state
  const [policy, setPolicy] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // 1. Initial Load Metrics & Hostels
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, hostelsRes, policyRes] = await Promise.all([
        hostelService.getAdminMetrics(),
        hostelService.getHostels(),
        hostelService.getPolicy(),
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (hostelsRes.success) {
        setHostels(hostelsRes.data);
        if (hostelsRes.data.length > 0 && !selectedHostelId) {
          setSelectedHostelId(hostelsRes.data[0]._id);
        }
      }
      if (policyRes.success) setPolicy(policyRes.data);
    } catch (err) {
      showToast('Failed to load hostel administration data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedHostelId, showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Rooms and Beds when selectedHostelId changes
  const loadHostelInventory = useCallback(async () => {
    if (!selectedHostelId) return;
    try {
      const [roomsRes, bedsRes] = await Promise.all([
        hostelService.getRooms({ hostelId: selectedHostelId }),
        hostelService.getBeds({ hostelId: selectedHostelId }),
      ]);
      if (roomsRes.success) setRooms(roomsRes.data);
      if (bedsRes.success) setBeds(bedsRes.data);
    } catch (err) {
      showToast('Failed to load room inventory', 'error');
    }
  }, [selectedHostelId, showToast]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadHostelInventory();
    }
  }, [activeTab, selectedHostelId, loadHostelInventory]);

  // Load Tab Specific Data
  const loadTabData = useCallback(async () => {
    try {
      if (activeTab === 'applications') {
        const res = await hostelService.getApplications();
        if (res.success) setApplications(res.data);
      } else if (activeTab === 'allocations' || activeTab === 'circulation') {
        const res = await hostelService.getAllocations();
        if (res.success) setAllocations(res.data);
      } else if (activeTab === 'transfers') {
        const res = await hostelService.getTransfers();
        if (res.success) setTransfers(res.data);
      } else if (activeTab === 'maintenance') {
        const res = await hostelService.getComplaints();
        if (res.success) setComplaints(res.data);
      }
    } catch (err) {
      showToast('Failed to load records', 'error');
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, loadTabData]);

  // Handle Add Hostel
  const handleAddHostelSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await hostelService.createHostel(hostelForm);
      if (res.success) {
        showToast(`Hostel '${res.data.name}' created!`, 'success');
        setShowAddHostelModal(false);
        setHostelForm({
          name: '',
          code: '',
          type: 'boys',
          genderEligibility: 'male',
          building: '',
          campusLocation: 'Main Campus',
          contactNumber: '',
        });
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create hostel', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Room
  const handleAddRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        hostelId: selectedHostelId,
        roomNumber: roomForm.roomNumber,
        floor: Number(roomForm.floor),
        roomType: roomForm.roomType,
        capacity: Number(roomForm.capacity),
        facilities: roomForm.facilities.split(',').map((f) => f.trim()),
      };
      const res = await hostelService.createRoom(payload);
      if (res.success) {
        showToast(`Room ${res.data.roomNumber} created!`, 'success');
        setShowAddRoomModal(false);
        setRoomForm({
          roomNumber: '',
          floor: 0,
          roomType: 'double',
          capacity: 2,
          facilities: 'Attached Washroom, Study Table',
        });
        loadHostelInventory();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Bed
  const handleAddBedSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await hostelService.createBed(bedForm);
      if (res.success) {
        showToast(`Bed ${res.data.bedNumber} added successfully!`, 'success');
        setShowAddBedModal(false);
        setBedForm({ roomId: '', bedNumber: '' });
        loadHostelInventory();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add bed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Application Review Submit
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewDecision === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
      showToast('Please provide a detailed rejection reason (min 5 characters)', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        decision: reviewDecision,
        comments: reviewComments,
        rejectionReason: reviewDecision === 'rejected' ? rejectionReason : undefined,
        waitlistNumber: reviewDecision === 'waitlisted' ? waitlistNumber : undefined,
      };

      const res = await hostelService.reviewApplication(selectedApp._id, payload);
      if (res.success) {
        showToast(`Application marked as ${reviewDecision}!`, 'success');
        setReviewModalOpen(false);
        loadTabData();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to review application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Allocate Modal for Approved Application
  const openAllocateModal = async (app) => {
    setSelectedApp(app);
    setAllocateForm({
      applicationId: app._id,
      studentId: app.student?._id || '',
      hostelId: app.preferredHostels?.[0]?._id || selectedHostelId || '',
      roomId: '',
      bedId: '',
    });

    try {
      const bedsRes = await hostelService.getBeds({
        hostelId: app.preferredHostels?.[0]?._id || selectedHostelId,
        status: 'available',
      });
      if (bedsRes.success) {
        setAvailableBedsForAlloc(bedsRes.data);
      }
    } catch (_) {}

    setShowAllocateModal(true);
  };

  // Handle Allocation Submit
  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!allocateForm.bedId || !allocateForm.hostelId) {
      showToast('Please select a target hostel and available bed', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const selectedBed = availableBedsForAlloc.find((b) => b._id === allocateForm.bedId);
      const payload = {
        studentId: allocateForm.studentId,
        applicationId: allocateForm.applicationId,
        hostelId: allocateForm.hostelId,
        roomId: selectedBed?.room?._id || selectedBed?.room,
        bedId: allocateForm.bedId,
      };

      const res = await hostelService.allocateBed(payload);
      if (res.success) {
        showToast('Bed allocated successfully!', 'success');
        setShowAllocateModal(false);
        loadTabData();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to allocate bed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Check-In Submit
  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!checkInForm.allocationId) {
      showToast('Please select an allocation to check in', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await hostelService.checkInStudent(checkInForm.allocationId, {
        inventoryCondition: checkInForm.inventoryCondition,
        keysIssued: Number(checkInForm.keysIssued) || 1,
        notes: checkInForm.notes,
      });
      if (res.success) {
        showToast('Student check-in recorded successfully!', 'success');
        setCheckInForm({ allocationId: '', inventoryCondition: 'Pristine condition', keysIssued: 1, notes: '' });
        loadTabData();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Check-Out Submit
  const handleCheckOutSubmit = async (e) => {
    e.preventDefault();
    if (!checkOutForm.allocationId) {
      showToast('Please select an active allocation to check out', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await hostelService.checkOutStudent(checkOutForm.allocationId, {
        roomCondition: checkOutForm.roomCondition,
        keysReturned: checkOutForm.keysReturned,
        damageAssessmentInPaise: Math.round(Number(checkOutForm.damageFee) * 100) || 0,
        clearanceStatus: checkOutForm.clearanceStatus,
        clearanceNotes: checkOutForm.clearanceNotes,
      });
      if (res.success) {
        showToast('Check-out completed and bed released!', 'success');
        setCheckOutForm({
          allocationId: '',
          roomCondition: 'Good condition',
          keysReturned: true,
          damageFee: 0,
          clearanceStatus: 'cleared',
          clearanceNotes: '',
        });
        loadTabData();
        loadInitialData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Check-out failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
                <Building className="text-blue-600" size={28} />
                Hostel Administration & Warden Desk
              </h1>
              <p className="cs-page-subtitle">
                Residential buildings, room inventory, student applications, bed allocation & circulation desk.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadInitialData}
                className="cs-btn cs-btn-secondary flex items-center gap-1.5"
              >
                <RotateCw size={16} /> Refresh
              </button>
              <a
                href={hostelService.exportCsvUrl('occupancy', selectedHostelId)}
                download
                className="cs-btn cs-btn-primary flex items-center gap-1.5"
              >
                <Download size={16} /> Export CSV
              </a>
            </div>
          </div>

          {/* ── Metric Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Hostels</div>
              <div className="text-xl font-bold text-gray-800">{metrics?.totalHostels || 0}</div>
            </div>
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Total Beds</div>
              <div className="text-xl font-bold text-gray-800">{metrics?.totalBeds || 0}</div>
            </div>
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Occupied Beds</div>
              <div className="text-xl font-bold text-blue-600">{metrics?.occupiedBeds || 0}</div>
            </div>
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Available Beds</div>
              <div className="text-xl font-bold text-emerald-600">{metrics?.availableBeds || 0}</div>
            </div>
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Occupancy Rate</div>
              <div className="text-xl font-bold text-purple-600">{metrics?.occupancyRate || 0}%</div>
            </div>
            <div className="cs-card p-3">
              <div className="text-xs text-gray-400 font-medium">Pending Apps</div>
              <div className="text-xl font-bold text-amber-600">{metrics?.pendingApps || 0}</div>
            </div>
          </div>

          {/* ── Navigation Tabs ── */}
          <div className="flex border-b border-gray-200 mb-6 space-x-2 overflow-x-auto">
            {[
              { id: 'inventory', label: 'Hostels & Rooms', icon: Building },
              { id: 'applications', label: 'Applications Queue', icon: Send },
              { id: 'allocations', label: 'Allocations', icon: Bed },
              { id: 'circulation', label: 'Check-In / Out Desk', icon: UserCheck },
              { id: 'transfers', label: 'Room Transfers', icon: RotateCw },
              { id: 'maintenance', label: 'Maintenance Hub', icon: Wrench },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
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

          {/* ── TAB 1: HOSTELS & ROOMS INVENTORY ── */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-600">Select Hostel:</label>
                  <select
                    className="border rounded-lg p-2 text-sm bg-white font-medium"
                    value={selectedHostelId}
                    onChange={(e) => setSelectedHostelId(e.target.value)}
                  >
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name} ({h.code} • {h.availableBeds}/{h.totalBeds} Beds Free)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddHostelModal(true)}
                    className="cs-btn cs-btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Hostel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddRoomModal(true)}
                    className="cs-btn cs-btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBedModal(true)}
                    className="cs-btn cs-btn-primary text-xs flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Bed
                  </button>
                </div>
              </div>

              {/* Rooms & Beds Grid */}
              {rooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => {
                    const roomBeds = beds.filter((b) => String(b.room?._id || b.room) === String(room._id));
                    return (
                      <div key={room._id} className="cs-card p-4 border-t-2 border-t-blue-500">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-base text-gray-800">
                              Room {room.roomNumber}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">Floor {room.floor}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                              room.status === 'full'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {room.occupiedBeds}/{room.capacity} Beds
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 capitalize mb-3">
                          Type: {room.roomType} • Amenities: {room.facilities?.join(', ') || 'Standard'}
                        </div>

                        {/* Beds inside Room */}
                        <div className="space-y-1.5 border-t pt-2">
                          <div className="text-[11px] font-medium text-gray-400">Beds in this Room:</div>
                          {roomBeds.length > 0 ? (
                            roomBeds.map((bed) => (
                              <div
                                key={bed._id}
                                className="flex justify-between items-center text-xs p-1.5 bg-gray-50 rounded"
                              >
                                <span className="font-semibold text-gray-700">Bed {bed.bedNumber}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    bed.status === 'occupied'
                                      ? 'bg-blue-100 text-blue-800'
                                      : bed.status === 'allocated'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {bed.status === 'occupied' && bed.currentStudent
                                    ? `Occupied: ${bed.currentStudent.fullName}`
                                    : bed.status.toUpperCase()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-400 italic">No beds configured yet.</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">
                  No rooms created for this hostel yet. Click &quot;Add Room&quot; above to begin inventory setup.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: APPLICATIONS QUEUE ── */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-gray-900">Student Accommodation Applications</h2>
              </div>

              {applications.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">App #</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Gender</th>
                          <th className="py-3 px-4">Program / Sem</th>
                          <th className="py-3 px-4">Distance</th>
                          <th className="py-3 px-4">Requested Type</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {applications.map((app) => (
                          <tr key={app._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono font-medium text-blue-600">
                              {app.applicationNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800">{app.student?.fullName}</div>
                              <div className="text-xs text-gray-400">{app.student?.rollNumber}</div>
                            </td>
                            <td className="py-3 px-4 capitalize text-xs">{app.student?.gender}</td>
                            <td className="py-3 px-4 text-xs">
                              {app.student?.program} • Sem {app.student?.semester}
                            </td>
                            <td className="py-3 px-4 text-xs">{app.distanceFromCollegeKm} km</td>
                            <td className="py-3 px-4 capitalize text-xs">{app.requestedRoomType}</td>
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
                            <td className="py-3 px-4 text-right space-x-2">
                              {app.status === 'submitted' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setReviewModalOpen(true);
                                  }}
                                  className="cs-btn cs-btn-secondary text-xs py-1 px-2.5"
                                >
                                  Review
                                </button>
                              )}
                              {app.status === 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => openAllocateModal(app)}
                                  className="cs-btn cs-btn-primary text-xs py-1 px-2.5"
                                >
                                  Allocate Bed
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">No applications to display.</div>
              )}
            </div>
          )}

          {/* ── TAB 3: ALLOCATIONS TABLE ── */}
          {activeTab === 'allocations' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900">Active & Historical Bed Allocations</h2>

              {allocations.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Alloc #</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Hostel</th>
                          <th className="py-3 px-4">Room & Bed</th>
                          <th className="py-3 px-4">Start Date</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allocations.map((alloc) => (
                          <tr key={alloc._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono font-medium text-blue-600">
                              {alloc.allocationNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800">{alloc.student?.fullName}</div>
                              <div className="text-xs text-gray-400">{alloc.student?.rollNumber}</div>
                            </td>
                            <td className="py-3 px-4 text-xs font-medium">{alloc.hostel?.name}</td>
                            <td className="py-3 px-4 text-xs">
                              Room {alloc.room?.roomNumber} • Bed {alloc.bed?.bedNumber}
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {new Date(alloc.startDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  alloc.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : alloc.status === 'allocated'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {alloc.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">No allocations found.</div>
              )}
            </div>
          )}

          {/* ── TAB 4: CIRCULATION DESK (CHECK-IN & CHECK-OUT) ── */}
          {activeTab === 'circulation' && (
            <div className="space-y-6">
              <div className="flex gap-2 border-b pb-3">
                <button
                  type="button"
                  onClick={() => setCirculationMode('check_in')}
                  className={`py-2 px-4 rounded-lg font-semibold text-xs transition-colors ${
                    circulationMode === 'check_in'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Student Check-In
                </button>
                <button
                  type="button"
                  onClick={() => setCirculationMode('check_out')}
                  className={`py-2 px-4 rounded-lg font-semibold text-xs transition-colors ${
                    circulationMode === 'check_out'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Student Check-Out & Clearance
                </button>
              </div>

              {circulationMode === 'check_in' ? (
                <div className="cs-card p-6 max-w-xl">
                  <h3 className="font-bold text-base text-gray-900 mb-4">Record Physical Check-In</h3>
                  <form onSubmit={handleCheckInSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Select Pending Allocation
                      </label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={checkInForm.allocationId}
                        onChange={(e) => setCheckInForm({ ...checkInForm, allocationId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Allocation --</option>
                        {allocations
                          .filter((a) => a.status === 'allocated')
                          .map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.student?.fullName} ({a.student?.rollNumber}) - {a.hostel?.code} Room {a.room?.roomNumber}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Room Inventory & Condition Notes
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="e.g. Pristine condition, 1 mattress, 1 study desk, 1 chair"
                        value={checkInForm.inventoryCondition}
                        onChange={(e) =>
                          setCheckInForm({ ...checkInForm, inventoryCondition: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Physical Keys Issued
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full border rounded-lg p-2 text-sm"
                        value={checkInForm.keysIssued}
                        onChange={(e) => setCheckInForm({ ...checkInForm, keysIssued: e.target.value })}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary w-full text-sm"
                    >
                      {submitting ? 'Confirming...' : 'Confirm Student Check-In'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="cs-card p-6 max-w-xl">
                  <h3 className="font-bold text-base text-gray-900 mb-4">Record Departure & Release Bed</h3>
                  <form onSubmit={handleCheckOutSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Select Actively Checked-In Allocation
                      </label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={checkOutForm.allocationId}
                        onChange={(e) => setCheckOutForm({ ...checkOutForm, allocationId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Checked-In Student --</option>
                        {allocations
                          .filter((a) => a.status === 'active')
                          .map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.student?.fullName} ({a.student?.rollNumber}) - {a.hostel?.code} Room {a.room?.roomNumber}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Departure Room Inspection Condition
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="e.g. Clean condition, no damage"
                        value={checkOutForm.roomCondition}
                        onChange={(e) => setCheckOutForm({ ...checkOutForm, roomCondition: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Damage Assessment Charge (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="0"
                        value={checkOutForm.damageFee}
                        onChange={(e) => setCheckOutForm({ ...checkOutForm, damageFee: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Clearance Status
                      </label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={checkOutForm.clearanceStatus}
                        onChange={(e) => setCheckOutForm({ ...checkOutForm, clearanceStatus: e.target.value })}
                      >
                        <option value="cleared">Cleared (Full deposit eligible)</option>
                        <option value="withheld">Withheld (Pending damages/dues)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary w-full text-sm"
                    >
                      {submitting ? 'Processing...' : 'Complete Check-Out & Release Bed'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: ROOM TRANSFERS ── */}
          {activeTab === 'transfers' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900">Student Room Transfer Requests</h2>

              {transfers.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Req #</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Current Bed</th>
                          <th className="py-3 px-4">Reason</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transfers.map((tr) => (
                          <tr key={tr._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono font-medium text-blue-600">
                              {tr.requestNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800">{tr.student?.fullName}</div>
                              <div className="text-xs text-gray-400">{tr.student?.rollNumber}</div>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {tr.currentHostel?.code} Room {tr.currentRoom?.roomNumber} (Bed {tr.currentBed?.bedNumber})
                            </td>
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
                            <td className="py-3 px-4 text-right">
                              {tr.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTransfer(tr);
                                    setTransferModalOpen(true);
                                  }}
                                  className="cs-btn cs-btn-secondary text-xs py-1 px-2.5"
                                >
                                  Review
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">No transfer requests pending.</div>
              )}
            </div>
          )}

          {/* ── TAB 6: MAINTENANCE HUB ── */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900">Hostel Maintenance & Complaints</h2>

              {complaints.length > 0 ? (
                <div className="cs-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase font-medium">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Raised By</th>
                          <th className="py-3 px-4">Hostel & Room</th>
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {complaints.map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-xs text-gray-500">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">{c.raisedBy?.name}</td>
                            <td className="py-3 px-4 text-xs">
                              {c.hostel?.code} {c.room ? `• Room ${c.room.roomNumber}` : ''}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-800 text-xs">{c.title}</div>
                              <div className="text-[11px] text-gray-400 truncate max-w-xs">{c.description}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full font-semibold uppercase ${
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
                                className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
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
                            <td className="py-3 px-4 text-right">
                              {c.status !== 'resolved' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedComplaint(c);
                                    setComplaintStatus(c.status);
                                    setAdminResponse(c.adminResponse || '');
                                    setComplaintModalOpen(true);
                                  }}
                                  className="cs-btn cs-btn-secondary text-xs py-1 px-2.5"
                                >
                                  Update
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="cs-card p-12 text-center text-gray-500">No maintenance tickets found.</div>
              )}
            </div>
          )}

          {/* ── MODAL: ADD HOSTEL ── */}
          {showAddHostelModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Add Residential Hostel Building</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddHostelModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddHostelSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Hostel Name</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="e.g. Ramanujan Boys Hostel 1"
                      value={hostelForm.name}
                      onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hostel Code</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm uppercase"
                        placeholder="e.g. H-BH1"
                        value={hostelForm.code}
                        onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hostel Type</label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={hostelForm.type}
                        onChange={(e) => setHostelForm({ ...hostelForm, type: e.target.value })}
                      >
                        <option value="boys">Boys</option>
                        <option value="girls">Girls</option>
                        <option value="international">International</option>
                        <option value="postgraduate">Postgraduate</option>
                        <option value="staff">Staff</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Building Details</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="e.g. North Campus, Block C"
                      value={hostelForm.building}
                      onChange={(e) => setHostelForm({ ...hostelForm, building: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Number</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="e.g. +91 9876543210"
                      value={hostelForm.contactNumber}
                      onChange={(e) => setHostelForm({ ...hostelForm, contactNumber: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddHostelModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Creating...' : 'Create Hostel'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: ADD ROOM ── */}
          {showAddRoomModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Add Room to Hostel</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddRoomModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddRoomSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Room Number</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="e.g. 101"
                        value={roomForm.roomNumber}
                        onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Floor</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="0"
                        value={roomForm.floor}
                        onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Room Type</label>
                      <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={roomForm.roomType}
                        onChange={(e) => {
                          const type = e.target.value;
                          const cap =
                            type === 'single' ? 1 : type === 'double' ? 2 : type === 'triple' ? 3 : 4;
                          setRoomForm({ ...roomForm, roomType: type, capacity: cap });
                        }}
                      >
                        <option value="single">Single Occupancy</option>
                        <option value="double">Double Occupancy</option>
                        <option value="triple">Triple Occupancy</option>
                        <option value="quad">Quad Occupancy</option>
                        <option value="dormitory">Dormitory</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Capacity</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full border rounded-lg p-2 text-sm"
                        value={roomForm.capacity}
                        onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Amenities</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="e.g. Attached Washroom, Balcony, AC"
                      value={roomForm.facilities}
                      onChange={(e) => setRoomForm({ ...roomForm, facilities: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddRoomModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Adding...' : 'Add Room'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: ADD BED ── */}
          {showAddBedModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Add Bed to Room</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddBedModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddBedSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Select Room</label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm"
                      value={bedForm.roomId}
                      onChange={(e) => setBedForm({ ...bedForm, roomId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Room --</option>
                      {rooms.map((r) => (
                        <option key={r._id} value={r._id}>
                          Room {r.roomNumber} ({r.occupiedBeds}/{r.capacity} beds currently)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Bed Number / Label
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm uppercase"
                      placeholder="e.g. B1, B2, Bed A"
                      value={bedForm.bedNumber}
                      onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddBedModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Adding...' : 'Add Bed'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: REVIEW APPLICATION ── */}
          {reviewModalOpen && selectedApp && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Review Application</h3>
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-gray-700">Student: </span>
                    {selectedApp.student?.fullName} ({selectedApp.student?.rollNumber})
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Gender / Program: </span>
                    {selectedApp.student?.gender} • {selectedApp.student?.program} (Sem {selectedApp.student?.semester})
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Distance from College: </span>
                    {selectedApp.distanceFromCollegeKm} km
                  </div>
                </div>

                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Decision</label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm"
                      value={reviewDecision}
                      onChange={(e) => setReviewDecision(e.target.value)}
                    >
                      <option value="approved">Approve Application</option>
                      <option value="waitlisted">Waitlist Application</option>
                      <option value="rejected">Reject Application</option>
                    </select>
                  </div>

                  {reviewDecision === 'waitlisted' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Waitlist Queue Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="e.g. 5"
                        value={waitlistNumber}
                        onChange={(e) => setWaitlistNumber(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {reviewDecision === 'rejected' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Rejection Reason (Min 5 chars)
                      </label>
                      <textarea
                        rows={2}
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="Reason for declining application..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Staff Comments (Optional)
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="Notes for student or warden records..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Saving...' : 'Submit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL: ALLOCATE BED ── */}
          {showAllocateModal && selectedApp && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-900">Allocate Hostel Bed</h3>
                  <button
                    type="button"
                    onClick={() => setShowAllocateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-blue-900">Student: </span>
                    {selectedApp.student?.fullName} ({selectedApp.student?.rollNumber})
                  </div>
                  <div>
                    <span className="font-semibold text-blue-900">Requested Type: </span>
                    {selectedApp.requestedRoomType}
                  </div>
                </div>

                <form onSubmit={handleAllocateSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Target Hostel</label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm"
                      value={allocateForm.hostelId}
                      onChange={async (e) => {
                        const hId = e.target.value;
                        setAllocateForm({ ...allocateForm, hostelId: hId, bedId: '' });
                        try {
                          const res = await hostelService.getBeds({ hostelId: hId, status: 'available' });
                          if (res.success) setAvailableBedsForAlloc(res.data);
                        } catch (_) {}
                      }}
                      required
                    >
                      {hostels.map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name} ({h.type} • {h.genderEligibility})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Available Bed
                    </label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm"
                      value={allocateForm.bedId}
                      onChange={(e) => setAllocateForm({ ...allocateForm, bedId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Available Bed --</option>
                      {availableBedsForAlloc.map((b) => (
                        <option key={b._id} value={b._id}>
                          Room {b.room?.roomNumber} (Floor {b.room?.floor}) • Bed {b.bedNumber} ({b.room?.roomType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAllocateModal(false)}
                      className="cs-btn cs-btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="cs-btn cs-btn-primary text-sm"
                    >
                      {submitting ? 'Allocating...' : 'Commit Bed Allocation'}
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

export default AdminHostel;

