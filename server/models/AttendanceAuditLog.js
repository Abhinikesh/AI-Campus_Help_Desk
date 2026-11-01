/**
 * server/models/AttendanceAuditLog.js
 * Append-only immutable log for all attendance sessions, corrections, and biometric operations.
 */
'use strict';

const mongoose = require('mongoose');

const attendanceAuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'create_session',
        'start_session',
        'pause_session',
        'resume_session',
        'close_session',
        'auto_expire_session',
        'finalize_session',
        'cancel_session',
        'mark_attendance',
        'manual_correction',
        'enroll_biometric',
        'revoke_biometric',
        'delete_biometric',
        'settings_update',
      ],
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      default: null,
    },
    affectedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Indexes for fast administrative querying
attendanceAuditLogSchema.index({ sessionId: 1, timestamp: -1 });
attendanceAuditLogSchema.index({ affectedStudentId: 1, timestamp: -1 });
attendanceAuditLogSchema.index({ actorId: 1, timestamp: -1 });
attendanceAuditLogSchema.index({ action: 1, timestamp: -1 });

const AttendanceAuditLog = mongoose.model('AttendanceAuditLog', attendanceAuditLogSchema);

// Static helper to record audit events safely
AttendanceAuditLog.record = async function (params) {
  try {
    return await this.create({
      actorId: params.actorId,
      actorRole: params.actorRole || 'system',
      action: params.action,
      attendanceId: params.attendanceId || null,
      sessionId: params.sessionId || null,
      affectedStudentId: params.affectedStudentId || null,
      previousValue: params.previousValue || null,
      newValue: params.newValue || null,
      reason: params.reason || '',
      ipAddress: params.ipAddress || '',
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('AuditLog.record error:', err.message);
    return null;
  }
};

module.exports = AttendanceAuditLog;
