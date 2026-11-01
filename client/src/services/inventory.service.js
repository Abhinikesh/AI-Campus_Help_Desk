/**
 * client/src/services/inventory.service.js
 * Axios API client for CampusSphere AI Asset, Inventory, Procurement & Maintenance.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/inventory',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const inventoryService = {
  // Metrics & Alerts
  getMetrics: async () => {
    const res = await api.get('/metrics');
    return res.data;
  },
  getLowStockAlerts: async () => {
    const res = await api.get('/low-stock');
    return res.data;
  },

  // Categories & Locations
  getCategories: async (params = {}) => {
    const res = await api.get('/categories', { params });
    return res.data;
  },
  createCategory: async (data) => {
    const res = await api.post('/categories', data);
    return res.data;
  },
  getLocations: async (params = {}) => {
    const res = await api.get('/locations', { params });
    return res.data;
  },
  createLocation: async (data) => {
    const res = await api.post('/locations', data);
    return res.data;
  },

  // Assets
  getAssets: async (params = {}) => {
    const res = await api.get('/assets', { params });
    return res.data;
  },
  getAssetById: async (id) => {
    const res = await api.get(`/assets/${id}`);
    return res.data;
  },
  getMyAssignedAssets: async () => {
    const res = await api.get('/assets/my');
    return res.data;
  },
  createAsset: async (data) => {
    const res = await api.post('/assets', data);
    return res.data;
  },
  allocateAsset: async (id, data) => {
    const res = await api.post(`/assets/${id}/allocate`, data);
    return res.data;
  },
  returnAsset: async (id, data) => {
    const res = await api.post(`/assets/${id}/return`, data);
    return res.data;
  },
  transferAsset: async (id, data) => {
    const res = await api.post(`/assets/${id}/transfer`, data);
    return res.data;
  },

  // Stock Items & Movements
  getStockItems: async (params = {}) => {
    const res = await api.get('/stock', { params });
    return res.data;
  },
  createStockItem: async (data) => {
    const res = await api.post('/stock', data);
    return res.data;
  },
  issueStock: async (id, data) => {
    const res = await api.post(`/stock/${id}/issue`, data);
    return res.data;
  },
  adjustStock: async (id, data) => {
    const res = await api.post(`/stock/${id}/adjust`, data);
    return res.data;
  },
  getStockMovements: async (params = {}) => {
    const res = await api.get('/stock/movements', { params });
    return res.data;
  },

  // Vendors
  getVendors: async (params = {}) => {
    const res = await api.get('/vendors', { params });
    return res.data;
  },
  createVendor: async (data) => {
    const res = await api.post('/vendors', data);
    return res.data;
  },

  // Procurement: Purchase Requests
  getPurchaseRequests: async (params = {}) => {
    const res = await api.get('/requests', { params });
    return res.data;
  },
  createPurchaseRequest: async (data) => {
    const res = await api.post('/requests', data);
    return res.data;
  },
  approvePurchaseRequest: async (id, data) => {
    const res = await api.post(`/requests/${id}/approve`, data);
    return res.data;
  },
  rejectPurchaseRequest: async (id, data) => {
    const res = await api.post(`/requests/${id}/reject`, data);
    return res.data;
  },

  // Purchase Orders
  getPurchaseOrders: async (params = {}) => {
    const res = await api.get('/orders', { params });
    return res.data;
  },
  createPurchaseOrder: async (data) => {
    const res = await api.post('/orders', data);
    return res.data;
  },

  // Goods Receipts
  getGoodsReceipts: async (params = {}) => {
    const res = await api.get('/receipts', { params });
    return res.data;
  },
  createGoodsReceipt: async (data) => {
    const res = await api.post('/receipts', data);
    return res.data;
  },

  // Asset Maintenance
  getMaintenanceRecords: async (params = {}) => {
    const res = await api.get('/maintenance', { params });
    return res.data;
  },
  createMaintenanceRecord: async (data) => {
    const res = await api.post('/maintenance', data);
    return res.data;
  },
  updateMaintenanceStatus: async (id, data) => {
    const res = await api.patch(`/maintenance/${id}/status`, data);
    return res.data;
  },

  // Physical Audits
  getAudits: async (params = {}) => {
    const res = await api.get('/audits', { params });
    return res.data;
  },
  getAuditById: async (id) => {
    const res = await api.get(`/audits/${id}`);
    return res.data;
  },
  createAudit: async (data) => {
    const res = await api.post('/audits', data);
    return res.data;
  },
  submitAuditCount: async (auditId, itemId, data) => {
    const res = await api.post(`/audits/${auditId}/items/${itemId}/count`, data);
    return res.data;
  },
  reconcileAudit: async (id, data) => {
    const res = await api.post(`/audits/${id}/reconcile`, data);
    return res.data;
  },

  // CSV Exports
  exportAssetsCsv: async () => {
    const res = await api.get('/export/assets', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campus-assets-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  exportStockCsv: async () => {
    const res = await api.get('/export/stock', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campus-stock-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

export default inventoryService;

