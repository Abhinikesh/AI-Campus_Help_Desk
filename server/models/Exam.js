/**
 * server/models/Exam.js
 * Comprehensive Examination and Assessment Schedule Model.
 */
'use strict';

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Examination title is required'],
      trim: true,
    },
    examinationType: {
      type: String,
      enum: [
        'mid_semester',
        'end_semester',
        'internal_assessment',
        'practical',
        'laboratory',
        'quiz',
        'class_test',
        'other',
      ],
      default: 'mid_semester',
      required: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      default: 'CSE',
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      default: 'All',
      trim: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned faculty is required'],
    },
    date: {
      type: Date,
      required: [true, 'Examination date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [15, 'Duration must be at least 15 minutes'],
      default: 180,
    },
    maximumMarks: {
      type: Number,
      required: [true, 'Maximum marks are required'],
      min: [1, 'Maximum marks must be positive'],
      default: 100,
    },
    passingMarks: {
      type: Number,
      required: [true, 'Passing marks are required'],
      min: [0, 'Passing marks cannot be negative'],
      default: 40,
    },
    room: {
      type: String,
      default: 'TBA',
      trim: true,
    },
    venue: {
      type: String,
      default: 'Main Campus Examination Hall',
      trim: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled', 'archived'],
      default: 'scheduled',
      index: true,
    },
    evaluationStatus: {
      type: String,
      enum: [
        'marks_pending',
        'submitted_for_review',
        'approved',
        'published',
        'correction_requested',
      ],
      default: 'marks_pending',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for high-performance scheduling and roster filtering
examSchema.index({ department: 1, semester: 1, status: 1 });
examSchema.index({ faculty: 1, status: 1 });
examSchema.index({ subject: 1, date: 1 });
examSchema.index({ date: 1, room: 1 });

module.exports = mongoose.model('Exam', examSchema);
