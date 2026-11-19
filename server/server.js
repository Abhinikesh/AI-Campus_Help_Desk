/**
 * server/server.js
 * CampusSphere ERP — Express application entry point.
 */
'use strict';

// Load .env first, then validate
const dotenv = require('dotenv');
dotenv.config();
const env = require('./config/env'); // exits if required vars are missing

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const mongoose     = require('mongoose');
const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

const app = express();

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet());

// ── CORS — allow configured client origin and local development origins ─────
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

// ── Body / cookie parsing — limit request size to 10 mb ─────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Global rate limiter (generous — per-route limits are stricter) ────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 500 : 50000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/student',       require('./routes/student.routes'));
app.use('/api/faculty',       require('./routes/faculty.routes'));
app.use('/api/admin',         require('./routes/admin.routes'));
app.use('/api/attendance',    require('./routes/attendance.routes'));
app.use('/api/ai',            require('./routes/ai.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/announcements', require('./routes/announcement.routes'));
app.use('/api/assignments',   require('./routes/assignment.routes'));
app.use('/api/submissions',   require('./routes/submission.routes'));
app.use('/api/exams',         require('./routes/exam.routes'));
app.use('/api/timetable',     require('./routes/timetable.routes'));
app.use('/api/calendar',      require('./routes/calendar.routes'));
app.use('/api/fees',          require('./routes/fee.routes'));
app.use('/api/library',       require('./routes/library.routes'));
app.use('/api/hostel',        require('./routes/hostel.routes'));
app.use('/api/transport',     require('./routes/transport.routes'));
app.use('/api/placement',     require('./routes/placement.routes'));
app.use('/api/events',        require('./routes/event.routes'));
app.use('/api/inventory',     require('./routes/inventory.routes'));
app.use('/api/procurement',   require('./routes/inventory.routes'));
app.use('/api/hr',            require('./routes/hr.routes'));
app.use('/api/certificates/verify/:identifier', (req, res, next) => {
  return require('./controllers/event.controller').verifyCertificate(req, res, next);
});

// ── Protected Uploads Guard ──────────────────────────────────────────────────
// Direct unauthenticated static access to /uploads is explicitly disabled to
// protect confidential student resumes, assignment submissions, and documents.
// All downloads must use authenticated controller endpoints with IDOR defense.
app.use('/uploads', (req, res) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  return res.status(404).json({
    success: false,
    message: 'Direct access to uploads is disabled. Please use authorized API endpoints.',
  });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbName  = mongoose.connection.db?.databaseName || 'not connected';
  const states  = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    success: true,
    data: {
      status:    'OK',
      database:  dbName,
      dbState:   states[dbState] || 'unknown',
      env:       env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    message: 'CampusSphere API is healthy 🚀',
  });
});

// ── Serve React build in production ──────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ── Central error handler (must be LAST) ─────────────────────────────────────
app.use(errorHandler);

const sessionScheduler = require('./services/sessionScheduler.service');

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = env.PORT;
const server = app.listen(PORT, () => {
  console.log(`🚀 CampusSphere ERP server running on http://localhost:${PORT} [${env.NODE_ENV}]`);
  sessionScheduler.startScheduler(60000); // Check every minute
});

function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down session scheduler and closing server...`);
  sessionScheduler.stopScheduler();
  server.close(() => {
    console.log('✅ HTTP server closed.');
    mongoose.connection.close(false).then(() => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
