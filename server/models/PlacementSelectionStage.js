/**
 * server/models/PlacementSelectionStage.js
 * Sequential selection rounds (Aptitude, Coding, Technical, HR) for a recruitment drive.
 */
'use strict';

const mongoose = require('mongoose');

const placementSelectionStageSchema = new mongoose.Schema(
  {
    drive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: [true, 'Placement drive is required'],
      index: true,
    },
    stageName: {
      type: String,
      required: [true, 'Stage name is required'],
      trim: true,
    },
    stageType: {
      type: String,
      enum: [
        'resume_screening',
        'online_assessment',
        'technical_interview',
        'coding_interview',
        'group_discussion',
        'hr_interview',
        'final_selection',
      ],
      default: 'technical_interview',
    },
    sequence: {
      type: Number,
      required: [true, 'Sequence order is required'],
      min: 1,
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    scheduledTime: {
      type: String,
      default: null,
    },
    venueOrLink: {
      type: String,
      default: '',
      trim: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique stage sequence per drive
placementSelectionStageSchema.index({ drive: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('PlacementSelectionStage', placementSelectionStageSchema);
