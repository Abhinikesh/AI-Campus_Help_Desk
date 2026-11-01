/**
 * server/models/EventAuditLog.js
 * Immutable audit trail for events, clubs, registrations, and certificate operations.
 */
'use strict';

const mongoose = require('mongoose');

const eventAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetEntity: {
      type: String,
      required: true,
      enum: [
        'CampusEvent',
        'EventApproval',
        'StudentClub',
        'ClubMembership',
        'EventRegistration',
        'EventVenue',
        'EventVenueBooking',
        'EventAttendance',
        'EventCertificate',
        'EventFeedback',
        'EventAnnouncement',
      ],
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('EventAuditLog', eventAuditLogSchema);

