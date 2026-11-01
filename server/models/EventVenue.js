/**
 * server/models/EventVenue.js
 * Physical campus venue and facility directory for event hosting.
 */
'use strict';

const mongoose = require('mongoose');

const eventVenueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      maxlength: [120, 'Venue name cannot exceed 120 characters'],
    },
    code: {
      type: String,
      required: [true, 'Venue code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'auditorium',
        'seminar_hall',
        'classroom',
        'laboratory',
        'sports_ground',
        'conference_room',
        'open_air_theatre',
        'other',
      ],
      default: 'seminar_hall',
      index: true,
    },
    location: {
      type: String,
      required: [true, 'Venue location/building is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Venue capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    facilities: {
      type: [String],
      default: ['Projector', 'Sound System', 'Wi-Fi', 'Air Conditioning'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventVenue', eventVenueSchema);
