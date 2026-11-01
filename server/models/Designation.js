/**
 * server/models/Designation.js
 * Standardized institutional job designations and reporting hierarchy.
 */
'use strict';

const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Designation name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Designation code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
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
      default: 'teaching_faculty',
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    reportingLevel: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Designation', designationSchema);
