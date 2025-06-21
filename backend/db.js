const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'shelter_status.db');
const db = new sqlite3.Database(dbPath);

// Set timezone to Israel for the database connection
db.run("PRAGMA timezone = '+03:00'");

// Create users table
// Fields: id, name, username, password_hash, location, role, team_lead_id
// role: 'user', 'team_lead', or 'admin'
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    location TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'team_lead', 'admin')),
    team_lead_id INTEGER,
    FOREIGN KEY(team_lead_id) REFERENCES users(id)
  )`);

  // Create statuses table
  // Fields: id, user_id, status_mamad, status_after, timestamp
  db.run(`CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status_mamad INTEGER DEFAULT NULL,
    status_after INTEGER DEFAULT NULL,
    timestamp DATETIME DEFAULT (datetime('now', '+03:00')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

module.exports = db;
