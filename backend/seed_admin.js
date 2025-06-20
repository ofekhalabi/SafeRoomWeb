const db = require('./db');
const bcrypt = require('bcryptjs');

const name = 'Admin';
const username = 'admin';
const password = 'admin123';
const location = 'HQ';
const role = 'admin';

const hash = bcrypt.hashSync(password, 10);
db.run('INSERT INTO users (name, username, password_hash, location, role) VALUES (?, ?, ?, ?, ?)',
  [name, username, hash, location, role],
  function(err) {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('Seeded admin user:', { id: this.lastID, username, password });
    }
    process.exit();
  }); 