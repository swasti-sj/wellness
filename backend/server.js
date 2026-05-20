// Entry point for Express backend
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const session = require("express-session");
const passport = require("passport");
const User = require("./models/User");
const Doctor = require("./models/Doctor");
const app = express();

const appointmentRoutes = require("./routes/appointments");
const doctorRoutes = require("./routes/doctors");
const userRoutes = require("./routes/users");
const trialreadRoutes = require("./routes/trialread");
const noteRoutes = require("./routes/notes");
const prescriptionRoutes = require("./routes/prescriptions");
const referralRoutes = require("./routes/referrals");
const vitalsRoutes = require("./routes/vitals");
const testRoutes = require("./routes/tests");
const dashboardRoutes = require('./routes/dashboardRoutes');
const medicineRoutes = require('./routes/medicines');
const authRoutes = require('./routes/auth');
const adminAuditRoutes = require('./routes/adminAudit');
const { createSession, getClientIp, parseUserAgent, uuidv4 } = require('./utils/audit');
const Nurse = require("./models/Nurse");
const Receptionist = require("./models/Receptionist");
const Pharmacist = require("./models/Pharmacist");

const ADMIN_EMAILS = new Set([
  'cs23bt027@iitdh.ac.in',
  'is23bm032@iitdh.ac.in'
].map((email) => email.toLowerCase()));

// Middleware
console.log("⚙️ Setting up middleware...");
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('backend/uploads'));

// Enable JSON parsing for form data
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "my_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// Connect to MongoDB
console.log("🔗 Connecting to MongoDB...");
// Enable helpful mongoose debugging in development
mongoose.set("strictQuery", false);
// Enable mongoose query debug only when explicitly requested.
// Set environment variable MONGOOSE_DEBUG=true to enable detailed query logs.
if (process.env.MONGOOSE_DEBUG === 'true') {
  mongoose.set('debug', true);
} else {
  mongoose.set('debug', false);
}

const mongoUri = process.env.MONGO_URI;
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // fail fast if cannot connect
    socketTimeoutMS: 45000,
    // family: 4, // uncomment to force IPv4 if your environment needs it
  })
  .then(() => {
    console.log("✅ Connected to MongoDB at", mongoUri);
  })
  .catch((err) => {
    console.error(
      "❌ MongoDB connection error (initial):",
      err && err.message ? err.message : err
    );
    // Fail fast during development so the issue is visible immediately
    if (process.env.NODE_ENV !== "production") {
      console.error("Exiting process due to MongoDB connection failure.");
      process.exit(1);
    }
  });

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error event:", err);
});

app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth
console.log("🔑 Configuring Google OAuth Strategy...");
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
    },
    (accessToken, refreshToken, profile, done) => {
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
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("💾 Serializing user into session:", user.email || user.googleId);
  done(null, user);
});

passport.deserializeUser((user, done) => {
  console.log(
    "📦 Deserializing user from session:",
    user.email || user.googleId
  );
  done(null, user);
});

// Google OAuth login entry
app.get("/auth/google", (req, res, next) => {
  const role = req.query.role || "patient";
  console.log(`🌐 /auth/google hit. Role requested: ${role}`);
  passport.authenticate("google", {
    state: role,
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
});

// Google OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    console.log("✅ Successful Google login callback");
    const { email, name, googleId, picture, accessToken, refreshToken } =
      req.user;
    console.log("🔓 User details:", { email, name, googleId });
    const role = req.query.state || "patient"; // <-- FIXED: get role from OAuth state param
    console.log("👥 Role from state param:", role);
    let firstLogin = false;

    const sessionId = uuidv4();
    const clientIp = getClientIp(req);
    const { browserInfo, deviceInfo } = parseUserAgent(req.headers['user-agent']);

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

      await createSession({
        userId: doctor._id,
        userName: doctor.name,
        userEmail: doctor.email,
        role: 'doctor',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      console.log("🔑 Issuing JWT for doctor...");
      const token = jwt.sign(
        { id: doctor._id, email: doctor.email, role: "doctor", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      console.log("📤 Redirecting doctor to frontend with token...");
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=doctor&firstLogin=${firstLogin}`
      );
    } else if (role === "nurse") {
      let nurse = await Nurse.findOne({ email });

      if (!nurse) {
        nurse = new Nurse({
          email,
          name,
          googleId,
          picture,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
        });
        await nurse.save();
        firstLogin = true;
      } else {
        nurse.googleAccessToken = accessToken;
        if (refreshToken) nurse.googleRefreshToken = refreshToken;
        await nurse.save();

        if (!nurse.phone) firstLogin = true;
      }

      await createSession({
        userId: nurse._id,
        userName: nurse.name,
        userEmail: nurse.email,
        role: 'nurse',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      const token = jwt.sign(
        { id: nurse._id, email: nurse.email, role: "nurse", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=nurse&firstLogin=${firstLogin}`
      );
    } else if (role === "receptionist") {
      let receptionist = await Receptionist.findOne({ email });

      if (!receptionist) {
        receptionist = new Receptionist({
          email,
          name,
          googleId,
          picture,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
        });
        await receptionist.save();
        firstLogin = true;
      } else {
        receptionist.googleAccessToken = accessToken;
        if (refreshToken) receptionist.googleRefreshToken = refreshToken;
        await receptionist.save();

        if (!receptionist.phone) firstLogin = true;
      }

      await createSession({
        userId: receptionist._id,
        userName: receptionist.name,
        userEmail: receptionist.email,
        role: 'receptionist',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      const token = jwt.sign(
        { id: receptionist._id, email: receptionist.email, role: "receptionist", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=receptionist&firstLogin=${firstLogin}`
      );
    } else if (role === "pharmacist") {
      let pharmacist = await Pharmacist.findOne({ email });

      if (!pharmacist) {
        pharmacist = new Pharmacist({
          email,
          name,
          googleId,
          picture,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
        });
        await pharmacist.save();
        firstLogin = true;
      } else {
        pharmacist.googleAccessToken = accessToken;
        if (refreshToken) pharmacist.googleRefreshToken = refreshToken;
        await pharmacist.save();

        if (!pharmacist.phone) firstLogin = true;
      }

      await createSession({
        userId: pharmacist._id,
        userName: pharmacist.name,
        userEmail: pharmacist.email,
        role: 'pharmacist',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      const token = jwt.sign(
        { id: pharmacist._id, email: pharmacist.email, role: "pharmacist", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=pharmacist&firstLogin=${firstLogin}`
      );
    } else if (role === 'admin') {
      const normalizedEmail = email?.toLowerCase();
      if (!ADMIN_EMAILS.has(normalizedEmail)) {
        console.log('Unauthorized admin login attempt:', email);
        return res.redirect(
          `${process.env.FRONTEND_URL}/others-login?error=admin_not_authorized`
        );
      }

      let admin = await User.findOne({ email });
      if (!admin) {
        admin = new User({
          googleId,
          email,
          name,
          picture,
          role: 'admin',
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
        });
        await admin.save();
        firstLogin = true;
      } else {
        if (admin.role !== 'admin') {
          admin.role = 'admin';
        }
        admin.googleAccessToken = accessToken;
        if (refreshToken) {
          admin.googleRefreshToken = refreshToken;
        }
        await admin.save();
      }

      await createSession({
        userId: admin._id,
        userName: admin.name,
        userEmail: admin.email,
        role: 'admin',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      const token = jwt.sign(
        { id: admin._id, email: admin.email, role: 'admin', sessionId },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=admin&firstLogin=${firstLogin}`
      );
    } else {
      console.log("🙋 Handling patient login/signup...");
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
          googleRefreshToken: refreshToken,
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
          console.log(
            "📋 Patient profile incomplete. Marking as firstLogin..."
          );
          firstLogin = true;
        }
      }

      await createSession({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        role: 'patient',
        sessionId,
        loginTime: new Date(),
        ipAddress: clientIp,
        deviceInfo,
        browserInfo
      });

      console.log("🔑 Issuing JWT for patient...");
      const token = jwt.sign(
        { id: user._id, email: user.email, role: "user", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      console.log("📤 Redirecting patient to frontend with token...");
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=patient&firstLogin=${firstLogin}`
      );
    }
  }
);

// Routes
console.log("🛣️ Mounting API routes...");
app.use('/api', dashboardRoutes);
app.use('/api', adminAuditRoutes);
app.use('/api/auth', authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/trialread", trialreadRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/tests", testRoutes);

app.get('/config', (req, res) => {
  const apiBaseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ apiBaseUrl });
});
app.use("/api/medicines", medicineRoutes);
app.use("/api/issuances", require("./routes/issuances"));
app.use("/api/nurse", require("./routes/nurses"));
app.use("/api/receptionist", require("./routes/receptionists"));
app.use("/api/pharmacist", require("./routes/pharmacists"));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});