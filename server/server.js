const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,               // allow cookies to be sent
  exposedHeaders: ['Content-Disposition']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth.routes'));
app.use('/api/student', require('./routes/student.routes'));
app.use('/api/faculty', require('./routes/faculty.routes'));
app.use('/api/admin',   require('./routes/admin.routes'));
app.use('/api/parent',  require('./routes/parent.routes'));
app.use('/api/ai',      require('./routes/ai.routes'));
app.use('/api/drive',   require('./routes/drive.routes'));

// Static serving for uploads
const path = require('path');
app.use('/uploads', express.static(
  path.join(__dirname, 'uploads')
));

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'CampusSphere API is running 🚀', timestamp: new Date() });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 CampusSphere server running on http://localhost:${PORT}`);
});
