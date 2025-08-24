// Entry point for Express backend
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const session = require('express-session'); 
const passport = require('passport');
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const app = express();

const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const userRoutes = require('./routes/users');
const trialreadRoutes=require('./routes/trialread'); 
const noteRoutes = require('./routes/notes');

// Middleware
console.log("⚙️ Setting up middleware...");
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'my_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Connect to MongoDB 
console.log("🔗 Connecting to MongoDB...");
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ Connected to MongoDB");
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});

app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/callback",
  scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"]
}, (accessToken, refreshToken, profile, done) => {
  console.log("📡 Google OAuth callback triggered");

  const userData = {
    googleId: profile.id,
    email: profile.emails?.[0]?.value,    
    name: profile.displayName,
    picture: profile.photos?.[0]?.value,
    accessToken,
    refreshToken,
  };
  return done(null, userData);
}));

passport.serializeUser((user, done) => {
  console.log("💾 Serializing user into session:", user.email || user.googleId);
  done(null, user);
});

passport.deserializeUser((user, done) => {
  console.log("📦 Deserializing user from session:", user.email || user.googleId);
  done(null, user);
});

// Google OAuth login entry
app.get('/auth/google', (req, res, next) => {
  const role = req.query.role || "patient";
  console.log(`🌐 /auth/google hit. Role requested: ${role}`);
  passport.authenticate('google', {
    state: role // Pass role as state
  })(req, res, next);
});

// Google OAuth callback
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    console.log("✅ Successful Google login callback");
    const { email, name, googleId, picture, accessToken, refreshToken } = req.user;
    console.log("🔓 User details:", { email, name, googleId });
    const role = req.query.state || "patient"; // <-- FIXED: get role from OAuth state param
    console.log("👥 Role from state param:", role);
    let firstLogin = false;

    if (role === "doctor") {
      console.log("👨‍⚕️ Handling doctor login/signup...");
      let doctor = await Doctor.findOne({ email });
      if (!doctor) {
        console.log("🆕 New doctor detected. Creating record...");
        doctor = new Doctor({
          name,
          email,
          googleId,
          picture,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
        });
        await doctor.save();
        firstLogin = true;
      } else {
        console.log("🔄 Existing doctor found. Updating tokens...");
        doctor.googleAccessToken = accessToken;
        if (refreshToken) doctor.googleRefreshToken = refreshToken;
        await doctor.save();
      }

      console.log("🔑 Issuing JWT for doctor...");
      const token = jwt.sign(
        { id: doctor._id, email: doctor.email, role: "doctor" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      console.log("📤 Redirecting doctor to frontend with token...");
      res.redirect(`http://localhost:3000/login?token=${token}&role=doctor&firstLogin=${firstLogin}`);
    } else {
      let user = await User.findOne({ email });

      if (!user) {
        console.log("🆕 New patient detected. Creating record...");
        user = new User({
          googleId,
          email,
          name,
          picture,
          role: "patient",
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken
        });
        await user.save();
        firstLogin = true;
      } else {
        console.log("🔄 Existing patient found. Updating tokens...");
        user.googleAccessToken = accessToken;
        if (refreshToken) {
          user.googleRefreshToken = refreshToken;
        }
        await user.save();

        if (!user.age || !user.phone || !user.sex) {
          console.log("📋 Patient profile incomplete. Marking as firstLogin...");
          firstLogin = true;
        }
      }

      console.log("🔑 Issuing JWT for patient...");
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      console.log("📤 Redirecting patient to frontend with token...");
      res.redirect(`http://localhost:3000/login?token=${token}&role=patient&firstLogin=${firstLogin}`);
    }
  }
);

// Routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);      
app.use('/api/trialread', trialreadRoutes);
app.use('/api/notes', noteRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});
