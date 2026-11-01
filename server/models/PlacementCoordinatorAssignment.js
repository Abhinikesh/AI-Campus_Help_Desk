/**
 * server/models/PlacementCoordinatorAssignment.js
 * Explicit drive-scoped assignment for student and faculty placement coordinators.
 */
'use strict';

const mongoose = require('mongoose');

const placementCoordinatorAssignmentSchema = new mongoose.Schema(
  {
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Coordinator user is required'],
      index: true,
    },
    drive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: [true, 'Placement drive is required'],
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roleInDrive: {
      type: String,
      enum: ['lead_coordinator', 'stage_coordinator', 'faculty_coordinator'],
      default: 'stage_coordinator',
    },
    status: {
      type: String,
      enum: ['active', 'relieved'],
      default: 'active',
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// One active assignment per coordinator per drive
placementCoordinatorAssignmentSchema.index({ coordinator: 1, drive: 1 }, { unique: true });

module.exports = mongoose.model(
  'PlacementCoordinatorAssignment',
  placementCoordinatorAssignmentSchema
);
