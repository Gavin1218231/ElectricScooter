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
const { initializeDatabase } = require('./database');

// Import route modules
const authRoutes = require('./routes/auth');
const scooterRoutes = require('./routes/scooters');
const rentalRoutes = require('./routes/rentals');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Vim Scooter API',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/scooters', scooterRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler for unknown routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
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
