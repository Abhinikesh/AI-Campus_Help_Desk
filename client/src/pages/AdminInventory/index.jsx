/**
 * client/src/pages/AdminInventory/index.jsx
 * Comprehensive Admin & Inventory Manager Desk for Assets, Stock, Procurement & Maintenance.
 */
import React, { useState, useEffect } from 'react';
import {
  Package,
  Boxes,
  ShoppingCart,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  Search,
  Plus,
  Download,
  Building,
  CheckCircle2,
  XCircle,
  Truck,
  RotateCcw,
  Send,
  Eye,
  FileText,
  DollarSign,
  Tag,
  ArrowRightLeft,
  X
} from 'lucide-react';
import inventoryService from '../../services/inventory.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const AdminInventory = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    inStoreAssets: 0,
    inUseAssets: 0,
    underMaintenanceAssets: 0,
    totalStockItems: 0,
    lowStockAlerts: 0,
    pendingPurchaseRequests: 0,
    activePurchaseOrders: 0,
    pendingMaintenance: 0,
    completedMaintenanceExpenditurePaise: 0,
    totalAssetBookValuePaise: 0
  });

  // Collections
  const [assets, setAssets] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [audits, setAudits] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showPrModal, setShowPrModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showAssetDetailModal, setShowAssetDetailModal] = useState(false);

  // Selected item states
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);

  // Form states
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: '',
    serialNumber: '',
    modelNumber: '',
    manufacturer: '',
    acquisitionCostRupees: '',
    salvageValueRupees: '',
    usefulLifeMonths: 60,
    purchaseDate: new Date().toISOString().slice(0, 10),
    warrantyExpiry: '',
    location: '',
    notes: ''
  });

  const [stockForm, setStockForm] = useState({
    sku: '',
    name: '',
    category: '',
    unitOfMeasure: 'pcs',
    initialQuantity: 0,
    reorderThreshold: 10,
    reorderQuantity: 50,
    unitCostRupees: '',
    defaultLocation: '',
    preferredVendor: ''
  });

  const [allocateForm, setAllocateForm] = useState({
    allocatedTo: '',
    expectedReturnDate: '',
    department: '',
    location: '',
    purpose: ''
  });

  const [returnForm, setReturnForm] = useState({
    returnCondition: 'good',
    returnLocation: '',
    notes: ''
  });

  const [transferForm, setTransferForm] = useState({
    toLocation: '',
    reason: ''
  });

  const [issueForm, setIssueForm] = useState({
    quantity: 1,
    notes: '',
    recipientUser: ''
  });

  const [adjustForm, setAdjustForm] = useState({
    countedQuantity: 0,
    reason: ''
  });

  const [prForm, setPrForm] = useState({
    title: '',
    priority: 'medium',
    justification: '',
    itemName: '',
    itemType: 'consumable',
    category: '',
    quantity: 1,
    estimatedUnitCostRupees: ''
  });

  const [poForm, setPoForm] = useState({
    vendor: '',
    purchaseRequest: '',
    itemName: '',
    itemType: 'consumable',
    category: '',
    quantity: 1,
    unitPriceRupees: '',
    taxPercent: 18,
    expectedDeliveryDate: ''
  });

  const [grnForm, setGrnForm] = useState({
    purchaseOrder: '',
    destinationLocation: '',
    invoiceNumber: '',
    deliveryChallanNumber: '',
    acceptedQuantity: 1,
    rejectedQuantity: 0,
    rejectionReason: '',
    serialNumbers: ''
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    asset: '',
    type: 'corrective',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: new Date().toISOString().slice(0, 10),
    serviceProvider: 'in_house',
    technicianName: ''
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    vendorCode: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstNumber: '',
    paymentTerms: 'Net 30'
  });

  const [auditForm, setAuditForm] = useState({
    title: '',
    auditType: 'departmental',
    location: '',
    category: '',
    plannedDate: new Date().toISOString().slice(0, 10)
  });

  // Load Initial Data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [
        metricsRes,
        categoriesRes,
        locationsRes,
        vendorsRes,
        assetsRes,
        stockRes,
        prRes,
        poRes,
        maintRes,
        auditRes,
        lowStockRes
      ] = await Promise.all([
        inventoryService.getMetrics().catch(() => ({ data: {} })),
        inventoryService.getCategories().catch(() => ({ data: [] })),
        inventoryService.getLocations().catch(() => ({ data: [] })),
        inventoryService.getVendors().catch(() => ({ data: [] })),
        inventoryService.getAssets().catch(() => ({ data: [] })),
        inventoryService.getStockItems().catch(() => ({ data: [] })),
        inventoryService.getPurchaseRequests().catch(() => ({ data: [] })),
        inventoryService.getPurchaseOrders().catch(() => ({ data: [] })),
        inventoryService.getMaintenanceRecords().catch(() => ({ data: [] })),
        inventoryService.getAudits().catch(() => ({ data: [] })),
        inventoryService.getLowStockAlerts().catch(() => ({ data: [] }))
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
      if (vendorsRes.data) setVendors(vendorsRes.data);
      if (assetsRes.data) setAssets(assetsRes.data);
      if (stockRes.data) setStockItems(stockRes.data);
      if (prRes.data) setPurchaseRequests(prRes.data);
      if (poRes.data) setPurchaseOrders(poRes.data);
      if (maintRes.data) setMaintenanceRecords(maintRes.data);
      if (auditRes.data) setAudits(auditRes.data);
      if (lowStockRes.data) setLowStockAlerts(lowStockRes.data);
    } catch (err) {
      showToast('Error loading inventory data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Quick reload for active tab
  const refreshTabData = async () => {
    try {
      if (activeTab === 'assets') {
        const res = await inventoryService.getAssets({ search: searchQuery, category: categoryFilter, status: statusFilter });
        setAssets(res.data);
      } else if (activeTab === 'stock') {
        const res = await inventoryService.getStockItems({ search: searchQuery, category: categoryFilter });
        setStockItems(res.data);
      } else if (activeTab === 'procurement') {
        const [pr, po, grn] = await Promise.all([
          inventoryService.getPurchaseRequests(),
          inventoryService.getPurchaseOrders(),
          inventoryService.getGoodsReceipts()
        ]);
        setPurchaseRequests(pr.data);
        setPurchaseOrders(po.data);
        setGoodsReceipts(grn.data);
      } else if (activeTab === 'vendors') {
        const res = await inventoryService.getVendors({ search: searchQuery });
        setVendors(res.data);
      } else if (activeTab === 'maintenance') {
        const res = await inventoryService.getMaintenanceRecords();
        setMaintenanceRecords(res.data);
      } else if (activeTab === 'audits') {
        const res = await inventoryService.getAudits();
        setAudits(res.data);
      } else if (activeTab === 'low_stock') {
        const res = await inventoryService.getLowStockAlerts();
        setLowStockAlerts(res.data);
      }
      const m = await inventoryService.getMetrics();
      if (m.data) setMetrics(m.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: assetForm.name,
        category: assetForm.category,
        serialNumber: assetForm.serialNumber,
        modelNumber: assetForm.modelNumber,
        manufacturer: assetForm.manufacturer,
        acquisitionCost: Math.round(parseFloat(assetForm.acquisitionCostRupees || 0) * 100),
        salvageValuePaise: Math.round(parseFloat(assetForm.salvageValueRupees || 0) * 100),
        usefulLifeMonths: parseInt(assetForm.usefulLifeMonths, 10),
        purchaseDate: assetForm.purchaseDate,
        warrantyExpiry: assetForm.warrantyExpiry || undefined,
        location: assetForm.location || undefined,
        notes: assetForm.notes
      };

      await inventoryService.createAsset(payload);
      showToast('Asset registered successfully', 'success');
      setShowAssetModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAllocateAsset = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.allocateAsset(selectedAsset._id, allocateForm);
      showToast('Asset allocated successfully', 'success');
      setShowAllocateModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleReturnAsset = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.returnAsset(selectedAsset._id, returnForm);
      showToast('Asset returned to central store', 'success');
      setShowReturnModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleTransferAsset = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.transferAsset(selectedAsset._id, transferForm);
      showToast('Asset transfer logged successfully', 'success');
      setShowTransferModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateStockItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        sku: stockForm.sku,
        name: stockForm.name,
        category: stockForm.category,
        unitOfMeasure: stockForm.unitOfMeasure,
        initialQuantity: parseFloat(stockForm.initialQuantity || 0),
        reorderThreshold: parseInt(stockForm.reorderThreshold, 10),
        reorderQuantity: parseInt(stockForm.reorderQuantity, 10),
        unitCostPaise: Math.round(parseFloat(stockForm.unitCostRupees || 0) * 100),
        defaultLocation: stockForm.defaultLocation || undefined,
        preferredVendor: stockForm.preferredVendor || undefined
      };

      await inventoryService.createStockItem(payload);
      showToast('Stock item registered successfully', 'success');
      setShowStockModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleIssueStock = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.issueStock(selectedStockItem._id, issueForm);
      showToast('Stock issued successfully', 'success');
      setShowIssueModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.adjustStock(selectedStockItem._id, adjustForm);
      showToast('Stock balance adjusted successfully', 'success');
      setShowAdjustModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreatePr = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: prForm.title,
        priority: prForm.priority,
        justification: prForm.justification,
        items: [
          {
            itemType: prForm.itemType,
            itemName: prForm.itemName,
            category: prForm.category,
            quantity: parseInt(prForm.quantity, 10),
            estimatedUnitCostPaise: Math.round(parseFloat(prForm.estimatedUnitCostRupees || 0) * 100)
          }
        ]
      };

      await inventoryService.createPurchaseRequest(payload);
      showToast('Purchase request created successfully', 'success');
      setShowPrModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleApprovePr = async (prId) => {
    try {
      await inventoryService.approvePurchaseRequest(prId, { comments: 'Approved by desk officer' });
      showToast('Stage approval recorded', 'success');
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        vendor: poForm.vendor,
        purchaseRequest: poForm.purchaseRequest || undefined,
        items: [
          {
            itemType: poForm.itemType,
            itemName: poForm.itemName,
            category: poForm.category,
            quantity: parseInt(poForm.quantity, 10),
            unitPricePaise: Math.round(parseFloat(poForm.unitPriceRupees || 0) * 100),
            taxPercent: parseFloat(poForm.taxPercent || 0)
          }
        ],
        expectedDeliveryDate: poForm.expectedDeliveryDate || undefined
      };

      await inventoryService.createPurchaseOrder(payload);
      showToast('Purchase Order issued successfully', 'success');
      setShowPoModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    try {
      const po = purchaseOrders.find((p) => p._id === grnForm.purchaseOrder);
      if (!po || !po.items || po.items.length === 0) {
        throw new Error('Selected PO has no valid items');
      }
      const targetItem = po.items[0];

      const serials = grnForm.serialNumbers
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        purchaseOrder: grnForm.purchaseOrder,
        destinationLocation: grnForm.destinationLocation,
        invoiceNumber: grnForm.invoiceNumber,
        deliveryChallanNumber: grnForm.deliveryChallanNumber,
        items: [
          {
            poItemId: targetItem._id,
            itemType: targetItem.itemType,
            itemName: targetItem.itemName,
            category: targetItem.category?._id || targetItem.category,
            stockItem: targetItem.stockItem || undefined,
            orderedQuantity: targetItem.quantity,
            receivedQuantity: parseInt(grnForm.acceptedQuantity, 10) + parseInt(grnForm.rejectedQuantity || 0, 10),
            acceptedQuantity: parseInt(grnForm.acceptedQuantity, 10),
            rejectedQuantity: parseInt(grnForm.rejectedQuantity || 0, 10),
            rejectionReason: grnForm.rejectionReason,
            unitCostPaise: targetItem.unitPricePaise,
            serialNumbers: serials
          }
        ]
      };

      await inventoryService.createGoodsReceipt(payload);
      showToast('GRN processed. Assets and stock balances generated automatically.', 'success');
      setShowGrnModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.createMaintenanceRecord(maintenanceForm);
      showToast('Maintenance task scheduled successfully', 'success');
      setShowMaintenanceModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCompleteMaintenance = async (maintId) => {
    try {
      const costInRupees = prompt('Enter repair cost in INR (e.g. 500):', '0');
      if (costInRupees === null) return;
      const costPaise = Math.round(parseFloat(costInRupees || 0) * 100);

      await inventoryService.updateMaintenanceStatus(maintId, {
        status: 'completed',
        costPaise,
        restoredCondition: 'good',
        resolutionNotes: 'Completed maintenance and certified healthy by technician'
      });
      showToast('Maintenance marked completed', 'success');
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.createVendor(vendorForm);
      showToast('Vendor registered successfully', 'success');
      setShowVendorModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.createAudit(auditForm);
      showToast('Stocktaking audit initiated', 'success');
      setShowAuditModal(false);
      refreshTabData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleViewMovements = async (item) => {
    setSelectedStockItem(item);
    try {
      const res = await inventoryService.getStockMovements({ stockItemId: item._id });
      setStockMovements(res.data);
      setShowMovementsModal(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleViewAssetDetails = async (asset) => {
    try {
      const res = await inventoryService.getAssetById(asset._id);
      setSelectedAsset(res.data);
      setShowAssetDetailModal(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Boxes className="h-7 w-7 text-indigo-400" />
                Asset, Inventory & Procurement Management
              </h1>
              <p className="text-sm text-slate-400">
                Centralized institutional asset register, consumable stock ledger, multi-tier procurement and maintenance.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={inventoryService.exportAssetsCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
                title="Download Sanitized Assets CSV"
              >
                <Download className="h-4 w-4 text-emerald-400" />
                Export Assets CSV
              </button>
              <button
                onClick={inventoryService.exportStockCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
                title="Download Sanitized Stock CSV"
              >
                <Download className="h-4 w-4 text-amber-400" />
                Export Stock CSV
              </button>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Total Assets
                <Package className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">{metrics.totalAssets}</div>
              <div className="text-xs text-slate-400 mt-1">
                Store: {metrics.inStoreAssets} | In Use: {metrics.inUseAssets}
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Asset Valuation
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                ₹{((metrics.totalAssetBookValuePaise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Acquisition Base</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Consumables
                <Boxes className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">{metrics.totalStockItems}</div>
              <div className="text-xs text-slate-400 mt-1">Cataloged SKUs</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Low Stock Alerts
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.lowStockAlerts}</div>
              <div className="text-xs text-slate-400 mt-1">Needs Reordering</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Procurement
                <ShoppingCart className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">{metrics.pendingPurchaseRequests}</div>
              <div className="text-xs text-slate-400 mt-1">Active POs: {metrics.activePurchaseOrders}</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Maintenance
                <Wrench className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-1">{metrics.pendingMaintenance}</div>
              <div className="text-xs text-slate-400 mt-1">
                Exp: ₹{((metrics.completedMaintenanceExpenditurePaise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 space-x-1 overflow-x-auto pb-1">
            {[
              { id: 'assets', label: 'Asset Register', icon: Package },
              { id: 'stock', label: 'Consumables Stock', icon: Boxes },
              { id: 'procurement', label: 'Procurement & Orders', icon: ShoppingCart },
              { id: 'vendors', label: 'Vendors', icon: Truck },
              { id: 'maintenance', label: 'Maintenance & Service', icon: Wrench },
              { id: 'audits', label: 'Physical Audits', icon: ClipboardCheck },
              { id: 'low_stock', label: 'Low-Stock Alerts', icon: AlertTriangle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'low_stock' && metrics.lowStockAlerts > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full font-bold">
                      {metrics.lowStockAlerts}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: ASSET REGISTER */}
          {activeTab === 'assets' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search ID, serial, name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">All Categories</option>
                    {categories.filter(c => c.classification === 'asset').map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={refreshTabData}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700"
                  >
                    Filter
                  </button>
                </div>
                <button
                  onClick={() => setShowAssetModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  Register Asset
                </button>
              </div>

              {/* Assets Table */}
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">Asset ID / Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Serial / Model</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Condition</th>
                      <th className="px-4 py-3">Location / Custodian</th>
                      <th className="px-4 py-3">Cost (₹)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                          No assets found. Click "Register Asset" or receive a Purchase Order.
                        </td>
                      </tr>
                    ) : (
                      assets.map((asset) => (
                        <tr key={asset._id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{asset.name}</div>
                            <div className="text-xs text-indigo-400 font-mono">{asset.assetId}</div>
                          </td>
                          <td className="px-4 py-3">{asset.category?.name || 'General'}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-mono">{asset.serialNumber || 'N/A'}</div>
                            <div className="text-xs text-slate-400">{asset.modelNumber || ''}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                asset.status === 'in_store'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : asset.status === 'in_use'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : asset.status === 'under_maintenance'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {asset.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize">{asset.condition}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs">{asset.location ? `${asset.location.building} - ${asset.location.name}` : 'Central Store'}</div>
                            <div className="text-xs text-indigo-300">{asset.currentCustodian?.name || 'Unallocated'}</div>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            ₹{((asset.acquisitionCost || 0) / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button
                              onClick={() => handleViewAssetDetails(asset)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded text-slate-200"
                              title="View Details & Depreciation"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {asset.status === 'in_store' && (
                              <button
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowAllocateModal(true);
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs rounded text-white"
                                title="Allocate to Custodian"
                              >
                                Allocate
                              </button>
                            )}
                            {asset.status === 'in_use' && (
                              <button
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowReturnModal(true);
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white"
                                title="Return to Store"
                              >
                                Return
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowTransferModal(true);
                              }}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded text-slate-200"
                              title="Transfer Location"
                            >
                              Transfer
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CONSUMABLES STOCK */}
          {activeTab === 'stock' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search SKU, consumable name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-400"
                    />
                  </div>
                  <button
                    onClick={refreshTabData}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700"
                  >
                    Search
                  </button>
                </div>
                <button
                  onClick={() => setShowStockModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  Add Stock Item (SKU)
                </button>
              </div>

              {/* Stock Items Table */}
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">SKU / Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Current Balance</th>
                      <th className="px-4 py-3">Reorder Threshold</th>
                      <th className="px-4 py-3">Unit Cost (₹)</th>
                      <th className="px-4 py-3">Total Value (₹)</th>
                      <th className="px-4 py-3">Storage Location</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {stockItems.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                          No consumable stock items cataloged.
                        </td>
                      </tr>
                    ) : (
                      stockItems.map((item) => {
                        const isLow = item.currentQuantity <= item.reorderThreshold;
                        const totalVal = ((item.currentQuantity * item.unitCostPaise) / 100).toFixed(2);
                        return (
                          <tr key={item._id} className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white">{item.name}</div>
                              <div className="text-xs text-blue-400 font-mono">{item.sku}</div>
                            </td>
                            <td className="px-4 py-3">{item.category?.name || 'General'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-bold font-mono ${
                                  isLow ? 'text-amber-400 underline decoration-amber-500' : 'text-emerald-400'
                                }`}
                              >
                                {item.currentQuantity} {item.unitOfMeasure}
                              </span>
                              {isLow && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded font-semibold">
                                  LOW
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">
                              {item.reorderThreshold} {item.unitOfMeasure}
                            </td>
                            <td className="px-4 py-3 font-mono">
                              ₹{((item.unitCostPaise || 0) / 100).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-200">
                              ₹{parseFloat(totalVal).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {item.defaultLocation ? `${item.defaultLocation.building} - ${item.defaultLocation.name}` : 'Main Store'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1">
                              <button
                                onClick={() => handleViewMovements(item)}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded text-slate-200"
                                title="Ledger History"
                              >
                                Ledger
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStockItem(item);
                                  setShowIssueModal(true);
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs rounded text-white"
                                title="Issue Stock"
                              >
                                Issue
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStockItem(item);
                                  setShowAdjustModal(true);
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white"
                                title="Manual Adjustment"
                              >
                                Adjust
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PROCUREMENT & ORDERS */}
          {activeTab === 'procurement' && (
            <div className="space-y-6">
              {/* Purchase Requests */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    Purchase Requisitions (PR)
                  </h3>
                  <button
                    onClick={() => setShowPrModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Request
                  </button>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">PR Number / Title</th>
                        <th className="px-4 py-3">Requested By</th>
                        <th className="px-4 py-3">Items / Est. Total</th>
                        <th className="px-4 py-3">Approval Stage</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {purchaseRequests.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                            No purchase requests active.
                          </td>
                        </tr>
                      ) : (
                        purchaseRequests.map((pr) => {
                          const isOwn = pr.requestedBy?._id === user?._id;
                          return (
                            <tr key={pr._id} className="hover:bg-slate-800/40 transition">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{pr.title}</div>
                                <div className="text-xs text-indigo-400 font-mono">{pr.requestNumber}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs text-slate-200">{pr.requestedBy?.name || 'User'}</div>
                                <div className="text-xs text-slate-400">{pr.department?.name || 'Department'}</div>
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <div>{pr.items?.length || 1} items</div>
                                <div className="text-emerald-400 font-semibold">
                                  ₹{((pr.estimatedTotalPaise || 0) / 100).toLocaleString('en-IN')}
                                </div>
                              </td>
                              <td className="px-4 py-3 capitalize text-xs">
                                {pr.status.replace('pending_', '').replace('_', ' ')}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    pr.status === 'approved'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : pr.status === 'rejected'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : pr.status === 'po_created'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {pr.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-1">
                                {pr.status.startsWith('pending') && (
                                  <button
                                    disabled={isOwn}
                                    onClick={() => handleApprovePr(pr._id)}
                                    className={`px-2 py-1 text-xs rounded text-white ${
                                      isOwn
                                        ? 'bg-slate-700 cursor-not-allowed opacity-50'
                                        : 'bg-emerald-600 hover:bg-emerald-500'
                                    }`}
                                    title={isOwn ? 'Separation of Duties: Cannot approve own request' : 'Approve Stage'}
                                  >
                                    Approve
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Orders */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-cyan-400" />
                    Purchase Orders (PO)
                  </h3>
                  <button
                    onClick={() => setShowPoModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Issue PO
                  </button>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Total Amount (₹)</th>
                        <th className="px-4 py-3">Delivery Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {purchaseOrders.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                            No purchase orders issued yet.
                          </td>
                        </tr>
                      ) : (
                        purchaseOrders.map((po) => (
                          <tr key={po._id} className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 font-mono font-semibold text-cyan-400">{po.poNumber}</td>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{po.vendor?.name || 'Vendor'}</div>
                              <div className="text-xs text-slate-400">{po.vendor?.phone || ''}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                              ₹{((po.totalAmountPaise || 0) / 100).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Immediate'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  po.status === 'fulfilled'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : po.status === 'partially_received'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-blue-500/20 text-blue-300'
                                }`}
                              >
                                {po.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-1">
                              {['issued', 'partially_received'].includes(po.status) && (
                                <button
                                  onClick={() => {
                                    setGrnForm((prev) => ({ ...prev, purchaseOrder: po._id }));
                                    setShowGrnModal(true);
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs rounded text-white"
                                  title="Receive Goods (GRN)"
                                >
                                  Process GRN
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VENDORS */}
          {activeTab === 'vendors' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vendor name, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-400"
                  />
                </div>
                <button
                  onClick={() => setShowVendorModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Add Vendor
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map((vendor) => (
                  <div key={vendor._id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-base">{vendor.name}</h4>
                        <span className="text-xs font-mono text-indigo-400">{vendor.vendorCode}</span>
                      </div>
                      <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-full font-medium">
                        {vendor.status || 'Active'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <div>Contact: {vendor.contactPerson || 'N/A'} ({vendor.phone})</div>
                      <div>Email: {vendor.email || 'N/A'}</div>
                      <div>GST: {vendor.gstNumber || 'Unregistered'}</div>
                      <div>Terms: {vendor.paymentTerms}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MAINTENANCE & SERVICE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-rose-400" />
                  Asset Maintenance & Calibration Register
                </h3>
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Schedule Service
                </button>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">Maintenance No. / Title</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Scheduled Date</th>
                      <th className="px-4 py-3">Repair Cost (₹)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {maintenanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-slate-400">
                          No maintenance records found.
                        </td>
                      </tr>
                    ) : (
                      maintenanceRecords.map((m) => (
                        <tr key={m._id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{m.title}</div>
                            <div className="text-xs text-rose-400 font-mono">{m.maintenanceNumber}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-white font-medium">{m.asset?.name || 'Asset'}</div>
                            <div className="text-xs text-slate-400 font-mono">{m.asset?.assetId || ''}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-xs">{m.type}</td>
                          <td className="px-4 py-3 text-xs">
                            {new Date(m.scheduledDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            ₹{((m.costPaise || 0) / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : m.status === 'in_progress'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {m.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {m.status !== 'completed' && (
                              <button
                                onClick={() => handleCompleteMaintenance(m._id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs rounded text-white"
                              >
                                Mark Completed
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: PHYSICAL AUDITS */}
          {activeTab === 'audits' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-indigo-400" />
                  Physical Stocktaking & Inventory Audits
                </h3>
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Initiate Audit
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {audits.map((audit) => (
                  <div key={audit._id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-base">{audit.title}</h4>
                        <span className="text-xs font-mono text-indigo-400">{audit.auditNumber}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          audit.status === 'reconciled'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : audit.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {audit.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-2.5 rounded-lg text-center">
                      <div>
                        <div className="text-xs text-slate-400">Total Items</div>
                        <div className="text-base font-bold text-white">{audit.summary?.totalItemsAudited || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Matched</div>
                        <div className="text-base font-bold text-emerald-400">{audit.summary?.matchedCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Discrepancies</div>
                        <div className="text-base font-bold text-rose-400">{audit.summary?.discrepancyCount || 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: LOW-STOCK ALERTS */}
          {activeTab === 'low_stock' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Automated Reorder Recommendations
                </h3>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">SKU / Item</th>
                      <th className="px-4 py-3">Current Balance</th>
                      <th className="px-4 py-3">Threshold</th>
                      <th className="px-4 py-3">Suggested Reorder</th>
                      <th className="px-4 py-3">Est. Cost (₹)</th>
                      <th className="px-4 py-3">Preferred Vendor</th>
                      <th className="px-4 py-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {lowStockAlerts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-slate-400">
                          All consumable items have healthy stock levels above reorder thresholds.
                        </td>
                      </tr>
                    ) : (
                      lowStockAlerts.map((alert) => (
                        <tr key={alert._id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{alert.name}</div>
                            <div className="text-xs font-mono text-amber-400">{alert.sku}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-rose-400">
                            {alert.currentQuantity} {alert.unitOfMeasure}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">
                            {alert.reorderThreshold} {alert.unitOfMeasure}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                            {alert.suggestedReorderQuantity} {alert.unitOfMeasure}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                            ₹{((alert.estimatedCostPaise || 0) / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {alert.preferredVendor?.name || 'Unassigned'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setPrForm({
                                  title: `Restock ${alert.name}`,
                                  priority: 'high',
                                  justification: `Current balance (${alert.currentQuantity}) has breached threshold (${alert.reorderThreshold})`,
                                  itemName: alert.name,
                                  itemType: 'consumable',
                                  category: alert.category?._id || '',
                                  quantity: alert.suggestedReorderQuantity,
                                  estimatedUnitCostRupees: ((alert.unitCostPaise || 0) / 100).toString()
                                });
                                setShowPrModal(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-xs font-medium rounded text-white"
                            >
                              Generate PR
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODALS */}
          {/* ================================================================= */}

          {/* REGISTER ASSET MODAL */}
          {showAssetModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Register Serialized Asset</h3>
                  <button onClick={() => setShowAssetModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateAsset} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Asset Name *</label>
                    <input
                      required
                      type="text"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                      placeholder="e.g. Dell PowerEdge Server R750"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Category *</label>
                      <select
                        required
                        value={assetForm.category}
                        onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      >
                        <option value="">Select Category</option>
                        {categories.filter(c => c.classification === 'asset').map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Serial Number</label>
                      <input
                        type="text"
                        value={assetForm.serialNumber}
                        onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                        placeholder="OEM Serial Tag"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Acquisition Cost (INR) *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={assetForm.acquisitionCostRupees}
                        onChange={(e) => setAssetForm({ ...assetForm, acquisitionCostRupees: e.target.value })}
                        placeholder="e.g. 75000"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Useful Life (Months)</label>
                      <input
                        type="number"
                        value={assetForm.usefulLifeMonths}
                        onChange={(e) => setAssetForm({ ...assetForm, usefulLifeMonths: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Location</label>
                    <select
                      value={assetForm.location}
                      onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="">Central Store / Unassigned</option>
                      {locations.map(loc => (
                        <option key={loc._id} value={loc._id}>{loc.building} - {loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAssetModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Save Asset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADD STOCK ITEM MODAL */}
          {showStockModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Add Consumable Stock SKU</h3>
                  <button onClick={() => setShowStockModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateStockItem} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">SKU Code *</label>
                      <input
                        required
                        type="text"
                        value={stockForm.sku}
                        onChange={(e) => setStockForm({ ...stockForm, sku: e.target.value })}
                        placeholder="e.g. STAT-A4-001"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Unit of Measure *</label>
                      <input
                        required
                        type="text"
                        value={stockForm.unitOfMeasure}
                        onChange={(e) => setStockForm({ ...stockForm, unitOfMeasure: e.target.value })}
                        placeholder="e.g. reams, pcs, kg"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Item Name *</label>
                    <input
                      required
                      type="text"
                      value={stockForm.name}
                      onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                      placeholder="e.g. A4 Copier Paper 75GSM"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Category *</label>
                      <select
                        required
                        value={stockForm.category}
                        onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      >
                        <option value="">Select Category</option>
                        {categories.filter(c => c.classification === 'consumable').map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Unit Cost (INR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={stockForm.unitCostRupees}
                        onChange={(e) => setStockForm({ ...stockForm, unitCostRupees: e.target.value })}
                        placeholder="e.g. 250"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Initial Qty</label>
                      <input
                        type="number"
                        value={stockForm.initialQuantity}
                        onChange={(e) => setStockForm({ ...stockForm, initialQuantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Reorder Threshold</label>
                      <input
                        type="number"
                        value={stockForm.reorderThreshold}
                        onChange={(e) => setStockForm({ ...stockForm, reorderThreshold: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Reorder Batch</label>
                      <input
                        type="number"
                        value={stockForm.reorderQuantity}
                        onChange={(e) => setStockForm({ ...stockForm, reorderQuantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowStockModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
                    >
                      Save SKU
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ALLOCATE ASSET MODAL */}
          {showAllocateModal && selectedAsset && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Allocate {selectedAsset.name}</h3>
                  <button onClick={() => setShowAllocateModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleAllocateAsset} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Purpose of Allocation</label>
                    <input
                      type="text"
                      value={allocateForm.purpose}
                      onChange={(e) => setAllocateForm({ ...allocateForm, purpose: e.target.value })}
                      placeholder="e.g. Faculty lab workstation setup"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Expected Return Date</label>
                    <input
                      type="date"
                      value={allocateForm.expectedReturnDate}
                      onChange={(e) => setAllocateForm({ ...allocateForm, expectedReturnDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAllocateModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Confirm Allocation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* RETURN ASSET MODAL */}
          {showReturnModal && selectedAsset && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Return {selectedAsset.name}</h3>
                  <button onClick={() => setShowReturnModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleReturnAsset} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Return Condition</label>
                    <select
                      value={returnForm.returnCondition}
                      onChange={(e) => setReturnForm({ ...returnForm, returnCondition: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="good">Good (Normal Wear)</option>
                      <option value="fair">Fair (Minor Wear)</option>
                      <option value="damaged">Damaged (Needs Repair)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Return Remarks</label>
                    <textarea
                      rows="2"
                      value={returnForm.notes}
                      onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                      placeholder="Inspection remarks..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-medium"
                    >
                      Accept Return
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ISSUE STOCK MODAL */}
          {showIssueModal && selectedStockItem && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Issue {selectedStockItem.name}</h3>
                  <button onClick={() => setShowIssueModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleIssueStock} className="space-y-3">
                  <div className="text-xs text-slate-400">
                    Available Stock: <span className="font-bold text-emerald-400 font-mono">{selectedStockItem.currentQuantity} {selectedStockItem.unitOfMeasure}</span>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Quantity to Issue *</label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.01"
                      max={selectedStockItem.currentQuantity}
                      value={issueForm.quantity}
                      onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Recipient / Purpose</label>
                    <input
                      type="text"
                      value={issueForm.notes}
                      onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                      placeholder="e.g. Physics Lab Sem 5 experiment stock"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowIssueModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Issue Stock
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* STOCK MOVEMENTS LEDGER MODAL */}
          {showMovementsModal && selectedStockItem && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">Stock Movement Ledger</h3>
                    <p className="text-xs text-slate-400">{selectedStockItem.name} ({selectedStockItem.sku})</p>
                  </div>
                  <button onClick={() => setShowMovementsModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2">Movement No</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Balance</th>
                        <th className="px-3 py-2">Date / Performed By</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {stockMovements.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-3 py-4 text-center text-slate-400">No movements recorded yet.</td>
                        </tr>
                      ) : (
                        stockMovements.map((mov) => (
                          <tr key={mov._id}>
                            <td className="px-3 py-2 font-mono text-indigo-400">{mov.movementNumber}</td>
                            <td className="px-3 py-2 uppercase font-bold text-[10px]">
                              <span className={mov.type === 'receipt' ? 'text-emerald-400' : 'text-amber-400'}>{mov.type}</span>
                            </td>
                            <td className="px-3 py-2 font-mono">{mov.quantity}</td>
                            <td className="px-3 py-2 font-mono text-slate-200">{mov.previousQuantity} → {mov.newQuantity}</td>
                            <td className="px-3 py-2">{new Date(mov.createdAt).toLocaleDateString()}</td>
                            <td className="px-3 py-2 text-slate-400">{mov.notes}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ASSET DETAIL & DEPRECIATION MODAL */}
          {showAssetDetailModal && selectedAsset && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-xl w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedAsset.name}</h3>
                    <p className="text-xs font-mono text-indigo-400">{selectedAsset.assetId}</p>
                  </div>
                  <button onClick={() => setShowAssetDetailModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg">
                    <div>
                      <span className="text-xs text-slate-400">Acquisition Cost:</span>
                      <div className="font-mono font-bold text-white">₹{((selectedAsset.acquisitionCost || 0) / 100).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Estimated Book Value (Straight-Line):</span>
                      <div className="font-mono font-bold text-emerald-400">
                        ₹{(((selectedAsset.depreciation?.straightLine?.currentBookValuePaise || 0)) / 100).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Accumulated Depreciation:</span>
                      <div className="font-mono text-amber-400">
                        ₹{(((selectedAsset.depreciation?.straightLine?.accumulatedDepreciationPaise || 0)) / 100).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Useful Life / Elapsed:</span>
                      <div className="font-mono text-slate-200">
                        {selectedAsset.usefulLifeMonths || 60} mos / {selectedAsset.depreciation?.elapsedMonths || 0} mos
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>Serial: <span className="font-mono text-white">{selectedAsset.serialNumber || 'N/A'}</span></div>
                    <div>Location: {selectedAsset.location ? `${selectedAsset.location.building} - ${selectedAsset.location.name}` : 'Central Store'}</div>
                    <div>Current Custodian: {selectedAsset.currentCustodian?.name || 'Unassigned'}</div>
                    <div>Condition: <span className="capitalize font-semibold text-white">{selectedAsset.condition}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROCESS GRN MODAL */}
          {showGrnModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Process Goods Receipt Note (GRN)</h3>
                  <button onClick={() => setShowGrnModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateGrn} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Destination Location *</label>
                    <select
                      required
                      value={grnForm.destinationLocation}
                      onChange={(e) => setGrnForm({ ...grnForm, destinationLocation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="">Select Store Location</option>
                      {locations.map(loc => (
                        <option key={loc._id} value={loc._id}>{loc.building} - {loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Invoice Number</label>
                      <input
                        type="text"
                        value={grnForm.invoiceNumber}
                        onChange={(e) => setGrnForm({ ...grnForm, invoiceNumber: e.target.value })}
                        placeholder="INV-9982"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Accepted Quantity *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={grnForm.acceptedQuantity}
                        onChange={(e) => setGrnForm({ ...grnForm, acceptedQuantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Serial Numbers (one per line, for assets)</label>
                    <textarea
                      rows="3"
                      value={grnForm.serialNumbers}
                      onChange={(e) => setGrnForm({ ...grnForm, serialNumbers: e.target.value })}
                      placeholder="SN-1001&#10;SN-1002"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowGrnModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium"
                    >
                      Accept & Generate Assets/Stock
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* NEW PR MODAL */}
          {showPrModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Create Purchase Requisition</h3>
                  <button onClick={() => setShowPrModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreatePr} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Requisition Title *</label>
                    <input
                      required
                      type="text"
                      value={prForm.title}
                      onChange={(e) => setPrForm({ ...prForm, title: e.target.value })}
                      placeholder="e.g. Lab Consumables Restock Q3"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Item Name *</label>
                      <input
                        required
                        type="text"
                        value={prForm.itemName}
                        onChange={(e) => setPrForm({ ...prForm, itemName: e.target.value })}
                        placeholder="Item name"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Category *</label>
                      <select
                        required
                        value={prForm.category}
                        onChange={(e) => setPrForm({ ...prForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Quantity *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={prForm.quantity}
                        onChange={(e) => setPrForm({ ...prForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Est. Unit Cost (INR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prForm.estimatedUnitCostRupees}
                        onChange={(e) => setPrForm({ ...prForm, estimatedUnitCostRupees: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Justification</label>
                    <textarea
                      rows="2"
                      value={prForm.justification}
                      onChange={(e) => setPrForm({ ...prForm, justification: e.target.value })}
                      placeholder="Academic or operational necessity..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowPrModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Submit Requisition
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SCHEDULE MAINTENANCE MODAL */}
          {showMaintenanceModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Schedule Asset Maintenance</h3>
                  <button onClick={() => setShowMaintenanceModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateMaintenance} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Asset *</label>
                    <select
                      required
                      value={maintenanceForm.asset}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, asset: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="">Select Asset</option>
                      {assets.map(a => (
                        <option key={a._id} value={a._id}>{a.name} ({a.assetId})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Type *</label>
                      <select
                        value={maintenanceForm.type}
                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      >
                        <option value="corrective">Corrective (Repair)</option>
                        <option value="preventative">Preventative</option>
                        <option value="calibration">Calibration</option>
                        <option value="inspection">Inspection</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Scheduled Date *</label>
                      <input
                        required
                        type="date"
                        value={maintenanceForm.scheduledDate}
                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Task Title *</label>
                    <input
                      required
                      type="text"
                      value={maintenanceForm.title}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                      placeholder="e.g. Replace projector bulb & clean filter"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowMaintenanceModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm font-medium"
                    >
                      Schedule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* INITIATE AUDIT MODAL */}
          {showAuditModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Initiate Physical Audit</h3>
                  <button onClick={() => setShowAuditModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateAudit} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Audit Title *</label>
                    <input
                      required
                      type="text"
                      value={auditForm.title}
                      onChange={(e) => setAuditForm({ ...auditForm, title: e.target.value })}
                      placeholder="e.g. Annual IT Lab Stocktaking"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Location</label>
                    <select
                      value={auditForm.location}
                      onChange={(e) => setAuditForm({ ...auditForm, location: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="">Campus-wide</option>
                      {locations.map(loc => (
                        <option key={loc._id} value={loc._id}>{loc.building} - {loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAuditModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Start Stocktaking
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADD VENDOR MODAL */}
          {showVendorModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h3 className="text-lg font-bold text-white">Add Vendor to Directory</h3>
                  <button onClick={() => setShowVendorModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleCreateVendor} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Vendor Name *</label>
                    <input
                      required
                      type="text"
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                      placeholder="e.g. Apex Infotech Solutions"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Vendor Code *</label>
                      <input
                        required
                        type="text"
                        value={vendorForm.vendorCode}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })}
                        placeholder="VND-APEX"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Phone *</label>
                      <input
                        required
                        type="text"
                        value={vendorForm.phone}
                        onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">GST Number</label>
                    <input
                      type="text"
                      value={vendorForm.gstNumber}
                      onChange={(e) => setVendorForm({ ...vendorForm, gstNumber: e.target.value })}
                      placeholder="27AAAAA0000A1Z5"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowVendorModal(false)}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
                    >
                      Save Vendor
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

export default AdminInventory;
