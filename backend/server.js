// Entry point for Express backend
const dns = require("dns");
// Use reliable public DNS resolvers. The local VM resolver intermittently
// fails the Atlas SRV lookup (querySrv ESERVFAIL), which silently breaks
// reconnection until the process is restarted.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const session = require("express-session");
const passport = require("passport");

const Admin = require("./models/Admin");
const User = require("./models/User");
const Doctor = require("./models/Doctor");
const Nurse = require("./models/Nurse");
const Receptionist = require("./models/Receptionist");
const Pharmacist = require("./models/Pharmacist");

const { isEmailAllowed } = require("./utils/googleSheetAuth");
const { createSession, getClientIp, parseUserAgent, uuidv4 } = require('./utils/audit');
const auditLogger = require('./middleware/auditLogger');

const app = express();

// ================= ROUTES =================
const adminRoutes = require('./routes/admin');
const adminAuditRoutes = require('./routes/adminAudit');
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

// ================= SHEETS =================
const SHEETS = {
  doctor: { sheetId: process.env.DOCTOR_SHEET_ID },
  nurse: { sheetId: process.env.NURSE_SHEET_ID },
  receptionist: { sheetId: process.env.RECEPTIONIST_SHEET_ID },
  pharmacist: { sheetId: process.env.PHARMACIST_SHEET_ID },
  admin: { sheetId: process.env.ADMIN_SHEET_ID },
};

// ================= MIDDLEWARE =================
console.log("⚙️ Setting up middleware...");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditLogger);

app.use('/uploads', express.static('backend/uploads'));

app.use(session({
  secret: process.env.SESSION_SECRET || "my_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

// ================= DB CONNECTION =================
console.log("🔗 Connecting to MongoDB...");

mongoose.set("strictQuery", false);

if (process.env.MONGOOSE_DEBUG === 'true') {
  mongoose.set('debug', true);
}

// Fail fast instead of buffering queries for 10s when the connection is down.
// Combined with the reconnect loop below, the app self-heals without a redeploy.
mongoose.set("bufferCommands", false);

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
};

let reconnectTimer = null;
function connectWithRetry() {
  mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => {
      console.error("❌ MongoDB error:", err.message);
      console.log("⏳ Retrying MongoDB connection in 5s...");
      scheduleReconnect();
    });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWithRetry();
  }, 5000);
}

connectWithRetry();

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected — scheduling reconnect.");
  scheduleReconnect();
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

// ================= PASSPORT =================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
},
  (accessToken, refreshToken, profile, done) => {
    return done(null, {
      googleId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    });
  }));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ================= GOOGLE LOGIN =================
app.get("/api/auth/google", (req, res, next) => {
  const role = req.query.role || "patient";
  passport.authenticate("google", {
    state: role,
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
});

// ================= CALLBACK =================
app.get("/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {

    const { email, name, googleId, picture, accessToken, refreshToken } = req.user;
    const role = req.query.state || "patient";

    let firstLogin = false;

    const sessionId = uuidv4();
    const clientIp = getClientIp(req);
    const { browserInfo, deviceInfo } = parseUserAgent(req.headers['user-agent']);

    let token;

    // ================= DOCTOR =================
    if (role === "doctor") {

      const allowed = await isEmailAllowed(SHEETS.doctor.sheetId, email);
      if (!allowed) return res.redirect(`${process.env.FRONTEND_URL}/others-login`);

      let doctor = await Doctor.findOne({ email });

      if (!doctor) {
        doctor = new Doctor({ name, email, googleId, picture, googleAccessToken: accessToken, googleRefreshToken: refreshToken });
        await doctor.save();
        firstLogin = true;
      }

      await createSession({ userId: doctor._id, userName: doctor.name, userEmail: doctor.email, role: "doctor", sessionId, ipAddress: clientIp, deviceInfo, browserInfo });

      token = jwt.sign({ id: doctor._id, name: doctor.name, email, role: "doctor", sessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&role=doctor&firstLogin=${firstLogin}`);
    }

    // ================= NURSE =================
    else if (role === "nurse") {

      const allowed = await isEmailAllowed(SHEETS.nurse.sheetId, email);
      if (!allowed) return res.redirect(`${process.env.FRONTEND_URL}/others-login`);

      let nurse = await Nurse.findOne({ email });

      if (!nurse) {
        nurse = new Nurse({ email, name, googleId, picture, googleAccessToken: accessToken, googleRefreshToken: refreshToken });
        await nurse.save();
        firstLogin = true;
      }

      token = jwt.sign({ id: nurse._id, name: nurse.name, email, role: "nurse", sessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&role=nurse&firstLogin=${firstLogin}`);
    }

    // ================= RECEPTIONIST =================
    else if (role === "receptionist") {

      const allowed = await isEmailAllowed(SHEETS.receptionist.sheetId, email);
      if (!allowed) return res.redirect(`${process.env.FRONTEND_URL}/others-login`);

      let r = await Receptionist.findOne({ email });

      if (!r) {
        r = new Receptionist({ email, name, googleId, picture, googleAccessToken: accessToken, googleRefreshToken: refreshToken });
        await r.save();
        firstLogin = true;
      }

      token = jwt.sign({ id: r._id, name: r.name, email, role: "receptionist", sessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&role=receptionist&firstLogin=${firstLogin}`);
    }

    // ================= PHARMACIST =================
    else if (role === "pharmacist") {

      const allowed = await isEmailAllowed(SHEETS.pharmacist.sheetId, email);
      if (!allowed) return res.redirect(`${process.env.FRONTEND_URL}/others-login`);

      let p = await Pharmacist.findOne({ email });

      if (!p) {
        p = new Pharmacist({ email, name, googleId, picture, googleAccessToken: accessToken, googleRefreshToken: refreshToken });
        await p.save();
        firstLogin = true;
      }

      token = jwt.sign({ id: p._id, name: p.name, email, role: "pharmacist", sessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&role=pharmacist&firstLogin=${firstLogin}`);
    }

    // ================= ADMIN =================
    // ================= ADMIN =================
    else if (role === "admin") {

      const allowed = await isEmailAllowed(SHEETS.admin.sheetId, email);
      if (!allowed) return res.redirect(`${process.env.FRONTEND_URL}/others-login`);

      let admin = await Admin.findOne({ email });

      if (!admin) {
        admin = new Admin({
          email,
          name,
          googleId,
          picture,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken
        });
        await admin.save();
        firstLogin = true;
      } else {
        // 🔥 FIX: check profile completeness
        if (!admin.name || !admin.phone || !admin.department) {
          firstLogin = true;
        }
      }

      token = jwt.sign(
        { id: admin._id, name: admin.name, email, role: "admin", sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?token=${token}&role=admin&firstLogin=${firstLogin}`
      );
    }
    // ================= PATIENT =================
    else {

      if (!email.endsWith("@iitdh.ac.in")) {
        return res.redirect(`${process.env.FRONTEND_URL}/`);
      }

      let user = await User.findOne({ email });

      if (!user) {
        user = new User({ googleId, email, name, picture, role: "patient" });
        await user.save();
        firstLogin = true;
      }

      token = jwt.sign({ id: user._id, name: user.name, email, role: "patient", sessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&role=patient&firstLogin=${firstLogin}`);
    }
  });

// ================= ROUTE MOUNTING =================
console.log("🛣️ Mounting routes...");

app.use('/api', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/audit', adminAuditRoutes); // ✅ FIXED (was collision risk)
app.use('/api/auth', authRoutes);

app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trialread", trialreadRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/medicines", medicineRoutes);

app.use("/api/issuances", require("./routes/issuances"));
app.use("/api/nurse", require("./routes/nurses"));
app.use("/api/receptionist", require("./routes/receptionists"));
app.use("/api/pharmacist", require("./routes/pharmacists"));

// ================= CONFIG =================
app.get('/api/config', (req, res) => {
  const apiBaseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ apiBaseUrl });
});

// ================= START =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});