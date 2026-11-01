/**
 * server/models/Assignment.js
 * Mongoose model for academic assignments created by faculty for specific classes/subjects.
 */
'use strict';

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
  },
  { _id: true, timestamps: true }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Assignment description/instructions are required'],
      trim: true,
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty creator is required'],
      index: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
      index: true,
    },
    section: {
      type: String,
      default: 'All',
      trim: true,
    },
    maximumMarks: {
      type: Number,
      required: [true, 'Maximum marks are required'],
      min: [1, 'Maximum marks must be at least 1'],
      max: [1000, 'Maximum marks cannot exceed 1000'],
      default: 100,
    },
    assignmentType: {
      type: String,
      enum: ['homework', 'lab', 'project', 'quiz', 'other'],
      default: 'homework',
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'archived'],
      default: 'draft',
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    latePolicy: {
      type: String,
      enum: ['none', 'allowed', 'grace_period'],
      default: 'allowed',
    },
    gracePeriodMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal querying
assignmentSchema.index({ subject: 1, semester: 1, status: 1 });
assignmentSchema.index({ faculty: 1, status: 1, createdAt: -1 });
assignmentSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);

