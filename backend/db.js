const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./shelter_status.db');

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
    status_mamad INTEGER DEFAULT 0,
    status_after INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

module.exports = db;
