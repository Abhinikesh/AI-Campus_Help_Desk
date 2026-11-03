/**
 * client/src/pages/FacultyInventory/index.jsx
 * Faculty Desk for Assigned Assets, Department Consumables, Requisitions & Maintenance Reports.
 */
import React, { useState, useEffect } from 'react';
import {
  Package,
  Boxes,
  FileText,
  Wrench,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  X
} from 'lucide-react';
import inventoryService from '../../services/inventory.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const FacultyInventory = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my_assets');

  const [myAssets, setMyAssets] = useState([]);
  const [departmentStock, setDepartmentStock] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [maintenanceReports, setMaintenanceReports] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modals
  const [showPrModal, setShowPrModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Forms
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

  const [maintForm, setMaintForm] = useState({
    asset: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: new Date().toISOString().slice(0, 10)
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [assetsRes, stockRes, prRes, maintRes, catRes] = await Promise.all([
        inventoryService.getMyAssignedAssets().catch(() => ({ data: [] })),
        inventoryService.getStockItems().catch(() => ({ data: [] })),
        inventoryService.getPurchaseRequests().catch(() => ({ data: [] })),
        inventoryService.getMaintenanceRecords().catch(() => ({ data: [] })),
        inventoryService.getCategories().catch(() => ({ data: [] }))
      ]);

      if (assetsRes.data) setMyAssets(assetsRes.data);
      if (stockRes.data) setDepartmentStock(stockRes.data);
      if (prRes.data) setMyRequests(prRes.data);
      if (maintRes.data) setMaintenanceReports(maintRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      showToast('Error loading faculty inventory: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePr = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: prForm.title,
        priority: prForm.priority,
        justification: prForm.justification,
        department: user?.department || undefined,
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
      showToast('Purchase requisition submitted for departmental approval', 'success');
      setShowPrModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const handleReportMaintenance = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.createMaintenanceRecord({
        ...maintForm,
        type: 'corrective',
        serviceProvider: 'in_house'
      });
      showToast('Maintenance request logged. Facility technician notified.', 'success');
      setShowMaintModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="cs-portal-shell overflow-hidden font-sans">
      <Sidebar />
      <div className="cs-portal-main overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Package className="h-7 w-7 text-indigo-400" />
                Faculty Asset & Resource Requisitions
              </h1>
              <p className="text-sm text-slate-500">
                Track assets in your custody, view departmental lab consumables, and request procurement or repairs.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                New Requisition (PR)
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 space-x-2">
            <button
              onClick={() => setActiveTab('my_assets')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                activeTab === 'my_assets'
                  ? 'bg-white text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover'
              }`}
            >
              <Package className="h-4 w-4" />
              Assigned to Me ({myAssets.length})
            </button>
            <button
              onClick={() => setActiveTab('dept_stock')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                activeTab === 'dept_stock'
                  ? 'bg-white text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover'
              }`}
            >
              <Boxes className="h-4 w-4" />
              Department Stock
            </button>
            <button
              onClick={() => setActiveTab('my_prs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                activeTab === 'my_prs'
                  ? 'bg-white text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover'
              }`}
            >
              <FileText className="h-4 w-4" />
              My Requisitions ({myRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                activeTab === 'maintenance'
                  ? 'bg-white text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Maintenance Requests
            </button>
          </div>

          {/* TAB 1: MY ASSETS */}
          {activeTab === 'my_assets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAssets.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <Package className="h-10 w-10 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p>You have no equipment or physical assets currently allocated in your custody.</p>
                </div>
              ) : (
                myAssets.map((asset) => (
                  <div key={asset._id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-base">{asset.name}</h4>
                        <span className="text-xs font-mono text-indigo-400">{asset.assetId}</span>
                      </div>
                      <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-full font-medium">
                        {asset.condition}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-1">
                      <div>Serial Number: <span className="font-mono text-slate-900">{asset.serialNumber || 'N/A'}</span></div>
                      <div>Location: {asset.location ? `${asset.location.building} - ${asset.location.name}` : 'Faculty Office'}</div>
                      <div>Model: {asset.modelNumber || 'Standard issue'}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => {
                          setMaintForm((prev) => ({ ...prev, asset: asset._id, title: `Issue with ${asset.name}` }));
                          setShowMaintModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-rose-600/80 hover text-xs font-medium rounded text-white"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Report Breakdown
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: DEPARTMENT STOCK */}
          {activeTab === 'dept_stock' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Consumable Item</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Available Balance</th>
                    <th className="px-4 py-3">Storage Location</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {departmentStock.map((item) => (
                    <tr key={item._id} className="hover transition">
                      <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-400">{item.sku}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {item.currentQuantity} {item.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.defaultLocation ? `${item.defaultLocation.building} - ${item.defaultLocation.name}` : 'Main Store'}
                      </td>
                      <td className="px-4 py-3">
                        {item.currentQuantity <= item.reorderThreshold ? (
                          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded font-medium">Low Stock</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded font-medium">Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: MY REQUISITIONS */}
          {activeTab === 'my_prs' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">PR Number / Title</th>
                    <th className="px-4 py-3">Items Requested</th>
                    <th className="px-4 py-3">Est. Amount (₹)</th>
                    <th className="px-4 py-3">Stage / Status</th>
                    <th className="px-4 py-3">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {myRequests.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-slate-500">
                        You have not submitted any purchase requisitions yet.
                      </td>
                    </tr>
                  ) : (
                    myRequests.map((pr) => (
                      <tr key={pr._id} className="hover transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{pr.title}</div>
                          <div className="text-xs font-mono text-indigo-400">{pr.requestNumber}</div>
                        </td>
                        <td className="px-4 py-3">
                          {pr.items?.map((it, idx) => (
                            <div key={idx} className="text-xs">
                              {it.itemName} ({it.quantity} units)
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                          ₹{((pr.estimatedTotalPaise || 0) / 100).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              pr.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : pr.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {pr.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(pr.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: MAINTENANCE REQUESTS */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-white">Reported Equipment Issues</h3>
                <button
                  onClick={() => setShowMaintModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover text-white text-xs font-medium rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Report Issue
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Maintenance No / Title</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Reported On</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {maintenanceReports.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-center text-slate-500">
                          No reported maintenance issues.
                        </td>
                      </tr>
                    ) : (
                      maintenanceReports.map((m) => (
                        <tr key={m._id} className="hover transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{m.title}</div>
                            <div className="text-xs text-rose-400 font-mono">{m.maintenanceNumber}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-900">{m.asset?.name || 'Asset'}</div>
                            <div className="text-xs text-slate-500 font-mono">{m.asset?.assetId || ''}</div>
                          </td>
                          <td className="px-4 py-3 uppercase text-xs font-semibold">{m.priority}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {m.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CREATE PR MODAL */}
          {showPrModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-bold text-white">Create Purchase Requisition</h3>
                  <button onClick={() => setShowPrModal(false)}><X className="h-5 w-5 text-slate-500" /></button>
                </div>
                <form onSubmit={handleCreatePr} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">Title / Purpose *</label>
                    <input
                      required
                      type="text"
                      value={prForm.title}
                      onChange={(e) => setPrForm({ ...prForm, title: e.target.value })}
                      placeholder="e.g. Lab Chemicals & Microcontrollers for Sem 4"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Item Name *</label>
                      <input
                        required
                        type="text"
                        value={prForm.itemName}
                        onChange={(e) => setPrForm({ ...prForm, itemName: e.target.value })}
                        placeholder="Item name"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Category *</label>
                      <select
                        required
                        value={prForm.category}
                        onChange={(e) => setPrForm({ ...prForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
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
                      <label className="text-xs text-slate-500">Quantity *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={prForm.quantity}
                        onChange={(e) => setPrForm({ ...prForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Est. Unit Cost (INR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prForm.estimatedUnitCostRupees}
                        onChange={(e) => setPrForm({ ...prForm, estimatedUnitCostRupees: e.target.value })}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Academic Justification *</label>
                    <textarea
                      required
                      rows="2"
                      value={prForm.justification}
                      onChange={(e) => setPrForm({ ...prForm, justification: e.target.value })}
                      placeholder="Why is this purchase required for curriculum or lab operation?"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowPrModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover text-white rounded text-sm font-medium"
                    >
                      Submit Requisition
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* REPORT MAINTENANCE MODAL */}
          {showMaintModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-bold text-white">Report Equipment Breakdown</h3>
                  <button onClick={() => setShowMaintModal(false)}><X className="h-5 w-5 text-slate-500" /></button>
                </div>
                <form onSubmit={handleReportMaintenance} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">Select Equipment / Asset *</label>
                    <select
                      required
                      value={maintForm.asset}
                      onChange={(e) => setMaintForm({ ...maintForm, asset: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                    >
                      <option value="">Select Asset</option>
                      {myAssets.map(a => (
                        <option key={a._id} value={a._id}>{a.name} ({a.assetId})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Issue Summary *</label>
                    <input
                      required
                      type="text"
                      value={maintForm.title}
                      onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                      placeholder="e.g. Display backlight flickering"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Detailed Description</label>
                    <textarea
                      rows="3"
                      value={maintForm.description}
                      onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                      placeholder="When did the issue start? Any error codes displayed?"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowMaintModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-rose-600 hover text-white rounded text-sm font-medium"
                    >
                      Log Breakdown
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

export default FacultyInventory;

