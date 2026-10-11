/**
 * server/models/Announcement.js
 * Campus-wide announcement created by admin or faculty.
 */
'use strict';

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
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
    /** Who this announcement is visible to */
    audience: {
      type: String,
      enum: ['all', 'student', 'faculty'],
      default: 'all',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
  },
  { timestamps: true }
);

announcementSchema.index({ audience: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
