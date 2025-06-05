require("dotenv").config();

// 2) Imports (ALL CommonJS style in one place)
const express = require("express");
const path = require("path");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const connectRedis = require("connect-redis");      // ← import connect-redis as a factory
const { createClient } = require("redis");
const { google } = require("googleapis");
const pool = require("../db");

// 3) Create Express app
const app = express();

// ─── 4) WRAP REDIS + SESSION SETUP IN AN ASYNC IIFE ────────────────────────────
(async () => {
  let sessionStore = null;

  if (process.env.REDIS_URL) {
    try {
      // a) Create & connect the Redis client
      const redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on("error", (err) => console.error("Redis Client Error", err));
      await redisClient.connect();

      // b) Create the RedisStore by passing in the `session` object
      const RedisStore = connectRedis(session);
      sessionStore = new RedisStore({ client: redisClient });

      console.log("✨ Connected to Redis at", process.env.REDIS_URL);
    } catch (err) {
      console.error("⚠️ Could not connect to Redis:", err);
      console.error("⚠️ Falling back to in-memory session store (NOT for production).");
    }
  } else {
    console.warn("⚠️ REDIS_URL is not set. Using in-memory session store.");
  }

  // ─── 5) HOOK UP THE SESSION MIDDLEWARE ──────────────────────────────────────────
  const sessionOptions = {
    secret: process.env.SESSION_SECRET || "change-this-to-a-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,     // Render is HTTPS by default
      sameSite: "lax",  // adjust if you need "strict" or "none"
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  };
  if (sessionStore) {
    sessionOptions.store = sessionStore;
  }
  app.use(session(sessionOptions));

  // ─── 6) ANY OTHER COOKIE/SESSION MIDDLEWARE (if needed) ───────────────────────
  app.use(cookieParser());
  // ─── 6) OPTIONAL: FFmpeg setup (only if you use ffmpeg)
  ffmpeg.setFfmpegPath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffmpeg.exe");
  ffmpeg.setFfprobePath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffprobe.exe");

  // ─── 7) GOOGLE OAUTH2 CLIENT SETUP ───────────────────────────────────────────────
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

  // 7.1) Redirect user to Google’s consent screen
  app.get("/auth/google", (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    res.redirect(authUrl);
  });

  // 7.2) Callback: exchange code for tokens
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

  // 7.3) Logout
  app.get("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  // ─── 8) POSTGRES POOL (if you need it elsewhere you can export/import it) ─────────
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  // (You can attach dbPool to req if you like, or just import this file’s pool in your route modules.)

  // ─── 9) CORS & BODY PARSING ─────────────────────────────────────────────────────
  app.use(
    cors({
      origin: ["http://localhost:3000"], // in production, use your actual front-end domain
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1gb" }));
  app.use(express.urlencoded({ limit: "1gb", extended: true }));

  // ─── 10) STATIC FILE SERVING ────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/assets", express.static(path.join(__dirname, "../assets")));

  // ─── 11) IMPORT AND MOUNT YOUR ROUTE MODULES ───────────────────────────────────
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

  // ─── 12) START THE SERVER ───────────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🔐 Server running on port ${PORT}`);
  });
})();