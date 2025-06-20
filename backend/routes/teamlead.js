const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const ExcelJS = require('exceljs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const fs = require('fs');

router.use(authenticateToken);

// Middleware to check team lead role
router.use((req, res, next) => {
  if (req.user.role !== 'team_lead') return res.status(403).json({ error: 'Forbidden' });
  next();
});

// Get users under this team lead with latest status
router.get('/users', (req, res) => {
  const sql = `SELECT u.id, u.name, u.location,
    (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
    (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after,
    (SELECT timestamp FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as last_updated
    FROM users u WHERE u.team_lead_id = ?`;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Get stats for charts
router.get('/stats', (req, res) => {
  const sql = `SELECT u.location,
    SUM(CASE WHEN s.status_mamad = 1 THEN 1 ELSE 0 END) as in_shelter,
    SUM(CASE WHEN s.status_after = 1 THEN 1 ELSE 0 END) as safe_after_alarm,
    COUNT(DISTINCT u.id) as user_count
    FROM users u
    LEFT JOIN statuses s ON u.id = s.user_id
    WHERE u.team_lead_id = ?
    GROUP BY u.location`;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Export PDF
router.get('/export/pdf', async (req, res) => {
  const sql = `SELECT u.name, u.location,
    (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
    (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after
    FROM users u WHERE u.team_lead_id = ?`;
  db.all(sql, [req.user.id], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const doc = new jsPDF();
    doc.text('User Status Report', 10, 10);
    doc.autoTable({
      head: [['Name', 'Location', 'In Shelter', 'Safe After Alarm']],
      body: rows.map(r => [r.name, r.location, r.status_mamad ? 'Yes' : 'No', r.status_after ? 'Yes' : 'No'])
    });
    const pdf = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="user_status_report.pdf"');
    res.send(Buffer.from(pdf));
  });
});

// Export Excel
router.get('/export/excel', async (req, res) => {
  const sql = `SELECT u.name, u.location,
    (SELECT status_mamad FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_mamad,
    (SELECT status_after FROM statuses s WHERE s.user_id = u.id ORDER BY timestamp DESC LIMIT 1) as status_after
    FROM users u WHERE u.team_lead_id = ?`;
  db.all(sql, [req.user.id], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Status');
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'In Shelter', key: 'status_mamad', width: 15 },
      { header: 'Safe After Alarm', key: 'status_after', width: 18 }
    ];
    rows.forEach(r => {
      worksheet.addRow({
        name: r.name,
        location: r.location,
        status_mamad: r.status_mamad ? 'Yes' : 'No',
        status_after: r.status_after ? 'Yes' : 'No'
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="user_status_report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router; 