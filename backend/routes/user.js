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
  const { status_mamad, status_after } = req.body;

  db.get('SELECT status_mamad, status_after FROM statuses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1', [req.user.id], (err, currentStatus) => {
    if (err) return res.status(500).json({ error: 'DB error while fetching current status.' });

    const newStatusValues = {
      mamad: currentStatus?.status_mamad,
      after: currentStatus?.status_after
    };

    if (status_mamad !== undefined) newStatusValues.mamad = status_mamad ? 1 : 0;
    if (status_after !== undefined) newStatusValues.after = status_after ? 1 : 0;

    db.run('INSERT INTO statuses (user_id, status_mamad, status_after) VALUES (?, ?, ?)',
      [req.user.id, newStatusValues.mamad, newStatusValues.after],
      function(err) {
        if (err) return res.status(500).json({ error: 'DB error while inserting new status.' });

        // After inserting, fetch the complete new row to return it.
        const newStatusId = this.lastID;
        db.get('SELECT * FROM statuses WHERE id = ?', [newStatusId], (err, newStatus) => {
          if (err) return res.status(500).json({ error: 'DB error while fetching new status.' });
          
          if (newStatus && newStatus.timestamp) {
            newStatus.timestamp = formatIsraelTime(newStatus.timestamp);
          }
          res.json({ success: true, newStatus });
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