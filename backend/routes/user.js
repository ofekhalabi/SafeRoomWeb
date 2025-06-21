const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { formatIsraelTime } = require('../utils/timezone');

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

module.exports = router; 