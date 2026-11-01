/**
 * server/models/Notification.js
 * Centralized notification model for authenticated recipients across all ERP roles.
 */
'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      enum: [
        'academic',
        'attendance',
        'examination',
        'assignment',
        'timetable',
        'announcement',
        'fee',
        'library',
        'hostel',
        'transport',
        'placement',
        'administrative',
        'system',
      ],
      default: 'system',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    relatedEntityType: {
      type: String,
      trim: true,
      default: null,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetRoute: {
      type: String,
      trim: true,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      trim: true,
      default: 'CampusSphere',
    },
    actorRole: {
      type: String,
      trim: true,
      default: 'system',
    },
    eventId: {
      type: String,
      trim: true,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal user queries and idempotent event insertion
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } }
);

module.exports = mongoose.model('Notification', notificationSchema);

