const db = require('./db');
const bcrypt = require('bcryptjs');

const name = 'Admin';
const username = 'admin';
const password = 'admin123';
const location = 'HQ';
const role = 'admin';

const hash = bcrypt.hashSync(password, 10);
db.run('INSERT OR REPLACE INTO users (id, name, username, password_hash, location, role, force_password_change) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [1, name, username, hash, location, role, false],
  function(err) {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('Seeded admin user:', { id: this.lastID, username, password });
    }
    process.exit();
  }); 