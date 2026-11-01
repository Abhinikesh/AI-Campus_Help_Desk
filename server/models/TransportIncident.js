/**
 * server/models/TransportIncident.js
 * Transport route safety, breakdown, delay, and conduct incident reports.
 */
'use strict';

const mongoose = require('mongoose');

const transportIncidentSchema = new mongoose.Schema(
  {
    incidentNumber: {
      type: String,
      required: [true, 'Incident number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    incidentDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      required: [true, 'Route reference is required'],
      index: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportVehicle',
      default: null,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporting user is required'],
      index: true,
    },
    category: {
      type: String,
      enum: [
        'breakdown',
        'traffic_delay',
        'accident',
        'driver_conduct',
        'student_behavior',
        'route_obstruction',
        'safety_hazard',
        'other',
      ],
      required: [true, 'Incident category is required'],
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
      trim: true,
    },
    actionTaken: {
      type: String,
      default: '',
      trim: true,
    },
    resolutionStatus: {
      type: String,
      enum: ['reported', 'investigating', 'action_taken', 'resolved', 'closed'],
      default: 'reported',
      index: true,
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TransportIncident', transportIncidentSchema);

