/**
 * server/models/CampusEvent.js
 * Centralized campus event model for college fests, workshops, seminars, and activities.
 */
'use strict';

const mongoose = require('mongoose');

const campusEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    eventCode: {
      type: String,
      required: [true, 'Event code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    category: {
      type: String,
      enum: [
        'technical',
        'cultural',
        'sports',
        'academic',
        'workshop',
        'seminar',
        'conference',
        'competition',
        'orientation',
        'community_service',
        'other',
      ],
      required: [true, 'Event category is required'],
      index: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer user reference is required'],
      index: true,
    },
    organizerRole: {
      type: String,
      enum: ['admin', 'faculty', 'event_organizer', 'club_coordinator'],
      default: 'faculty',
    },
    facultyCoordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
      index: true,
    },
    studentCoordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentClub',
      default: null,
      index: true,
    },
    location: {
      type: String,
      default: 'Main Campus',
      trim: true,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventVenue',
      default: null,
      index: true,
    },
    venueName: {
      type: String,
      default: '',
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    registrationOpeningDate: {
      type: Date,
      required: [true, 'Registration opening date is required'],
    },
    registrationClosingDate: {
      type: Date,
      required: [true, 'Registration closing date is required'],
      index: true,
    },
    maxParticipants: {
      type: Number,
      required: [true, 'Maximum participants limit is required'],
      min: [1, 'Maximum participants must be at least 1'],
      default: 100,
    },
    allocatedParticipantsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitlistCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isWaitlistEnabled: {
      type: Boolean,
      default: true,
    },
    waitlistCapacity: {
      type: Number,
      default: 50,
      min: 0,
    },
    eligibilityCriteria: {
      allowedBranches: {
        type: [String],
        default: [], // empty = open to all branches
      },
      allowedSemesters: {
        type: [Number],
        default: [], // empty = open to all semesters
      },
      allowedBatches: {
        type: [Number],
        default: [], // empty = open to all batches
      },
      clubMembershipRequired: {
        type: Boolean,
        default: false,
      },
    },
    targetAudience: {
      type: String,
      enum: ['all', 'students', 'faculty', 'department', 'club_only'],
      default: 'students',
      index: true,
    },
    targetDepartment: {
      type: String,
      default: 'ALL',
      trim: true,
    },
    registrationType: {
      type: String,
      enum: ['individual', 'team', 'open_walkin'],
      default: 'individual',
    },
    maxTeamSize: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'approved',
        'published',
        'registration_open',
        'registration_closed',
        'ongoing',
        'completed',
        'cancelled',
        'archived',
      ],
      default: 'draft',
      index: true,
    },
    bannerUrl: {
      type: String,
      default: '',
      trim: true,
    },
    supportingDocs: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    calendarEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicCalendarEvent',
      default: null,
    },
    approvalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    feedbackSummary: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Compound indexes for discovery and status tracking
campusEventSchema.index({ status: 1, startDate: 1 });
campusEventSchema.index({ category: 1, status: 1 });
campusEventSchema.index({ targetAudience: 1, targetDepartment: 1, status: 1 });
campusEventSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('CampusEvent', campusEventSchema);

