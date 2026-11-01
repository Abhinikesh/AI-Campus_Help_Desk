/**
 * client/src/pages/AdminTransport/index.jsx
 * Comprehensive Transport Administration Desk — Fleet, Routes, Stops, Allocations,
 * Document Expiry Alerts, Daily Operations, Maintenance, and Reporting.
 */
import React, { useState, useEffect } from 'react';
import {
  Bus,
  MapPin,
  Users,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Download,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Wrench,
  FileCheck,
  Eye,
  FileText,
} from 'lucide-react';
import transportService from '../../services/transport.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const AdminTransport = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState({ vehicleAlerts: [], driverAlerts: [] });
  const [activeTab, setActiveTab] = useState('routes');

  // Datasets
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [applications, setApplications] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [incidents, setIncidents] = useState([]);

  // Modals
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReviewAppModal, setShowReviewAppModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Selected item targets
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);

  // Forms
  const [routeForm, setRouteForm] = useState({
    name: '',
    code: '',
    startLocation: '',
    endLocation: '',
    estimatedDurationMinutes: 45,
    maxCapacity: 40,
    operationalDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    morningDepartureTime: '07:30',
    eveningDepartureTime: '17:15',
  });

  const [vehicleForm, setVehicleForm] = useState({
    registrationNumber: '',
    vehicleCode: '',
    vehicleType: 'bus',
    makeAndModel: '',
    seatingCapacity: 40,
    ownershipType: 'institution_owned',
    fuelType: 'diesel',
  });

  const [stopForm, setStopForm] = useState({
    stopName: '',
    sequence: 1,
    scheduledMorningPickupTime: '07:45',
    scheduledEveningDropTime: '17:45',
    address: '',
  });

  const [assignForm, setAssignForm] = useState({
    vehicleId: '',
    driverUserId: '',
    attendantUserId: '',
  });

  const [reviewForm, setReviewForm] = useState({
    decision: 'approved',
    comments: '',
    rejectionReason: '',
  });

  const [allocateForm, setAllocateForm] = useState({
    studentId: '',
    routeId: '',
    pickupStopId: '',
  });

  const [staffForm, setStaffForm] = useState({
    userId: '',
    staffRole: 'driver',
    fullName: '',
    phone: '',
    licenseNumber: '',
    licenseCategory: 'heavy_passenger',
    licenseExpiryDate: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleId: '',
    maintenanceType: 'routine_service',
    description: '',
    serviceProvider: '',
    costInPaise: 250000,
    odometerReadingKm: 15000,
  });

  const [submitting, setSubmitting] = useState(false);
  const [stopsList, setStopsList] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, rRes, vRes, sRes, aRes, allocRes, tRes, maintRes, incRes] = await Promise.all([
        transportService.getMetrics(),
        transportService.getRoutes(),
        transportService.getVehicles(),
        transportService.getStaff(),
        transportService.getApplications(),
        transportService.getAllocations(),
        transportService.getTrips(),
        transportService.getMaintenance(),
        transportService.getIncidents(),
      ]);

      setMetrics(mRes.data || {});
      setExpiringDocs(mRes.data?.expiringDocuments || { vehicleAlerts: [], driverAlerts: [] });
      setRoutes(rRes.data || []);
      setVehicles(vRes.data || []);
      setStaff(sRes.data || []);
      setApplications(aRes.data || []);
      setAllocations(allocRes.data || []);
      setTrips(tRes.data || []);
      setMaintenance(mRes.data || []);
      setIncidents(incRes.data || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load transport desk data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When allocating student, fetch stops for selected route
  useEffect(() => {
    if (!allocateForm.routeId) {
      setStopsList([]);
      return;
    }
    const fetchStops = async () => {
      try {
        const res = await transportService.getStops(allocateForm.routeId);
        setStopsList(res.data || []);
      } catch (err) {
        showToast('Failed to load stops', 'error');
      }
    };
    fetchStops();
  }, [allocateForm.routeId]);

  // Handlers
  const handleAddRoute = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await transportService.createRoute({
        ...routeForm,
        schedule: {
          morningDepartureTime: routeForm.morningDepartureTime,
          eveningDepartureTime: routeForm.eveningDepartureTime,
        },
      });
      showToast('Route created successfully', 'success');
      setShowAddRouteModal(false);
      setRouteForm({
        name: '',
        code: '',
        startLocation: '',
        endLocation: '',
        estimatedDurationMinutes: 45,
        maxCapacity: 40,
        operationalDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        morningDepartureTime: '07:30',
        eveningDepartureTime: '17:15',
      });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create route', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await transportService.createVehicle(vehicleForm);
      showToast('Vehicle registered successfully', 'success');
      setShowAddVehicleModal(false);
      setVehicleForm({
        registrationNumber: '',
        vehicleCode: '',
        vehicleType: 'bus',
        makeAndModel: '',
        seatingCapacity: 40,
        ownershipType: 'institution_owned',
        fuelType: 'diesel',
      });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to register vehicle', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!selectedRoute?._id) return;
    try {
      setSubmitting(true);
      await transportService.createStop(selectedRoute._id, stopForm);
      showToast('Stop added to route successfully', 'success');
      setShowAddStopModal(false);
      setStopForm({ stopName: '', sequence: 1, scheduledMorningPickupTime: '07:45', scheduledEveningDropTime: '17:45', address: '' });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add stop', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignVehicleStaff = async (e) => {
    e.preventDefault();
    if (!selectedRoute?._id) return;
    try {
      setSubmitting(true);
      await transportService.assignVehicleAndStaff(selectedRoute._id, assignForm);
      showToast('Operational assignments updated successfully', 'success');
      setShowAssignModal(false);
      setAssignForm({ vehicleId: '', driverUserId: '', attendantUserId: '' });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign vehicle/staff', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewApplication = async (e) => {
    e.preventDefault();
    if (!selectedApp?._id) return;
    try {
      setSubmitting(true);
      await transportService.reviewApplication(selectedApp._id, reviewForm);
      showToast(`Application marked as ${reviewForm.decision}`, 'success');
      setShowReviewAppModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Review submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateStudent = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await transportService.allocateStudent(allocateForm);
      showToast('Student successfully allocated to route', 'success');
      setShowAllocateModal(false);
      setAllocateForm({ studentId: '', routeId: '', pickupStopId: '' });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Allocation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await transportService.createStaff(staffForm);
      showToast('Staff registered successfully', 'success');
      setShowAddStaffModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to register staff', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordMaintenance = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await transportService.recordMaintenance(maintenanceForm);
      showToast('Maintenance service logged', 'success');
      setShowMaintenanceModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record maintenance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAllocation = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this transport allocation? The seat will be released immediately.')) {
      return;
    }
    try {
      await transportService.cancelAllocation(id, { reason: 'Administrative withdrawal' });
      showToast('Allocation cancelled and capacity released', 'success');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cancellation failed', 'error');
    }
  };

  const totalAlerts = (expiringDocs?.vehicleAlerts?.length || 0) + (expiringDocs?.driverAlerts?.length || 0);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar />

        <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-semibold tracking-wide text-xs uppercase mb-1">
                <Bus size={16} /> Campus Transport Administration
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Transport & Fleet Desk
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Centralized fleet inventory, route allocation, staff assignments, daily trips, and regulatory compliance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                title="Refresh Metrics"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={transportService.exportCsvUrl('routes')}
                  download
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                >
                  <Download size={14} /> Export Routes
                </a>
                <a
                  href={transportService.exportCsvUrl('allocations')}
                  download
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                >
                  <Download size={14} /> Export Allocations
                </a>
              </div>
            </div>
          </div>

          {/* Expiring Documents Warning Banner */}
          {totalAlerts > 0 && (
            <div className="p-4 rounded-xl border border-amber-800/60 bg-amber-950/20 text-amber-200 flex items-start gap-3.5">
              <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-1">
                <span className="font-bold text-sm block text-amber-300">
                  Document Expiry Notice: {totalAlerts} upcoming or expired document(s) detected!
                </span>
                <p className="text-amber-300/80">
                  Regulatory compliance requires valid insurance, fitness certificates, and driver licenses before vehicles can operate.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {expiringDocs?.vehicleAlerts?.map((a, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/50">
                      Bus {a.vehicleCode}: {a.documentType} ({a.daysRemaining > 0 ? `${a.daysRemaining}d left` : 'EXPIRED'})
                    </span>
                  ))}
                  {expiringDocs?.driverAlerts?.map((d, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/50">
                      Driver {d.fullName}: License ({d.daysRemaining > 0 ? `${d.daysRemaining}d left` : 'EXPIRED'})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Total Fleet</span>
                <span className="text-2xl font-bold text-white">{metrics.totalVehicles || 0}</span>
                <span className="text-xs text-slate-500 block mt-0.5">{metrics.activeVehicles || 0} active</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Active Routes</span>
                <span className="text-2xl font-bold text-indigo-400">{metrics.activeRoutes || 0}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Of {metrics.totalRoutes || 0} total</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Fleet Capacity</span>
                <span className="text-2xl font-bold text-white">{metrics.totalCapacity || 0}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Passenger seats</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Allocated Students</span>
                <span className="text-2xl font-bold text-emerald-400">{metrics.allocatedStudents || 0}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Active passes</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Occupancy Rate</span>
                <span className="text-2xl font-bold text-purple-400">{metrics.occupancyRate || 0}%</span>
                <span className="text-xs text-slate-500 block mt-0.5">{metrics.availableCapacity || 0} seats open</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-xs text-slate-400 block mb-1">Pending Apps</span>
                <span className="text-2xl font-bold text-amber-400">{metrics.pendingApps || 0}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Awaiting review</span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-sm font-medium gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('routes')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'routes'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin size={16} /> Routes & Stops ({routes.length})
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'vehicles'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bus size={16} /> Fleet Inventory ({vehicles.length})
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'staff'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={16} /> Drivers & Attendants ({staff.length})
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'applications'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar size={16} /> Applications ({applications.length})
            </button>
            <button
              onClick={() => setActiveTab('allocations')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'allocations'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 size={16} /> Active Allocations ({allocations.length})
            </button>
            <button
              onClick={() => setActiveTab('trips')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'trips'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock size={16} /> Daily Trips ({trips.length})
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'maintenance'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench size={16} /> Maintenance & Incidents
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" text="Loading transport records..." />
            </div>
          ) : (
            <>
              {/* TAB 1: ROUTES & STOPS */}
              {activeTab === 'routes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Configured Transport Routes</h3>
                    <button
                      onClick={() => setShowAddRouteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white"
                    >
                      <Plus size={15} /> Add New Route
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Code</th>
                          <th className="p-3.5">Route Name</th>
                          <th className="p-3.5">Start → Destination</th>
                          <th className="p-3.5">Schedule</th>
                          <th className="p-3.5">Assigned Vehicle</th>
                          <th className="p-3.5">Assigned Driver</th>
                          <th className="p-3.5">Capacity</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {routes.map((r) => (
                          <tr key={r._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-bold text-indigo-400">{r.code}</td>
                            <td className="p-3.5 font-medium text-white">{r.name}</td>
                            <td className="p-3.5 text-slate-400">
                              {r.startLocation} → {r.endLocation}
                            </td>
                            <td className="p-3.5">
                              {r.schedule?.morningDepartureTime || '07:30'} / {r.schedule?.eveningDepartureTime || '17:15'}
                            </td>
                            <td className="p-3.5">
                              {r.assignedVehicle ? (
                                <span className="text-emerald-400 font-medium">
                                  {r.assignedVehicle.vehicleCode} ({r.assignedVehicle.registrationNumber})
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              {r.assignedDriver ? r.assignedDriver.name : <span className="text-slate-500 italic">Unassigned</span>}
                            </td>
                            <td className="p-3.5">
                              <span className="font-semibold text-white">{r.allocatedStudentsCount}</span> / {r.maxCapacity}
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedRoute(r);
                                  setShowAddStopModal(true);
                                }}
                                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              >
                                + Stop
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRoute(r);
                                  setShowAssignModal(true);
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium"
                              >
                                Assign
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: FLEET INVENTORY */}
              {activeTab === 'vehicles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Centralized Fleet Inventory</h3>
                    <button
                      onClick={() => setShowAddVehicleModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white"
                    >
                      <Plus size={15} /> Register Vehicle
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Code</th>
                          <th className="p-3.5">Registration</th>
                          <th className="p-3.5">Make & Model</th>
                          <th className="p-3.5">Seats</th>
                          <th className="p-3.5">Type & Fuel</th>
                          <th className="p-3.5">Assigned Route</th>
                          <th className="p-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {vehicles.map((v) => (
                          <tr key={v._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-bold text-indigo-400">{v.vehicleCode}</td>
                            <td className="p-3.5 font-semibold text-white">{v.registrationNumber}</td>
                            <td className="p-3.5">{v.makeAndModel}</td>
                            <td className="p-3.5 font-medium">{v.seatingCapacity} seats</td>
                            <td className="p-3.5 capitalize">{v.vehicleType} ({v.fuelType})</td>
                            <td className="p-3.5">
                              {v.assignedRoute ? (
                                <span className="text-emerald-400">{v.assignedRoute.code} ({v.assignedRoute.name})</span>
                              ) : (
                                <span className="text-slate-500 italic">Standby</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  v.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : v.status === 'under_maintenance'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {v.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: STAFF (DRIVERS & ATTENDANTS) */}
              {activeTab === 'staff' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Transport Operations Staff</h3>
                    <button
                      onClick={() => setShowAddStaffModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white"
                    >
                      <Plus size={15} /> Add Staff Profile
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Role</th>
                          <th className="p-3.5">Name</th>
                          <th className="p-3.5">Contact Phone</th>
                          <th className="p-3.5">License Number</th>
                          <th className="p-3.5">License Expiry</th>
                          <th className="p-3.5">Assigned Route</th>
                          <th className="p-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {staff.map((s) => (
                          <tr key={s._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-bold uppercase text-indigo-400">{s.staffRole}</td>
                            <td className="p-3.5 font-medium text-white">{s.fullName}</td>
                            <td className="p-3.5">{s.phone}</td>
                            <td className="p-3.5 font-mono">{s.licenseNumber || 'N/A'}</td>
                            <td className="p-3.5">
                              {s.licenseExpiryDate ? new Date(s.licenseExpiryDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-3.5">
                              {s.assignedRoute ? s.assignedRoute.code : <span className="text-slate-500 italic">Unassigned</span>}
                            </td>
                            <td className="p-3.5 capitalize">{s.availabilityStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: APPLICATIONS REVIEW */}
              {activeTab === 'applications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Student Transport Applications</h3>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">App Number</th>
                          <th className="p-3.5">Student</th>
                          <th className="p-3.5">Roll No</th>
                          <th className="p-3.5">Preferred Route</th>
                          <th className="p-3.5">Pickup Stop</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {applications.map((app) => (
                          <tr key={app._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-mono text-indigo-400">#{app.applicationNumber}</td>
                            <td className="p-3.5 font-semibold text-white">{app.student?.fullName}</td>
                            <td className="p-3.5 font-mono">{app.student?.rollNumber}</td>
                            <td className="p-3.5">{app.preferredRoute?.code} ({app.preferredRoute?.name})</td>
                            <td className="p-3.5">{app.preferredPickupStop?.stopName}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  app.status === 'allocated' || app.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : app.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {app.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              {app.status !== 'allocated' && (
                                <button
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setShowReviewAppModal(true);
                                  }}
                                  className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
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
              )}

              {/* TAB 5: ACTIVE ALLOCATIONS */}
              {activeTab === 'allocations' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Active Passenger Allocations</h3>
                    <button
                      onClick={() => setShowAllocateModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white"
                    >
                      <Plus size={15} /> + Allocate Student
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Pass ID</th>
                          <th className="p-3.5">Student</th>
                          <th className="p-3.5">Roll No</th>
                          <th className="p-3.5">Route</th>
                          <th className="p-3.5">Boarding Stop</th>
                          <th className="p-3.5">Fee (Paise)</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {allocations.map((a) => (
                          <tr key={a._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-mono text-indigo-400">{a.allocationNumber}</td>
                            <td className="p-3.5 font-semibold text-white">{a.student?.fullName}</td>
                            <td className="p-3.5 font-mono">{a.student?.rollNumber}</td>
                            <td className="p-3.5">{a.route?.code} ({a.route?.name})</td>
                            <td className="p-3.5">{a.pickupStop?.stopName}</td>
                            <td className="p-3.5">₹{(a.feeAmountInPaise / 100).toLocaleString('en-IN')}</td>
                            <td className="p-3.5 capitalize">{a.status}</td>
                            <td className="p-3.5 text-right">
                              {a.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleCancelAllocation(a._id)}
                                  className="px-2.5 py-1 rounded border border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60"
                                >
                                  Cancel Pass
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: TRIPS */}
              {activeTab === 'trips' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white">Daily Operational Trips</h3>
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Route</th>
                          <th className="p-3.5">Vehicle</th>
                          <th className="p-3.5">Driver</th>
                          <th className="p-3.5">Type</th>
                          <th className="p-3.5">Departure</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Delay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {trips.map((t) => (
                          <tr key={t._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-semibold text-indigo-400">{t.route?.code}</td>
                            <td className="p-3.5">{t.vehicle?.vehicleCode}</td>
                            <td className="p-3.5">{t.driver?.name}</td>
                            <td className="p-3.5 capitalize">{t.tripType.replace('_', ' ')}</td>
                            <td className="p-3.5">{new Date(t.scheduledDeparture).toLocaleTimeString()}</td>
                            <td className="p-3.5 capitalize font-medium">{t.status}</td>
                            <td className="p-3.5 text-amber-400">{t.delayMinutes > 0 ? `${t.delayMinutes} mins` : 'On time'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: MAINTENANCE & INCIDENTS */}
              {activeTab === 'maintenance' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Fleet Maintenance Logs</h3>
                    <button
                      onClick={() => setShowMaintenanceModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white"
                    >
                      <Plus size={15} /> + Record Service
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Vehicle</th>
                          <th className="p-3.5">Service Type</th>
                          <th className="p-3.5">Description</th>
                          <th className="p-3.5">Workshop / Provider</th>
                          <th className="p-3.5">Cost (INR)</th>
                          <th className="p-3.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {maintenance.map((m) => (
                          <tr key={m._id} className="hover:bg-slate-900/60 transition">
                            <td className="p-3.5 font-bold text-white">{m.vehicle?.vehicleCode}</td>
                            <td className="p-3.5 capitalize">{m.maintenanceType?.replace('_', ' ')}</td>
                            <td className="p-3.5">{m.description}</td>
                            <td className="p-3.5">{m.serviceProvider}</td>
                            <td className="p-3.5 font-semibold text-emerald-400">
                              ₹{(m.costInPaise / 100).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5">{new Date(m.serviceDate).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ADD ROUTE MODAL */}
          {showAddRouteModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Create New Transport Route</h3>
                  <button onClick={() => setShowAddRouteModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleAddRoute} className="space-y-3.5 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Route Code</label>
                      <input
                        type="text"
                        placeholder="TR-01"
                        value={routeForm.code}
                        onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Max Passenger Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={routeForm.maxCapacity}
                        onChange={(e) => setRouteForm({ ...routeForm, maxCapacity: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Route Name</label>
                    <input
                      type="text"
                      placeholder="Route 1 — Downtown Express"
                      value={routeForm.name}
                      onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Start Location</label>
                      <input
                        type="text"
                        placeholder="North Metro Terminal"
                        value={routeForm.startLocation}
                        onChange={(e) => setRouteForm({ ...routeForm, startLocation: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">End Destination</label>
                      <input
                        type="text"
                        placeholder="Main Campus South Gate"
                        value={routeForm.endLocation}
                        onChange={(e) => setRouteForm({ ...routeForm, endLocation: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowAddRouteModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Save Route</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADD VEHICLE MODAL */}
          {showAddVehicleModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Register Fleet Vehicle</h3>
                  <button onClick={() => setShowAddVehicleModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleAddVehicle} className="space-y-3.5 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle Code</label>
                      <input
                        type="text"
                        placeholder="BUS-01"
                        value={vehicleForm.vehicleCode}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleCode: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Registration Number</label>
                      <input
                        type="text"
                        placeholder="DL-01-AB-1234"
                        value={vehicleForm.registrationNumber}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Make & Model</label>
                    <input
                      type="text"
                      placeholder="Tata Starbus Ultra 40-Seater"
                      value={vehicleForm.makeAndModel}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, makeAndModel: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Seating Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={vehicleForm.seatingCapacity}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, seatingCapacity: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Fuel Type</label>
                      <select
                        value={vehicleForm.fuelType}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      >
                        <option value="diesel">Diesel</option>
                        <option value="cng">CNG</option>
                        <option value="electric">Electric</option>
                        <option value="petrol">Petrol</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowAddVehicleModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Save Vehicle</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADD STOP MODAL */}
          {showAddStopModal && selectedRoute && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Add Stop to {selectedRoute.code}</h3>
                  <button onClick={() => setShowAddStopModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleAddStop} className="space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Stop Name</label>
                    <input
                      type="text"
                      placeholder="Connaught Place Metro Gate 2"
                      value={stopForm.stopName}
                      onChange={(e) => setStopForm({ ...stopForm, stopName: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Sequence Number</label>
                      <input
                        type="number"
                        min="1"
                        value={stopForm.sequence}
                        onChange={(e) => setStopForm({ ...stopForm, sequence: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Morning Pickup Time</label>
                      <input
                        type="text"
                        placeholder="07:45"
                        value={stopForm.scheduledMorningPickupTime}
                        onChange={(e) => setStopForm({ ...stopForm, scheduledMorningPickupTime: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowAddStopModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Add Stop</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ASSIGN VEHICLE & STAFF MODAL */}
          {showAssignModal && selectedRoute && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Assign Vehicle & Staff: {selectedRoute.code}</h3>
                  <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleAssignVehicleStaff} className="space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Fleet Vehicle</label>
                    <select
                      value={assignForm.vehicleId}
                      onChange={(e) => setAssignForm({ ...assignForm, vehicleId: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="">-- Choose active vehicle --</option>
                      {vehicles.filter(v => v.status === 'active').map(v => (
                        <option key={v._id} value={v._id}>
                          {v.vehicleCode} ({v.registrationNumber}) — {v.seatingCapacity} seats
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Assign Driver</label>
                    <select
                      value={assignForm.driverUserId}
                      onChange={(e) => setAssignForm({ ...assignForm, driverUserId: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="">-- Choose licensed driver --</option>
                      {staff.filter(s => s.staffRole === 'driver').map(s => (
                        <option key={s.user?._id || s._id} value={s.user?._id || s.user}>
                          {s.fullName} ({s.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Confirm Assignment</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* REVIEW APPLICATION MODAL */}
          {showReviewAppModal && selectedApp && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Review Application #{selectedApp.applicationNumber}</h3>
                  <button onClick={() => setShowReviewAppModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleReviewApplication} className="space-y-3.5 text-sm">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div>Student: <span className="font-semibold text-white">{selectedApp.student?.fullName}</span></div>
                    <div>Roll: <span className="font-mono text-white">{selectedApp.student?.rollNumber}</span></div>
                    <div>Route: <span className="font-semibold text-indigo-400">{selectedApp.preferredRoute?.code}</span></div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Decision</label>
                    <select
                      value={reviewForm.decision}
                      onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="approved">Approve Application</option>
                      <option value="rejected">Reject Application</option>
                      <option value="waitlisted">Waitlist Application</option>
                    </select>
                  </div>
                  {reviewForm.decision === 'rejected' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Rejection Reason (min 5 chars)</label>
                      <textarea
                        rows={2}
                        value={reviewForm.rejectionReason}
                        onChange={(e) => setReviewForm({ ...reviewForm, rejectionReason: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowReviewAppModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Save Decision</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ALLOCATE STUDENT MODAL */}
          {showAllocateModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Allocate Passenger Seat</h3>
                  <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleAllocateStudent} className="space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Approved Application</label>
                    <select
                      value={allocateForm.studentId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        const matchedApp = applications.find(a => (a.student?._id || a.student) === sId);
                        setAllocateForm({
                          ...allocateForm,
                          studentId: sId,
                          routeId: matchedApp?.preferredRoute?._id || matchedApp?.preferredRoute || '',
                          pickupStopId: matchedApp?.preferredPickupStop?._id || matchedApp?.preferredPickupStop || '',
                        });
                      }}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="">-- Choose student application --</option>
                      {applications.filter(a => a.status === 'approved').map(a => (
                        <option key={a._id} value={a.student?._id || a.student}>
                          {a.student?.fullName} ({a.student?.rollNumber}) — Route {a.preferredRoute?.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Target Route</label>
                    <select
                      value={allocateForm.routeId}
                      onChange={(e) => setAllocateForm({ ...allocateForm, routeId: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="">-- Choose Route --</option>
                      {routes.filter(r => r.status === 'active').map(r => (
                        <option key={r._id} value={r._id}>
                          {r.code} — {r.name} ({r.allocatedStudentsCount}/{r.maxCapacity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Boarding Stop</label>
                    <select
                      value={allocateForm.pickupStopId}
                      onChange={(e) => setAllocateForm({ ...allocateForm, pickupStopId: e.target.value })}
                      required
                      disabled={!allocateForm.routeId}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white disabled:opacity-50"
                    >
                      <option value="">-- Choose Stop --</option>
                      {stopsList.map(s => (
                        <option key={s._id} value={s._id}>
                          Seq #{s.sequence}: {s.stopName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setShowAllocateModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white">Confirm Allocation</button>
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

export default AdminTransport;

