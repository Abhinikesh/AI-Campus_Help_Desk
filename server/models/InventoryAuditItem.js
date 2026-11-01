const mongoose = require('mongoose');

const inventoryAuditItemSchema = new mongoose.Schema({
  audit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryAudit',
    required: true,
    index: true
  },
  itemType: {
    type: String,
    enum: ['asset', 'consumable'],
    required: true
  },
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    default: null
  },
  stockItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockItem',
    default: null
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLocation',
    required: true
  },
  expectedQuantity: {
    type: Number,
    required: true,
    default: 1
  },
  countedQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  variance: {
    type: Number,
    default: 0
  },
  expectedCondition: {
    type: String,
    enum: ['new', 'good', 'fair', 'poor', 'damaged', 'obsolete']
  },
  countedCondition: {
    type: String,
    enum: ['new', 'good', 'fair', 'poor', 'damaged', 'obsolete']
  },
  status: {
    type: String,
    enum: ['pending', 'matched', 'discrepancy', 'reconciled'],
    default: 'pending',
    index: true
  },
  reconciliationAction: {
    type: String,
    enum: ['none', 'stock_adjusted', 'asset_updated', 'written_off', 'investigation_pending'],
    default: 'none'
  },
  remarks: {
    type: String,
    default: ''
  },
  auditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

inventoryAuditItemSchema.index({ audit: 1, itemType: 1 });
inventoryAuditItemSchema.index({ audit: 1, status: 1 });

module.exports = mongoose.model('InventoryAuditItem', inventoryAuditItemSchema);
