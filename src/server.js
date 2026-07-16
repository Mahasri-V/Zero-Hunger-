const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const donationRoutes = require('./routes/donations');
const requestRoutes = require('./routes/requests');
const { startMatchingEngine } = require('./services/matchingEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON Request parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/requests', requestRoutes);

// Fallback to index.html for client side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start backend server
const server = app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Zero Hunger AI Backend Server running on port ${PORT}`);
  console.log(` Access Local Site: http://localhost:${PORT}`);
  console.log(`=================================================`);
});

// Start Matching Engine Background Job
startMatchingEngine();

module.exports = server;
