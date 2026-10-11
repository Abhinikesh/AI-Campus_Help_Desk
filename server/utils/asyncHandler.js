/**
 * server/utils/asyncHandler.js
 * Wraps async route handlers to forward errors to the central error handler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
'use strict';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
