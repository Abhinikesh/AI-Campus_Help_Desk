/**
 * client/src/pages/StudentTransport/index.jsx
 * Student Transport Portal — Routes, Stops, Allocations, Schedules & Applications.
 */
import React, { useState, useEffect } from 'react';
import {
  Bus,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Phone,
  User,
  ShieldAlert,
  Search,
  Plus,
  RefreshCw,
  ChevronRight,
  Info,
} from 'lucide-react';
import transportService from '../../services/transport.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const StudentTransport = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [activeTab, setActiveTab] = useState('my_transport');

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  // Form states
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [availableStops, setAvailableStops] = useState([]);
  const [applyForm, setApplyForm] = useState({
    pickupStopId: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Parent',
  });
  const [submittingApply, setSubmittingApply] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    category: 'traffic_delay',
    severity: 'medium',
    title: '',
    description: '',
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Route search filter
  const [routeSearch, setRouteSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovData, rData, tData] = await Promise.all([
        transportService.getStudentOverview(),
        transportService.getRoutes({ status: 'active' }),
        transportService.getTrips(),
      ]);
      setOverview(ovData.data || {});
      setRoutes(rData.data || []);
      setTrips(tData.data || []);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load transport details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch stops when user selects a route in Apply modal
  useEffect(() => {
    if (!selectedRouteId) {
      setAvailableStops([]);
      return;
    }
    const fetchStops = async () => {
      try {
        const res = await transportService.getStops(selectedRouteId);
        setAvailableStops(res.data || []);
      } catch (err) {
        showToast('Failed to load stops for selected route', 'error');
      }
    };
    fetchStops();
  }, [selectedRouteId]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedRouteId || !applyForm.pickupStopId) {
      showToast('Please select a route and pickup stop', 'warning');
      return;
    }
    try {
      setSubmittingApply(true);
      await transportService.createApplication({
        preferredRouteId: selectedRouteId,
        preferredPickupStopId: applyForm.pickupStopId,
        emergencyContact: {
          name: applyForm.emergencyContactName,
          phone: applyForm.emergencyContactPhone,
          relation: applyForm.emergencyContactRelation,
        },
      });
      showToast('Transport application submitted successfully!', 'success');
      setShowApplyModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Application submission failed', 'error');
    } finally {
      setSubmittingApply(false);
    }
  };

  const handleIncidentSubmit = async (e) => {
    e.preventDefault();
    const alloc = overview?.allocation;
    if (!alloc?.route?._id) {
      showToast('You must have an allocated route to report an incident', 'warning');
      return;
    }
    try {
      setSubmittingIncident(true);
      await transportService.reportIncident({
        routeId: alloc.route._id,
        vehicleId: alloc.vehicle?._id,
        category: incidentForm.category,
        severity: incidentForm.severity,
        title: incidentForm.title,
        description: incidentForm.description,
      });
      showToast('Incident reported to transport desk', 'success');
      setShowIncidentModal(false);
      setIncidentForm({ category: 'traffic_delay', severity: 'medium', title: '', description: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to report incident', 'error');
    } finally {
      setSubmittingIncident(false);
    }
  };

  const allocation = overview?.allocation;
  const applications = overview?.applications || [];
  const routeStops = overview?.routeStops || [];

  const filteredRoutes = routes.filter((r) => {
    const term = routeSearch.toLowerCase();
    return (
      r.name?.toLowerCase().includes(term) ||
      r.code?.toLowerCase().includes(term) ||
      r.startLocation?.toLowerCase().includes(term) ||
      r.endLocation?.toLowerCase().includes(term)
    );
  });

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
                <Bus size={16} /> Campus Transit & Fleet
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Campus Transport Portal
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage your daily commute, route schedules, bus stops, and travel alerts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                title="Refresh Transport Data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              {!allocation && (
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-white shadow-lg shadow-indigo-600/20 transition"
                >
                  <Plus size={16} /> Apply for Transport
                </button>
              )}

              {allocation && (
                <button
                  onClick={() => setShowIncidentModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rose-800 bg-rose-950/40 hover:bg-rose-900/60 font-medium text-rose-300 transition"
                >
                  <AlertTriangle size={16} /> Report Issue
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" text="Loading transit schedule..." />
            </div>
          ) : (
            <>
              {/* Quick Status Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Bus size={22} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-400">Allocated Route</div>
                    <div className="text-sm font-semibold text-white">
                      {allocation?.route ? `${allocation.route.code} — ${allocation.route.name}` : 'Not Allocated'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-400">Pickup Stop</div>
                    <div className="text-sm font-semibold text-white">
                      {allocation?.pickupStop?.stopName || 'No Stop Assigned'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-400">Morning Pickup</div>
                    <div className="text-sm font-semibold text-white">
                      {allocation?.pickupStop?.scheduledMorningPickupTime ||
                        allocation?.route?.schedule?.morningDepartureTime ||
                        '--:--'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-400">Transit Pass Fee</div>
                    <div className="text-sm font-semibold text-white">
                      ₹{((allocation?.feeAmountInPaise || overview?.policy?.defaultFeeInPaise || 1800000) / 100).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 text-sm font-medium gap-2">
                <button
                  onClick={() => setActiveTab('my_transport')}
                  className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'my_transport'
                      ? 'border-indigo-500 text-indigo-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bus size={16} /> My Commute
                </button>
                <button
                  onClick={() => setActiveTab('routes')}
                  className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'routes'
                      ? 'border-indigo-500 text-indigo-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MapPin size={16} /> Campus Routes ({routes.length})
                </button>
                <button
                  onClick={() => setActiveTab('trips')}
                  className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'trips'
                      ? 'border-indigo-500 text-indigo-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock size={16} /> Daily Trips & Delays
                </button>
                <button
                  onClick={() => setActiveTab('applications')}
                  className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'applications'
                      ? 'border-indigo-500 text-indigo-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Calendar size={16} /> Applications ({applications.length})
                </button>
              </div>

              {/* TAB 1: MY COMMUTE */}
              {activeTab === 'my_transport' && (
                <div className="space-y-6">
                  {allocation ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Allocation Card */}
                      <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                          <div>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              Active Pass #{allocation.allocationNumber}
                            </span>
                            <h2 className="text-xl font-bold text-white mt-1.5">
                              {allocation.route?.name} ({allocation.route?.code})
                            </h2>
                          </div>
                          <span className="text-xs text-slate-400">
                            Valid: {new Date(allocation.startDate).toLocaleDateString()} –{' '}
                            {new Date(allocation.endDate).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Route details grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="text-slate-400 text-xs block mb-1">Boarding Stop</span>
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <MapPin size={15} className="text-indigo-400" />
                              {allocation.pickupStop?.stopName} (Seq #{allocation.pickupStop?.sequence})
                            </span>
                          </div>

                          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="text-slate-400 text-xs block mb-1">Morning Pickup Time</span>
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <Clock size={15} className="text-amber-400" />
                              {allocation.pickupStop?.scheduledMorningPickupTime ||
                                allocation.route?.schedule?.morningDepartureTime ||
                                '07:45 AM'}
                            </span>
                          </div>

                          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="text-slate-400 text-xs block mb-1">Assigned Vehicle</span>
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <Bus size={15} className="text-purple-400" />
                              {allocation.vehicle
                                ? `${allocation.vehicle.vehicleCode} (${allocation.vehicle.registrationNumber})`
                                : allocation.route?.assignedVehicle
                                ? `${allocation.route.assignedVehicle.vehicleCode} (${allocation.route.assignedVehicle.registrationNumber})`
                                : 'Fleet Vehicle TBA'}
                            </span>
                          </div>

                          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="text-slate-400 text-xs block mb-1">Driver In-Charge</span>
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <User size={15} className="text-emerald-400" />
                              {allocation.route?.assignedDriver?.name || 'Assigned Driver TBA'}
                              {allocation.route?.assignedDriver?.phone && (
                                <span className="text-xs text-slate-400">
                                  ({allocation.route.assignedDriver.phone})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Route Stops Sequence */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <MapPin size={16} className="text-indigo-400" /> Route Stops Timeline
                          </h3>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {routeStops.map((s) => {
                              const isMyStop = s._id === allocation.pickupStop?._id;
                              return (
                                <div
                                  key={s._id}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition ${
                                    isMyStop
                                      ? 'bg-indigo-950/30 border-indigo-500/50 text-white font-medium'
                                      : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        isMyStop ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {s.sequence}
                                    </span>
                                    <span>{s.stopName}</span>
                                    {isMyStop && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                                        Your Pickup
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-3">
                                    {s.scheduledMorningPickupTime && (
                                      <span>Pickup: {s.scheduledMorningPickupTime}</span>
                                    )}
                                    {s.scheduledEveningDropTime && (
                                      <span>Drop: {s.scheduledEveningDropTime}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right: Operational Notices & Support */}
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Info size={16} className="text-indigo-400" /> Commute Guidelines
                          </h3>
                          <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                            <li>Please arrive at your boarding stop 5 minutes prior to scheduled pickup.</li>
                            <li>Carry your student digital identity card at all times while boarding.</li>
                            <li>Daily delays due to traffic are notified in real-time under Daily Trips.</li>
                            <li>Route and stop modifications require minimum 7 days notice.</li>
                          </ul>
                        </div>

                        <div className="p-5 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-2 text-xs text-amber-300">
                          <div className="flex items-center gap-2 font-semibold text-amber-200">
                            <ShieldAlert size={16} /> Campus Transport Desk Help
                          </div>
                          <p>
                            Helpline: +91 11-2345-6789 (Mon-Sat, 7:00 AM – 7:30 PM)
                            <br />
                            Email: transport@campussphere.edu
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/20 max-w-xl mx-auto space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-400 mx-auto">
                        <Bus size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-white">No Active Transport Allocation</h2>
                      <p className="text-sm text-slate-400">
                        You are currently not enrolled in college transit services. Browse available routes and apply for an academic transport pass.
                      </p>
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
                      >
                        <Plus size={16} /> Apply for Transport Pass
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EXPLORE ROUTES */}
              {activeTab === 'routes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by route code, location, or name..."
                        value={routeSearch}
                        onChange={(e) => setRouteSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <span className="text-xs text-slate-400">
                      Showing {filteredRoutes.length} active routes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRoutes.map((r) => {
                      const isFull = r.allocatedStudentsCount >= r.maxCapacity;
                      return (
                        <div
                          key={r._id}
                          className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {r.code}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  isFull
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {isFull ? 'Capacity Full' : `${r.maxCapacity - r.allocatedStudentsCount} seats left`}
                              </span>
                            </div>
                            <h3 className="font-semibold text-white text-base leading-snug">{r.name}</h3>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <span>{r.startLocation}</span>
                              <ChevronRight size={12} />
                              <span>{r.endLocation}</span>
                            </p>
                          </div>

                          <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Morning Departure:</span>
                              <span className="font-medium text-white">
                                {r.schedule?.morningDepartureTime || '07:30 AM'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Evening Departure:</span>
                              <span className="font-medium text-white">
                                {r.schedule?.eveningDepartureTime || '05:15 PM'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Assigned Bus:</span>
                              <span className="font-medium text-white">
                                {r.assignedVehicle?.vehicleCode || 'Standard Transit Bus'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: DAILY TRIPS & DELAYS */}
              {activeTab === 'trips' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Today's Operating Route Trips</h3>
                    <span className="text-xs text-slate-400">Real-time departure and arrival records</span>
                  </div>

                  {trips.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trips.map((t) => (
                        <div
                          key={t._id}
                          className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-400">
                              {t.route?.code} — {t.tripType === 'morning_pickup' ? 'Morning Commute' : 'Evening Drop'}
                            </span>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                t.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : t.status === 'in_progress'
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : t.status === 'delayed'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {t.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 space-y-1">
                            <div>Route: {t.route?.name}</div>
                            <div>Vehicle: {t.vehicle?.vehicleCode} ({t.vehicle?.registrationNumber})</div>
                            <div>Driver: {t.driver?.name || 'On Duty'}</div>
                          </div>

                          {t.delayMinutes > 0 && (
                            <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 flex items-center gap-2">
                              <AlertTriangle size={14} /> Delay of {t.delayMinutes} mins reported ({t.delayReason || 'Traffic congestion'})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/20 text-slate-400 text-sm">
                      No active trips scheduled for today yet.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: APPLICATIONS */}
              {activeTab === 'applications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Application History</h3>
                    {!allocation && (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                      >
                        + New Application
                      </button>
                    )}
                  </div>

                  {applications.length > 0 ? (
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                      {applications.map((app) => (
                        <div key={app._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">#{app.applicationNumber}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  app.status === 'allocated' || app.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : app.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {app.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              Preferred Route: {app.preferredRoute?.code} ({app.preferredRoute?.name}) | Stop: {app.preferredPickupStop?.stopName}
                            </div>
                            {app.reviewDetails?.rejectionReason && (
                              <div className="text-xs text-rose-400 mt-1">
                                Rejection Reason: {app.reviewDetails.rejectionReason}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            Submitted: {new Date(app.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/20 text-slate-400 text-sm">
                      No previous transport applications submitted.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* APPLY MODAL */}
          {showApplyModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Apply for College Transit</h3>
                  <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleApplySubmit} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Route</label>
                    <select
                      value={selectedRouteId}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose an active route --</option>
                      {routes.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.code} — {r.name} ({r.startLocation} to {r.endLocation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Boarding Stop</label>
                    <select
                      value={applyForm.pickupStopId}
                      onChange={(e) => setApplyForm({ ...applyForm, pickupStopId: e.target.value })}
                      required
                      disabled={!selectedRouteId || availableStops.length === 0}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    >
                      <option value="">-- Choose your pickup stop --</option>
                      {availableStops.map((s) => (
                        <option key={s._id} value={s._id}>
                          Seq #{s.sequence} — {s.stopName} ({s.scheduledMorningPickupTime || 'Morning'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        placeholder="Parent / Guardian"
                        value={applyForm.emergencyContactName}
                        onChange={(e) => setApplyForm({ ...applyForm, emergencyContactName: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Phone</label>
                      <input
                        type="tel"
                        placeholder="+91 9876543210"
                        value={applyForm.emergencyContactPhone}
                        onChange={(e) => setApplyForm({ ...applyForm, emergencyContactPhone: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-indigo-950/20 border border-indigo-800/40 text-xs text-indigo-300">
                    Standard semester transit pass fee is ₹{((overview?.policy?.defaultFeeInPaise || 1800000) / 100).toLocaleString('en-IN')}. Invoices are billed upon allocation approval.
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowApplyModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingApply}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white"
                    >
                      {submittingApply ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* REPORT INCIDENT MODAL */}
          {showIncidentModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-lg text-white">Report Transit Incident</h3>
                  <button onClick={() => setShowIncidentModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleIncidentSubmit} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Issue Category</label>
                    <select
                      value={incidentForm.category}
                      onChange={(e) => setIncidentForm({ ...incidentForm, category: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="traffic_delay">Traffic Delay</option>
                      <option value="breakdown">Vehicle Breakdown</option>
                      <option value="driver_conduct">Driver / Attendant Conduct</option>
                      <option value="safety_hazard">Safety Concern</option>
                      <option value="other">Other Grievance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Bus arrived 30 mins late at stop"
                      value={incidentForm.title}
                      onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Detailed Description</label>
                    <textarea
                      rows={3}
                      placeholder="Provide specific details..."
                      value={incidentForm.description}
                      onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowIncidentModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingIncident}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold text-white"
                    >
                      {submittingIncident ? 'Reporting...' : 'Submit Incident Report'}
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

export default StudentTransport;

