/**
 * server/models/PlacementDrive.js
 * Coordinated campus recruitment drives linking companies, opportunities, and selection schedules.
 */
'use strict';

const mongoose = require('mongoose');

const placementDriveSchema = new mongoose.Schema(
  {
    driveCode: {
      type: String,
      required: [true, 'Drive code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    driveName: {
      type: String,
      required: [true, 'Drive name is required'],
      trim: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
      index: true,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementOpportunity',
      required: [true, 'Opportunity reference is required'],
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    registrationStartDate: {
      type: Date,
      required: [true, 'Registration start date is required'],
    },
    registrationEndDate: {
      type: Date,
      required: [true, 'Registration end date is required'],
      index: true,
    },
    prePlacementTalkDate: {
      type: Date,
      default: null,
    },
    assessmentDate: {
      type: Date,
      default: null,
    },
    interviewStartDate: {
      type: Date,
      default: null,
    },
    venue: {
      type: String,
      default: 'Campus Placement Cell / Virtual',
      trim: true,
    },
    coordinators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: [
        'draft',
        'scheduled',
        'registration_open',
        'registration_closed',
        'ongoing',
        'completed',
        'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    calendarEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicCalendarEvent',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

placementDriveSchema.index({ company: 1, status: 1 });
placementDriveSchema.index({ coordinators: 1 });

module.exports = mongoose.model('PlacementDrive', placementDriveSchema);

