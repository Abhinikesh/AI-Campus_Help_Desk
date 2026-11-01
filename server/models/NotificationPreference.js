/**
 * server/models/NotificationPreference.js
 * User notification preferences schema for controlling subscribed categories.
 */
'use strict';

const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
      index: true,
    },
    categories: {
      academic:       { type: Boolean, default: true },
      attendance:     { type: Boolean, default: true },
      examination:    { type: Boolean, default: true },
      assignment:     { type: Boolean, default: true },
      timetable:      { type: Boolean, default: true },
      announcement:   { type: Boolean, default: true },
      fee:            { type: Boolean, default: true },
      library:        { type: Boolean, default: true },
      hostel:         { type: Boolean, default: true },
      transport:      { type: Boolean, default: true },
      placement:      { type: Boolean, default: true },
      event:          { type: Boolean, default: true },
      inventory:      { type: Boolean, default: true },
      hr:             { type: Boolean, default: true },
      leave:          { type: Boolean, default: true },
      administrative: { type: Boolean, default: true },
      system:         { type: Boolean, default: true }, // Mandatory system notifications
    },
    channels: {
      inApp:          { type: Boolean, default: true },
      email:          { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);

