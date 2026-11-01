/**
 * server/models/Announcement.js
 * Campus-wide announcement created by admin or faculty with audience targeting.
 */
'use strict';

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Announcement body is required'],
      trim: true,
      maxlength: [5000, 'Body cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      enum: ['academic', 'administrative', 'event', 'urgent', 'general'],
      default: 'general',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    /** Target audience scope */
    audience: {
      type: String,
      enum: ['all', 'student', 'faculty', 'department', 'semester'],
      default: 'all',
      index: true,
    },
    targetBranches: {
      type: [String],
      default: [],
    },
    targetSemesters: {
      type: [Number],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    authorName: {
      type: String,
      trim: true,
      default: 'Campus Administration',
    },
    authorRole: {
      type: String,
      trim: true,
      default: 'admin',
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias: 'content' maps to 'body' for API consistency
announcementSchema.virtual('content').get(function () {
  return this.body;
});

// Compound indexes for optimal queries
announcementSchema.index({ audience: 1, status: 1, publishedAt: -1 });
announcementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
