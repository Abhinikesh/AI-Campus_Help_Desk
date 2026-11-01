/**
 * server/models/EmployeeProfile.js
 * Canonical master employee record for teaching and non-teaching personnel.
 */
'use strict';

const mongoose = require('mongoose');

const qualificationSchema = new mongoose.Schema(
  {
    degree: { type: String, required: true, trim: true },
    field: { type: String, default: '', trim: true },
    institution: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
  },
  { _id: true }
);

const employeeProfileSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Linked User account is required'],
      unique: true,
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    officialEmail: {
      type: String,
      required: [true, 'Official email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      select: false, // confidential HR field
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    emergencyContact: {
      name: { type: String, default: '' },
      relationship: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    employeeCategory: {
      type: String,
      enum: [
        'teaching_faculty',
        'non_teaching_staff',
        'administrative_staff',
        'technical_staff',
        'support_staff',
        'contract_employee',
        'visiting_faculty',
      ],
      required: [true, 'Employee category is required'],
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
      required: [true, 'Designation is required'],
      index: true,
    },
    employmentType: {
      type: String,
      enum: ['permanent', 'probation', 'contract', 'visiting', 'part_time', 'intern'],
      default: 'permanent',
      index: true,
    },
    employmentStatus: {
      type: String,
      enum: [
        'draft',
        'pending_verification',
        'active',
        'probation',
        'confirmed',
        'contract',
        'suspended',
        'resigned',
        'retired',
        'terminated',
        'inactive',
      ],
      default: 'draft',
      index: true,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    confirmationDate: {
      type: Date,
      default: null,
    },
    contractEndDate: {
      type: Date,
      default: null,
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    workLocation: {
      type: String,
      default: 'Main Campus',
      trim: true,
    },
    qualifications: [qualificationSchema],
    onboardingStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'verified', 'completed'],
      default: 'pending',
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    separationDetails: {
      date: { type: Date, default: null },
      reason: { type: String, default: '' },
      separationType: { type: String, default: '' },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true }
);

employeeProfileSchema.index({ department: 1, employmentStatus: 1 });
employeeProfileSchema.index({ firstName: 'text', lastName: 'text', officialEmail: 'text', employeeId: 'text' });

module.exports = mongoose.model('EmployeeProfile', employeeProfileSchema);

