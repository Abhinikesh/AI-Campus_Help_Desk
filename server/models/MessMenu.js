/**
 * server/models/MessMenu.js
 * Configurable weekly mess dining schedule per hostel.
 */
'use strict';

const mongoose = require('mongoose');

const mealDetailsSchema = new mongoose.Schema(
  {
    time: { type: String, default: '' },
    items: [{ type: String, trim: true }],
  },
  { _id: false }
);

const messMenuSchema = new mongoose.Schema(
  {
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: [true, 'Day of week is required'],
    },
    breakfast: {
      type: mealDetailsSchema,
      default: () => ({ time: '07:30 - 09:30 AM', items: [] }),
    },
    lunch: {
      type: mealDetailsSchema,
      default: () => ({ time: '12:30 - 02:30 PM', items: [] }),
    },
    snacks: {
      type: mealDetailsSchema,
      default: () => ({ time: '05:00 - 06:00 PM', items: [] }),
    },
    dinner: {
      type: mealDetailsSchema,
      default: () => ({ time: '08:00 - 10:00 PM', items: [] }),
    },
    specialNotes: {
      type: String,
      default: '',
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

messMenuSchema.index({ hostel: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('MessMenu', messMenuSchema);

