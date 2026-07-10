/**
 * Rental routes for the Vim scooter app.
 * Handles starting/ending rides, viewing active rentals, and rental history.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { haversineDistance } = require('../utils/geo');

const router = express.Router();

// All rental routes require authentication
router.use(authenticate);

/**
 * POST /rentals/start
 * Start a new rental.
 * Body: { scooter_id }
 * Checks: scooter is available, user has no active rental, user has sufficient balance.
 * Returns: { rental: {...}, scooter: {...} }
 */
router.post('/start', (req, res) => {
  try {
    const { scooter_id } = req.body;
    const userId = req.user.id;
    const db = getDb();

    if (!scooter_id) {
      return res.status(400).json({ error: 'scooter_id is required.' });
    }

    // Check if scooter exists and is available
    const scooter = db.prepare('SELECT * FROM scooters WHERE id = ?').get(scooter_id);
    if (!scooter) {
      return res.status(404).json({ error: 'Scooter not found.' });
    }
    if (scooter.status !== 'available') {
      return res.status(400).json({ error: `Scooter is currently ${scooter.status} and cannot be rented.` });
    }

    // Check if user already has an active rental
    const activeRental = db.prepare(
      "SELECT id FROM rentals WHERE user_id = ? AND status = 'active'"
    ).get(userId);
    if (activeRental) {
      return res.status(400).json({ error: 'You already have an active rental. Please end it before starting a new one.' });
    }

    // Check user balance
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (user.balance < scooter.price_to_unlock) {
      return res.status(400).json({
        error: `Insufficient balance. You need at least $${scooter.price_to_unlock.toFixed(2)} to unlock this scooter. Your balance is $${user.balance.toFixed(2)}.`,
      });
    }

    const now = new Date().toISOString();
    const rentalId = uuidv4();

    // Use a transaction to ensure atomicity
    const startRental = db.transaction(() => {
      // Create rental record
      db.prepare(`
        INSERT INTO rentals (id, user_id, scooter_id, status, start_latitude, start_longitude, start_time, unlock_fee, per_minute_cost, created_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `).run(
        rentalId,
        userId,
        scooter_id,
        scooter.latitude,
        scooter.longitude,
        now,
        scooter.price_to_unlock,
        scooter.price_per_minute,
        now
      );

      // Update scooter status to in_use
      db.prepare("UPDATE scooters SET status = 'in_use' WHERE id = ?").run(scooter_id);

      // Deduct unlock fee from user balance
      db.prepare('UPDATE users SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
        scooter.price_to_unlock,
        now,
        userId
      );

      // Create payment record for unlock fee
      db.prepare(`
        INSERT INTO payments (id, user_id, rental_id, type, amount, status, description, created_at)
        VALUES (?, ?, ?, 'charge', ?, 'completed', ?, ?)
      `).run(
        uuidv4(),
        userId,
        rentalId,
        scooter.price_to_unlock,
        `Unlock fee for scooter ${scooter.code}`,
        now
      );
    });

    startRental();

    // Retrieve the created rental
    const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(rentalId);
    const updatedScooter = db.prepare('SELECT * FROM scooters WHERE id = ?').get(scooter_id);
    const updatedUser = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ rental, scooter: updatedScooter, user: updatedUser });
  } catch (err) {
    console.error('Start rental error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /rentals/:id/end
 * End an active rental.
 * Body: { latitude, longitude }
 * Calculates duration, distance, and total cost.
 * Returns: { rental: {...}, summary: {...} }
 */
router.post('/:id/end', (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const userId = req.user.id;
    const db = getDb();

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required to end the rental.' });
    }

    const endLat = parseFloat(latitude);
    const endLng = parseFloat(longitude);

    if (isNaN(endLat) || isNaN(endLng)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values.' });
    }

    if (endLat < -90 || endLat > 90 || endLng < -180 || endLng > 180) {
      return res.status(400).json({ error: 'Coordinates are out of range.' });
    }

    // Fetch the rental
    const rental = db.prepare('SELECT * FROM rentals WHERE id = ? AND user_id = ?').get(id, userId);
    if (!rental) {
      return res.status(404).json({ error: 'Rental not found.' });
    }
    if (rental.status !== 'active') {
      return res.status(400).json({ error: 'This rental is not active.' });
    }

    // Calculate duration in minutes
    const startTime = new Date(rental.start_time);
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.max(durationMs / (1000 * 60), 1); // Minimum 1 minute

    // Calculate distance using haversine formula
    const distanceKm = haversineDistance(
      rental.start_latitude,
      rental.start_longitude,
      endLat,
      endLng
    );

    // Calculate cost: unlock_fee already charged + per-minute cost
    const perMinuteCost = Math.round(durationMinutes * rental.per_minute_cost * 100) / 100;
    const totalCost = Math.round((rental.unlock_fee + perMinuteCost) * 100) / 100;

    const endTimeISO = endTime.toISOString();
    const roundedDuration = Math.round(durationMinutes * 100) / 100;
    const roundedDistance = Math.round(distanceKm * 1000) / 1000;

    // Use a transaction for atomicity
    const endRental = db.transaction(() => {
      // Update rental record
      db.prepare(`
        UPDATE rentals
        SET status = 'completed',
            end_latitude = ?,
            end_longitude = ?,
            end_time = ?,
            duration_minutes = ?,
            distance_km = ?,
            total_cost = ?
        WHERE id = ?
      `).run(endLat, endLng, endTimeISO, roundedDuration, roundedDistance, totalCost, id);

      // Update scooter: set new location, status back to available, reduce battery
      const batteryDrain = Math.min(Math.floor(durationMinutes / 3), 30); // Rough battery drain estimate
      db.prepare(`
        UPDATE scooters
        SET status = 'available',
            latitude = ?,
            longitude = ?,
            battery_level = MAX(0, battery_level - ?)
        WHERE id = ?
      `).run(endLat, endLng, batteryDrain, rental.scooter_id);

      // Deduct per-minute cost from user balance (unlock fee already deducted at start)
      db.prepare('UPDATE users SET balance = balance - ?, updated_at = ? WHERE id = ?').run(
        perMinuteCost,
        endTimeISO,
        userId
      );

      // Create payment record for the ride cost
      const scooter = db.prepare('SELECT code FROM scooters WHERE id = ?').get(rental.scooter_id);
      db.prepare(`
        INSERT INTO payments (id, user_id, rental_id, type, amount, status, description, created_at)
        VALUES (?, ?, ?, 'charge', ?, 'completed', ?, ?)
      `).run(
        uuidv4(),
        userId,
        id,
        perMinuteCost,
        `Ride cost for scooter ${scooter.code} (${roundedDuration} min)`,
        endTimeISO
      );
    });

    endRental();

    // Fetch updated records
    const updatedRental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    const updatedUser = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(userId);

    const summary = {
      rental_id: id,
      duration_minutes: roundedDuration,
      distance_km: roundedDistance,
      unlock_fee: rental.unlock_fee,
      per_minute_cost: perMinuteCost,
      total_cost: totalCost,
      new_balance: updatedUser.balance,
    };

    res.json({ rental: updatedRental, summary, user: updatedUser });
  } catch (err) {
    console.error('End rental error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /rentals/active
 * Get the user's currently active rental (if any) with scooter details.
 * Returns: { rental: {...} | null }
 */
router.get('/active', (req, res) => {
  try {
    const db = getDb();

    const rental = db.prepare(`
      SELECT r.*,
             s.code as scooter_code, s.model as scooter_model, s.battery_level as scooter_battery,
             s.latitude as scooter_latitude, s.longitude as scooter_longitude,
             s.price_per_minute as scooter_price_per_minute
      FROM rentals r
      JOIN scooters s ON r.scooter_id = s.id
      WHERE r.user_id = ? AND r.status = 'active'
    `).get(req.user.id);

    if (!rental) {
      return res.json({ rental: null });
    }

    // Calculate current duration and estimated cost.
    // Billing enforces a 1-minute minimum at end, so mirror that floor here
    // to avoid the estimate under-stating the actual charge for sub-1-min rides.
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const currentDuration = (now - startTime) / (1000 * 60);
    const billedDuration = Math.max(currentDuration, 1);
    const estimatedCost = Math.round((rental.unlock_fee + billedDuration * rental.per_minute_cost) * 100) / 100;

    res.json({
      rental: {
        ...rental,
        current_duration_minutes: Math.round(currentDuration * 100) / 100,
        estimated_total_cost: estimatedCost,
      },
    });
  } catch (err) {
    console.error('Get active rental error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /rentals/history
 * Get the user's rental history, most recent first.
 * Includes scooter details.
 * Returns: { rentals: [...] }
 */
router.get('/history', (req, res) => {
  try {
    const db = getDb();

    const rentals = db.prepare(`
      SELECT r.*,
             s.code as scooter_code, s.model as scooter_model
      FROM rentals r
      JOIN scooters s ON r.scooter_id = s.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id);

    res.json({ rentals });
  } catch (err) {
    console.error('Get rental history error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /rentals/:id
 * Get specific rental details.
 * Returns: { rental: {...} }
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const rental = db.prepare(`
      SELECT r.*,
             s.code as scooter_code, s.model as scooter_model
      FROM rentals r
      JOIN scooters s ON r.scooter_id = s.id
      WHERE r.id = ? AND r.user_id = ?
    `).get(id, req.user.id);

    if (!rental) {
      return res.status(404).json({ error: 'Rental not found.' });
    }

    res.json({ rental });
  } catch (err) {
    console.error('Get rental error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
