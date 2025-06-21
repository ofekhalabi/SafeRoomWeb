const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const ExcelJS = require('exceljs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const fs = require('fs');
const { formatIsraelTime } = require('../utils/timezone');

router.use(authenticateToken);

// Middleware to check for 'team_lead' or 'admin' role for ALL routes in this file.
router.use((req, res, next) => {
  if (req.user.role !== 'team_lead' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Access restricted to Team Leads and Admins.' });
  }
  next();
});

// Reset all user statuses.
router.post('/reset-statuses', (req, res) => {
  db.run('DELETE FROM statuses', function(err) {
    if (err) {
      console.error('Failed to reset statuses:', err.message);
      return res.status(500).json({ error: 'Database error while resetting statuses.' });
    }
    res.json({ success: true, message: `All ${this.changes} user statuses have been reset.` });
  });
});

// Get users under this team lead with latest status (or all users for admin)
router.get('/users', (req, res) => {
  let sql;
  let params;

  if (req.user.role === 'admin') {
    sql = `SELECT u.id, u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.role != 'admin'`;
    params = [];
  } else { // team_lead
    sql = `SELECT u.id, u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.team_lead_id = ?`;
    params = [req.user.id];
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const formattedRows = rows.map(row => ({
      ...row,
      last_updated: formatIsraelTime(row.last_updated)
    }));
    res.json(formattedRows);
  });
});

// Get stats for charts (or all stats for admin)
router.get('/stats', (req, res) => {
  let sql;
  let params;

  if (req.user.role === 'admin') {
    sql = `SELECT u.location,
      SUM(CASE WHEN s.status_mamad = 1 THEN 1 ELSE 0 END) as in_shelter,
      SUM(CASE WHEN s.status_after = 1 THEN 1 ELSE 0 END) as safe_after_alarm,
      COUNT(DISTINCT u.id) as user_count
      FROM users u
      LEFT JOIN statuses s ON u.id = s.user_id
      WHERE u.role != 'admin'
      GROUP BY u.location`;
    params = [];
  } else { // team_lead
    sql = `SELECT u.location,
      SUM(CASE WHEN s.status_mamad = 1 THEN 1 ELSE 0 END) as in_shelter,
      SUM(CASE WHEN s.status_after = 1 THEN 1 ELSE 0 END) as safe_after_alarm,
      COUNT(DISTINCT u.id) as user_count
      FROM users u
      LEFT JOIN statuses s ON u.id = s.user_id
      WHERE u.team_lead_id = ?
      GROUP BY u.location`;
    params = [req.user.id];
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Export PDF
router.get('/export/pdf', async (req, res) => {
  let sql;
  let params;

  if (req.user.role === 'admin') {
    sql = `SELECT u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.role != 'admin'`;
    params = [];
  } else { // team_lead
    sql = `SELECT u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.team_lead_id = ?`;
    params = [req.user.id];
  }

  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const doc = new jsPDF();
    doc.text('User Status Report (Israel Time)', 10, 10);
    doc.autoTable({
      head: [['Name', 'Location', 'In Shelter', 'Safe After Alarm', 'Last Updated']],
      body: rows.map(r => [
        r.name, 
        r.location, 
        r.status_mamad ? 'Yes' : 'No', 
        r.status_after ? 'Yes' : 'No',
        formatIsraelTime(r.last_updated) || 'N/A'
      ])
    });
    const pdf = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="user_status_report.pdf"');
    res.send(Buffer.from(pdf));
  });
});

// Export Excel
router.get('/export/excel', async (req, res) => {
  let sql;
  let params;

  if (req.user.role === 'admin') {
    sql = `SELECT u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.role != 'admin'`;
    params = [];
  } else { // team_lead
    sql = `SELECT u.name, u.location,
      (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
      (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
      (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
      FROM users u WHERE u.team_lead_id = ?`;
    params = [req.user.id];
  }

  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Status');
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'In Shelter', key: 'status_mamad', width: 15 },
      { header: 'Safe After Alarm', key: 'status_after', width: 18 },
      { header: 'Last Updated (Israel Time)', key: 'last_updated', width: 25 }
    ];
    rows.forEach(r => {
      worksheet.addRow({
        name: r.name,
        location: r.location,
        status_mamad: r.status_mamad ? 'Yes' : 'No',
        status_after: r.status_after ? 'Yes' : 'No',
        last_updated: formatIsraelTime(r.last_updated) || 'N/A'
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="user_status_report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router; 