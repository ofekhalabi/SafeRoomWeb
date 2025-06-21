const db = require('./db');

const username = 'admin';

db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
  if (err) {
    return console.error('Error deleting user:', err.message);
  }
  if (this.changes === 0) {
    console.log(`User with username '${username}' not found.`);
  } else {
    console.log(`Successfully deleted user '${username}'.`);
  }
  process.exit();
}); 