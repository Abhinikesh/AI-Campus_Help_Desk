/**
 * server/middleware/aiLimiter.js
 * Rate-limiting middleware for CampusSphere AI Assistant endpoints.
 * Protects AI inference and backend resources against DoS, scraping, and abuse.
 */
'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Dynamically evaluate limit:
 * - process.env.AI_RATE_LIMIT_MAX (if set)
 * - 'test' environment: 5 requests / min
 * - 'production' environment: 20 requests / min
 * - 'development': 60 requests / min
 */
const resolveLimit = () => {
  if (process.env.AI_RATE_LIMIT_MAX) {
    return parseInt(process.env.AI_RATE_LIMIT_MAX, 10);
  }
  if (process.env.NODE_ENV === 'test') {
    return 5;
  }
  if (process.env.NODE_ENV === 'production') {
    return 20;
  }
  return 60;
};

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: () => resolveLimit(),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by authenticated user ID if present; fallback to IP
    return req.user?.id || req.user?.userId || req.user?._id || req.ip || 'anonymous';
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many AI chat requests. Please slow down and try again in a minute.',
    });
  },
});

module.exports = aiLimiter;
