/**
 * client/src/pages/StudentLibrary/index.jsx
 * Student Library Portal: Catalog Search, Active Loans, Renewals, Reservations & Fine Obligations.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import libraryService from '../../services/library.service';
import {
  BookOpen,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Bookmark,
  Receipt,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  X,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const StudentLibrary = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('loans'); // 'loans' | 'catalog' | 'reservations' | 'fines'

  // Tab 2: Catalog state
  const [books, setBooks] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Modals state
  const [selectedBook, setSelectedBook] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load student overview metrics & loans
  const loadOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await libraryService.getStudentOverview();
      if (res.success) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error('Failed to load student library data', err);
      showToast(err.response?.data?.message || 'Failed to load library overview', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load catalog books
  const loadCatalogBooks = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const res = await libraryService.getBooks({
        search: catalogSearch || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        availableOnly: availableOnly || undefined,
      });
      if (res.success) {
        setBooks(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load book catalog', err);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogSearch, categoryFilter, availableOnly]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadCatalogBooks();
    }
  }, [activeTab, loadCatalogBooks]);

  // Handle Book Loan Renewal
  const handleRenewLoan = async (loan) => {
    try {
      setActionLoading(true);
      const res = await libraryService.renewLoan(loan._id, { reason: 'Student portal renewal' });
      if (res.success) {
        showToast(res.message || 'Loan renewed successfully', 'success');
        loadOverviewData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to renew loan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Place Reservation
  const handlePlaceReservation = async (book) => {
    try {
      setActionLoading(true);
      const res = await libraryService.createReservation({ bookId: book._id });
      if (res.success) {
        showToast(res.message || 'Reservation placed successfully', 'success');
        setShowDetailModal(false);
        loadOverviewData();
        if (activeTab === 'catalog') loadCatalogBooks();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to place reservation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Reservation
  const handleCancelReservation = async (resId) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      setActionLoading(true);
      const res = await libraryService.cancelReservation(resId, { cancellationReason: 'Student requested' });
      if (res.success) {
        showToast('Reservation cancelled', 'success');
        loadOverviewData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel reservation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Format countdown pill
  const getDueCountdownBadge = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-3.5 h-3.5" /> {Math.abs(diffDays)} Days Overdue
        </span>
      );
    }
    if (diffDays <= 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" /> Due in {diffDays} {diffDays === 1 ? 'day' : 'days'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Clock className="w-3.5 h-3.5" /> Due in {diffDays} days
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-gray-100 overflow-hidden font-sans">
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <Navbar />

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-indigo-400" />
                Library & Circulation Portal
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Explore the Central Library catalog, manage your active book loans, and track reservations.
              </p>
            </div>
          </div>

          {/* Top Metric Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-[#131B2E] rounded-xl border border-gray-800"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Book Loans</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {overview?.metrics?.activeLoansCount || 0}{' '}
                    <span className="text-xs text-gray-400 font-normal">/ {overview?.metrics?.maxPermittedLoans || 3} allowed</span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Quota remaining: {overview?.metrics?.remainingBorrowQuota} books</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Overdue Books</p>
                  <p className={`text-2xl font-bold mt-1 ${overview?.metrics?.overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {overview?.metrics?.overdueCount || 0}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {overview?.metrics?.overdueCount > 0 ? 'Requires immediate return' : 'No overdue loans'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${overview?.metrics?.overdueCount > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Reservations</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{overview?.metrics?.pendingReservationsCount || 0}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Queued title holds</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <Bookmark className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding Fines</p>
                  <p className={`text-2xl font-bold mt-1 ${overview?.metrics?.totalOutstandingFinesInRupees > 0 ? 'text-rose-400' : 'text-gray-200'}`}>
                    ₹{overview?.metrics?.totalOutstandingFinesInRupees || 0}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Payable at accounts / desk</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gray-800/60 flex items-center justify-center text-gray-300 border border-gray-700/50">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('loans')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'loans'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="w-4 h-4" /> My Issued Books ({overview?.activeLoans?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Search className="w-4 h-4" /> Search Catalog
            </button>
            <button
              onClick={() => setActiveTab('reservations')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'reservations'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Bookmark className="w-4 h-4" /> Holds & Reservations ({overview?.pendingReservations?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('fines')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'fines'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Receipt className="w-4 h-4" /> Library Fines ({overview?.unpaidFines?.length || 0})
            </button>
          </div>

          {/* TAB 1: My Issued Books */}
          {activeTab === 'loans' && (
            <div className="space-y-4">
              {!overview?.activeLoans || overview.activeLoans.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No books currently checked out</p>
                  <p className="text-sm text-gray-500 mt-1">Browse the catalog to discover books available on shelf for borrowing.</p>
                  <button
                    onClick={() => setActiveTab('catalog')}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Search className="w-3.5 h-3.5" /> Explore Book Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {overview.activeLoans.map((loan) => (
                    <div
                      key={loan._id}
                      className="bg-[#131B2E] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">{loan.issueId}</span>
                          {getDueCountdownBadge(loan.dueDate)}
                        </div>

                        <h3 className="text-base font-bold text-white line-clamp-1">{loan.book?.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">By {loan.book?.authors?.join(', ')}</p>

                        <div className="mt-4 bg-[#0B0F19] rounded-lg p-3 space-y-1.5 text-xs border border-gray-800/80">
                          <div className="flex justify-between text-gray-400">
                            <span>Copy Accession:</span>
                            <span className="font-mono text-gray-200">{loan.copy?.accessionNumber}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Issued On:</span>
                            <span>{new Date(loan.issueDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Return Deadline:</span>
                            <span className="font-semibold text-white">{new Date(loan.dueDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-gray-400 pt-1 border-t border-gray-800">
                            <span>Renewals Used:</span>
                            <span>{loan.renewalCount} of {loan.policySnapshot?.maxRenewals || 2}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-800 flex gap-2">
                        <button
                          disabled={actionLoading || loan.renewalCount >= (loan.policySnapshot?.maxRenewals || 2)}
                          onClick={() => handleRenewLoan(loan)}
                          className="w-full py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Extend / Renew Loan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Book Catalog Discovery */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131B2E] border border-gray-800 p-3.5 rounded-xl text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search by title, author, ISBN..."
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Academic Categories</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Literature">Literature</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 px-2">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 select-none">
                    <input
                      type="checkbox"
                      checked={availableOnly}
                      onChange={(e) => setAvailableOnly(e.target.checked)}
                      className="rounded bg-gray-900 border-gray-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Available copies on shelf only</span>
                  </label>
                </div>
              </div>

              {/* Catalog Results Grid */}
              {catalogLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-44 bg-[#131B2E] rounded-xl border border-gray-800"></div>
                  ))}
                </div>
              ) : books.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No books found</p>
                  <p className="text-sm text-gray-500 mt-1">Try broadening your search terms or clearing category filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {books.map((b) => (
                    <div
                      key={b._id}
                      className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {b.category}
                          </span>
                          {b.availableCopies > 0 ? (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> {b.availableCopies} on shelf
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              0 Available (Hold Queue)
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white mt-2 line-clamp-1">{b.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">By {b.authors?.join(', ')}</p>

                        <div className="mt-3 text-xs text-gray-400 space-y-1">
                          {b.isbn && <p className="font-mono text-[11px]">ISBN: {b.isbn}</p>}
                          <p className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-500" />
                            {b.shelfNumber ? `Shelf: ${b.shelfNumber}, Rack: ${b.rackNumber || '1'}` : b.location}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-xs">
                        {b.availableCopies > 0 ? (
                          <span className="text-gray-400 text-[11px]">Direct borrow at Issue Desk</span>
                        ) : (
                          <button
                            onClick={() => handlePlaceReservation(b)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Bookmark className="w-3.5 h-3.5" /> Place Hold / Reserve
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedBook(b);
                            setShowDetailModal(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Reservations */}
          {activeTab === 'reservations' && (
            <div className="space-y-4">
              {!overview?.pendingReservations || overview.pendingReservations.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <Bookmark className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No active book reservations</p>
                  <p className="text-sm text-gray-500 mt-1">When all copies of a book are checked out, you can reserve it to queue for the next return.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {overview.pendingReservations.map((res) => (
                    <div key={res._id} className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-mono font-bold text-indigo-400">{res.reservationNumber}</span>
                          {res.status === 'available_for_pickup' ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Ready for Pickup
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              In Queue
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white mt-2 line-clamp-1">{res.book?.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">By {res.book?.authors?.join(', ')}</p>

                        {res.status === 'available_for_pickup' && (
                          <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                            <p className="font-semibold">Held at Circulation Desk:</p>
                            <p className="text-[11px] mt-0.5">Copy: {res.reservedCopy?.accessionNumber} | Collect by: {new Date(res.pickupDeadline).toLocaleDateString()}</p>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-gray-400 space-y-1">
                          <p>Requested On: {new Date(res.requestDate).toLocaleDateString()}</p>
                          {res.queuePosition && (
                            <p className="text-amber-300 font-semibold">Queue Position: #{res.queuePosition}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-800 flex justify-end">
                        <button
                          onClick={() => handleCancelReservation(res._id)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                        >
                          Cancel Hold
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Library Fines */}
          {activeTab === 'fines' && (
            <div className="space-y-4">
              {!overview?.unpaidFines || overview.unpaidFines.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No outstanding library fines</p>
                  <p className="text-sm text-gray-500 mt-1">Your library account is in good standing with zero overdue penalties.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Fine #</th>
                          <th className="px-4 py-3">Book</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {overview.unpaidFines.map((f) => (
                          <tr key={f._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-mono font-medium text-indigo-400">{f.fineNumber}</td>
                            <td className="px-4 py-3 font-medium text-white">{f.book?.title || 'Library Copy'}</td>
                            <td className="px-4 py-3 uppercase text-gray-300">{f.fineType?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 font-bold text-rose-400 text-sm">
                              ₹{(f.amountInPaise / 100).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-400">{f.reason}</td>
                            <td className="px-4 py-3">
                              <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {f.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODAL: Book Details */}
          {showDetailModal && selectedBook && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  {selectedBook.title}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">By {selectedBook.authors?.join(', ')}</p>

                <div className="mt-4 space-y-3 text-xs text-gray-300">
                  <div className="grid grid-cols-2 gap-2 bg-[#0B0F19] p-3 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-gray-500">Category:</p>
                      <p className="font-medium text-white">{selectedBook.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">ISBN:</p>
                      <p className="font-mono text-white">{selectedBook.isbn || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Copies:</p>
                      <p className="font-medium text-white">{selectedBook.totalCopies}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Available on Shelf:</p>
                      <p className="font-bold text-emerald-400">{selectedBook.availableCopies}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-500">Location:</p>
                    <p className="text-white font-medium">
                      {selectedBook.shelfNumber ? `Shelf: ${selectedBook.shelfNumber}, Rack: ${selectedBook.rackNumber || '1'} (${selectedBook.location})` : selectedBook.location}
                    </p>
                  </div>

                  {selectedBook.description && (
                    <div>
                      <p className="text-gray-500">Description:</p>
                      <p className="text-gray-300 mt-1 leading-relaxed">{selectedBook.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                  >
                    Close
                  </button>
                  {selectedBook.availableCopies === 0 && (
                    <button
                      onClick={() => handlePlaceReservation(selectedBook)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      Place Hold / Reserve
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentLibrary;

