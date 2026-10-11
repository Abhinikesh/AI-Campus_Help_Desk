/**
 * server/models/Timetable.js
 * Weekly timetable entry for a subject.
 */
'use strict';

const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
    },
    room: {
      type: String,
      default: 'TBA',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Timetable', timetableSchema);
