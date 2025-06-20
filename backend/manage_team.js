const db = require('./db');
const bcrypt = require('bcryptjs');

const teamLeadUsername = 'ofekh';
const teamLeadName = 'Ofek H';
const teamLeadPassword = 'password123'; // Use a secure password
const teamLeadLocation = 'Main Office';

const userUsername = 'ofek-halabi';
const userName = 'Ofek Halabi';
const userPassword = 'password123'; // Use a secure password
const userLocation = 'Remote';

const ensureUserExists = (username, name, password, location, role, teamLeadId, callback) => {
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return callback(err);
    if (row) {
      // User exists, just pass the id
      return callback(null, row.id);
    }
    // User does not exist, create them
    const hash = bcrypt.hashSync(password, 10);
    const params = [name, username, hash, location, role, teamLeadId];
    const sql = `INSERT INTO users (name, username, password_hash, location, role, team_lead_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, params, function(err) {
      if (err) return callback(err);
      console.log(`Created user '${username}'.`);
      callback(null, this.lastID);
    });
  });
};

// Main logic
ensureUserExists(teamLeadUsername, teamLeadName, teamLeadPassword, teamLeadLocation, 'team_lead', null, (err, teamLeadId) => {
  if (err) {
    console.error('Error with team lead:', err.message);
    return;
  }
  
  ensureUserExists(userUsername, userName, userPassword, userLocation, 'user', teamLeadId, (err, userId) => {
    if (err) {
      console.error('Error with user:', err.message);
      return;
    }

    // Now, ensure the user is assigned to the team lead
    db.run('UPDATE users SET team_lead_id = ? WHERE id = ?', [teamLeadId, userId], function(err) {
        if (err) {
            console.error('Error assigning user to team:', err.message);
            return;
        }
        console.log(`User '${userUsername}' is now assigned to team lead '${teamLeadUsername}'.`);
    });
  });
}); 