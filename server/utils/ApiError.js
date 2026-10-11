/**
 * server/utils/ApiError.js
 * Operational error class for known HTTP errors.
 * The central error handler distinguishes ApiError from unexpected crashes.
 */
'use strict';

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (e.g. 400, 401, 404)
   * @param {string} message     Human-readable message sent to the client
   */
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;  // distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
