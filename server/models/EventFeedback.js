/**
 * server/models/EventFeedback.js
 * Post-event feedback and ratings submitted by verified participants.
 */
'use strict';

const mongoose = require('mongoose');

const eventFeedbackSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusEvent',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    ratings: {
      overall: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      organization: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      venue: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      content: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
    },
    comments: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One feedback per student per event
eventFeedbackSchema.index({ event: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('EventFeedback', eventFeedbackSchema);

