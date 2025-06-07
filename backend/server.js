require("dotenv").config();

//  Imports (ALL CommonJS style in one place)
const express = require("express");
const path = require("path");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { google } = require("googleapis");
const PgSession = require("connect-pg-simple")(session);
const pool = require("./db");
const http = require("http");

// Create Express app
const app = express();
const server = http.createServer(app);



// ───  HOOK UP THE POSTGRES SESSION STORE ─────────────────────────────────────
app.use(
  session({
    store: new PgSession({ pool, tableName: "user_sessions" }),
    secret: process.env.SESSION_SECRET || "change-this-to-a-long-random-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,          // true if behind HTTPS (Render is HTTPS by default)
      sameSite: "lax",       // adjust to "strict" or "none" if needed
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    },
  })
);

// ───  ANY OTHER MIDDLEWARE YOU NEED ──────────────────────────────────────────
app.use(cookieParser());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));

// ───  OPTIONAL: FFmpeg setup (only if you use ffmpeg)
// if (!process.env.RENDER) {
//   // Only set custom paths locally (on Windows)
//   ffmpeg.setFfmpegPath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffmpeg.exe");
//   ffmpeg.setFfprobePath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffprobe.exe");
// }

// ───  GOOGLE OAUTH2 CLIENT SETUP ───────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/gmail.send",
  "https://mail.google.com/",
];

//  Redirect user to Google’s consent screen
app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});

//  Callback: exchange code for tokens
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    // Store tokens in session
    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    // (Optional) Save refreshToken in your database if you want persistent logins
    res.redirect("/dashboard.html");
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    res.status(500).send("Authentication failed");
  }
});

//  Logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// ─── IMPORT AND MOUNT YOUR ROUTE MODULES ───────────────────────────────────
// (Assuming you have these route files in a ./routes/ folder)
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const tutorRoutes = require("./routes/tutor_contentRoutes");
const overviewRoutes = require("./routes/overviewRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", overviewRoutes);

// ───  STATIC FILE SERVING ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));


server.timeout = 10 * 60 * 1000; // 10 minutes
server.keepAliveTimeout = 10 * 60 * 1000; // Optional, keep connection alive

// ─── 12) START THE SERVER ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔐 Server running on port ${PORT}`);
});