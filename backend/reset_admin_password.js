const db = require('./db');
const bcrypt = require('bcryptjs');

const username = 'admin';
const newPassword = 'admin123';

const newHash = bcrypt.hashSync(newPassword, 10);

db.run('UPDATE users SET password_hash = ? WHERE username = ?',
  [newHash, username],
  function(err) {
    if (err) {
      return console.error('Error updating password:', err.message);
    }
    if (this.changes === 0) {
      console.log(`User with username '${username}' not found. No password was updated.`);
      console.log('Please run "node backend/seed_admin.js" first to create the admin user.');
    } else {
      console.log(`Successfully reset password for user '${username}'.`);
      console.log('You can now log in with:');
      console.log(`  Username: ${username}`);
      console.log(`  Password: ${newPassword}`);
    }
    process.exit();
  }
); 