/**
 * client/src/pages/AdminFinance/index.jsx
 * Administrator Finance & Fee Administration Dashboard.
 * Supports cohort invoicing, offline verification, fee structures, concessions, refunds, and CSV audits.
 */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Navbar from '../../components/Navbar/Navbar';
import { useSidebar } from '../../context/SidebarContext';
import { useToast } from '../../context/ToastContext';
import feeService from '../../services/fee.service';
import {
  CreditCard,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Download,
  PlusCircle,
  X,
  Filter,
  Search,
  Percent,
  IndianRupee,
  ShieldCheck,
  Ban,
  CheckCheck,
  RefreshCw,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import '../../styles/dashboard-shared.css';

const AdminFinance = () => {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('verifications'); // 'verifications' | 'invoices' | 'structures' | 'concessions'

  // Tab 1: Pending Verifications
  const [pendingTxns, setPendingTxns] = useState([]);
  const [rejectModalTxn, setRejectModalTxn] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Tab 2: Invoices
  const [invoices, setInvoices] = useState([]);
  const [invFilter, setInvFilter] = useState({ department: 'all', semester: 'all', status: 'all', search: '' });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genForm, setGenForm] = useState({
    feeStructureId: '',
    department: 'CSE',
    semester: '5',
    section: 'all',
    academicYear: '2026-2027',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  // Tab 3: Fee Structures
  const [structures, setStructures] = useState([]);
  const [showCreateStructModal, setShowCreateStructModal] = useState(false);
  const [structForm, setStructForm] = useState({
    name: '',
    code: '',
    department: 'CSE',
    semester: 5,
    academicYear: '2026-2027',
    program: 'B.Tech',
    components: [{ name: 'Tuition Fee', amount: 45000, isMandatory: true }],
    lateFeePolicy: {
      policyType: 'none',
      graceDays: 7,
      fixedAmount: 500,
      percentageRate: 5,
    },
  });

  // Tab 4: Concessions & Refunds
  const [adjustments, setAdjustments] = useState([]);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({
    invoiceId: '',
    amount: '',
    reason: '',
    supportingDocReference: '',
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Load Admin Metrics & Active Tab Data
  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);
      const metricsRes = await feeService.getAdminMetrics();
      if (metricsRes.success) {
        setMetrics(metricsRes.data);
      }

      // Load specific tab data
      if (activeTab === 'verifications') {
        const txRes = await feeService.getTransactions({ status: 'pending' });
        if (txRes.success) setPendingTxns(txRes.data || []);
      } else if (activeTab === 'invoices') {
        const invRes = await feeService.getInvoices(invFilter);
        if (invRes.success) setInvoices(invRes.data || []);
      } else if (activeTab === 'structures') {
        const strRes = await feeService.getFeeStructures();
        if (strRes.success) setStructures(strRes.data || []);
      } else if (activeTab === 'concessions') {
        const adjRes = await feeService.getAdjustments();
        if (adjRes.success) setAdjustments(adjRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load finance data', err);
      showToast(err.response?.data?.message || 'Error loading financial records', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, invFilter, showToast]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Load structures for generation dropdown if modal opens
  useEffect(() => {
    if (showGenerateModal && structures.length === 0) {
      feeService.getFeeStructures({ status: 'active' }).then((res) => {
        if (res.success) setStructures(res.data);
      });
    }
  }, [showGenerateModal, structures.length]);

  // Handle Verify Payment
  const handleVerifyPayment = async (txn) => {
    try {
      setActionLoading(true);
      const res = await feeService.verifyPaymentTransaction(txn._id, { action: 'verify' });
      if (res.success) {
        showToast(`Transaction ${txn.transactionId} verified successfully!`, 'success');
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Payment
  const handleRejectPayment = async () => {
    if (!rejectModalTxn) return;
    try {
      setActionLoading(true);
      const res = await feeService.verifyPaymentTransaction(rejectModalTxn._id, {
        action: 'reject',
        rejectionReason: rejectionReason.trim(),
      });
      if (res.success) {
        showToast(`Transaction ${rejectModalTxn.transactionId} marked as rejected`, 'success');
        setRejectModalTxn(null);
        setRejectionReason('');
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Rejection failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cohort Invoice Generation
  const handleGenerateCohortInvoices = async (e) => {
    e.preventDefault();
    if (!genForm.feeStructureId) {
      showToast('Please select a fee structure template', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await feeService.generateCohortInvoices(genForm);
      if (res.success) {
        showToast(res.message || 'Cohort invoices issued successfully', 'success');
        setShowGenerateModal(false);
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to issue cohort invoices', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Fee Structure
  const handleCreateStructure = async (e) => {
    e.preventDefault();
    if (!structForm.name || !structForm.code) {
      showToast('Structure name and code are required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await feeService.createFeeStructure(structForm);
      if (res.success) {
        showToast('Fee structure created successfully', 'success');
        setShowCreateStructModal(false);
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create fee structure', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Component Row in Structure Form
  const handleAddComponent = () => {
    setStructForm({
      ...structForm,
      components: [...structForm.components, { name: '', amount: 1000, isMandatory: true }],
    });
  };

  const handleRemoveComponent = (idx) => {
    setStructForm({
      ...structForm,
      components: structForm.components.filter((_, i) => i !== idx),
    });
  };

  // Handle Concession Approval
  const handleApproveConcession = async (adj) => {
    try {
      setActionLoading(true);
      const res = await feeService.approveConcession(adj._id);
      if (res.success) {
        showToast('Concession approved and invoice balance reduced', 'success');
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Approval failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Concession Rejection
  const handleRejectConcession = async (adj) => {
    const reason = window.prompt('Enter reason for concession rejection:');
    if (reason === null) return;

    try {
      setActionLoading(true);
      const res = await feeService.rejectConcession(adj._id, { rejectionReason: reason });
      if (res.success) {
        showToast('Concession application rejected', 'success');
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Rejection failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Refund Submission
  const handleRecordRefund = async (e) => {
    e.preventDefault();
    if (!refundForm.invoiceId || !refundForm.amount) {
      showToast('Invoice ID and refund amount are required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const res = await feeService.recordRefund(refundForm);
      if (res.success) {
        showToast('Refund processed successfully', 'success');
        setShowRefundModal(false);
        loadFinanceData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Refund failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      showToast('Generating financial audit CSV report...', 'info');
      const blob = await feeService.exportCsvReport(invFilter);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CampusSphere_Fee_Report_${Date.now()}.csv`);
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
                Financial Administration & Fee Management
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Academic cohort billing, offline transaction verification, fee structures, and audit ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-gray-400" /> Export CSV Report
              </button>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <PlusCircle className="w-4 h-4" /> Issue Cohort Invoices
              </button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Net Receivables</p>
                    <p className="text-2xl font-bold text-white mt-1">₹{metrics.overview.totalNetPayableInRupees.toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex justify-between">
                  <span>Gross: ₹{metrics.overview.totalGrossInRupees.toLocaleString()}</span>
                  <span className="text-emerald-400">Waivers: ₹{metrics.overview.totalConcessionsInRupees.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Collected</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">₹{metrics.overview.totalPaidInRupees.toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Collection Rate: <b>{metrics.overview.collectionRatePercent}%</b></span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Outstanding</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">₹{metrics.overview.totalOutstandingInRupees.toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                  <span>Across {metrics.overview.totalInvoicesCount} student invoices</span>
                </div>
              </div>

              <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Offline Verifications</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.pendingApprovals.count}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-amber-300 mt-2">
                  <span>Totaling ₹{metrics.pendingApprovals.totalAmountInRupees.toLocaleString()} pending check</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('verifications')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'verifications'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" /> Pending Verifications ({metrics?.pendingApprovals?.count || 0})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'invoices'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Invoices
            </button>
            <button
              onClick={() => setActiveTab('structures')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'structures'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Fee Structures
            </button>
            <button
              onClick={() => setActiveTab('concessions')}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'concessions'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Concessions & Waivers
            </button>
          </div>

          {/* TAB 1: Pending Verifications Action Table */}
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                  Offline Payments Awaiting Financial Verification
                </h3>
                <button
                  onClick={loadFinanceData}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {pendingTxns.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <CheckCheck className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <p className="text-base font-semibold text-gray-200">All offline payments verified</p>
                  <p className="text-sm text-gray-500 mt-1">There are no pending student payments awaiting bank statement reconciliation.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Invoice #</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Mode</th>
                          <th className="px-4 py-3">Bank Reference (UTR / Cheque)</th>
                          <th className="px-4 py-3">Payment Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {pendingTxns.map((tx) => (
                          <tr key={tx._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{tx.student?.user?.name || 'Student'}</p>
                              <p className="text-gray-400 text-[11px] font-mono">{tx.student?.rollNumber || tx.student?.user?.loginId}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-indigo-400">
                              {tx.invoice?.invoiceNumber || '—'}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                              ₹{(tx.amountInPaise / 100).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 uppercase font-medium text-gray-200">
                              {tx.paymentMethod}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-amber-300">
                              {tx.externalReference || 'Not provided'}
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {new Date(tx.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                disabled={actionLoading}
                                onClick={() => handleVerifyPayment(tx)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                              >
                                Verify & Credit
                              </button>
                              <button
                                disabled={actionLoading}
                                onClick={() => setRejectModalTxn(tx)}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition"
                              >
                                Reject
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

          {/* TAB 2: Invoices Management */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#131B2E] border border-gray-800 p-3.5 rounded-xl text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Department</label>
                  <select
                    value={invFilter.department}
                    onChange={(e) => setInvFilter({ ...invFilter, department: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-200"
                  >
                    <option value="all">All Departments</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Semester</label>
                  <select
                    value={invFilter.semester}
                    onChange={(e) => setInvFilter({ ...invFilter, semester: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-200"
                  >
                    <option value="all">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Status</label>
                  <select
                    value={invFilter.status}
                    onChange={(e) => setInvFilter({ ...invFilter, status: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-200"
                  >
                    <option value="all">All Statuses</option>
                    <option value="issued">Issued / Unpaid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Fully Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Search Invoice #</label>
                  <input
                    type="text"
                    value={invFilter.search}
                    onChange={(e) => setInvFilter({ ...invFilter, search: e.target.value })}
                    placeholder="Search by invoice number..."
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-200"
                  />
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No invoices found</p>
                  <p className="text-sm text-gray-500 mt-1">Generate invoices for an academic cohort or adjust your filters.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Invoice #</th>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Dept / Sem</th>
                          <th className="px-4 py-3">Net Payable</th>
                          <th className="px-4 py-3">Paid</th>
                          <th className="px-4 py-3">Outstanding</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Due Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {invoices.map((inv) => (
                          <tr key={inv._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                              {inv.invoiceNumber}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{inv.student?.user?.name || 'Student'}</p>
                              <p className="text-gray-400 text-[11px] font-mono">{inv.student?.rollNumber}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {inv.department} - Sem {inv.semester}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-200">
                              ₹{inv.netPayable?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-semibold text-emerald-400">
                              ₹{inv.amountPaid?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-rose-400">
                              ₹{inv.outstandingBalance?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {new Date(inv.dueDate).toLocaleDateString()}
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

          {/* TAB 3: Fee Structures Templates */}
          {activeTab === 'structures' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                  Academic Fee Structure Templates
                </h3>
                <button
                  onClick={() => setShowCreateStructModal(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> New Structure Template
                </button>
              </div>

              {structures.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <Layers className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No fee structures configured</p>
                  <p className="text-sm text-gray-500 mt-1">Create your first fee structure to start issuing invoices.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {structures.map((st) => (
                    <div key={st._id} className="bg-[#131B2E] border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-mono font-bold text-indigo-400">{st.code}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${st.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-400'}`}>
                            {st.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{st.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{st.department} • Semester {st.semester} • {st.academicYear}</p>

                        <div className="mt-4 border-t border-gray-800/80 pt-3 space-y-1.5 text-xs text-gray-300">
                          {st.components?.map((c, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-gray-400">{c.name}:</span>
                              <span className="font-mono">₹{(c.amountInPaise / 100).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold text-white pt-1 border-t border-gray-800">
                            <span>Total Gross:</span>
                            <span className="font-mono text-indigo-400">₹{st.totalAmount?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-400 flex justify-between items-center">
                        <span>Late Fee: {st.lateFeePolicy?.policyType || 'None'}</span>
                        {st.status === 'active' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Archive fee structure ${st.name}?`)) {
                                await feeService.archiveFeeStructure(st._id);
                                loadFinanceData();
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Concessions & Refunds */}
          {activeTab === 'concessions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                  Concessions, Scholarships, Waivers & Refunds
                </h3>
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Percent className="w-3.5 h-3.5" /> Process Formal Refund
                </button>
              </div>

              {adjustments.length === 0 ? (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                  <ShieldCheck className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-base font-semibold text-gray-200">No fee adjustments</p>
                  <p className="text-sm text-gray-500 mt-1">Concession and scholarship applications will appear here for review.</p>
                </div>
              ) : (
                <div className="bg-[#131B2E] border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#0B0F19] uppercase font-semibold text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3">Adjustment #</th>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Reason / Reference</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {adjustments.map((adj) => (
                          <tr key={adj._id} className="hover:bg-gray-800/30 transition">
                            <td className="px-4 py-3 font-mono text-indigo-400 font-semibold">
                              {adj.adjustmentNumber}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{adj.student?.user?.name || 'Student'}</p>
                              <p className="text-gray-400 text-[11px] font-mono">{adj.student?.rollNumber}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-200 uppercase">
                              {adj.adjustmentType?.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                              ₹{(adj.amountInPaise / 100).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                              <p>{adj.reason}</p>
                              {adj.supportingDocReference && (
                                <p className="text-[10px] text-gray-500">Ref: {adj.supportingDocReference}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                                adj.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : adj.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {adj.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {adj.status === 'pending' && (
                                <div className="space-x-2">
                                  <button
                                    onClick={() => handleApproveConcession(adj)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectConcession(adj)}
                                    className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded text-xs font-semibold"
                                  >
                                    Reject
                                  </button>
                                </div>
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

          {/* MODAL: Reject Payment Modal */}
          {rejectModalTxn && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Reject Payment Verification
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Rejecting transaction <span className="font-mono text-indigo-400">{rejectModalTxn.transactionId}</span> of ₹{rejectModalTxn.amountInPaise / 100}.
                </p>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Rejection Reason *
                  </label>
                  <textarea
                    rows="3"
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. UTR not found on bank statement, payment reversed, incorrect amount..."
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => {
                      setRejectModalTxn(null);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectPayment}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: Generate Cohort Invoices */}
          {showGenerateModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" />
                  Generate Cohort Fee Invoices
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Batch generates individual student invoices based on a configured fee structure template. Existing invoices for the term are skipped.
                </p>

                <form onSubmit={handleGenerateCohortInvoices} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Fee Structure Template *
                    </label>
                    <select
                      required
                      value={genForm.feeStructureId}
                      onChange={(e) => setGenForm({ ...genForm, feeStructureId: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Select a structure template...</option>
                      {structures.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.code}) - {s.department} Sem {s.semester} (₹{s.totalAmount})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Department</label>
                      <select
                        value={genForm.department}
                        onChange={(e) => setGenForm({ ...genForm, department: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="MECH">MECH</option>
                        <option value="CIVIL">CIVIL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Semester</label>
                      <select
                        value={genForm.semester}
                        onChange={(e) => setGenForm({ ...genForm, semester: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Academic Year</label>
                      <input
                        type="text"
                        value={genForm.academicYear}
                        onChange={(e) => setGenForm({ ...genForm, academicYear: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Payment Due Date *</label>
                      <input
                        type="date"
                        required
                        value={genForm.dueDate}
                        onChange={(e) => setGenForm({ ...genForm, dueDate: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      {actionLoading ? 'Issuing Invoices...' : 'Confirm & Issue Invoices'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: Create Fee Structure */}
          {showCreateStructModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowCreateStructModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Create Academic Fee Structure Template
                </h3>

                <form onSubmit={handleCreateStructure} className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Structure Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.Tech CSE Sem 5 Fee 2026"
                        value={structForm.name}
                        onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Structure Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BTECH-CSE-S5-2026"
                        value={structForm.code}
                        onChange={(e) => setStructForm({ ...structForm, code: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Department</label>
                      <select
                        value={structForm.department}
                        onChange={(e) => setStructForm({ ...structForm, department: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="MECH">MECH</option>
                        <option value="CIVIL">CIVIL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Semester</label>
                      <select
                        value={structForm.semester}
                        onChange={(e) => setStructForm({ ...structForm, semester: Number(e.target.value) })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">Year</label>
                      <input
                        type="text"
                        value={structForm.academicYear}
                        onChange={(e) => setStructForm({ ...structForm, academicYear: e.target.value })}
                        className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Components Builder */}
                  <div className="border border-gray-800 rounded-xl p-3.5 space-y-2 bg-[#0B0F19]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-300 uppercase">Fee Components</span>
                      <button
                        type="button"
                        onClick={handleAddComponent}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                      >
                        + Add Component
                      </button>
                    </div>

                    {structForm.components.map((comp, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          placeholder="Component Name (e.g. Tuition)"
                          value={comp.name}
                          onChange={(e) => {
                            const newComps = [...structForm.components];
                            newComps[idx].name = e.target.value;
                            setStructForm({ ...structForm, components: newComps });
                          }}
                          className="flex-1 bg-[#131B2E] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="Amount (₹)"
                          value={comp.amount}
                          onChange={(e) => {
                            const newComps = [...structForm.components];
                            newComps[idx].amount = Number(e.target.value);
                            setStructForm({ ...structForm, components: newComps });
                          }}
                          className="w-28 bg-[#131B2E] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                        {structForm.components.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateStructModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      Create Structure
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: Record Refund */}
          {showRefundModal && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#131B2E] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Percent className="w-5 h-5 text-rose-400" />
                  Process Student Fee Refund
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Refunds are recorded as an approved negative ledger adjustment. Cannot exceed total verified payments.
                </p>

                <form onSubmit={handleRecordRefund} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Fee Invoice ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Invoice ID (e.g. from invoices table)"
                      value={refundForm.invoiceId}
                      onChange={(e) => setRefundForm({ ...refundForm, invoiceId: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Refund Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      placeholder="Refund Amount"
                      value={refundForm.amount}
                      onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Reason for Refund *
                    </label>
                    <textarea
                      rows="2"
                      required
                      placeholder="e.g. Overpayment adjustment, course cancellation, excess deposit refund..."
                      value={refundForm.reason}
                      onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white"
                    ></textarea>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRefundModal(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      Process Refund
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

export default AdminFinance;

