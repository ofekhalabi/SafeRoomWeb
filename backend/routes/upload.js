const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// Only team leads can upload
router.use((req, res, next) => {
  if (req.user.role !== 'team_lead') return res.status(403).json({ error: 'Forbidden' });
  next();
});

// Bulk user creation from Excel
router.post('/users', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  const requiredFields = ['name', 'username', 'password', 'location', 'role'];
  const usernames = new Set();
  const users = [];
  for (const row of rows) {
    for (const field of requiredFields) {
      if (!row[field]) return res.status(400).json({ error: `Missing field: ${field}` });
    }
    if (usernames.has(row.username)) return res.status(400).json({ error: `Duplicate username in file: ${row.username}` });
    usernames.add(row.username);
    users.push(row);
  }
  // Check for existing usernames in DB
  db.all('SELECT username FROM users WHERE username IN (' + users.map(() => '?').join(',') + ')', users.map(u => u.username), (err, existing) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (existing && existing.length > 0) return res.status(400).json({ error: `Usernames already exist: ${existing.map(e => e.username).join(', ')}` });
    // Insert users
    const stmt = db.prepare('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)');
    users.forEach(u => {
      const hash = bcrypt.hashSync(u.password, 10);
      stmt.run(u.name, u.username, hash, u.location, u.role, req.user.id);
    });
    stmt.finalize();
    res.json({ success: true, count: users.length });
  });
});

module.exports = router; 