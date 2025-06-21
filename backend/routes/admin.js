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

// Endpoint to delete a user and all their related data
router.delete('/users/:id', (req, res) => {
  const userIdToDelete = req.params.id;

  db.serialize(() => {
    // First, delete all status history for the user to maintain data integrity.
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
          return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ success: true, message: 'User and their status history have been deleted.' });
      });
    });
  });
});

// Endpoint to delete a user by USERNAME and all their related data
router.delete('/users/:username', (req, res) => {
  const usernameToDelete = req.params.username;

  // First, find the user to get their ID
  db.get('SELECT id FROM users WHERE username = ?', [usernameToDelete], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error while finding user.' });
    }
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
          res.json({ success: true, message: `User '${usernameToDelete}' and their status history have been deleted.` });
        });
      });
    });
  });
});

module.exports = router; 