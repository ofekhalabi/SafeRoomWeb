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

// Endpoint for creating users in bulk from an Excel file.
router.post('/users', authenticateToken, upload.single('file'), (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    const processRowSequentially = (index) => {
      if (index >= data.length) {
        // Finished processing all rows
        return res.json({
          message: 'Bulk user upload processed.',
          successCount,
          errorCount,
          errors
        });
      }

      const row = data[index];
      const { name, username, password, location } = row;
      if (!name || !username || !password || !location) {
        errors.push(`Row ${index + 2}: Missing required fields.`);
        errorCount++;
        processRowSequentially(index + 1); // Move to next row
        return;
      }

      const password_hash = bcrypt.hashSync(password.toString(), 10);
      const team_lead_id = req.user.role === 'team_lead' ? req.user.id : null;

      db.run('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, username, password_hash, location, 'user', team_lead_id],
        function(err) {
          if (err) {
            errors.push(`Row ${index + 2} (Username: ${username}): ${err.message}`);
            errorCount++;
          } else {
            successCount++;
          }
          processRowSequentially(index + 1); // Process the next row
        }
      );
    };

    // Start processing from the first row
    processRowSequentially(0);

  } catch (e) {
    res.status(500).json({ error: 'Failed to process Excel file.', details: e.message });
  }
});

// Endpoint for assigning users to team leads in bulk from an Excel file.
router.post('/assign-users', authenticateToken, upload.single('file'), (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. This action is restricted to admins.' });
    }
  
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
  
    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
  
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
  
      const processRow = (row, index, callback) => {
        const { username, team_lead_username } = row;
        if (!username || !team_lead_username) {
          errors.push(`Row ${index + 2}: Missing 'username' or 'team_lead_username'.`);
          errorCount++;
          return callback();
        }
  
        // Find the team lead first
        db.get('SELECT id FROM users WHERE username = ? AND role = "team_lead"', [team_lead_username], (err, teamLead) => {
          if (err) {
            errors.push(`Row ${index + 2}: DB error finding team lead '${team_lead_username}'.`);
            errorCount++;
            return callback();
          }
          if (!teamLead) {
            errors.push(`Row ${index + 2}: Team lead '${team_lead_username}' not found or is not a team lead.`);
            errorCount++;
            return callback();
          }
  
          // Find the user and update their team_lead_id
          db.run('UPDATE users SET team_lead_id = ? WHERE username = ?', [teamLead.id, username], function(err) {
            if (err) {
              errors.push(`Row ${index + 2}: DB error updating user '${username}'.`);
              errorCount++;
            } else if (this.changes === 0) {
              errors.push(`Row ${index + 2}: User '${username}' not found.`);
              errorCount++;
            } else {
              successCount++;
            }
            callback();
          });
        });
      };
  
      // Process rows one by one to avoid database locking issues with async operations
      let i = 0;
      const next = () => {
        if (i < data.length) {
          processRow(data[i], i, next);
          i++;
        } else {
          // All rows processed
          res.json({
            message: 'User assignment process completed.',
            successCount,
            errorCount,
            errors,
          });
        }
      };
      
      next();
  
    } catch (e) {
      res.status(500).json({ error: 'Failed to process Excel file.', details: e.message });
    }
  });

module.exports = router; 