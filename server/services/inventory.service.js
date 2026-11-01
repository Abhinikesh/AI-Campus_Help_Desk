/**
 * server/services/inventory.service.js
 * Campus Inventory, Asset Lifecycle, Consumables Stock Ledger, Procurement & Maintenance Service.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const InventoryCategory = require('../models/InventoryCategory');
const InventoryLocation = require('../models/InventoryLocation');
const Asset = require('../models/Asset');
const AssetAllocation = require('../models/AssetAllocation');
const AssetTransfer = require('../models/AssetTransfer');
const StockItem = require('../models/StockItem');
const StockMovement = require('../models/StockMovement');
const Vendor = require('../models/Vendor');
const PurchaseRequest = require('../models/PurchaseRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const AssetMaintenance = require('../models/AssetMaintenance');
const InventoryAudit = require('../models/InventoryAudit');
const InventoryAuditItem = require('../models/InventoryAuditItem');
const InventoryAuditLog = require('../models/InventoryAuditLog');
const notificationService = require('./notification.service');

// Configure Multer storage for inventory document attachments
const INVENTORY_UPLOADS = path.join(__dirname, '../uploads/inventory');
if (!fs.existsSync(INVENTORY_UPLOADS)) {
  fs.mkdirSync(INVENTORY_UPLOADS, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, INVENTORY_UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `inv-${Date.now()}-${cleanBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: PDF, PNG, JPG, JPEG, WEBP'));
  }
};

const uploadInventoryDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

class InventoryService {
  /**
   * Generates a unique sequential identifier for various entities.
   * @param {string} prefix
   * @param {string} [subcode='']
   * @returns {string}
   */
  generateCode(prefix, subcode = '') {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (subcode) {
      return `${prefix}-${subcode}-${dateStr}-${randStr}`;
    }
    return `${prefix}-${dateStr}-${randStr}`;
  }

  /**
   * Sanitizes text to prevent CSV injection (CWE-1236).
   * @param {any} val
   * @returns {string}
   */
  sanitizeCsvValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Logs an administrative action in the immutable audit log.
   */
  async logAuditAction({ entityType, entityId, action, performedBy, changes = null, notes = '', ipAddress = '', userAgent = '' }) {
    try {
      await InventoryAuditLog.create({
        entityType,
        entityId,
        action,
        performedBy,
        changes,
        notes,
        ipAddress,
        userAgent
      });
    } catch (err) {
      console.error('Failed to write inventory audit log:', err.message);
    }
  }

  /**
   * Atomic Stock Adjustment / Movement Invariant
   * Decrements or increments stock atomically while guaranteeing non-negative balance.
   */
  async recordStockMovement({
    stockItemId,
    type, // 'issue', 'purchase_receipt', 'return', 'adjustment', 'write_off'
    quantity,
    reason = 'Stock balance update',
    referenceNumber = '',
    sourceLocation = null,
    destinationLocation = null,
    issuedTo = null,
    performedBy,
    session = null
  }) {
    if (!quantity || quantity === 0) {
      throw new Error('Movement quantity cannot be zero');
    }

    const stockItem = await StockItem.findById(stockItemId).session(session);
    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const previousBalance = stockItem.currentQuantity;
    let newBalance = previousBalance;
    const movementQty = Math.abs(quantity);

    // Map high-level type to StockMovement enum movementType
    let movementType = type;
    if (type === 'receipt') movementType = 'purchase_receipt';

    if (['issue', 'write_off', 'damaged', 'expired'].includes(movementType) || (movementType === 'adjustment' && quantity < 0)) {
      if (previousBalance < movementQty) {
        throw new Error(`Insufficient stock. Available: ${previousBalance}, Requested decrement: ${movementQty}`);
      }
      newBalance = previousBalance - movementQty;

      const updateQuery = {
        _id: stockItemId,
        currentQuantity: { $gte: movementQty }
      };

      const updateDoc = {
        $inc: { currentQuantity: -movementQty },
        $set: { updatedAt: new Date() }
      };

      const res = await StockItem.updateOne(updateQuery, updateDoc).session(session);
      if (res.modifiedCount === 0) {
        throw new Error('Concurrent modification detected or insufficient stock balance');
      }
    } else if (['purchase_receipt', 'opening_balance', 'return'].includes(movementType) || (movementType === 'adjustment' && quantity > 0)) {
      newBalance = previousBalance + movementQty;

      const updateDoc = {
        $inc: { currentQuantity: movementQty },
        $set: { updatedAt: new Date() }
      };

      await StockItem.updateOne({ _id: stockItemId }, updateDoc).session(session);
    }

    const movementNumber = this.generateCode('MOV');
    const movement = new StockMovement({
      movementNumber,
      stockItem: stockItemId,
      movementType,
      quantity: movementQty,
      previousBalance,
      newBalance,
      sourceLocation,
      destinationLocation,
      issuedTo,
      performedBy,
      reason,
      referenceNumber
    });

    await movement.save({ session });

    // Check low stock condition and trigger notification if reorder threshold breached
    if (newBalance <= stockItem.reorderThreshold && previousBalance > stockItem.reorderThreshold) {
      this.sendLowStockAlert(stockItem);
    }

    return { stockItem: await StockItem.findById(stockItemId).session(session), movement };
  }

  /**
   * Computes informational depreciation using Straight-Line and WDV methodologies.
   * @param {Object} asset
   * @returns {Object} Depreciation metrics
   */
  calculateDepreciation(asset) {
    const acquisitionCost = asset.acquisitionCost || 0;
    const salvageValue = asset.depreciation?.residualValue || asset.salvageValuePaise || 0;
    const usefulLifeYears = asset.depreciation?.usefulLifeYears || 5;
    const usefulLifeMonths = usefulLifeYears * 12;
    const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : new Date();
    const currentDate = new Date();

    const elapsedMonths = Math.max(
      0,
      (currentDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
        (currentDate.getMonth() - purchaseDate.getMonth())
    );

    const depreciableBase = Math.max(0, acquisitionCost - salvageValue);
    const monthlyStraightLine = usefulLifeMonths > 0 ? depreciableBase / usefulLifeMonths : 0;
    const straightLineAccumulated = Math.min(
      depreciableBase,
      Math.round(monthlyStraightLine * Math.min(elapsedMonths, usefulLifeMonths))
    );
    const straightLineBookValue = Math.max(salvageValue, acquisitionCost - straightLineAccumulated);

    // Written Down Value (WDV) rate estimate (15% per annum)
    const annualRate = 0.15;
    const yearsElapsed = elapsedMonths / 12;
    const wdvBookValue = Math.max(
      salvageValue,
      Math.round(acquisitionCost * Math.pow(1 - annualRate, yearsElapsed))
    );
    const wdvAccumulated = Math.max(0, acquisitionCost - wdvBookValue);

    return {
      acquisitionCostPaise: acquisitionCost,
      salvageValuePaise: salvageValue,
      usefulLifeMonths,
      elapsedMonths,
      straightLine: {
        monthlyDepreciationPaise: Math.round(monthlyStraightLine),
        accumulatedDepreciationPaise: straightLineAccumulated,
        currentBookValuePaise: straightLineBookValue
      },
      writtenDownValue: {
        annualRatePercent: 15,
        accumulatedDepreciationPaise: wdvAccumulated,
        currentBookValuePaise: wdvBookValue
      }
    };
  }

  /**
   * Retrieves low stock consumables and calculates automated reorder suggestions.
   */
  async getLowStockAlerts() {
    const lowStockItems = await StockItem.find({
      isActive: true,
      $expr: { $lte: ['$currentQuantity', '$reorderThreshold'] }
    })
      .populate('category', 'name code')
      .populate('location', 'name code building')
      .sort({ currentQuantity: 1 })
      .lean();

    return lowStockItems.map((item) => {
      const deficit = Math.max(0, item.reorderThreshold - item.currentQuantity);
      const reorderQuantity = item.reorderThreshold * 2;
      const suggestedReorderQty = Math.max(reorderQuantity, deficit + 10);
      const estimatedCostPaise = suggestedReorderQty * (item.unitPrice || 0);

      return {
        ...item,
        unitOfMeasure: item.unit,
        unitCostPaise: item.unitPrice,
        reorderQuantity,
        isDeficit: deficit > 0,
        suggestedReorderQuantity: suggestedReorderQty,
        estimatedCostPaise
      };
    });
  }

  /**
   * Dispatches notifications to storekeepers & inventory managers on low stock.
   */
  async sendLowStockAlert(stockItem) {
    try {
      const User = mongoose.model('User');
      const managers = await User.find({
        role: { $in: ['admin', 'inventory_manager', 'storekeeper'] },
        status: 'active'
      }).select('_id');

      for (const m of managers) {
        await notificationService.sendNotification({
          recipient: m._id,
          title: `Low Stock Alert: ${stockItem.name}`,
          message: `Item ${stockItem.name} (${stockItem.sku}) is at ${stockItem.currentQuantity} ${stockItem.unit}, which is below or at the reorder threshold (${stockItem.reorderThreshold}).`,
          category: 'inventory',
          priority: 'high',
          link: `/admin/inventory?tab=stock&sku=${stockItem.sku}`
        });
      }
    } catch (err) {
      console.error('Failed to send low stock alert:', err.message);
    }
  }

  /**
   * Aggregates live institutional inventory and procurement metrics.
   */
  async getInventoryMetrics() {
    const [
      totalAssets,
      assetsByStatus,
      totalStockItems,
      lowStockCount,
      pendingRequestsCount,
      activePosCount,
      pendingMaintenanceCount,
      totalMaintenanceCostResult,
      totalAssetValueResult
    ] = await Promise.all([
      Asset.countDocuments(),
      Asset.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      StockItem.countDocuments({ isActive: true }),
      StockItem.countDocuments({
        isActive: true,
        $expr: { $lte: ['$currentQuantity', '$reorderThreshold'] }
      }),
      PurchaseRequest.countDocuments({
        status: { $in: ['submitted', 'under_review', 'pending_hod', 'pending_finance', 'pending_principal'] }
      }),
      PurchaseOrder.countDocuments({
        status: { $in: ['issued', 'partially_received'] }
      }),
      AssetMaintenance.countDocuments({
        status: { $in: ['scheduled', 'in_progress'] }
      }),
      AssetMaintenance.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalCostPaise: { $sum: '$costPaise' } } }
      ]),
      Asset.aggregate([
        { $match: { status: { $ne: 'disposed' } } },
        { $group: { _id: null, totalValuationPaise: { $sum: '$acquisitionCost' } } }
      ])
    ]);

    const assetStatusMap = {};
    assetsByStatus.forEach((s) => {
      assetStatusMap[s._id] = s.count;
    });

    return {
      totalAssets,
      inStoreAssets: (assetStatusMap['in_stock'] || 0) + (assetStatusMap['available'] || 0),
      inUseAssets: assetStatusMap['assigned'] || 0,
      underMaintenanceAssets: assetStatusMap['under_maintenance'] || 0,
      disposedAssets: assetStatusMap['disposed'] || 0,
      totalStockItems,
      lowStockAlerts: lowStockCount,
      pendingPurchaseRequests: pendingRequestsCount,
      activePurchaseOrders: activePosCount,
      pendingMaintenance: pendingMaintenanceCount,
      completedMaintenanceExpenditurePaise: totalMaintenanceCostResult[0]?.totalCostPaise || 0,
      totalAssetBookValuePaise: totalAssetValueResult[0]?.totalValuationPaise || 0
    };
  }

  /**
   * Generates sanitized CSV report data for Assets.
   */
  async exportAssetsCsv() {
    const assets = await Asset.find()
      .populate('category', 'name code')
      .populate('currentLocation', 'name code building roomNumber')
      .populate('assignedTo', 'name email role')
      .sort({ assetId: 1 })
      .lean();

    const headers = [
      'Asset ID',
      'Name',
      'Category',
      'Serial Number',
      'Model',
      'Manufacturer',
      'Status',
      'Condition',
      'Acquisition Cost (INR)',
      'Current Book Value (INR)',
      'Purchase Date',
      'Warranty Expiry',
      'Location',
      'Custodian',
      'Department'
    ];

    const rows = assets.map((a) => {
      const dep = this.calculateDepreciation(a);
      const costInr = ((a.acquisitionCost || 0) / 100).toFixed(2);
      const bookValInr = (dep.straightLine.currentBookValuePaise / 100).toFixed(2);

      return [
        this.sanitizeCsvValue(a.assetId),
        this.sanitizeCsvValue(a.name),
        this.sanitizeCsvValue(a.category?.name || ''),
        this.sanitizeCsvValue(a.serialNumber || 'N/A'),
        this.sanitizeCsvValue(a.model || 'N/A'),
        this.sanitizeCsvValue(a.manufacturer || 'N/A'),
        this.sanitizeCsvValue(a.status),
        this.sanitizeCsvValue(a.condition),
        this.sanitizeCsvValue(costInr),
        this.sanitizeCsvValue(bookValInr),
        this.sanitizeCsvValue(a.purchaseDate ? new Date(a.purchaseDate).toISOString().slice(0, 10) : ''),
        this.sanitizeCsvValue(a.warrantyExpiry ? new Date(a.warrantyExpiry).toISOString().slice(0, 10) : 'N/A'),
        this.sanitizeCsvValue(a.currentLocation ? `${a.currentLocation.building} - ${a.currentLocation.name}` : 'Central Store'),
        this.sanitizeCsvValue(a.assignedTo?.name || 'Unassigned'),
        this.sanitizeCsvValue(a.department || 'General')
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates sanitized CSV report data for Consumable Stock.
   */
  async exportStockCsv() {
    const items = await StockItem.find()
      .populate('category', 'name code')
      .populate('location', 'name building')
      .sort({ sku: 1 })
      .lean();

    const headers = [
      'SKU',
      'Item Name',
      'Category',
      'Current Quantity',
      'Unit Of Measure',
      'Reorder Threshold',
      'Unit Cost (INR)',
      'Stock Value (INR)',
      'Location',
      'Department',
      'Status'
    ];

    const rows = items.map((i) => {
      const unitCostInr = ((i.unitPrice || 0) / 100).toFixed(2);
      const stockValInr = (((i.currentQuantity || 0) * (i.unitPrice || 0)) / 100).toFixed(2);

      return [
        this.sanitizeCsvValue(i.sku),
        this.sanitizeCsvValue(i.name),
        this.sanitizeCsvValue(i.category?.name || ''),
        this.sanitizeCsvValue(i.currentQuantity),
        this.sanitizeCsvValue(i.unit),
        this.sanitizeCsvValue(i.reorderThreshold),
        this.sanitizeCsvValue(unitCostInr),
        this.sanitizeCsvValue(stockValInr),
        this.sanitizeCsvValue(i.location ? `${i.location.building} - ${i.location.name}` : ''),
        this.sanitizeCsvValue(i.department || 'Central Stores'),
        this.sanitizeCsvValue(i.isActive ? 'Active' : 'Inactive')
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

const inventoryService = new InventoryService();

module.exports = {
  inventoryService,
  uploadInventoryDocument,
  INVENTORY_UPLOADS
};
