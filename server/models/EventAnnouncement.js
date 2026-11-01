/**
 * server/models/EventAnnouncement.js
 * Targeted campus announcements for events and student clubs.
 */
'use strict';

const mongoose = require('mongoose');

const eventAnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
      trim: true,
      maxlength: [2500, 'Content cannot exceed 2500 characters'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
      default: null,
      index: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentClub',
      default: null,
      index: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'students', 'faculty', 'department', 'club_members', 'registered_participants'],
      default: 'all',
      index: true,
    },
    department: {
      type: String,
      default: 'ALL',
      trim: true,
    },
    publishDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventAnnouncement', eventAnnouncementSchema);

