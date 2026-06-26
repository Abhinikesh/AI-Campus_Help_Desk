const mongoose = require('mongoose');
const driveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  filename: { type: String, required: true },
  subject: { type: String, required: true },
  category: {
    type: String,
    enum: ['notes', 'papers', 'assignments', 'manuals', 'syllabus'],
    default: 'notes'
  },
  semester: { type: String, default: 'Sem 4' },
  description: { type: String, default: '' },
  size: { type: Number, required: true },
  type: { type: String, default: 'PDF' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploaderName: { type: String },
  uploaderRole: { type: String },
  path: { type: String },
  shareCode: { type: String, unique: true },
  downloads: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('Drive', driveSchema);
