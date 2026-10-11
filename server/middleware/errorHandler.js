/**
 * server/middleware/errorHandler.js
 * Central Express error-handling middleware.
 * Must be registered LAST in server.js (after all routes).
 *
 * - Operational errors (ApiError): returns the error message to the client.
 * - Unexpected errors (programming bugs): returns a generic 500; stack trace
 *   is only printed in development, never sent to the client in production.
 */
'use strict';

const { NODE_ENV } = require('../config/env');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Mongoose duplicate-key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for "${field}". Please use a different value.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('; '),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
  }

  // Known operational error (created via `new ApiError(statusCode, message)`)
  if (err instanceof ApiError && err.isOperational) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Unknown / programming error — log full stack, send generic response
  console.error('❌  Unhandled error:', err.stack || err.message);

  return res.status(500).json({
    success: false,
    message:
      NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
