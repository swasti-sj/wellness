// server.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const userRoutes = require('./routes/users');

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/medapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Use routes with correct base paths
app.use('/api/auth', authRoutes);         // <-- required for /api/auth/signup and /login
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);        // optional depending on your need

// Start server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
