const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  keyGenerator: (req) => {
    // Rate limit by IP + username to prevent user enumeration
    return `${req.ip}:${req.body.username || 'unknown'}`;
  }
});

const logoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  skip: (req) => !req.session?.userId // Don't rate limit if not authenticated
});

// Input validation for login
function validateLoginInput(username, password) {
  const errors = [];
  
  if (!username || typeof username !== 'string') {
    errors.push('Username is required');
  } else if (username.length < 3 || username.length > 50) {
    errors.push('Username must be between 3 and 50 characters');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username contains invalid characters');
  }
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 8 || password.length > 128) {
    errors.push('Password must be between 8 and 128 characters');
  }
  
  return errors;
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  const validationErrors = validateLoginInput(username, password);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors[0] });
  }
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      console.warn(`[WARN] Failed login attempt for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      console.warn(`[WARN] Failed login attempt for user: ${username} (wrong password)`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    req.session.userId = user.id;
    req.session.role   = user.role;
    req.session.name   = user.name;
    
    console.log(`[INFO] User logged in: ${username} (${user.role})`);
    
    return res.json({ success: true, role: user.role, name: user.name });
  } catch (err) {
    console.error('[ERROR] Login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/logout', logoutLimiter, (req, res) => {
  const username = req.session?.name || 'unknown';
  
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    
    console.log(`[INFO] User logged out: ${username}`);
    
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;
