/**
 * server/services/qrChallenge.service.js
 * Cryptographically secure rotating QR challenge token generator & validator.
 * Provides short-lived challenge tokens with session binding and replay mitigation.
 */
'use strict';

const crypto = require('crypto');
const { JWT_SECRET } = require('../config/env');
const ApiError = require('../utils/ApiError');

// Derive an HMAC signing key from JWT_SECRET or internal secret
const QR_SIGNING_SECRET = crypto.createHash('sha256').update(JWT_SECRET || 'campussphere-qr-secret-key-2026').digest();
const DEFAULT_EXPIRY_SECONDS = 45;

class QrChallengeService {
  /**
   * Generate a tamper-proof, timestamped rotating challenge token for a session.
   * Format: <timestamp_hex>.<random_hex>.<hmac_signature_hex>
   *
   * @param {string|ObjectId} sessionId
   * @param {number} [validitySeconds=45]
   * @returns {{ token: string, expiresAt: Date, expiresInSeconds: number }}
   */
  generateChallenge(sessionId, validitySeconds = DEFAULT_EXPIRY_SECONDS) {
    const sId = sessionId.toString();
    const now = Date.now();
    const expiresAt = new Date(now + validitySeconds * 1000);

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestampHex = now.toString(16);
    const payload = `${sId}:${timestampHex}:${nonce}`;

    const signature = crypto
      .createHmac('sha256', QR_SIGNING_SECRET)
      .update(payload)
      .digest('hex');

    const token = `${timestampHex}.${nonce}.${signature}`;

    return {
      token,
      expiresAt,
      expiresInSeconds: validitySeconds,
    };
  }

  /**
   * Validate a submitted QR challenge token against session and expiry.
   *
   * @param {Object} session AttendanceSession document
   * @param {string} token Submitted challenge token string
   * @param {Date} [now=new Date()] Injectable clock for testability
   * @returns {boolean} True if valid, throws ApiError otherwise
   */
  validateChallenge(session, token, now = new Date()) {
    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'QR challenge token is missing or malformed');
    }

    if (!session || !['open', 'active'].includes(session.status)) {
      throw new ApiError(400, 'QR challenge cannot be validated for an inactive or closed session');
    }

    const sId = (session._id || session.id).toString();

    // 1. Direct match with current session challenge if stored
    if (session.qrChallengeToken && session.qrChallengeToken === token) {
      if (session.qrChallengeExpiresAt && now > new Date(session.qrChallengeExpiresAt)) {
        throw new ApiError(400, 'QR code has expired. Please scan the newly generated code.');
      }
      return true;
    }

    // 2. Cryptographic signature and timestamp verification
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new ApiError(400, 'Invalid QR code token format');
    }

    const [timestampHex, nonce, signature] = parts;
    const createdAtMs = parseInt(timestampHex, 16);
    if (isNaN(createdAtMs)) {
      throw new ApiError(400, 'Malformed QR code token timestamp');
    }

    // Verify HMAC signature
    const payload = `${sId}:${timestampHex}:${nonce}`;
    const expectedSig = crypto
      .createHmac('sha256', QR_SIGNING_SECRET)
      .update(payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new ApiError(400, 'Invalid QR code signature or token belongs to a different session');
    }

    // Verify expiration (45 seconds + 5 seconds clock drift allowance)
    const tokenExpiresAtMs = createdAtMs + (DEFAULT_EXPIRY_SECONDS + 5) * 1000;
    if (now.getTime() > tokenExpiresAtMs) {
      throw new ApiError(400, 'QR code has expired. Please scan the current code.');
    }

    return true;
  }
}

const qrChallengeService = new QrChallengeService();
module.exports = qrChallengeService;

