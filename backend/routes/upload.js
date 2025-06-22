const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const csv = require('csv-parser');
const { Readable } = require('stream');
const iconv = require('iconv-lite');

const upload = multer({ storage: multer.memoryStorage() });

// All routes in this file require authentication.
router.use(authenticateToken);

const processAndInsertData = (data, req, res) => {
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  const processRowSequentially = (index) => {
    if (index >= data.length) {
      return res.json({
        message: 'Bulk user upload processed.',
        successCount,
        errorCount,
        errors
      });
    }

    const row = data[index];
    const { name, username, password, location, role } = row;
    if (!name || !username || !password || !location) {
      errors.push(`Row ${index + 2}: Missing required fields (name, username, password, location).`);
      errorCount++;
      processRowSequentially(index + 1);
      return;
    }

    const userRole = (role && ['user', 'team_lead', 'admin'].includes(role.toLowerCase())) ? role.toLowerCase() : 'user';
    const password_hash = bcrypt.hashSync(password.toString(), 10);
    const team_lead_id = req.user.role === 'team_lead' ? req.user.id : null;

    db.run('INSERT INTO users (name, username, password_hash, location, role, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, password_hash, location, userRole, team_lead_id],
      function(err) {
        if (err) {
          errors.push(`Row ${index + 2} (Username: ${username}): ${err.message}`);
          errorCount++;
        } else {
          successCount++;
        }
        processRowSequentially(index + 1);
      }
    );
  };

  processRowSequentially(0);
};

// Endpoint for creating users in bulk from an Excel or CSV file.
router.post('/users', upload.single('file'), (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      const results = [];
      const stream = Readable.from(req.file.buffer);
      stream
        .pipe(iconv.decodeStream('win1255'))
        .pipe(csv({ bom: true }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
          processAndInsertData(results, req, res);
        });
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      processAndInsertData(data, req, res);
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to process file.', details: e.message });
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
      let workbook;
      if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        const csvString = req.file.buffer.toString('utf8');
        workbook = xlsx.read(csvString, { type: 'string' });
      } else {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer', codepage: 65001 });
      }
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