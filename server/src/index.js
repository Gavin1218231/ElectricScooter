/**
 * Vim Scooter App - Main Express Server
 *
 * An electric scooter rental API similar to Bird/Lime/GOAT.
 * Provides endpoints for user authentication, scooter discovery,
 * rental management, and payments.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./database');

// Import route modules
const authRoutes = require('./routes/auth');
const scooterRoutes = require('./routes/scooters');
const rentalRoutes = require('./routes/rentals');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// Restrict CORS to configured origin(s) instead of allowing every site.
// CORS_ORIGIN is a comma-separated allowlist; defaults to the local dev client.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, mobile apps) that send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json());

// Rate limiting: a general cap for all API traffic, plus a stricter cap on the
// auth endpoints to blunt credential brute-force and account-spam attacks.
// Allow test suites to bypass rate limiting (standard practice) without weakening
// the control in normal operation.
// The bypass is only honoured outside production, so setting it in a production
// environment (accidentally or otherwise) cannot disable rate limiting.
const skipRateLimit = () =>
  process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: 'Too many attempts. Please try again later.' },
});
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Vim Scooter API',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/scooters', scooterRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler for unknown routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  // Malformed JSON bodies and similar client errors arrive here with a 4xx
  // status already set (e.g. body-parser SyntaxError). Returning 500 for those
  // misreports a client mistake as a server fault and hides real 500s.
  if (err && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Invalid request body.' });
  }
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Vim Scooter API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
