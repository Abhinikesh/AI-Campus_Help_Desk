/**
 * client/src/pages/AdminActivities/index.jsx
 * Comprehensive Admin & Organizer Desk for Campus Events, Clubs, Venues, Attendance & Certificates.
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Award,
  Bell,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Download,
  AlertTriangle,
  Building,
  Check,
  X,
  FileText,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import eventService from '../../services/event.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const AdminActivities = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    pendingApprovals: 0,
    activeClubs: 0,
    totalRegistrations: 0,
    confirmedParticipants: 0,
    waitlistedParticipants: 0,
    certificatesIssued: 0,
  });

  // Data collections
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Attendance & Registrations workspace
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [showCreateVenueModal, setShowCreateVenueModal] = useState(false);
  const [showBookVenueModal, setShowBookVenueModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showCancelEventModal, setShowCancelEventModal] = useState(false);
  const [showIssueCertModal, setShowIssueCertModal] = useState(false);
  const [showCorrectAttendanceModal, setShowCorrectAttendanceModal] = useState(false);
  const [showCreateAnnouncementModal, setShowCreateAnnouncementModal] = useState(false);

  // Form states
  const [selectedEventForAction, setSelectedEventForAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedRegForAction, setSelectedRegForAction] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [selectedAttendeeForCert, setSelectedAttendeeForCert] = useState(null);
  const [certType, setCertType] = useState('participation');

  // New Event Form
  const [newEvent, setNewEvent] = useState({
    title: '',
    eventCode: '',
    description: '',
    category: 'technical',
    startDate: '',
    endDate: '',
    registrationOpeningDate: '',
    registrationClosingDate: '',
    maxParticipants: 100,
    isWaitlistEnabled: true,
    waitlistCapacity: 50,
    targetAudience: 'students',
    targetDepartment: 'ALL',
    location: 'Main Campus',
    venue: '',
  });

  // New Club Form
  const [newClub, setNewClub] = useState({
    name: '',
    code: '',
    description: '',
    category: 'technical',
    membershipCapacity: 150,
    meetingSchedule: 'Every Wednesday 4:00 PM',
  });

  // New Venue Form
  const [newVenue, setNewVenue] = useState({
    name: '',
    code: '',
    type: 'seminar_hall',
    location: '',
    capacity: 200,
  });

  // New Venue Booking Form
  const [newBooking, setNewBooking] = useState({
    venueId: '',
    eventId: '',
    bookingDate: '',
    startTime: '09:00',
    endTime: '12:00',
    purpose: '',
  });

  // New Announcement Form
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
  });

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, eventsRes, clubsRes, venuesRes, annRes] = await Promise.all([
        eventService.getOverviewMetrics(),
        eventService.getEvents({ limit: 100 }),
        eventService.getClubs(),
        eventService.getVenues(),
        eventService.getAnnouncements(),
      ]);

      if (metricsRes?.success) setMetrics(metricsRes.data || {});
      if (eventsRes?.success) {
        setEvents(eventsRes.data || []);
        if (eventsRes.data?.length > 0 && !selectedEventId) {
          setSelectedEventId(eventsRes.data[0]._id);
        }
      }
      if (clubsRes?.success) setClubs(clubsRes.data || []);
      if (venuesRes?.success) setVenues(venuesRes.data || []);
      if (annRes?.success) setAnnouncements(annRes.data || []);
    } catch (err) {
      console.error('Failed to load admin activities data:', err);
      showToast('error', 'Failed to load administration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch registrations & attendance whenever selectedEventId changes
  const fetchEventWorkspace = async (eventId) => {
    if (!eventId) return;
    try {
      const [regsRes, attRes] = await Promise.all([
        eventService.getEventRegistrations(eventId),
        eventService.getEventAttendance(eventId),
      ]);
      if (regsRes?.success) setEventRegistrations(regsRes.data || []);
      if (attRes?.success) setAttendanceRecords(attRes.data || []);
    } catch (err) {
      console.error('Failed to load event workspace data:', err);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchEventWorkspace(selectedEventId);
    }
  }, [selectedEventId]);

  // Handler: Create Event
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await eventService.createEvent(newEvent);
      if (res?.success) {
        showToast('success', res.message || 'Event created successfully');
        setShowCreateEventModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to create event');
    }
  };

  // Handler: Submit Event for Approval
  const handleSubmitApproval = async (eventId) => {
    try {
      const res = await eventService.submitEventForApproval(eventId);
      if (res?.success) {
        showToast('success', 'Event submitted for review');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to submit');
    }
  };

  // Handler: Approve Event
  const handleApproveEvent = async (eventId) => {
    try {
      const res = await eventService.reviewEventApproval(eventId, { action: 'approve' });
      if (res?.success) {
        showToast('success', 'Event approved successfully');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to approve');
    }
  };

  // Handler: Reject Event
  const handleConfirmReject = async () => {
    if (!selectedEventForAction) return;
    try {
      const res = await eventService.reviewEventApproval(selectedEventForAction._id, {
        action: 'reject',
        rejectionReason,
      });
      if (res?.success) {
        showToast('success', 'Event rejected and returned to draft');
        setShowApprovalModal(false);
        setRejectionReason('');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to reject');
    }
  };

  // Handler: Publish Event
  const handlePublishEvent = async (eventId) => {
    try {
      const res = await eventService.publishEvent(eventId);
      if (res?.success) {
        showToast('success', 'Event is now published to campus');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to publish');
    }
  };

  // Handler: Cancel Event
  const handleConfirmCancelEvent = async () => {
    if (!selectedEventForAction) return;
    try {
      const res = await eventService.cancelEvent(selectedEventForAction._id, {
        cancellationReason,
      });
      if (res?.success) {
        showToast('success', 'Event cancelled and attendees notified');
        setShowCancelEventModal(false);
        setCancellationReason('');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to cancel event');
    }
  };

  // Handler: Create Club
  const handleCreateClub = async (e) => {
    e.preventDefault();
    try {
      const res = await eventService.createClub(newClub);
      if (res?.success) {
        showToast('success', 'Club created successfully');
        setShowCreateClubModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to create club');
    }
  };

  // Handler: Create Venue
  const handleCreateVenue = async (e) => {
    e.preventDefault();
    try {
      const res = await eventService.createVenue(newVenue);
      if (res?.success) {
        showToast('success', 'Venue registered');
        setShowCreateVenueModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to create venue');
    }
  };

  // Handler: Book Venue
  const handleBookVenue = async (e) => {
    e.preventDefault();
    try {
      const res = await eventService.bookVenue(newBooking);
      if (res?.success) {
        showToast('success', res.message || 'Venue booked');
        setShowBookVenueModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to book venue (conflict detected)');
    }
  };

  // Handler: Mark Attendance
  const handleMarkAttendance = async (studentId, registrationId, status) => {
    try {
      const res = await eventService.recordAttendance(selectedEventId, {
        studentId,
        registrationId,
        status,
      });
      if (res?.success) {
        showToast('success', `Attendance marked as ${status}`);
        fetchEventWorkspace(selectedEventId);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to mark attendance');
    }
  };

  // Handler: Correct Attendance
  const handleConfirmCorrectAttendance = async () => {
    if (!selectedRegForAction) return;
    try {
      const res = await eventService.correctAttendance(selectedEventId, selectedRegForAction.attendanceId, {
        newStatus: selectedRegForAction.newStatus,
        reason: correctionReason,
      });
      if (res?.success) {
        showToast('success', 'Attendance corrected');
        setShowCorrectAttendanceModal(false);
        setCorrectionReason('');
        fetchEventWorkspace(selectedEventId);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to correct');
    }
  };

  // Handler: Issue Certificate
  const handleConfirmIssueCert = async () => {
    if (!selectedAttendeeForCert) return;
    try {
      const res = await eventService.issueCertificate(selectedEventId, {
        studentId: selectedAttendeeForCert._id,
        certificateType: certType,
      });
      if (res?.success) {
        showToast('success', 'Certificate issued successfully');
        setShowIssueCertModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to issue certificate');
    }
  };

  // Handler: Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await eventService.createAnnouncement(newAnnouncement);
      if (res?.success) {
        showToast('success', 'Announcement published');
        setShowCreateAnnouncementModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to publish announcement');
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 antialiased overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar />

        <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Header & Metrics */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Calendar className="w-7 h-7 text-purple-400" />
                <span>Events & Student Activities Administration</span>
              </h1>
              <p className="text-xs text-slate-400">Institutional event governance, clubs, venue bookings, attendance, and certificates.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Event
              </button>
              <button
                onClick={() => setShowCreateClubModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Club
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Events</span>
              <div className="text-2xl font-bold text-white">{metrics.totalEvents}</div>
              <div className="text-[11px] text-purple-400">{metrics.publishedEvents} Published / Active</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-400 font-medium">Pending Approvals</span>
              <div className="text-2xl font-bold text-amber-400">{metrics.pendingApprovals}</div>
              <div className="text-[11px] text-slate-400">Awaiting faculty review</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-400 font-medium">Registrations</span>
              <div className="text-2xl font-bold text-emerald-400">{metrics.totalRegistrations}</div>
              <div className="text-[11px] text-slate-400">
                {metrics.confirmedParticipants} Confirmed · {metrics.waitlistedParticipants} Waitlisted
              </div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-400 font-medium">Certificates Issued</span>
              <div className="text-2xl font-bold text-blue-400">{metrics.certificatesIssued}</div>
              <div className="text-[11px] text-slate-400">{metrics.activeClubs} Active Clubs</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 space-x-2">
            {[
              { id: 'events', label: 'Events Directory', icon: Calendar, count: events.length },
              { id: 'attendance', label: 'Attendance & Certificates', icon: CheckCircle2 },
              { id: 'clubs', label: 'Clubs & Societies', icon: Users, count: clubs.length },
              { id: 'venues', label: 'Venues & Bookings', icon: Building, count: venues.length },
              { id: 'announcements', label: 'Announcements', icon: Bell, count: announcements.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    isActive
                      ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* TAB 1: EVENTS DIRECTORY */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/60 uppercase font-mono text-[11px] text-slate-400 border-b border-slate-700">
                          <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Event Title</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Dates</th>
                            <th className="px-4 py-3">Participants</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {events.map((ev) => (
                            <tr key={ev._id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-mono text-purple-400">{ev.eventCode}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{ev.title}</div>
                                <div className="text-[11px] text-slate-400">{ev.venueName || ev.location}</div>
                              </td>
                              <td className="px-4 py-3 uppercase text-[10px] font-mono text-slate-300">{ev.category}</td>
                              <td className="px-4 py-3">
                                <div>{new Date(ev.startDate).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-500">
                                  {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <span>{ev.allocatedParticipantsCount} / {ev.maxParticipants}</span>
                                {ev.waitlistCount > 0 && (
                                  <span className="text-[10px] text-amber-400 block">+{ev.waitlistCount} waitlist</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                                    ev.status === 'published'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : ev.status === 'pending_approval'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : ev.status === 'approved'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : ev.status === 'cancelled'
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {ev.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-1">
                                {ev.status === 'draft' && (
                                  <button
                                    onClick={() => handleSubmitApproval(ev._id)}
                                    className="px-2 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                                  >
                                    Submit
                                  </button>
                                )}
                                {ev.status === 'pending_approval' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveEvent(ev._id)}
                                      className="px-2 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedEventForAction(ev);
                                        setShowApprovalModal(true);
                                      }}
                                      className="px-2 py-1 text-[11px] bg-red-600 hover:bg-red-500 text-white rounded"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {['approved', 'draft'].includes(ev.status) && (
                                  <button
                                    onClick={() => handlePublishEvent(ev._id)}
                                    className="px-2 py-1 text-[11px] bg-purple-600 hover:bg-purple-500 text-white rounded"
                                  >
                                    Publish
                                  </button>
                                )}
                                {['published', 'registration_open'].includes(ev.status) && (
                                  <button
                                    onClick={() => {
                                      setSelectedEventForAction(ev);
                                      setShowCancelEventModal(true);
                                    }}
                                    className="px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 rounded"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <a
                                  href={eventService.getParticipantsExportUrl(ev._id)}
                                  download
                                  className="px-2 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded inline-flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> CSV
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTENDANCE & CERTIFICATES */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  {/* Select Event Bar */}
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl flex items-center gap-4">
                    <label className="text-xs text-slate-400 font-medium">Select Event:</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 flex-1 max-w-md"
                    >
                      {events.map((ev) => (
                        <option key={ev._id} value={ev._id}>
                          {ev.title} ({ev.eventCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Registrations & Attendance Table */}
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/60 uppercase font-mono text-[11px] text-slate-400 border-b border-slate-700">
                          <tr>
                            <th className="px-4 py-3">Reg #</th>
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3">Roll Number</th>
                            <th className="px-4 py-3">Branch & Sem</th>
                            <th className="px-4 py-3">Reg Status</th>
                            <th className="px-4 py-3">Attendance</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {eventRegistrations.map((reg) => {
                            const student = reg.student || {};
                            const attRecord = attendanceRecords.find(
                              (a) => String(a.student?._id || a.student) === String(student._id)
                            );
                            const isPresent = attRecord?.status === 'present';

                            return (
                              <tr key={reg._id} className="hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-mono text-purple-400">{reg.registrationNumber}</td>
                                <td className="px-4 py-3 font-semibold text-white">{student.fullName || 'N/A'}</td>
                                <td className="px-4 py-3 font-mono">{student.rollNumber || 'N/A'}</td>
                                <td className="px-4 py-3">{student.branch || 'N/A'} · Sem {student.semester || 'N/A'}</td>
                                <td className="px-4 py-3 uppercase text-[10px] font-mono">{reg.status}</td>
                                <td className="px-4 py-3">
                                  {attRecord ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                                        isPresent
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      }`}
                                    >
                                      {attRecord.status}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Unmarked</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right space-x-1">
                                  {!attRecord ? (
                                    <>
                                      <button
                                        onClick={() => handleMarkAttendance(student._id, reg._id, 'present')}
                                        className="px-2 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                                      >
                                        Present
                                      </button>
                                      <button
                                        onClick={() => handleMarkAttendance(student._id, reg._id, 'absent')}
                                        className="px-2 py-1 text-[11px] bg-red-600 hover:bg-red-500 text-white rounded"
                                      >
                                        Absent
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedRegForAction({
                                          attendanceId: attRecord._id,
                                          newStatus: isPresent ? 'absent' : 'present',
                                        });
                                        setShowCorrectAttendanceModal(true);
                                      }}
                                      className="px-2 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                                    >
                                      Correct
                                    </button>
                                  )}

                                  {isPresent && (
                                    <button
                                      onClick={() => {
                                        setSelectedAttendeeForCert(student);
                                        setShowIssueCertModal(true);
                                      }}
                                      className="px-2 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white rounded"
                                    >
                                      Cert
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CLUBS & SOCIETIES */}
              {activeTab === 'clubs' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {clubs.map((club) => (
                      <div key={club._id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-xl space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-white">{club.name}</h4>
                          <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                            {club.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{club.description}</p>
                        <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-300 flex justify-between">
                          <span>Members:</span>
                          <span className="font-mono">{club.activeMembersCount} / {club.membershipCapacity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: VENUES & BOOKINGS */}
              {activeTab === 'venues' && (
                <div className="space-y-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateVenueModal(true)}
                      className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                      + Add Venue
                    </button>
                    <button
                      onClick={() => setShowBookVenueModal(true)}
                      className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
                    >
                      Book Venue
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {venues.map((v) => (
                      <div key={v._id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-white text-sm">{v.name}</h4>
                          <span className="font-mono text-purple-400 text-[10px]">{v.code}</span>
                        </div>
                        <div className="text-slate-400">{v.location}</div>
                        <div className="text-slate-300 pt-1">Capacity: <span className="font-mono">{v.capacity} seats</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: ANNOUNCEMENTS */}
              {activeTab === 'announcements' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowCreateAnnouncementModal(true)}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Post Announcement
                    </button>
                  </div>

                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div key={ann._id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-white text-sm">{ann.title}</h4>
                          <span className="text-slate-400">{new Date(ann.publishDate).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-300">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* MODAL: CREATE EVENT */}
          {showCreateEventModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-white">Create Campus Event</h3>
                <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Event Title</label>
                    <input
                      type="text"
                      required
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Event Code (Unique)</label>
                      <input
                        type="text"
                        required
                        value={newEvent.eventCode}
                        onChange={(e) => setNewEvent({ ...newEvent, eventCode: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Category</label>
                      <select
                        value={newEvent.category}
                        onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      >
                        <option value="technical">Technical</option>
                        <option value="cultural">Cultural</option>
                        <option value="workshop">Workshop</option>
                        <option value="seminar">Seminar</option>
                        <option value="competition">Competition</option>
                        <option value="sports">Sports</option>
                        <option value="academic">Academic</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Description</label>
                    <textarea
                      rows={3}
                      required
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Start Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={newEvent.startDate}
                        onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">End Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={newEvent.endDate}
                        onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Registration Opens</label>
                      <input
                        type="datetime-local"
                        required
                        value={newEvent.registrationOpeningDate}
                        onChange={(e) => setNewEvent({ ...newEvent, registrationOpeningDate: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Registration Closes</label>
                      <input
                        type="datetime-local"
                        required
                        value={newEvent.registrationClosingDate}
                        onChange={(e) => setNewEvent({ ...newEvent, registrationClosingDate: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Max Capacity</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newEvent.maxParticipants}
                        onChange={(e) => setNewEvent({ ...newEvent, maxParticipants: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Venue (Optional)</label>
                      <select
                        value={newEvent.venue}
                        onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      >
                        <option value="">Select Venue...</option>
                        {venues.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.name} ({v.capacity} seats)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateEventModal(false)}
                      className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium"
                    >
                      Save Event
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: CREATE CLUB */}
          {showCreateClubModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Add Student Club</h3>
                <form onSubmit={handleCreateClub} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Club Name</label>
                    <input
                      type="text"
                      required
                      value={newClub.name}
                      onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Club Code</label>
                      <input
                        type="text"
                        required
                        value={newClub.code}
                        onChange={(e) => setNewClub({ ...newClub, code: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Category</label>
                      <select
                        value={newClub.category}
                        onChange={(e) => setNewClub({ ...newClub, category: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      >
                        <option value="technical">Technical</option>
                        <option value="robotics">Robotics</option>
                        <option value="ai_ml">AI & ML</option>
                        <option value="cultural">Cultural</option>
                        <option value="music_arts">Music & Arts</option>
                        <option value="sports">Sports</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Description</label>
                    <textarea
                      rows={3}
                      required
                      value={newClub.description}
                      onChange={(e) => setNewClub({ ...newClub, description: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateClubModal(false)}
                      className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                    >
                      Save Club
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: CREATE VENUE */}
          {showCreateVenueModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Add Campus Venue</h3>
                <form onSubmit={handleCreateVenue} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Venue Name</label>
                    <input
                      type="text"
                      required
                      value={newVenue.name}
                      onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Venue Code</label>
                      <input
                        type="text"
                        required
                        value={newVenue.code}
                        onChange={(e) => setNewVenue({ ...newVenue, code: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Capacity</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newVenue.capacity}
                        onChange={(e) => setNewVenue({ ...newVenue, capacity: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Location / Building</label>
                    <input
                      type="text"
                      required
                      value={newVenue.location}
                      onChange={(e) => setNewVenue({ ...newVenue, location: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateVenueModal(false)}
                      className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium"
                    >
                      Save Venue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: BOOK VENUE */}
          {showBookVenueModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Book Venue for Event</h3>
                <form onSubmit={handleBookVenue} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Select Venue</label>
                    <select
                      required
                      value={newBooking.venueId}
                      onChange={(e) => setNewBooking({ ...newBooking, venueId: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    >
                      <option value="">Select Venue...</option>
                      {venues.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.name} ({v.capacity} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Select Event</label>
                    <select
                      required
                      value={newBooking.eventId}
                      onChange={(e) => setNewBooking({ ...newBooking, eventId: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    >
                      <option value="">Select Event...</option>
                      {events.map((ev) => (
                        <option key={ev._id} value={ev._id}>
                          {ev.title} ({ev.eventCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Booking Date</label>
                    <input
                      type="date"
                      required
                      value={newBooking.bookingDate}
                      onChange={(e) => setNewBooking({ ...newBooking, bookingDate: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Start Time (HH:mm)</label>
                      <input
                        type="time"
                        required
                        value={newBooking.startTime}
                        onChange={(e) => setNewBooking({ ...newBooking, startTime: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">End Time (HH:mm)</label>
                      <input
                        type="time"
                        required
                        value={newBooking.endTime}
                        onChange={(e) => setNewBooking({ ...newBooking, endTime: e.target.value })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowBookVenueModal(false)}
                      className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: REJECT EVENT */}
          {showApprovalModal && selectedEventForAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Reject Event Proposal</h3>
                <p className="text-xs text-slate-400">
                  Provide a mandatory reason for rejecting <span className="text-purple-400 font-semibold">{selectedEventForAction.title}</span>.
                </p>
                <textarea
                  rows={3}
                  placeholder="Reason for rejection (min 5 characters)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowApprovalModal(false)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: CANCEL EVENT */}
          {showCancelEventModal && selectedEventForAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Cancel Event</h3>
                <p className="text-xs text-slate-400">
                  Cancelling will release booked venues and notify all registered participants.
                </p>
                <textarea
                  rows={3}
                  placeholder="Reason for cancellation (min 5 characters)..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCancelEventModal(false)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    Abort
                  </button>
                  <button
                    onClick={handleConfirmCancelEvent}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium"
                  >
                    Cancel Event
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: ISSUE CERTIFICATE */}
          {showIssueCertModal && selectedAttendeeForCert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Issue Verifiable Certificate</h3>
                <p className="text-xs text-slate-300">
                  Recipient: <span className="font-semibold text-purple-400">{selectedAttendeeForCert.fullName}</span> ({selectedAttendeeForCert.rollNumber})
                </p>
                <div className="space-y-2 text-xs">
                  <label className="text-slate-400 block">Certificate Honor Type</label>
                  <select
                    value={certType}
                    onChange={(e) => setCertType(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                  >
                    <option value="participation">Participation</option>
                    <option value="completion">Completion</option>
                    <option value="winner">Winner (1st Place)</option>
                    <option value="runner_up">Runner Up</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="organizer">Organizer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowIssueCertModal(false)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmIssueCert}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium"
                  >
                    Issue Certificate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: CORRECT ATTENDANCE */}
          {showCorrectAttendanceModal && selectedRegForAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Correct Attendance Status</h3>
                <p className="text-xs text-slate-300">
                  Changing status to <span className="uppercase font-mono font-bold text-purple-400">{selectedRegForAction.newStatus}</span>.
                </p>
                <textarea
                  rows={3}
                  placeholder="Reason for correction (mandatory)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCorrectAttendanceModal(false)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmCorrectAttendance}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium"
                  >
                    Save Correction
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

export default AdminActivities;
