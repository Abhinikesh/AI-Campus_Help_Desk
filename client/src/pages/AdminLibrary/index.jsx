/**
 * client/src/pages/AdminLibrary/index.jsx
 * Central Library Administration, Physical Inventory, Circulation Desk & Fine Management.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import libraryService from '../../services/library.service';
import {
  BookOpen,
  Building2,
  PlusCircle,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  RotateCw,
  Bookmark,
  Receipt,
  Download,
  X,
  Layers,
  MapPin,
  Settings,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
  RefreshCw,
  Archive,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const AdminLibrary = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('desk'); // 'desk' | 'catalog' | 'inventory' | 'loans' | 'fines' | 'policy'

  // Tab 1: Circulation Desk State
  const [issueForm, setIssueForm] = useState({
    rollNumber: '',
    accessionNumber: '',
    customDueDate: '',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    accessionNumber: '',
    condition: 'good',
    damageFee: '',
    notes: '',
  });

  // Tab 2: Catalog State
  const [books, setBooks] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showAddCopyModal, setShowAddCopyModal] = useState(false);
  const [selectedBookForCopy, setSelectedBookForCopy] = useState(null);

  const [newBookForm, setNewBookForm] = useState({
    title: '',
    subtitle: '',
    isbn: '',
    authors: '',
    category: 'Computer Science',
    publisher: '',
    edition: '1st',
    publicationYear: '2025',
    shelfNumber: 'CS-01',
    rackNumber: 'R1',
    location: 'Central Library - Main Stack',
  });

  const [newCopyForm, setNewCopyForm] = useState({
    accessionNumber: '',
    condition: 'good',
    price: 500,
    shelfLocation: '',
  });

  // Tab 3: Copies Inventory State
  const [copies, setCopies] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Tab 4: Loans State
  const [loans, setLoans] = useState([]);

  // Tab 5: Fines State
  const [fines, setFines] = useState([]);

  // Tab 6: Policy State
  const [policyForm, setPolicyForm] = useState({
    maxBooksPerStudent: 3,
    loanDurationDays: 14,
    maxRenewals: 2,
    renewalDurationDays: 14,
    gracePeriodDays: 1,
    finePerOverdueDay: 5,
    maxFinePerBook: 1000,
    reservationExpiryDays: 3,
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Load Admin Metrics & Active Tab Data
  const loadLibraryData = useCallback(async () => {
    try {
      setLoading(true);
      const metricsRes = await libraryService.getAdminMetrics();
      if (metricsRes.success) {
        setMetrics(metricsRes.data);
      }

      if (activeTab === 'catalog') {
        const bRes = await libraryService.getBooks({
          search: catalogSearch || undefined,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
        });
        if (bRes.success) setBooks(bRes.data || []);
      } else if (activeTab === 'inventory') {
        const cRes = await libraryService.getCopies({ search: inventorySearch || undefined });
        if (cRes.success) setCopies(cRes.data || []);
      } else if (activeTab === 'policy') {
        const pRes = await libraryService.getPolicy();
        if (pRes.success && pRes.data) {
          setPolicyForm({
            maxBooksPerStudent: pRes.data.maxBooksPerStudent,
            loanDurationDays: pRes.data.loanDurationDays,
            maxRenewals: pRes.data.maxRenewals,
            renewalDurationDays: pRes.data.renewalDurationDays,
            gracePeriodDays: pRes.data.gracePeriodDays,
            finePerOverdueDay: pRes.data.finePerOverdueDayInRupees || 5,
            maxFinePerBook: (pRes.data.maxFinePerBookInPaise || 100000) / 100,
            reservationExpiryDays: pRes.data.reservationExpiryDays,
          });
        }
      } else if (activeTab === 'fines') {
        const fRes = await libraryService.getFines();
        if (fRes.success) setFines(fRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load library admin data', err);
      showToast(err.response?.data?.message || 'Error loading library records', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, catalogSearch, categoryFilter, inventorySearch, showToast]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  // Handle Book Issue
  const handleIssueBook = async (e) => {
    e.preventDefault();
    if (!issueForm.rollNumber || !issueForm.accessionNumber) {
      showToast('Student Roll Number and Copy Accession Number are required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await libraryService.issueBook(issueForm);
      if (res.success) {
        showToast(res.message || 'Book issued successfully', 'success');
        setIssueForm({ rollNumber: '', accessionNumber: '', customDueDate: '', notes: '' });
        loadLibraryData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to issue book', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Book Return
  const handleReturnBook = async (e) => {
    e.preventDefault();
    if (!returnForm.accessionNumber) {
      showToast('Accession Number is required for returning a book', 'error');
      return;
    }

    try {
      setActionLoading(true);
      // Locate active loan for this copy
      const copiesRes = await libraryService.getCopies({ search: returnForm.accessionNumber.trim() });
      const targetCopy = copiesRes.data?.find(
        (c) => c.accessionNumber.toUpperCase() === returnForm.accessionNumber.trim().toUpperCase()
      );

      if (!targetCopy || !targetCopy.currentLoan) {
        showToast(`No active loan found for accession '${returnForm.accessionNumber}'`, 'error');
        setActionLoading(false);
        return;
      }

      const loanId = targetCopy.currentLoan._id || targetCopy.currentLoan;
      const res = await libraryService.returnBook(loanId, {
        condition: returnForm.condition,
        damageFee: returnForm.damageFee ? Number(returnForm.damageFee) : undefined,
        notes: returnForm.notes,
      });

      if (res.success) {
        showToast(res.message || 'Book returned and checked in successfully', 'success');
        setReturnForm({ accessionNumber: '', condition: 'good', damageFee: '', notes: '' });
        loadLibraryData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to return book', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Book
  const handleCreateBook = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await libraryService.createBook(newBookForm);
      if (res.success) {
        showToast('Book registered in catalog successfully', 'success');
        setShowAddBookModal(false);
        loadLibraryData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add book', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Copy
  const handleAddCopy = async (e) => {
    e.preventDefault();
    if (!selectedBookForCopy) return;

    try {
      setActionLoading(true);
      const res = await libraryService.addBookCopy({
        bookId: selectedBookForCopy._id,
        accessionNumber: newCopyForm.accessionNumber,
        condition: newCopyForm.condition,
        price: Number(newCopyForm.price),
        shelfLocation: newCopyForm.shelfLocation,
      });

      if (res.success) {
        showToast('Physical copy registered and barcoded', 'success');
        setShowAddCopyModal(false);
        setNewCopyForm({ accessionNumber: '', condition: 'good', price: 500, shelfLocation: '' });
        loadLibraryData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to register copy', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Waive Fine
  const handleWaiveFine = async (fineId) => {
    const reason = window.prompt('Enter reason for waiving this fine (min 5 chars):');
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) showToast('A detailed reason (min 5 characters) is required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await libraryService.waiveFine(fineId, { waiverReason: reason.trim() });
      if (res.success) {
        showToast('Library fine waived successfully', 'success');
        loadLibraryData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to waive fine', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle CSV Export
  const handleExportCsv = async (type) => {
    try {
      showToast(`Generating library ${type} audit CSV report...`, 'info');
      const blob = await libraryService.exportCsvReport({ type });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CampusSphere_Library_${type}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Report downloaded successfully', 'success');
    } catch (err) {
      showToast('Failed to export CSV report', 'error');
    }
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
                <Building2 className="w-8 h-8 text-indigo-400" />
                Library Administration & Circulation Desk
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage physical book inventory, circulation issue/return workflows, reservations, and fine records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleExportCsv('inventory')}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-gray-400" /> Inventory CSV
              </button>
              <button
                onClick={() => handleExportCsv('loans')}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-gray-400" /> Circulation CSV
              </button>
              <button
                onClick={() => setShowAddBookModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <PlusCircle className="w-4 h-4" /> Add Book Title
              </button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Book Catalog Titles</p>
                    <p className="text-2xl font-bold text-white mt-1">{metrics.totalBooks}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex justify-between">
                  <span>Physical Copies: <b>{metrics.copyStats?.totalCopies || 0}</b></span>
                  <span className="text-emerald-400">Available: <b>{metrics.copyStats?.available || 0}</b></span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Circulation Loans</p>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">{metrics.circulation?.activeLoansCount || 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                  <span>Copies currently checked out by students</span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Overdue Book Loans</p>
                    <p className={`text-2xl font-bold mt-1 ${metrics.circulation?.overdueLoansCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {metrics.circulation?.overdueLoansCount || 0}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${metrics.circulation?.overdueLoansCount > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                  <span>Subject to daily overdue fines</span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding Fines</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">₹{metrics.fineStats?.pendingAmountInRupees?.toLocaleString() || 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                    <Receipt className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex justify-between">
                  <span>Pending: {metrics.fineStats?.pendingCount || 0}</span>
                  <span className="text-emerald-400">Collected: ₹{metrics.fineStats?.paidAmountInRupees || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('desk')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'desk'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <RotateCw className="w-4 h-4" /> Issue / Return Desk
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Book Catalog ({metrics?.totalBooks || 0})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Physical Copies ({metrics?.copyStats?.totalCopies || 0})
            </button>
            <button
              onClick={() => setActiveTab('fines')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'fines'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Receipt className="w-4 h-4" /> Fines & Penalties
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'policy'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Circulation Policy
            </button>
          </div>

          {/* TAB 1: Issue / Return Circulation Desk */}
          {activeTab === 'desk' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Issue Desk Form */}
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Issue Book to Student
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Enforces student eligibility, quota limits, and copy availability checks.
                </p>

                <form onSubmit={handleIssueBook} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Student Roll Number / Login ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CSE-2026-001"
                      value={issueForm.rollNumber}
                      onChange={(e) => setIssueForm({ ...issueForm, rollNumber: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Physical Copy Accession Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACC-CS-001"
                      value={issueForm.accessionNumber}
                      onChange={(e) => setIssueForm({ ...issueForm, accessionNumber: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Custom Due Date (Optional — defaults to 14 days)
                    </label>
                    <input
                      type="date"
                      value={issueForm.customDueDate}
                      onChange={(e) => setIssueForm({ ...issueForm, customDueDate: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Librarian Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Special borrowing conditions..."
                      value={issueForm.notes}
                      onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition"
                  >
                    <CheckCircle className="w-4 h-4" /> Issue Book & Generate Loan Record
                  </button>
                </form>
              </div>

              {/* Return Desk Form */}
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCw className="w-5 h-5 text-emerald-400" />
                  Check-in / Return Book Copy
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Processes physical check-in, assesses condition, calculates overdue fines, and triggers reservation queues.
                </p>

                <form onSubmit={handleReturnBook} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Physical Copy Accession Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACC-CS-001"
                      value={returnForm.accessionNumber}
                      onChange={(e) => setReturnForm({ ...returnForm, accessionNumber: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Physical Condition on Return *
                    </label>
                    <select
                      value={returnForm.condition}
                      onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="good">Good / Normal Wear</option>
                      <option value="new">Like New</option>
                      <option value="fair">Fair / Minor Scuffs</option>
                      <option value="damaged">Damaged (Requires Repair / Penalty)</option>
                      <option value="lost">Lost / Missing</option>
                    </select>
                  </div>

                  {returnForm.condition === 'damaged' && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Damage / Repair Assessment Fee (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 150"
                        value={returnForm.damageFee}
                        onChange={(e) => setReturnForm({ ...returnForm, damageFee: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Inspection Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Missing dust jacket, torn page 42..."
                      value={returnForm.notes}
                      onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg text-xs text-gray-400">
                    <p className="flex items-center gap-1.5 text-gray-300 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Automated Fair Queue Processing
                    </p>
                    <p className="mt-0.5 text-[11px]">
                      If returned in good condition and students are waiting in the reservation queue, this copy is held for the next student.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition"
                  >
                    <CheckCheck className="w-4 h-4" /> Check-in Copy & Complete Return
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Book Catalog Management */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
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

                <div className="flex justify-end items-center">
                  <button
                    onClick={loadLibraryData}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh Catalog
                  </button>
                </div>
              </div>

              {books.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No books found in catalog</p>
                  <p className="text-sm text-gray-500 mt-1">Add book titles and register physical barcoded copies.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Book Title</th>
                          <th className="px-4 py-3">ISBN</th>
                          <th className="px-4 py-3">Authors</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Shelf Location</th>
                          <th className="px-4 py-3">Total Copies</th>
                          <th className="px-4 py-3">Available</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {books.map((b) => (
                          <tr key={b._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-semibold text-white">
                              {b.title}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-400">
                              {b.isbn || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {b.authors?.join(', ')}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {b.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {b.shelfNumber ? `Shelf ${b.shelfNumber}` : b.location}
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{b.totalCopies}</td>
                            <td className="px-4 py-3 font-bold text-emerald-400">{b.availableCopies}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedBookForCopy(b);
                                  setShowAddCopyModal(true);
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold"
                              >
                                + Add Copy
                              </button>
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

          {/* TAB 3: Physical Copies Inventory */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search accession #, copy ID..."
                    className="w-full bg-[#131B2E] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={loadLibraryData}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {copies.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <Layers className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No physical copies found</p>
                  <p className="text-sm text-gray-500 mt-1">Register physical copies under catalog titles.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Accession #</th>
                          <th className="px-4 py-3">Copy ID</th>
                          <th className="px-4 py-3">Book Title</th>
                          <th className="px-4 py-3">Shelf Location</th>
                          <th className="px-4 py-3">Condition</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {copies.map((c) => (
                          <tr key={c._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-400">{c.accessionNumber}</td>
                            <td className="px-4 py-3 font-mono text-gray-400">{c.copyId}</td>
                            <td className="px-4 py-3 font-semibold text-white">{c.book?.title}</td>
                            <td className="px-4 py-3 text-gray-400">{c.shelfLocation || 'Main Stack'}</td>
                            <td className="px-4 py-3 uppercase text-gray-300">{c.condition}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                c.status === 'available'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : c.status === 'issued'
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : c.status === 'reserved'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {c.status}
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

          {/* TAB 4: Fine Management */}
          {activeTab === 'fines' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                  Library Penalties & Overdue Fines Ledger
                </h3>
                <button
                  onClick={loadLibraryData}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {fines.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <CheckCheck className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No library fines on record</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Fine #</th>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Book Title</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {fines.map((f) => (
                          <tr key={f._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-mono font-medium text-indigo-400">{f.fineNumber}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{f.student?.user?.name || 'Student'}</p>
                              <p className="text-gray-400 text-[11px] font-mono">{f.student?.rollNumber}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-200">{f.book?.title || 'Book Copy'}</td>
                            <td className="px-4 py-3 uppercase text-gray-300">{f.fineType?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 font-bold text-rose-400 text-sm">
                              ₹{(f.amountInPaise / 100).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-400">{f.reason}</td>
                            <td className="px-4 py-3">
                              <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                                f.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : f.status === 'waived'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {f.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              {f.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleWaiveFine(f._id)}
                                    className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-xs font-semibold"
                                  >
                                    Waive
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const ref = window.prompt('Enter cash receipt number or transaction reference:');
                                      if (ref) {
                                        await libraryService.recordFinePayment(f._id, { paymentReference: ref });
                                        loadLibraryData();
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                                  >
                                    Mark Paid
                                  </button>
                                </>
                              )}
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

          {/* TAB 5: Policy Settings */}
          {activeTab === 'policy' && (
            <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-6 max-w-2xl shadow-sm">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Institutional Library Policy Settings
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Configure loan quotas, checkout durations, renewal policies, and overdue fine rates.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setActionLoading(true);
                    await libraryService.updatePolicy(policyForm);
                    showToast('Circulation policy updated successfully', 'success');
                  } catch (err) {
                    showToast('Failed to update policy', 'error');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                className="mt-6 space-y-4 text-xs"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Max Books per Student</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={policyForm.maxBooksPerStudent}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxBooksPerStudent: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Standard Loan Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={policyForm.loanDurationDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, loanDurationDays: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Max Renewals Allowed</label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.maxRenewals}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxRenewals: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Renewal Extension (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={policyForm.renewalDurationDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, renewalDurationDays: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Grace Period (Days)</label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.gracePeriodDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, gracePeriodDays: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Fine per Overdue Day (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.finePerOverdueDay}
                      onChange={(e) => setPolicyForm({ ...policyForm, finePerOverdueDay: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Max Fine Cap per Book (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={policyForm.maxFinePerBook}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxFinePerBook: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Save Policy Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* MODAL: Add New Book Title */}
          {showAddBookModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowAddBookModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Add Book to Catalog
                </h3>

                <form onSubmit={handleCreateBook} className="mt-5 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Book Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Introduction to Algorithms"
                      value={newBookForm.title}
                      onChange={(e) => setNewBookForm({ ...newBookForm, title: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Authors (Comma-separated) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cormen, Leiserson, Rivest"
                        value={newBookForm.authors}
                        onChange={(e) => setNewBookForm({ ...newBookForm, authors: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">ISBN (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 978-0262033848"
                        value={newBookForm.isbn}
                        onChange={(e) => setNewBookForm({ ...newBookForm, isbn: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Category *</label>
                      <select
                        value={newBookForm.category}
                        onChange={(e) => setNewBookForm({ ...newBookForm, category: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                      >
                        <option value="Computer Science">Computer Science</option>
                        <option value="Artificial Intelligence">Artificial Intelligence</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Physics">Physics</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Literature">Literature</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Publisher</label>
                      <input
                        type="text"
                        placeholder="e.g. MIT Press"
                        value={newBookForm.publisher}
                        onChange={(e) => setNewBookForm({ ...newBookForm, publisher: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Shelf Number</label>
                      <input
                        type="text"
                        placeholder="e.g. CS-04"
                        value={newBookForm.shelfNumber}
                        onChange={(e) => setNewBookForm({ ...newBookForm, shelfNumber: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-300 mb-1">Rack Number</label>
                      <input
                        type="text"
                        placeholder="e.g. R2"
                        value={newBookForm.rackNumber}
                        onChange={(e) => setNewBookForm({ ...newBookForm, rackNumber: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddBookModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold disabled:opacity-50"
                    >
                      Add Book to Catalog
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: Register Physical Copy */}
          {showAddCopyModal && selectedBookForCopy && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowAddCopyModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Register Physical Copy
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                  For: <span className="font-semibold text-white">{selectedBookForCopy.title}</span>
                </p>

                <form onSubmit={handleAddCopy} className="mt-5 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">
                      Unique Accession Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACC-CS-004-01"
                      value={newCopyForm.accessionNumber}
                      onChange={(e) => setNewCopyForm({ ...newCopyForm, accessionNumber: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Initial Condition</label>
                    <select
                      value={newCopyForm.condition}
                      onChange={(e) => setNewCopyForm({ ...newCopyForm, condition: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    >
                      <option value="new">Brand New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Acquisition Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={newCopyForm.price}
                      onChange={(e) => setNewCopyForm({ ...newCopyForm, price: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-300 mb-1">Shelf Location Override</label>
                    <input
                      type="text"
                      placeholder={selectedBookForCopy.shelfNumber ? `Shelf: ${selectedBookForCopy.shelfNumber}` : 'e.g. Rack 2 Shelf A'}
                      value={newCopyForm.shelfLocation}
                      onChange={(e) => setNewCopyForm({ ...newCopyForm, shelfLocation: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddCopyModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold disabled:opacity-50"
                    >
                      Register Copy
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

export default AdminLibrary;

