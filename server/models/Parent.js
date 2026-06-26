const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  studentRollNumber: {
    type: String,
    required: true,
  },
  relation: {
    type: String,
    default: 'Parent',
  }
});

module.exports = mongoose.model('Parent', parentSchema);
