const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Middleware to ensure only admins can access these routes
router.use(authenticateToken, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }
  next();
});

// Endpoint to delete a user by USERNAME and all their related data
router.delete('/users/by-username/:username', (req, res) => {
  const usernameToDelete = req.params.username.trim();
  const sql = 'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?)';
  console.log('Executing SQL:', sql, 'with value:', usernameToDelete);

  // First, find the user to get their ID
  db.get(sql, [usernameToDelete], (err, user) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error while finding user.' });
    }
    console.log('User found in DB:', user);
    if (!user) {
      return res.status(404).json({ error: `User with username '${usernameToDelete}' not found.` });
    }

    const userIdToDelete = user.id;

    db.serialize(() => {
      // Delete all status history for the user.
      db.run('DELETE FROM statuses WHERE user_id = ?', [userIdToDelete], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error while deleting user statuses.' });
        }

        // Then, delete the user themselves.
        db.run('DELETE FROM users WHERE id = ?', [userIdToDelete], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error while deleting user.' });
          }
          if (this.changes === 0) {
            // This case should ideally not be reached if the user was found before,
            // but as a safeguard:
            return res.status(404).json({ error: 'User not found during deletion phase.' });
          }
          res.json({ success: true, message: `User '${usernameToDelete}' and their status history have been deleted.` });
        });
      });
    });
  });
});

module.exports = router; 