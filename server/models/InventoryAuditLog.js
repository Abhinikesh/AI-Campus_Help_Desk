const mongoose = require('mongoose');

const inventoryAuditLogSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: [
      'Asset',
      'StockItem',
      'PurchaseRequest',
      'PurchaseOrder',
      'GoodsReceipt',
      'AssetMaintenance',
      'InventoryAudit',
      'InventoryCategory',
      'InventoryLocation',
      'Vendor'
    ],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

inventoryAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryAuditLog', inventoryAuditLogSchema);
