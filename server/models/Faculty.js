const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  day:       { type: String, required: true },
  startTime: { type: String, required: true },
  endTime:   { type: String, required: true },
  subject:   { type: String, required: true },
  code:      { type: String, required: true },
  room:      { type: String, required: true },
  batch:     { type: String, default: 'All' },
});

const facultySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  department: { type: String, default: '' },
  subjects: [{
    name:     { type: String, required: true },
    code:     { type: String, required: true },
    credits:  { type: Number, required: true },
    semester: { type: Number, required: true }
  }],
  employeeId: { type: String, default: '' },
  timetable:  [timetableSchema],
});

module.exports = mongoose.model('Faculty', facultySchema);
