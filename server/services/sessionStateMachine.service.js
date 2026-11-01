/**
 * server/services/sessionStateMachine.service.js
 * Authoritative state-machine service for Smart Attendance Sessions.
 * Enforces atomic conditional transitions, RBAC authorization, and append-only audit logging.
 */
'use strict';

const AttendanceSession = require('../models/AttendanceSession');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const ApiError = require('../utils/ApiError');

const ALLOWED_TRANSITIONS = {
  scheduled: ['open', 'active', 'cancelled'],
  open: ['active', 'paused', 'closed', 'completed', 'finalized', 'cancelled', 'expired'],
  active: ['paused', 'closed', 'completed', 'finalized', 'cancelled', 'expired'],
  paused: ['open', 'active', 'closed', 'completed', 'cancelled', 'expired'],
  closed: ['finalized', 'cancelled'],
  completed: ['finalized', 'cancelled'],
  expired: ['closed', 'completed', 'finalized', 'cancelled'],
  finalized: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Perform an atomic, conditional state transition on an AttendanceSession.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.sessionId
 * @param {string} params.targetState
 * @param {string|ObjectId} params.actorId
 * @param {string} params.actorRole
 * @param {string} [params.reason]
 * @param {string} [params.ipAddress]
 * @param {Object} [params.extraFields]
 * @returns {Promise<Document>} The updated AttendanceSession document
 */
async function transitionSessionState({
  sessionId,
  targetState,
  actorId,
  actorRole,
  reason = '',
  ipAddress = '',
  extraFields = {}
}) {
  const session = await AttendanceSession.findById(sessionId);
  if (!session) {
    throw new ApiError(404, 'Attendance session not found');
  }

  // 1. Authorization check: only assigned faculty or admin
  if (actorRole === 'faculty') {
    const facultyId = session.faculty?._id ? session.faculty._id.toString() : session.faculty.toString();
    if (facultyId !== actorId.toString()) {
      throw new ApiError(403, 'Unauthorized: You can only control your own attendance sessions');
    }
  } else if (actorRole !== 'admin' && actorRole !== 'system') {
    throw new ApiError(403, 'Unauthorized: Insufficient role permissions for session lifecycle actions');
  }

  const currentStatus = session.status || 'open';

  // 2. Idempotency: If already in targetState, return without error
  if (currentStatus === targetState) {
    return session;
  }

  // 3. State transition validity check
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetState)) {
    throw new ApiError(
      400,
      `Invalid session state transition from '${currentStatus}' to '${targetState}'. Permitted transitions: [${allowed.join(', ')}]`
    );
  }

  // 4. Construct atomic update payload
  const now = new Date();
  const updatePayload = {
    status: targetState,
    sessionStatus: targetState,
    ...extraFields
  };

  if (targetState === 'open' || targetState === 'active') {
    if (!session.openedAt) updatePayload.openedAt = now;
    if (!session.actualStartTime) updatePayload.actualStartTime = now;
  } else if (targetState === 'closed' || targetState === 'completed') {
    if (!session.closedAt) updatePayload.closedAt = now;
    if (!session.actualEndTime) updatePayload.actualEndTime = now;
  } else if (targetState === 'finalized') {
    if (!session.finalizedAt) updatePayload.finalizedAt = now;
    if (!session.closedAt) updatePayload.closedAt = now;
    if (!session.actualEndTime) updatePayload.actualEndTime = now;
  }

  // 5. Execute conditional atomic update to prevent concurrent race conditions
  const updatedSession = await AttendanceSession.findOneAndUpdate(
    { _id: sessionId, status: currentStatus },
    { $set: updatePayload },
    { new: true }
  );

  if (!updatedSession) {
    // Another concurrent request changed the status in between
    throw new ApiError(
      409,
      `Concurrent session state transition conflict. The session status changed while processing.`
    );
  }

  // 6. Record append-only audit log
  let auditAction = `${targetState}_session`;
  if (targetState === 'open' || targetState === 'active') auditAction = 'start_session';
  if (targetState === 'paused') auditAction = 'pause_session';
  if (targetState === 'completed' || targetState === 'closed') auditAction = 'close_session';
  if (targetState === 'finalized') auditAction = 'finalize_session';
  if (targetState === 'cancelled') auditAction = 'cancel_session';
  if (targetState === 'expired') auditAction = 'auto_expire_session';

  await AttendanceAuditLog.record({
    actorId,
    actorRole,
    action: auditAction,
    sessionId: updatedSession._id,
    previousValue: { status: currentStatus },
    newValue: { status: targetState, ...extraFields },
    reason: reason || `Session transitioned from '${currentStatus}' to '${targetState}'`,
    ipAddress
  });

  return updatedSession;
}

module.exports = {
  ALLOWED_TRANSITIONS,
  transitionSessionState,
};
