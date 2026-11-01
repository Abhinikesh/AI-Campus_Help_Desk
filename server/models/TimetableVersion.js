/**
 * server/models/TimetableVersion.js
 * Tracks immutable snapshots of published timetable versions for auditing and governance.
 */
'use strict';

const mongoose = require('mongoose');

const timetableVersionSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    entryCount: {
      type: Number,
      default: 0,
    },
    entriesSnapshot: [
      {
        timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        subjectCode: String,
        subjectName: String,
        facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        facultyName: String,
        dayOfWeek: Number,
        dayName: String,
        period: Number,
        startTime: String,
        endTime: String,
        room: String,
        sessionType: String,
      },
    ],
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

timetableVersionSchema.index(
  { academicYear: 1, department: 1, semester: 1, section: 1, versionNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('TimetableVersion', timetableVersionSchema);

