/**
 * server/models/EmployeeTrainingRecord.js
 * Professional development, certifications, and compliance training tracking.
 */
'use strict';

const mongoose = require('mongoose');

const employeeTrainingRecordSchema = new mongoose.Schema(
  {
    trainingNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: [
        'pedagogy',
        'technical_skill',
        'compliance',
        'leadership',
        'safety',
        'soft_skills',
        'research_workshop',
        'other'
      ],
      default: 'technical_skill',
      index: true
    },
    organizer: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    durationHours: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'completed',
      index: true
    },
    completionCertificateUrl: {
      type: String,
      trim: true,
      default: ''
    },
    scoreOrGrade: {
      type: String,
      trim: true,
      default: ''
    },
    feedback: {
      type: String,
      trim: true,
      default: ''
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

employeeTrainingRecordSchema.index({ employee: 1, startDate: -1 });

module.exports =
  mongoose.models.EmployeeTrainingRecord || mongoose.model('EmployeeTrainingRecord', employeeTrainingRecordSchema);
