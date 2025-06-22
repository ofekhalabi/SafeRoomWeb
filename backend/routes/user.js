const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { formatIsraelTime, toUTC } = require('../utils/timezone');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// All routes here require authentication
router.use(authenticateToken);

// Get user info
router.get('/me', (req, res) => {
  const { id, name, location, role, team_lead_id } = req.user;
  res.json({ id, name, location, role, team_lead_id });
});

// Get latest status
router.get('/status', (req, res) => {
  db.get('SELECT * FROM statuses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1', [req.user.id], (err, status) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    const result = status || { status_mamad: null, status_after: null };

    if (result.timestamp) {
      result.timestamp = formatIsraelTime(result.timestamp);
    }
    
    res.json(result);
  });
});

// Unified endpoint to update a user's status
router.post('/update-status', (req, res) => {
  db.get('SELECT status_mamad, status_after FROM statuses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1', [req.user.id], (err, currentStatus) => {
    if (err) {
      return res.status(500).json({ error: 'Database error when fetching status.' });
    }

    // Establish the previous state, defaulting to null if no history exists.
    const previousMamad = currentStatus ? currentStatus.status_mamad : null;
    const previousAfter = currentStatus ? currentStatus.status_after : null;

    // Determine the next state for 'mamad', using the update if provided, otherwise preserving the old state.
    let nextMamad = previousMamad;
    if (req.body.hasOwnProperty('status_mamad')) {
      nextMamad = req.body.status_mamad ? 1 : 0;
    }
    
    // Determine the next state for 'after', using the update if provided, otherwise preserving the old state.
    let nextAfter = previousAfter;
    if (req.body.hasOwnProperty('status_after')) {
      nextAfter = req.body.status_after ? 1 : 0;
    }

    // Insert the new, complete status record into the history.
    db.run('INSERT INTO statuses (user_id, status_mamad, status_after) VALUES (?, ?, ?)',
      [req.user.id, nextMamad, nextAfter],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error when inserting new status.' });
        }
        // Retrieve and return the newly created record to sync the frontend.
        db.get('SELECT * FROM statuses WHERE id = ?', [this.lastID], (err, newRecord) => {
          if (err) {
            return res.status(500).json({ error: 'Database error when fetching new record.' });
          }
          newRecord.timestamp = formatIsraelTime(newRecord.timestamp);
          res.json(newRecord);
        });
      }
    );
  });
});

// Get status history
router.get('/status/history', (req, res) => {
  db.all('SELECT * FROM statuses WHERE user_id = ? ORDER BY timestamp DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const formattedRows = rows.map(row => ({
      ...row,
      timestamp: formatIsraelTime(row.timestamp)
    }));
    res.json(formattedRows);
  });
});

// Endpoint for a user to change their own password
router.post('/change-password', (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.id;
  
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
  
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
    db.run(
      'UPDATE users SET password_hash = ?, force_password_change = ? WHERE id = ?',
      [hashedPassword, false, userId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error while changing password.' });
        }
        
        // After success, fetch user details to generate a new token with updated claims
        db.get('SELECT id, name, username, role, location, force_password_change FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
                // This would be an internal error, as the user should exist.
                return res.status(500).json({ error: 'Could not retrieve user details after password change.' });
            }

            const payload = {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                location: user.location,
                forcePasswordChange: user.force_password_change === 1 // Will be false
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

            res.json({ 
                success: true, 
                message: 'Password changed successfully.',
                token // Send the new token back
            });
        });
      }
    );
});

module.exports = router; 