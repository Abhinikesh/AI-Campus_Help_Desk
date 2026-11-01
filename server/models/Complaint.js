/**
 * server/models/Complaint.js
 * Campus complaint raised by student or faculty.
 */
'use strict';

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Complaint must have a raiser'],
    },
    category: {
      type: String,
      enum: ['academic', 'admin', 'hostel', 'infrastructure', 'other'],
      required: [true, 'Category is required'],
    },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'resolved', 'closed', 'rejected'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelRoom',
      default: null,
    },
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelBed',
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminResponse: {
      type: String,
      default: '',
      trim: true,
    },
    closureNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

complaintSchema.index({ raisedBy: 1 });
complaintSchema.index({ status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
