/**
 * Authentication routes for the Vim scooter app.
 * Handles user registration, login, and profile management.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /auth/register
 * Create a new user account.
 * Body: { email, password, name, phone }
 * Returns: { token, user }
 */
router.post('/register', (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = getDb();

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const now = new Date().toISOString();
    const id = uuidv4();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, balance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase(), passwordHash, name, phone || null, 0, now, now);

    // Retrieve user (without password_hash)
    const user = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(id);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /auth/login
 * Log in with email and password.
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDb();

    // Find user by email
    const userWithPassword = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!userWithPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, userWithPassword.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Return user without password_hash
    const user = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      name: userWithPassword.name,
      phone: userWithPassword.phone,
      balance: userWithPassword.balance,
      created_at: userWithPassword.created_at,
      updated_at: userWithPassword.updated_at,
    };

    const token = generateToken(user);

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /auth/me
 * Get the current authenticated user's profile.
 * Requires authentication.
 * Returns: { user }
 */
router.get('/me', authenticate, (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /auth/me
 * Update the current user's profile (name, phone).
 * Requires authentication.
 * Body: { name, phone }
 * Returns: { user }
 */
router.put('/me', authenticate, (req, res) => {
  try {
    const { name, phone } = req.body;
    const db = getDb();

    // Build update fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update. Provide name or phone.' });
    }

    // Validate name if provided
    if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
      return res.status(400).json({ error: 'Name must be a non-empty string.' });
    }

    const now = new Date().toISOString();

    // Build dynamic update query
    const setClauses = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    // Retrieve updated user
    const user = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);

    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
