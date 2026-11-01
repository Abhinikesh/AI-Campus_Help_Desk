/**
 * server/models/StudentClub.js
 * Student societies and clubs directory.
 */
'use strict';

const mongoose = require('mongoose');

const studentClubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Club name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Club code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Club description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      enum: [
        'technical',
        'robotics',
        'ai_ml',
        'entrepreneurship',
        'cultural',
        'music_arts',
        'photography',
        'sports',
        'social_service',
        'literary',
        'other',
      ],
      required: [true, 'Club category is required'],
      index: true,
    },
    facultyAdvisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
      index: true,
    },
    studentPresident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    studentCoordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    membershipCapacity: {
      type: Number,
      default: 200,
      min: [1, 'Capacity must be at least 1'],
    },
    activeMembersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    meetingSchedule: {
      type: String,
      default: 'Every Wednesday 4:00 PM',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

studentClubSchema.index({ category: 1, isActive: 1 });
studentClubSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('StudentClub', studentClubSchema);

