/**
 * server/models/PlacementStageResult.js
 * Evaluator marks, attendance, and outcomes for candidate applicants at each interview stage.
 */
'use strict';

const mongoose = require('mongoose');

const correctionItemSchema = new mongoose.Schema(
  {
    previousOutcome: { type: String, required: true },
    newOutcome: { type: String, required: true },
    reason: { type: String, required: [true, 'Correction reason is mandatory'], trim: true },
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    correctedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const placementStageResultSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementApplication',
      required: [true, 'Application is required'],
      index: true,
    },
    stage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementSelectionStage',
      required: [true, 'Selection stage is required'],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    outcome: {
      type: String,
      enum: ['pending', 'cleared', 'not_cleared', 'on_hold', 'absent'],
      default: 'pending',
      index: true,
    },
    score: {
      type: Number,
      default: null,
      min: 0,
    },
    maxScore: {
      type: Number,
      default: null,
      min: 1,
    },
    internalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    studentFeedback: {
      type: String,
      default: '',
      trim: true,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
    correctionHistory: [correctionItemSchema],
  },
  {
    timestamps: true,
  }
);

// Enforce single result per application and stage
placementStageResultSchema.index({ application: 1, stage: 1 }, { unique: true });
placementStageResultSchema.index({ stage: 1, outcome: 1 });

module.exports = mongoose.model('PlacementStageResult', placementStageResultSchema);
