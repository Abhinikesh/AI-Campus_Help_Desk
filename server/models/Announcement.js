const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
  },
  body: {
    type: String,
    required: [true, 'Announcement body is required'],
    trim: true,
  },
  // Which roles can see this announcement
  targetRoles: {
    type: [String],
    enum: ['student', 'faculty', 'parent', 'admission', 'admin'],
    default: ['student', 'faculty', 'parent', 'admission', 'admin'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Announcement', announcementSchema);
