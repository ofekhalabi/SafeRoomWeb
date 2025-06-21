const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const teamleadRoutes = require('./routes/teamlead');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/teamlead', teamleadRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Shelter Status API running');
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 