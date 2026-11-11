/**
 * server/utils/scopeKey.util.js
 * Collision-safe, deterministic canonical scopeKey generator and validator for Timetable & TimetableVersion.
 */
'use strict';

/**
 * Normalizes a single token by trimming, converting to uppercase, and escaping delimiter characters.
 * @param {string|number} val
 * @param {string} fallback
 * @returns {string}
 */
function sanitizeToken(val, fallback = '') {
  if (val === undefined || val === null || val === '') {
    return String(fallback).trim().toUpperCase();
  }
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/[|=]/g, '_'); // Escape delimiter characters to prevent collision injection
}

/**
 * Builds a deterministic, collision-safe canonical scope key for an academic cohort.
 * Format: AY=<academicYear>|PRG=<program>|DPT=<dept>|BRN=<branch>|SPC=<spec>|SEM=<semester>|SEC=<section>
 *
 * @param {Object} dimensions
 * @param {string} dimensions.academicYear
 * @param {string} [dimensions.program='B.Tech']
 * @param {string} [dimensions.department='CSE']
 * @param {string} [dimensions.departmentCode='CSE']
 * @param {string} [dimensions.branch='CSE']
 * @param {string} [dimensions.specialization='Core']
 * @param {number|string} [dimensions.semester=1]
 * @param {string} [dimensions.section='A']
 * @returns {string} Canonical scope key
 */
function buildCanonicalScopeKey(dimensions = {}) {
  const ay = sanitizeToken(dimensions.academicYear, '2026-2027');
  const prg = sanitizeToken(dimensions.program, 'B.TECH');
  const dpt = sanitizeToken(dimensions.departmentCode || dimensions.department, 'CSE');
  const brn = sanitizeToken(dimensions.branch, 'CSE');
  const spc = sanitizeToken(dimensions.specialization, 'CORE');
  const sem = sanitizeToken(dimensions.semester, '1');
  const sec = sanitizeToken(dimensions.section, 'A');

  return `AY=${ay}|PRG=${prg}|DPT=${dpt}|BRN=${brn}|SPC=${spc}|SEM=${sem}|SEC=${sec}`;
}

/**
 * Parses a canonical scope key back into its individual cohort dimensions.
 * @param {string} scopeKey
 * @returns {Object} Parsed dimensions
 */
function parseCanonicalScopeKey(scopeKey) {
  if (!scopeKey || typeof scopeKey !== 'string') {
    throw new Error('Invalid scopeKey: must be a non-empty string.');
  }

  const parts = scopeKey.split('|');
  const result = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) continue;
    switch (key) {
      case 'AY':
        result.academicYear = value;
        break;
      case 'PRG':
        result.program = value;
        break;
      case 'DPT':
        result.departmentCode = value;
        break;
      case 'BRN':
        result.branch = value;
        break;
      case 'SPC':
        result.specialization = value;
        break;
      case 'SEM':
        result.semester = parseInt(value, 10);
        break;
      case 'SEC':
        result.section = value;
        break;
      default:
        break;
    }
  }

  return result;
}

/**
 * Validates a scope key against a set of cohort dimensions.
 * @param {string} scopeKey
 * @param {Object} dimensions
 * @returns {boolean} True if matched, throws error or returns false if mismatched
 */
function validateScopeKey(scopeKey, dimensions) {
  const expected = buildCanonicalScopeKey(dimensions);
  return scopeKey === expected;
}

module.exports = {
  buildCanonicalScopeKey,
  parseCanonicalScopeKey,
  validateScopeKey,
  sanitizeToken,
};

