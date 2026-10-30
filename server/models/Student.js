/**
 * server/models/Student.js
 * Student profile — linked to User via ref.
 */
'use strict';

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    branch: {
      type: String,
      default: '',
      trim: true,
    },
    program: {
      type: String,
      default: 'B.Tech',
      trim: true,
    },
    semester: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    admissionYear: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    guardianName: {
      type: String,
      default: '',
      trim: true,
    },
    guardianPhone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'alumni', 'suspended', 'withdrawn'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Text index for admin search
studentSchema.index({ fullName: 'text', rollNumber: 'text', email: 'text', phone: 'text' });

// Standard lookup indexes
studentSchema.index({ phone: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ branch: 1, semester: 1 });

module.exports = mongoose.model('Student', studentSchema);
