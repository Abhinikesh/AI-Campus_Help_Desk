/**
 * server/utils/safeSearch.util.js
 * Centralized utility for safe, ReDoS-protected literal regular expression search queries.
 */
'use strict';

const ApiError = require('./ApiError');

const DEFAULT_MAX_SEARCH_LENGTH = 100;

/**
 * Escapes all regular expression metacharacters in a string so it can be safely used
 * in a RegExp as a literal match pattern.
 *
 * @param {string} str - Raw input string
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates, bounds, and converts a user search input into a safe, case-insensitive
 * literal RegExp object.
 *
 * - Rejects non-string inputs (e.g., query objects like { $gt: '' }) with 400 Bad Request.
 * - Rejects inputs exceeding maxSearchLength (default 100) with 400 Bad Request.
 * - Returns null for undefined, null, or empty/whitespace-only input (meaning no filter).
 * - Escapes all regex metacharacters, preventing ReDoS and regex injection.
 * - Enforces case-insensitive matching ('i') without accepting arbitrary user flags.
 *
 * @param {*} input - User query parameter (e.g. req.query.search)
 * @param {Object} [options]
 * @param {number} [options.maxLength=100] - Maximum allowed string length
 * @param {string} [options.paramName='Search query'] - Descriptive name for error messages
 * @returns {RegExp|null} Safe RegExp instance, or null if input is empty
 */
function createSafeRegex(input, options = {}) {
  const maxLength = options.maxLength || DEFAULT_MAX_SEARCH_LENGTH;
  const paramName = options.paramName || 'Search query';

  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input !== 'string') {
    throw new ApiError(400, `${paramName} must be a valid text string`);
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${paramName} cannot exceed ${maxLength} characters`);
  }

  const escaped = escapeRegex(trimmed);
  return new RegExp(escaped, 'i');
}

/**
 * Validates and clamps pagination parameters to safe bounds.
 *
 * @param {*} page - Page number from query
 * @param {*} limit - Limit from query
 * @param {number} [defaultLimit=20] - Default limit if missing
 * @param {number} [maxLimit=100] - Maximum allowable limit
 * @returns {{ page: number, limit: number, skip: number }}
 */
function sanitizePagination(page, limit, defaultLimit = 20, maxLimit = 100) {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, maxLimit)
    : defaultLimit;

  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
}

module.exports = {
  escapeRegex,
  createSafeRegex,
  sanitizePagination,
  DEFAULT_MAX_SEARCH_LENGTH
};
