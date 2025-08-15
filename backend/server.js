// Entry point for Express backend
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

//Import routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const userRoutes = require('./routes/users');
const trialreadRoutes=require('./routes/trialread'); 

//Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB 
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Use routes with correct base paths
app.use('/api/auth', authRoutes);         // <-- required for /api/auth/signup and /login
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);        // optional depending on your need
app.use('/api/trialread', trialreadRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
