// 1) Load .env immediately so all process.env.* values are available
require('dotenv').config();

// 2) Imports
const express       = require('express');
const path          = require('path');
const cors          = require('cors');
const ffmpeg        = require('fluent-ffmpeg');
const session       = require('express-session');
const cookieParser  = require('cookie-parser');
const { google }    = require('googleapis');
const { Pool } = require('pg');


// 3) Create Express app
const app = express();

// 4) (Optional) FFmpeg setup (only needed if you actually use ffmpeg in this server)
ffmpeg.setFfmpegPath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffmpeg.exe");
ffmpeg.setFfprobePath("C:/ffmpeg/ffmpeg-7.1.1-essentials_build/bin/ffprobe.exe");

// ──────────────────────────────────────────────────────────────
// 5) Session & Cookie middleware
// ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    // In production, consider using a store (e.g. Redis) instead of default MemoryStore
  })
);

// ──────────────────────────────────────────────────────────────
// 6) Configure Google OAuth2 Client
// ──────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/gmail.send',
  'https://mail.google.com/',
];

// ──────────────────────────────────────────────────────────────
// 7) OAuth Routes
// ──────────────────────────────────────────────────────────────

// 7.1) Redirect user to Google’s consent screen
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // so you get a refresh_token
    scope: SCOPES,
    prompt: 'consent',      // force consent every time (ensures refresh_token)
  });
  res.redirect(authUrl);
});

// 7.2) Callback: exchange code for tokens
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    // Store tokens in session
    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);

    // (Optional) You could save tokens/refresh_token in your MySQL user record here.

    // Redirect to a dashboard or success page:
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('Error exchanging code for tokens:', err);
    res.status(500).send('Authentication failed');
  }
});

// 7.3) Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


// ──────────────────────────────────────────────────────────────
// 9) CORS & Body Parsing
// ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: ['http://localhost:3000'], // in production, replace with your front-end/origin
    credentials: true,
  })
);
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));

// ──────────────────────────────────────────────────────────────
// 10) Static File Serving
// ──────────────────────────────────────────────────────────────
// Serves files from /public (HTML, etc.)
app.use(express.static(path.join(__dirname, '../public')));
// Serves files from /assets (CSS, JS, images, etc.)
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ──────────────────────────────────────────────────────────────
// 11) Import & Mount Your Other Route Modules
// ──────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const userRoutes     = require('./routes/userRoutes');
const sessionRoutes  = require('./routes/sessionRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const studentRoutes  = require('./routes/studentRoutes');
const tutorRoutes    = require('./routes/tutor_contentRoutes');
const overviewRoutes = require('./routes/overviewRoutes');

app.use('/api/auth',     authRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/tutor',    tutorRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api',          overviewRoutes);


// ──────────────────────────────────────────────────────────────
// 13) Start the server
// ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔐 Server running on http://localhost:${PORT}`);
});
