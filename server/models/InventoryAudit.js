const mongoose = require('mongoose');

const inventoryAuditSchema = new mongoose.Schema({
  auditNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  auditType: {
    type: String,
    enum: ['full_campus', 'departmental', 'location_specific', 'category_specific', 'surprise'],
    default: 'departmental',
    index: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLocation',
    default: null
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryCategory',
    default: null
  },
  plannedDate: {
    type: Date,
    required: true
  },
  startDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  leadAuditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  auditTeam: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'reconciled', 'cancelled'],
    default: 'draft',
    index: true
  },
  summary: {
    totalItemsAudited: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    discrepancyCount: { type: Number, default: 0 },
    surplusCount: { type: Number, default: 0 },
    deficitCount: { type: Number, default: 0 },
    damagedCount: { type: Number, default: 0 },
    netDiscrepancyValuePaise: { type: Number, default: 0 }
  },
  remarks: {
    type: String,
    default: ''
  },
  reconciledAt: {
    type: Date
  },
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

inventoryAuditSchema.index({ status: 1, plannedDate: -1 });

module.exports = mongoose.model('InventoryAudit', inventoryAuditSchema);

