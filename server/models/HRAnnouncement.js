/**
 * server/models/HRAnnouncement.js
 * Centralized announcements and circulars for employees and faculty.
 */
'use strict';

const mongoose = require('mongoose');

const hrAnnouncementSchema = new mongoose.Schema(
  {
    announcementNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    targetAudience: {
      type: String,
      enum: ['all', 'teaching_faculty', 'non_teaching', 'administrative', 'department_specific'],
      default: 'all',
      index: true
    },
    targetDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    publishDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiryDate: {
      type: Date,
      default: null
    },
    attachments: [
      {
        title: { type: String, trim: true },
        fileName: { type: String },
        filePath: { type: String },
        mimeType: { type: String },
        fileSize: { type: Number }
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    acknowledgedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

hrAnnouncementSchema.index({ isActive: 1, publishDate: -1 });

module.exports = mongoose.models.HRAnnouncement || mongoose.model('HRAnnouncement', hrAnnouncementSchema);
