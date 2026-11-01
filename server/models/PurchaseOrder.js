const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['asset', 'consumable'],
    required: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryCategory',
    required: true
  },
  stockItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockItem',
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  unitPricePaise: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  taxPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  taxAmountPaise: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  purchaseRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequest',
    default: null,
    index: true
  },
  items: [purchaseOrderItemSchema],
  subtotalPaise: {
    type: Number,
    required: true,
    min: 0
  },
  taxTotalPaise: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  deliveryAddress: {
    building: { type: String, default: '' },
    room: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  expectedDeliveryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'issued', 'partially_received', 'fulfilled', 'cancelled'],
    default: 'draft',
    index: true
  },
  issuedAt: {
    type: Date
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  termsAndConditions: {
    type: String,
    default: ''
  },
  attachments: [{
    type: String
  }],
  cancellationReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);

