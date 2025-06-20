const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

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
    res.json(status || {});
  });
});

// Update status_mamad
router.post('/status/mamad', (req, res) => {
  const { status_mamad } = req.body;
  db.run('INSERT INTO statuses (user_id, status_mamad) VALUES (?, ?)', [req.user.id, status_mamad ? 1 : 0], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

// Update status_after
router.post('/status/after', (req, res) => {
  const { status_after } = req.body;
  db.run('INSERT INTO statuses (user_id, status_after) VALUES (?, ?)', [req.user.id, status_after ? 1 : 0], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

// Get status history
router.get('/status/history', (req, res) => {
  db.all('SELECT * FROM statuses WHERE user_id = ? ORDER BY timestamp DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

module.exports = router; 