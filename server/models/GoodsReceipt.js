const mongoose = require('mongoose');

const goodsReceiptItemSchema = new mongoose.Schema({
  poItemId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
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
  orderedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  acceptedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  rejectedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  unitCostPaise: {
    type: Number,
    required: true,
    min: 0
  },
  serialNumbers: [{
    type: String,
    trim: true
  }],
  generatedAssets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }]
}, { _id: true });

const goodsReceiptSchema = new mongoose.Schema({
  grnNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true,
    index: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  destinationLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLocation',
    required: true
  },
  invoiceNumber: {
    type: String,
    trim: true,
    default: ''
  },
  invoiceDate: {
    type: Date
  },
  deliveryChallanNumber: {
    type: String,
    trim: true,
    default: ''
  },
  items: [goodsReceiptItemSchema],
  inspectionStatus: {
    type: String,
    enum: ['pending', 'passed', 'partial_rejection', 'rejected'],
    default: 'passed',
    index: true
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  inspectionNotes: {
    type: String,
    default: ''
  },
  documents: [{
    type: String
  }],
  remarks: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

goodsReceiptSchema.index({ receivedDate: -1 });

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
