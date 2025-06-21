const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_jwt_secret'; // Change in production

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for username: ${username}`);
  console.log(`Password received: ${password}`);

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    
    console.log('User found in database:', user);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        console.error('Bcrypt comparison error:', err);
      }
      console.log(`Password match result (isMatch): ${isMatch}`);

      if (err || !isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({
        id: user.id,
        name: user.name,
        role: user.role,
        location: user.location,
        team_lead_id: user.team_lead_id
      }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token });
    });
  });
});

// Register endpoint (for initial setup or admin use)
router.post('/register', (req, res) => {
  const { name, username, password, location, role, team_lead_id } = req.body;
  if (!name || !username || !password || !location || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (role === 'team_lead') {
    db.get('SELECT * FROM users WHERE role = "team_lead"', [], (err, existing) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (existing) return res.status(400).json({ error: 'Team lead already exists' });
      const hash = bcrypt.hashSync(password, 10);
      db.run('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, username, hash, location, role, team_lead_id || null],
        function(err) {
          if (err) return res.status(500).json({ error: 'DB error' });
          res.json({ success: true, id: this.lastID });
        });
    });
  } else if (role === 'admin') {
    db.get('SELECT * FROM users WHERE role = "admin"', [], (err, existing) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (existing) return res.status(400).json({ error: 'Admin already exists' });
      const hash = bcrypt.hashSync(password, 10);
      db.run('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, username, hash, location, role, null],
        function(err) {
          if (err) return res.status(500).json({ error: 'DB error' });
          res.json({ success: true, id: this.lastID });
        });
    });
  } else {
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, hash, location, role, team_lead_id || null],
      function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true, id: this.lastID });
      });
  }
});

module.exports = router; 