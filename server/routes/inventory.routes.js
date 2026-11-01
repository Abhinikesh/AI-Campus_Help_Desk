/**
 * server/routes/inventory.routes.js
 * Express routes for Campus Inventory, Asset Lifecycle, Consumables Stock Ledger, Procurement & Maintenance.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const {
  getCategories,
  createCategory,
  getLocations,
  createLocation,
  getAssets,
  getAssetById,
  createAsset,
  allocateAsset,
  returnAsset,
  transferAsset,
  getMyAssignedAssets,
  getStockItems,
  createStockItem,
  issueStock,
  adjustStock,
  getStockMovements,
  getVendors,
  createVendor,
  getPurchaseRequests,
  createPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  getPurchaseOrders,
  createPurchaseOrder,
  getGoodsReceipts,
  createGoodsReceipt,
  getMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceStatus,
  getAudits,
  getAuditById,
  createAudit,
  submitAuditCount,
  reconcileAudit,
  getMetrics,
  getLowStockAlerts,
  exportAssetsCsv,
  exportStockCsv
} = require('../controllers/inventory.controller');

// All inventory routes require authentication
router.use(authMiddleware);

// -------------------------------------------------------------
// METRICS, LOW STOCK & CSV EXPORTS
// -------------------------------------------------------------
router.get(
  '/metrics',
  allowRoles('admin', 'inventory_manager', 'procurement_officer'),
  getMetrics
);

router.get(
  '/low-stock',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper'),
  getLowStockAlerts
);

router.get(
  '/export/assets',
  allowRoles('admin', 'inventory_manager', 'procurement_officer'),
  exportAssetsCsv
);

router.get(
  '/export/stock',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper'),
  exportStockCsv
);

// -------------------------------------------------------------
// CATEGORIES & LOCATIONS
// -------------------------------------------------------------
router.get(
  '/categories',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getCategories
);

router.post(
  '/categories',
  allowRoles('admin', 'inventory_manager'),
  createCategory
);

router.get(
  '/locations',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getLocations
);

router.post(
  '/locations',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  createLocation
);

// -------------------------------------------------------------
// ASSETS
// -------------------------------------------------------------
router.get(
  '/assets/my',
  allowRoles('admin', 'faculty', 'inventory_manager', 'storekeeper'),
  getMyAssignedAssets
);

router.get(
  '/assets',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getAssets
);

router.get(
  '/assets/:id',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getAssetById
);

router.post(
  '/assets',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  createAsset
);

router.post(
  '/assets/:id/allocate',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  allocateAsset
);

router.post(
  '/assets/:id/return',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  returnAsset
);

router.post(
  '/assets/:id/transfer',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  transferAsset
);

// -------------------------------------------------------------
// CONSUMABLE STOCK ITEMS & LEDGER
// -------------------------------------------------------------
router.get(
  '/stock/movements',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper'),
  getStockMovements
);

router.get(
  '/stock',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getStockItems
);

router.post(
  '/stock',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  createStockItem
);

router.post(
  '/stock/:id/issue',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  issueStock
);

router.post(
  '/stock/:id/adjust',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  adjustStock
);

// -------------------------------------------------------------
// VENDORS
// -------------------------------------------------------------
router.get(
  '/vendors',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getVendors
);

router.post(
  '/vendors',
  allowRoles('admin', 'procurement_officer', 'inventory_manager'),
  createVendor
);

// -------------------------------------------------------------
// PURCHASE REQUESTS
// -------------------------------------------------------------
router.get(
  '/requests',
  allowRoles('admin', 'procurement_officer', 'inventory_manager', 'faculty'),
  getPurchaseRequests
);

router.post(
  '/requests',
  allowRoles('admin', 'procurement_officer', 'inventory_manager', 'faculty'),
  createPurchaseRequest
);

router.post(
  '/requests/:id/approve',
  allowRoles('admin', 'procurement_officer', 'inventory_manager'),
  approvePurchaseRequest
);

router.post(
  '/requests/:id/reject',
  allowRoles('admin', 'procurement_officer', 'inventory_manager'),
  rejectPurchaseRequest
);

// -------------------------------------------------------------
// PURCHASE ORDERS
// -------------------------------------------------------------
router.get(
  '/orders',
  allowRoles('admin', 'procurement_officer', 'inventory_manager', 'storekeeper'),
  getPurchaseOrders
);

router.post(
  '/orders',
  allowRoles('admin', 'procurement_officer', 'inventory_manager'),
  createPurchaseOrder
);

// -------------------------------------------------------------
// GOODS RECEIPTS (GRN)
// -------------------------------------------------------------
router.get(
  '/receipts',
  allowRoles('admin', 'procurement_officer', 'inventory_manager', 'storekeeper'),
  getGoodsReceipts
);

router.post(
  '/receipts',
  allowRoles('admin', 'procurement_officer', 'inventory_manager', 'storekeeper'),
  createGoodsReceipt
);

// -------------------------------------------------------------
// ASSET MAINTENANCE
// -------------------------------------------------------------
router.get(
  '/maintenance',
  allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty'),
  getMaintenanceRecords
);

router.post(
  '/maintenance',
  allowRoles('admin', 'inventory_manager', 'storekeeper', 'faculty'),
  createMaintenanceRecord
);

router.patch(
  '/maintenance/:id/status',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  updateMaintenanceStatus
);

// -------------------------------------------------------------
// PHYSICAL AUDITS & STOCKTAKING
// -------------------------------------------------------------
router.get(
  '/audits',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  getAudits
);

router.get(
  '/audits/:id',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  getAuditById
);

router.post(
  '/audits',
  allowRoles('admin', 'inventory_manager'),
  createAudit
);

router.post(
  '/audits/:auditId/items/:itemId/count',
  allowRoles('admin', 'inventory_manager', 'storekeeper'),
  submitAuditCount
);

router.post(
  '/audits/:id/reconcile',
  allowRoles('admin', 'inventory_manager'),
  reconcileAudit
);

module.exports = router;
