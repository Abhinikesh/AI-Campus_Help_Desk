/**
 * server/models/Exam.js
 * Exam schedule entry.
 */
'use strict';

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    title: {
      type: String,
      enum: ['mid-sem', 'end-sem', 'lab', 'other'],
      required: [true, 'Exam title/type is required'],
    },
    date: {
      type: Date,
      required: [true, 'Exam date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
    },
    room: {
      type: String,
      default: 'TBA',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);
