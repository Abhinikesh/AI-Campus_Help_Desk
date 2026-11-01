/**
 * client/src/pages/StudentFees/index.jsx
 * Comprehensive Student Fee Management, Payments, Invoices, Receipts & Concessions.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import feeService from '../../services/fee.service';
import {
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Download,
  Printer,
  X,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  IndianRupee,
  HelpCircle,
  Search,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const StudentFees = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'receipts'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showConcessionModal, setShowConcessionModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Forms state
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'upi',
    externalReference: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [concessionForm, setConcessionForm] = useState({
    adjustmentType: 'need_based_concession',
    amount: '',
    reason: '',
    supportingDocReference: '',
  });

  const receiptPrintRef = useRef(null);

  const fetchFeeData = useCallback(async () => {
    try {
      setLoading(true);
      const [ovRes, recRes] = await Promise.all([
        feeService.getStudentOverview(),
        feeService.getStudentReceipts(),
      ]);

      if (ovRes.success) {
        setOverview(ovRes.data.metrics);
        setInvoices(ovRes.data.invoices || []);
      }
      if (recRes.success) {
        setReceipts(recRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load fee information', err);
      showToast(err.response?.data?.message || 'Failed to load fee information', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchFeeData();
  }, [fetchFeeData]);

  // Open Payment Modal
  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
    setPaymentForm({
      amount: inv.outstandingBalance > 0 ? String(inv.outstandingBalance) : '',
      paymentMethod: 'upi',
      externalReference: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPayModal(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    if (amt > selectedInvoice.outstandingBalance) {
      showToast(`Amount cannot exceed remaining balance (₹${selectedInvoice.outstandingBalance})`, 'error');
      return;
    }
    if (!paymentForm.externalReference.trim()) {
      showToast('Please provide a UTR or payment reference number', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await feeService.recordOfflinePayment({
        invoiceId: selectedInvoice._id,
        amount: amt,
        paymentMethod: paymentForm.paymentMethod,
        externalReference: paymentForm.externalReference.trim(),
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes.trim(),
      });

      if (res.success) {
        showToast('Payment reference recorded. It will be verified by the Finance Office.', 'success');
        setShowPayModal(false);
        fetchFeeData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Concession Modal
  const handleOpenConcession = (inv) => {
    setSelectedInvoice(inv);
    setConcessionForm({
      adjustmentType: 'need_based_concession',
      amount: '',
      reason: '',
      supportingDocReference: '',
    });
    setShowConcessionModal(true);
  };

  // Submit Concession Request
  const handleSubmitConcession = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = Number(concessionForm.amount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid concession amount', 'error');
      return;
    }
    if (amt > selectedInvoice.grossAmount) {
      showToast(`Concession cannot exceed gross invoice amount (₹${selectedInvoice.grossAmount})`, 'error');
      return;
    }
    if (concessionForm.reason.trim().length < 5) {
      showToast('Please provide a detailed justification reason (min 5 chars)', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await feeService.requestConcession({
        invoiceId: selectedInvoice._id,
        adjustmentType: concessionForm.adjustmentType,
        amount: amt,
        reason: concessionForm.reason.trim(),
        supportingDocReference: concessionForm.supportingDocReference.trim(),
      });

      if (res.success) {
        showToast('Concession application submitted for review.', 'success');
        setShowConcessionModal(false);
        fetchFeeData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Receipt Modal
  const handleViewReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.feeStructure?.name?.toLowerCase().includes(q) ||
      inv.academicYear?.toLowerCase().includes(q) ||
      inv.status?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Fully Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Partially Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue
          </span>
        );
      case 'issued':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" /> Payment Due
          </span>
        );
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
                <CreditCard className="w-8 h-8 text-indigo-400" />
                Fee & Payment Management
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                View your academic fee invoices, submit offline payment proofs, and download verified receipts.
              </p>
            </div>
          </div>

          {/* Top Metric Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-[#131B2E] rounded-xl border border-gray-800"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Net Billed</p>
                  <p className="text-2xl font-bold text-white mt-1">₹{overview?.totalBilledInRupees?.toLocaleString() || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <FileText className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Verified Paid</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">₹{overview?.totalPaidInRupees?.toLocaleString() || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-rose-400 mt-1">₹{overview?.totalOutstandingInRupees?.toLocaleString() || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <IndianRupee className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Verification</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{overview?.pendingPaymentsCount || 0}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Transactions under review</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'invoices'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Academic Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'receipts'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Receipt className="w-4 h-4" /> Verified Receipts ({receipts.length})
            </button>
          </div>

          {/* TAB 1: Invoices */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {/* Search & Notice Bar */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search invoices..."
                    className="w-full bg-[#131B2E] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1.5 self-start sm:self-auto bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Payments are securely recorded in paise and reconciled by the Finance Office.
                </div>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-medium text-gray-300">No invoices found</p>
                  <p className="text-sm text-gray-500 mt-1">There are no fee invoices matching your criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredInvoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="bg-[#131B2E] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div>
                            <span className="text-xs font-mono font-bold text-indigo-400 tracking-wider">
                              {inv.invoiceNumber}
                            </span>
                            <h3 className="text-base font-semibold text-white mt-0.5">
                              {inv.feeStructure?.name || `Semester ${inv.semester} Fees`}
                            </h3>
                          </div>
                          {getStatusBadge(inv.status)}
                        </div>

                        <div className="text-xs text-gray-400 space-y-1 mb-4">
                          <p>Department: <span className="text-gray-200 font-medium">{inv.department}</span></p>
                          <p>Academic Term: <span className="text-gray-200 font-medium">{inv.academicYear} (Sem {inv.semester})</span></p>
                          <p>Due Date: <span className="text-gray-200 font-medium">{new Date(inv.dueDate).toLocaleDateString()}</span></p>
                        </div>

                        {/* Financial Ledger Mini Summary */}
                        <div className="bg-[#0B0F19] rounded-lg p-3 space-y-1.5 text-xs border border-gray-800/70 mb-4">
                          <div className="flex justify-between text-gray-400">
                            <span>Gross Billed:</span>
                            <span>₹{inv.grossAmount?.toLocaleString()}</span>
                          </div>
                          {inv.concessionAmount > 0 && (
                            <div className="flex justify-between text-emerald-400">
                              <span>Scholarship/Concession:</span>
                              <span>- ₹{inv.concessionAmount?.toLocaleString()}</span>
                            </div>
                          )}
                          {inv.lateFeeAmount > 0 && (
                            <div className="flex justify-between text-rose-400">
                              <span>Late Fee:</span>
                              <span>+ ₹{inv.lateFeeAmount?.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-200 font-semibold pt-1 border-t border-gray-800">
                            <span>Net Payable:</span>
                            <span>₹{inv.netPayable?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400">
                            <span>Amount Paid:</span>
                            <span>₹{inv.amountPaid?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-gray-800 text-sm">
                            <span>Outstanding:</span>
                            <span>₹{inv.outstandingBalance?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        {inv.outstandingBalance > 0 && inv.status !== 'cancelled' ? (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <CreditCard className="w-4 h-4" /> Record Offline Payment
                          </button>
                        ) : (
                          <div className="w-full py-2 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                            <CheckCircle className="w-4 h-4" /> Fully Settled
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setShowDetailModal(true);
                            }}
                            className="flex-1 py-1.5 px-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium text-center transition"
                          >
                            Breakdown
                          </button>
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => handleOpenConcession(inv)}
                              className="flex-1 py-1.5 px-2 bg-gray-800/80 hover:bg-gray-700 text-indigo-300 rounded-lg text-xs font-medium text-center transition"
                            >
                              Apply Waiver
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Verified Receipts */}
          {activeTab === 'receipts' && (
            <div className="space-y-4">
              {receipts.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <Receipt className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-medium text-gray-300">No verified payment receipts</p>
                  <p className="text-sm text-gray-500 mt-1">Once your submitted offline payments are verified by the Finance Department, formal receipts appear here.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                      <thead className="bg-[#0B0F19] text-xs uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-5 py-3.5">Receipt #</th>
                          <th className="px-5 py-3.5">Transaction ID</th>
                          <th className="px-5 py-3.5">Invoice #</th>
                          <th className="px-5 py-3.5">Amount</th>
                          <th className="px-5 py-3.5">Method & Ref</th>
                          <th className="px-5 py-3.5">Payment Date</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {receipts.map((rcp) => (
                          <tr key={rcp._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-5 py-3.5 font-mono font-medium text-indigo-400">
                              {rcp.receiptNumber}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-gray-400">
                              {rcp.transactionId}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-300">
                              {rcp.invoice?.invoiceNumber || '—'}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-emerald-400">
                              ₹{(rcp.amountInPaise / 100).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-xs">
                              <span className="uppercase font-semibold text-gray-200">{rcp.paymentMethod}</span>
                              {rcp.externalReference && (
                                <p className="text-gray-400 font-mono text-[11px]">Ref: {rcp.externalReference}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-400">
                              {new Date(rcp.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleViewReceipt(rcp)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition"
                              >
                                <Printer className="w-3.5 h-3.5" /> View Receipt
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

          {/* MODAL: Offline Payment Submission */}
          {showPayModal && selectedInvoice && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  Submit Offline Payment Proof
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Invoice <span className="font-mono text-indigo-400">{selectedInvoice.invoiceNumber}</span> | Outstanding: <span className="text-rose-400 font-bold">₹{selectedInvoice.outstandingBalance}</span>
                </p>

                <form onSubmit={handleSubmitPayment} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Payment Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      max={selectedInvoice.outstandingBalance}
                      min="1"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[11px] text-gray-500">Cannot exceed remaining balance of ₹{selectedInvoice.outstandingBalance}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="upi">UPI Transfer (Google Pay, PhonePe, Paytm, BHIM)</option>
                      <option value="bank_transfer">Direct Bank Transfer</option>
                      <option value="neft_rtgs">NEFT / RTGS / IMPS</option>
                      <option value="cheque">Bank Cheque</option>
                      <option value="dd">Demand Draft (DD)</option>
                      <option value="cash">Direct Cash at Campus Accounts Desk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Bank Transaction ID / UTR / Cheque No. *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 12-digit UTR 428901238910 or Cheque # 001928"
                      value={paymentForm.externalReference}
                      onChange={(e) => setPaymentForm({ ...paymentForm, externalReference: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Remarks / Student Notes (Optional)
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Optional notes for the Accounts Department..."
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    ></textarea>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                    <p className="font-semibold">Verification Notice:</p>
                    <p className="mt-0.5 text-amber-200/80">
                      Your submission will be recorded in <b>pending</b> status. An authorized finance officer will verify your bank reference against college bank statements. Your invoice balance updates upon verification.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPayModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: Fee Breakdown Detail */}
          {showDetailModal && selectedInvoice && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Fee Invoice Breakdown
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Invoice <span className="font-mono text-indigo-400">{selectedInvoice.invoiceNumber}</span> | Term: {selectedInvoice.academicYear} Sem {selectedInvoice.semester}
                </p>

                <div className="mt-5 space-y-4">
                  <div className="border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0F19] text-gray-400 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Component</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 text-gray-300">
                        {selectedInvoice.components?.map((c, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 font-medium">{c.name}</td>
                            <td className="px-4 py-2.5 text-gray-400">
                              {c.isMandatory ? 'Mandatory' : 'Optional'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              ₹{(c.amountInPaise / 100).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#0B0F19] p-4 rounded-xl space-y-2 text-xs border border-gray-800">
                    <div className="flex justify-between text-gray-400">
                      <span>Gross Components Total:</span>
                      <span className="font-mono">₹{selectedInvoice.grossAmount?.toLocaleString()}</span>
                    </div>
                    {selectedInvoice.concessionAmount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Scholarship / Approved Concessions:</span>
                        <span className="font-mono">- ₹{selectedInvoice.concessionAmount?.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedInvoice.lateFeeAmount > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Late Fee Charged:</span>
                        <span className="font-mono">+ ₹{selectedInvoice.lateFeeAmount?.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-bold pt-1 border-t border-gray-800">
                      <span>Net Payable:</span>
                      <span className="font-mono">₹{selectedInvoice.netPayable?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Verified Amount Paid:</span>
                      <span className="font-mono">₹{selectedInvoice.amountPaid?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-gray-800 text-sm">
                      <span>Outstanding Balance:</span>
                      <span className="font-mono">₹{selectedInvoice.outstandingBalance?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: Concession / Scholarship Application */}
          {showConcessionModal && selectedInvoice && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowConcessionModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Apply for Fee Concession / Scholarship
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Invoice <span className="font-mono text-indigo-400">{selectedInvoice.invoiceNumber}</span> | Gross: ₹{selectedInvoice.grossAmount}
                </p>

                <form onSubmit={handleSubmitConcession} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Concession / Adjustment Category *
                    </label>
                    <select
                      value={concessionForm.adjustmentType}
                      onChange={(e) => setConcessionForm({ ...concessionForm, adjustmentType: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="need_based_concession">Need-based Financial Concession</option>
                      <option value="merit_scholarship">Academic Merit Scholarship</option>
                      <option value="government_scholarship">Government / State Welfare Scholarship</option>
                      <option value="institutional_waiver">Institutional / Employee Ward Fee Waiver</option>
                      <option value="other">Other Special Waiver</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Requested Concession Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      max={selectedInvoice.grossAmount}
                      min="1"
                      value={concessionForm.amount}
                      onChange={(e) => setConcessionForm({ ...concessionForm, amount: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[11px] text-gray-500">Cannot exceed invoice gross amount of ₹{selectedInvoice.grossAmount}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Justification & Reason *
                    </label>
                    <textarea
                      rows="3"
                      required
                      placeholder="Explain the background, scholarship award criteria, or financial hardship..."
                      value={concessionForm.reason}
                      onChange={(e) => setConcessionForm({ ...concessionForm, reason: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Supporting Document Reference / Award Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Merit Order #CS-2026/89 or Gov Application ID"
                      value={concessionForm.supportingDocReference}
                      onChange={(e) => setConcessionForm({ ...concessionForm, supportingDocReference: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConcessionModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Concession Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: Printable Official Receipt */}
          {showReceiptModal && selectedReceipt && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative text-gray-100">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Receipt Content for Display / Printing */}
                <div ref={receiptPrintRef} className="p-6 bg-[#0B0F19] rounded-xl border border-gray-800 space-y-5">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white tracking-wide">CampusSphere AI College</h2>
                        <p className="text-xs text-gray-400">Office of the Accounts & Financial Administration</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold rounded uppercase">
                        Payment Receipt
                      </span>
                    </div>
                  </div>

                  {/* Receipt Meta */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500">Receipt Number:</p>
                      <p className="font-mono font-bold text-indigo-400 text-sm">{selectedReceipt.receiptNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Transaction ID:</p>
                      <p className="font-mono text-gray-300">{selectedReceipt.transactionId}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Payment Date:</p>
                      <p className="font-medium text-gray-200">{new Date(selectedReceipt.paymentDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Invoice Number:</p>
                      <p className="font-mono text-gray-200">{selectedReceipt.invoice?.invoiceNumber || '—'}</p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-[#131B2E] p-4 rounded-lg space-y-2 text-xs border border-gray-800">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment Mode:</span>
                      <span className="font-semibold uppercase text-gray-200">{selectedReceipt.paymentMethod}</span>
                    </div>
                    {selectedReceipt.externalReference && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bank Reference (UTR / Cheque):</span>
                        <span className="font-mono text-gray-200">{selectedReceipt.externalReference}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-800 text-emerald-400">
                      <span>Total Amount Paid:</span>
                      <span>₹{(selectedReceipt.amountInPaise / 100).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Verification Signature Block */}
                  <div className="flex justify-between items-end pt-3 text-xs text-gray-500 border-t border-gray-800">
                    <div>
                      <p className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <ShieldCheck className="w-4 h-4" /> System Verified Transaction
                      </p>
                      <p className="text-[11px] mt-0.5">Verified on {selectedReceipt.verifiedAt ? new Date(selectedReceipt.verifiedAt).toLocaleString() : 'System Audit'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-300">Finance Registrar</p>
                      <p className="text-[10px] text-gray-500">CampusSphere ERP</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                  >
                    Close
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

export default StudentFees;

