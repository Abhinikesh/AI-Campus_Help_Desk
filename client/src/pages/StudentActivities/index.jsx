/**
 * client/src/pages/StudentActivities/index.jsx
 * Campus Events, Clubs, Workshops & Student Activities Portal for Students.
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Award,
  Bell,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Star,
  ShieldCheck,
  Send,
  Building,
  Sparkles,
} from 'lucide-react';
import eventService from '../../services/event.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const StudentActivities = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');

  // Data states
  const [events, setEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [myMemberships, setMyMemberships] = useState([]);
  const [myCertificates, setMyCertificates] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showClubModal, setShowClubModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [statementOfPurpose, setStatementOfPurpose] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState({ overall: 5, organization: 5, venue: 5, content: 5 });
  const [feedbackComments, setFeedbackComments] = useState('');
  const [verifyingCert, setVerifyingCert] = useState(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, regsRes, clubsRes, memsRes, certsRes, annRes] = await Promise.all([
        eventService.getEvents({ limit: 50 }),
        eventService.getMyRegistrations(),
        eventService.getClubs({ isActive: true }),
        eventService.getMyMemberships(),
        eventService.getMyCertificates(),
        eventService.getAnnouncements(),
      ]);

      if (eventsRes?.success) setEvents(eventsRes.data || []);
      if (regsRes?.success) setMyRegistrations(regsRes.data || []);
      if (clubsRes?.success) setClubs(clubsRes.data || []);
      if (memsRes?.success) setMyMemberships(memsRes.data || []);
      if (certsRes?.success) setMyCertificates(certsRes.data || []);
      if (annRes?.success) setAnnouncements(annRes.data || []);
    } catch (err) {
      console.error('Failed to load student activities data:', err);
      showToast('error', 'Failed to load activities data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Check eligibility for selected event
  const handleCheckEligibility = async (event) => {
    setSelectedEvent(event);
    try {
      const res = await eventService.getEventById(event._id);
      if (res?.success) {
        setEligibilityData(res.eligibility);
        setShowEligibilityModal(true);
      }
    } catch (err) {
      showToast('error', 'Could not evaluate eligibility');
    }
  };

  // Open registration modal
  const handleOpenRegister = (event) => {
    setSelectedEvent(event);
    setShowRegisterModal(true);
  };

  // Submit Registration
  const handleConfirmRegister = async () => {
    if (!selectedEvent) return;
    try {
      const res = await eventService.registerForEvent(selectedEvent._id);
      if (res?.success) {
        showToast('success', res.message || 'Registration confirmed!');
        setShowRegisterModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to register');
    }
  };

  // Cancel Registration
  const handleCancelRegistration = async (eventId, regId) => {
    if (!window.confirm('Are you sure you want to cancel your registration?')) return;
    try {
      const res = await eventService.cancelRegistration(eventId, regId);
      if (res?.success) {
        showToast('success', 'Registration cancelled');
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to cancel');
    }
  };

  // Apply for Club Membership
  const handleApplyClub = (club) => {
    setSelectedClub(club);
    setStatementOfPurpose('');
    setShowClubModal(true);
  };

  const handleConfirmApplyClub = async () => {
    if (!selectedClub) return;
    try {
      const res = await eventService.applyForMembership(selectedClub._id, { statementOfPurpose });
      if (res?.success) {
        showToast('success', res.message || 'Application submitted');
        setShowClubModal(false);
        fetchData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to apply');
    }
  };

  // Submit Feedback
  const handleSubmitFeedback = async () => {
    if (!selectedEvent) return;
    try {
      const res = await eventService.submitFeedback(selectedEvent._id, {
        ratings: feedbackRating,
        comments: feedbackComments,
      });
      if (res?.success) {
        showToast('success', 'Feedback submitted! Thank you.');
        setShowFeedbackModal(false);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to submit feedback');
    }
  };

  // Verify Certificate publicly
  const handleVerifyCertificate = async (certNumber) => {
    try {
      const res = await eventService.verifyCertificate(certNumber);
      if (res?.success) {
        setVerifyingCert(res.certificate);
      }
    } catch (err) {
      showToast('error', 'Certificate could not be verified');
    }
  };

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = !categoryFilter || ev.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Helper: check if already registered
  const isRegistered = (eventId) => {
    return myRegistrations.some(
      (r) => (r.event?._id === eventId || r.event === eventId) && ['confirmed', 'waitlisted', 'attended'].includes(r.status)
    );
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 antialiased overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar />

        <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-slate-800 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-600/30 border border-purple-400/40 rounded-xl text-purple-300">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Campus Activities & Clubs</h1>
                    <p className="text-sm text-slate-300">Explore college fests, technical workshops, student clubs, and verifiable certificates.</p>
                  </div>
                </div>
              </div>

              {/* Quick Summary Badges */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs flex items-center gap-1.5 text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{events.length} Upcoming Events</span>
                </div>
                <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs flex items-center gap-1.5 text-slate-200">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{myMemberships.filter((m) => m.status === 'approved').length} Active Clubs</span>
                </div>
                <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs flex items-center gap-1.5 text-slate-200">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>{myCertificates.length} Certificates</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 space-x-2">
            {[
              { id: 'events', label: 'Explore Events', icon: Calendar, count: events.length },
              { id: 'my_registrations', label: 'My Registrations', icon: Clock, count: myRegistrations.length },
              { id: 'clubs', label: 'Clubs & Societies', icon: Users, count: clubs.length },
              { id: 'certificates', label: 'My Certificates', icon: Award, count: myCertificates.length },
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
              {/* TAB 1: EXPLORE EVENTS */}
              {activeTab === 'events' && (
                <div className="space-y-6">
                  {/* Search and Category Filters */}
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search events by title, code, or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Filter className="w-4 h-4 text-slate-400" />
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">All Categories</option>
                        <option value="technical">Technical</option>
                        <option value="cultural">Cultural</option>
                        <option value="workshop">Workshop</option>
                        <option value="seminar">Seminar</option>
                        <option value="competition">Competition</option>
                        <option value="sports">Sports</option>
                        <option value="academic">Academic</option>
                        <option value="community_service">Community Service</option>
                      </select>
                    </div>
                  </div>

                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-slate-300">No events found</h3>
                      <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria or category filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredEvents.map((ev) => {
                        const registered = isRegistered(ev._id);
                        const isFull = ev.allocatedParticipantsCount >= ev.maxParticipants;
                        const startDateFormatted = new Date(ev.startDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const startTime = new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={ev._id}
                            className="bg-slate-800/60 border border-slate-700/60 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Event Card Header */}
                              <div className="p-5 pb-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    {ev.category}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono">{ev.eventCode}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-white line-clamp-1">{ev.title}</h3>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ev.description}</p>
                              </div>

                              {/* Event Details Grid */}
                              <div className="px-5 py-3 bg-slate-900/40 border-y border-slate-800/60 space-y-2 text-xs text-slate-300">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                  <span>{startDateFormatted} at {startTime}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>{ev.venueName || ev.location}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1">
                                  <span className="text-slate-400">Seats:</span>
                                  <span className="font-mono">
                                    {ev.allocatedParticipantsCount} / {ev.maxParticipants} filled
                                    {isFull && ev.isWaitlistEnabled && ` (${ev.waitlistCount} on waitlist)`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="p-4 bg-slate-800/90 flex items-center justify-between gap-2">
                              <button
                                onClick={() => handleCheckEligibility(ev)}
                                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700/60 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <span>Eligibility</span>
                              </button>

                              {registered ? (
                                <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Registered
                                </span>
                              ) : isFull ? (
                                ev.isWaitlistEnabled ? (
                                  <button
                                    onClick={() => handleOpenRegister(ev)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                                  >
                                    Join Waitlist
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-400">
                                    Full
                                  </span>
                                )
                              ) : (
                                <button
                                  onClick={() => handleOpenRegister(ev)}
                                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-sm"
                                >
                                  Register Now
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MY REGISTRATIONS */}
              {activeTab === 'my_registrations' && (
                <div className="space-y-4">
                  {myRegistrations.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-slate-300">No active event registrations</h3>
                      <p className="text-sm text-slate-500 mt-1">Browse upcoming events and register to participate.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {myRegistrations.map((reg) => {
                        const ev = reg.event || {};
                        const isConfirmed = reg.status === 'confirmed';
                        const isWaitlisted = reg.status === 'waitlisted';
                        const isAttended = reg.status === 'attended';

                        return (
                          <div
                            key={reg._id}
                            className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-purple-400">{reg.registrationNumber}</span>
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                    isConfirmed
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : isWaitlisted
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : isAttended
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {isWaitlisted ? `Waitlist #${reg.waitlistNumber}` : reg.status.toUpperCase()}
                                </span>
                              </div>
                              <h4 className="text-base font-semibold text-white">{ev.title || 'Campus Event'}</h4>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                                <span>Code: {ev.eventCode}</span>
                                <span>Date: {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : 'TBD'}</span>
                                <span>Venue: {ev.venueName || ev.location}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isAttended && (
                                <button
                                  onClick={() => {
                                    setSelectedEvent(ev);
                                    setShowFeedbackModal(true);
                                  }}
                                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Star className="w-3.5 h-3.5" /> Submit Feedback
                                </button>
                              )}
                              {['registered', 'confirmed', 'waitlisted'].includes(reg.status) && (
                                <button
                                  onClick={() => handleCancelRegistration(ev._id, reg._id)}
                                  className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-lg transition-colors"
                                >
                                  Cancel Registration
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CLUBS & SOCIETIES */}
              {activeTab === 'clubs' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clubs.map((club) => {
                      const myMembership = myMemberships.find((m) => m.club?._id === club._id || m.club === club._id);
                      const isMember = myMembership?.status === 'approved';
                      const isPending = myMembership?.status === 'submitted' || myMembership?.status === 'under_review';

                      return (
                        <div
                          key={club._id}
                          className="bg-slate-800/70 border border-slate-700/70 rounded-2xl p-6 flex flex-col justify-between shadow-lg"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {club.category}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{club.code}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{club.name}</h3>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-3">{club.description}</p>

                            <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-1.5 text-xs text-slate-300">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Meeting:</span>
                                <span>{club.meetingSchedule}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Active Members:</span>
                                <span className="font-mono">{club.activeMembersCount} / {club.membershipCapacity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3">
                            {isMember ? (
                              <span className="w-full block text-center py-2 text-xs font-medium rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✓ Member ({myMembership.role})
                              </span>
                            ) : isPending ? (
                              <span className="w-full block text-center py-2 text-xs font-medium rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Application Under Review
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApplyClub(club)}
                                className="w-full py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                              >
                                Join Club
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: MY CERTIFICATES */}
              {activeTab === 'certificates' && (
                <div className="space-y-4">
                  {myCertificates.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-slate-300">No participation certificates issued yet</h3>
                      <p className="text-sm text-slate-500 mt-1">Attend campus events to earn verified participation and achievement honors.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myCertificates.map((cert) => (
                        <div
                          key={cert._id}
                          className="bg-gradient-to-br from-slate-800 to-slate-800/90 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {cert.certificateType}
                              </span>
                              <h4 className="text-base font-bold text-white pt-1">{cert.eventTitle}</h4>
                              <p className="text-xs text-slate-300">Awarded to: <span className="font-semibold">{cert.participantName}</span> ({cert.studentRollNumber})</p>
                              <p className="text-xs text-slate-400">Issued by: {cert.issuerName}</p>
                              <p className="text-xs font-mono text-purple-400 pt-1">ID: {cert.certificateNumber}</p>
                            </div>
                            <Award className="w-10 h-10 text-amber-400/80 shrink-0" />
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Issued: {new Date(cert.issueDate).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handleVerifyCertificate(cert.certificateNumber)}
                              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verify Authenticity
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ANNOUNCEMENTS */}
              {activeTab === 'announcements' && (
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-slate-300">No event announcements</h3>
                      <p className="text-sm text-slate-500 mt-1">Institutional and club notices will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((ann) => (
                        <div key={ann._id} className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-semibold text-white">{ann.title}</h4>
                            <span className="text-xs text-slate-400">
                              {new Date(ann.publishDate).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{ann.content}</p>
                          <div className="text-xs text-slate-500 pt-1">
                            Audience: <span className="font-mono text-purple-400">{ann.targetAudience}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* MODAL: ELIGIBILITY CHECK */}
          {showEligibilityModal && selectedEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Eligibility Criteria</h3>
                  <button onClick={() => setShowEligibilityModal(false)} className="text-slate-400 hover:text-slate-200">
                    ✕
                  </button>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-400 text-sm">{selectedEvent.title}</h4>
                  <p className="text-xs text-slate-400">Code: {selectedEvent.eventCode}</p>
                </div>

                <div className="space-y-2 text-xs">
                  {eligibilityData?.eligible ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>You meet all eligibility requirements for this event!</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1 text-red-300">
                      <div className="flex items-center gap-2 font-semibold">
                        <XCircle className="w-5 h-5 shrink-0" />
                        <span>You do not currently meet the criteria:</span>
                      </div>
                      <ul className="list-disc list-inside pl-1 space-y-0.5 text-xs text-red-200">
                        {eligibilityData?.reasons?.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowEligibilityModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: EVENT REGISTRATION CONFIRMATION */}
          {showRegisterModal && selectedEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Confirm Event Registration</h3>
                <p className="text-xs text-slate-300">
                  You are about to register for <span className="font-semibold text-purple-400">{selectedEvent.title}</span>.
                </p>

                <div className="p-3 bg-slate-900/60 rounded-xl space-y-1.5 text-xs text-slate-400">
                  <div>Date: <span className="text-slate-200">{new Date(selectedEvent.startDate).toLocaleDateString()}</span></div>
                  <div>Venue: <span className="text-slate-200">{selectedEvent.venueName || selectedEvent.location}</span></div>
                  <div>Category: <span className="text-slate-200 uppercase">{selectedEvent.category}</span></div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRegister}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-xl font-medium shadow-sm"
                  >
                    Confirm Registration
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: CLUB MEMBERSHIP APPLICATION */}
          {showClubModal && selectedClub && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Join {selectedClub.name}</h3>
                <p className="text-xs text-slate-400">Please provide a brief statement of purpose for your membership application.</p>

                <textarea
                  rows={4}
                  placeholder="Why do you want to join this club? What skills or interests do you bring?"
                  value={statementOfPurpose}
                  onChange={(e) => setStatementOfPurpose(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowClubModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmApplyClub}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-medium shadow-sm"
                  >
                    Submit Application
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: CERTIFICATE VERIFICATION VIEW */}
          {verifyingCert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-bold text-sm">Authentic Verified Certificate</span>
                  </div>
                  <button onClick={() => setVerifyingCert(null)} className="text-slate-400 hover:text-slate-200">
                    ✕
                  </button>
                </div>

                <div className="p-4 bg-slate-900/80 rounded-xl space-y-2 text-xs">
                  <div><span className="text-slate-400">Certificate #:</span> <span className="font-mono text-purple-400 font-bold">{verifyingCert.certificateNumber}</span></div>
                  <div><span className="text-slate-400">Recipient:</span> <span className="text-white font-semibold">{verifyingCert.participantName}</span></div>
                  <div><span className="text-slate-400">Event:</span> <span className="text-white">{verifyingCert.eventTitle}</span></div>
                  <div><span className="text-slate-400">Honor Type:</span> <span className="uppercase text-amber-300 font-medium">{verifyingCert.certificateType}</span></div>
                  <div><span className="text-slate-400">Issuer:</span> <span className="text-slate-200">{verifyingCert.issuerName}</span></div>
                  <div><span className="text-slate-400">Issue Date:</span> <span className="text-slate-200">{new Date(verifyingCert.issueDate).toLocaleDateString()}</span></div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setVerifyingCert(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: EVENT FEEDBACK */}
          {showFeedbackModal && selectedEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Event Feedback</h3>
                <p className="text-xs text-slate-300">Share your thoughts on <span className="text-purple-400 font-semibold">{selectedEvent.title}</span>.</p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Overall Experience (1-5)</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={feedbackRating.overall}
                      onChange={(e) => setFeedbackRating({ ...feedbackRating, overall: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Poor</span>
                      <span>Rating: {feedbackRating.overall} ★</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Comments (optional)</label>
                    <textarea
                      rows={3}
                      placeholder="What did you like best or how can we improve?"
                      value={feedbackComments}
                      onChange={(e) => setFeedbackComments(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFeedback}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-medium"
                  >
                    Submit Feedback
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

export default StudentActivities;
