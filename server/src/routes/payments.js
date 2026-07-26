/**
 * Payment routes for the Vim scooter app.
 * Handles balance top-ups and payment history.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { parsePagination } = require('../utils/pagination');

const router = express.Router();

// All payment routes require authentication
router.use(authenticate);

/**
 * POST /payments/topup
 * Add funds to the user's account.
 * Body: { amount }
 * Min $5, max $100.
 * Returns: { balance, payment }
 */
router.post('/topup', (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const db = getDb();

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'amount is required.' });
    }

    const topupAmount = parseFloat(amount);

    if (isNaN(topupAmount) || topupAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    if (topupAmount < 5) {
      return res.status(400).json({ error: 'Minimum top-up amount is $5.00.' });
    }

    if (topupAmount > 100) {
      return res.status(400).json({ error: 'Maximum top-up amount is $100.00.' });
    }

    const now = new Date().toISOString();
    const paymentId = uuidv4();
    const roundedAmount = Math.round(topupAmount * 100) / 100;

    // Use a transaction for atomicity
    const processTopup = db.transaction(() => {
      // Update user balance
      db.prepare('UPDATE users SET balance = balance + ?, updated_at = ? WHERE id = ?').run(
        roundedAmount,
        now,
        userId
      );

      // Create payment record
      db.prepare(`
        INSERT INTO payments (id, user_id, rental_id, type, amount, status, description, created_at)
        VALUES (?, ?, NULL, 'topup', ?, 'completed', ?, ?)
      `).run(
        paymentId,
        userId,
        roundedAmount,
        `Account top-up of $${roundedAmount.toFixed(2)}`,
        now
      );
    });

    processTopup();

    // Get updated balance
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);

    res.json({
      balance: user.balance,
      payment,
    });
  } catch (err) {
    console.error('Top-up error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /payments/history
 * Get the user's payment history, most recent first.
 * Returns: { payments: [...] }
 */
router.get('/history', (req, res) => {
  try {
    const db = getDb();

    // Bound the result set so a long-lived account can't produce an unbounded response.
    const { limit, offset } = parsePagination(req.query);

    const payments = db.prepare(`
      SELECT p.*,
             r.scooter_id
      FROM payments p
      LEFT JOIN rentals r ON p.rental_id = r.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    const { total } = db
      .prepare('SELECT COUNT(*) as total FROM payments WHERE user_id = ?')
      .get(req.user.id);

    res.json({ payments, total, limit, offset });
  } catch (err) {
    console.error('Get payment history error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /payments/balance
 * Get the user's current balance.
 * Returns: { balance }
 */
router.get('/balance', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);

    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
