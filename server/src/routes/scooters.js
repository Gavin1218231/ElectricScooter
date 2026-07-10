/**
 * Scooter routes for the Vim scooter app.
 * Handles listing, searching, and looking up scooters.
 */

const express = require('express');
const { getDb } = require('../database');
const { haversineDistance } = require('../utils/geo');

const router = express.Router();

/**
 * GET /scooters
 * List all available scooters.
 * Query params:
 *   - lat (number): User's latitude for distance calculation and filtering
 *   - lng (number): User's longitude for distance calculation and filtering
 *   - radius (number): Search radius in km (default 5)
 * Returns: { scooters: [...] }
 */
router.get('/', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const db = getDb();

    // Fetch all available scooters
    const scooters = db.prepare(
      "SELECT * FROM scooters WHERE status = 'available' ORDER BY code ASC"
    ).all();

    // If lat/lng provided, calculate distance and optionally filter by radius
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const searchRadius = parseFloat(radius) || 5;

      if (isNaN(userLat) || isNaN(userLng)) {
        return res.status(400).json({ error: 'Invalid lat/lng values.' });
      }

      if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
        return res.status(400).json({ error: 'Coordinates are out of range.' });
      }

      const scootersWithDistance = scooters
        .map((scooter) => {
          const distance = haversineDistance(userLat, userLng, scooter.latitude, scooter.longitude);
          return { ...scooter, distance_km: Math.round(distance * 1000) / 1000 };
        })
        .filter((scooter) => scooter.distance_km <= searchRadius)
        .sort((a, b) => a.distance_km - b.distance_km);

      return res.json({ scooters: scootersWithDistance });
    }

    res.json({ scooters });
  } catch (err) {
    console.error('List scooters error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /scooters/code/:code
 * Look up a scooter by its VIM code (e.g., "VIM-0001").
 * Used when a user scans a scooter's QR code.
 * Returns: { scooter: {...} }
 */
router.get('/code/:code', (req, res) => {
  try {
    const { code } = req.params;
    const db = getDb();

    const scooter = db.prepare('SELECT * FROM scooters WHERE code = ?').get(code.toUpperCase());

    if (!scooter) {
      return res.status(404).json({ error: 'Scooter not found with that code.' });
    }

    res.json({ scooter });
  } catch (err) {
    console.error('Get scooter by code error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /scooters/:id
 * Get detailed information about a specific scooter by ID.
 * Returns: { scooter: {...} }
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const scooter = db.prepare('SELECT * FROM scooters WHERE id = ?').get(id);

    if (!scooter) {
      return res.status(404).json({ error: 'Scooter not found.' });
    }

    res.json({ scooter });
  } catch (err) {
    console.error('Get scooter error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
