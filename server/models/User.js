/**
 * server/models/User.js
 * Core user document for all three roles: student | faculty | admin
 */
'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    /** Unique login identifier: roll number (student), employee ID (faculty), admin-style ID */
    loginId: {
      type: String,
      required: [true, 'Login ID is required'],
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: [
        'student',
        'faculty',
        'admin',
        'librarian',
        'warden',
        'transport_manager',
        'driver',
        'attendant',
        'placement_officer',
        'placement_coordinator',
        'event_organizer',
        'club_coordinator',
        'inventory_manager',
        'procurement_officer',
        'storekeeper',
      ],
      required: [true, 'Role is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound text index for admin search
userSchema.index({ name: 'text', email: 'text', loginId: 'text' });

module.exports = mongoose.model('User', userSchema);
