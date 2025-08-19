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
const app = express();

const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const userRoutes = require('./routes/users');
const trialreadRoutes=require('./routes/trialread'); 

//Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'my_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
// Connect to MongoDB 
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
app.get('/auth/google', passport.authenticate('google'));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    const { email, name, googleId, picture, accessToken, refreshToken } = req.user;

    let user = await User.findOne({ email });
    let firstLogin = false;

    if (!user) {
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
      user.googleAccessToken = accessToken;
      if (refreshToken) {
        user.googleRefreshToken = refreshToken;
      }
      await user.save();

      if (!user.age || !user.phone || !user.sex) {
        firstLogin = true;
      }
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.redirect(`http://localhost:3000/login?token=${token}&firstLogin=${firstLogin}`);
  }
);

app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);      
app.use('/api/trialread', trialreadRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
