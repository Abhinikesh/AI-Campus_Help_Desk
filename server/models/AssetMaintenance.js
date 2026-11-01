const mongoose = require('mongoose');

const maintenancePartSchema = new mongoose.Schema({
  partName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  costPaise: {
    type: Number,
    required: true,
    min: 0
  },
  stockItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockItem',
    default: null
  }
}, { _id: true });

const assetMaintenanceSchema = new mongoose.Schema({
  maintenanceNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['preventative', 'corrective', 'calibration', 'upgrade', 'inspection'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  startDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  serviceProvider: {
    type: String,
    enum: ['in_house', 'vendor', 'oem'],
    default: 'in_house'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  technicianName: {
    type: String,
    trim: true,
    default: ''
  },
  technicianContact: {
    type: String,
    trim: true,
    default: ''
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  costPaise: {
    type: Number,
    default: 0,
    min: 0
  },
  isUnderWarranty: {
    type: Boolean,
    default: false
  },
  partsReplaced: [maintenancePartSchema],
  resolutionNotes: {
    type: String,
    default: ''
  },
  documents: [{
    type: String
  }]
}, {
  timestamps: true
});

assetMaintenanceSchema.index({ asset: 1, status: 1 });
assetMaintenanceSchema.index({ scheduledDate: -1 });

module.exports = mongoose.model('AssetMaintenance', assetMaintenanceSchema);
