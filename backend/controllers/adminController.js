const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const nodemailer = require('nodemailer');
const upload = require('../middleware/upload');
const courseModel = require('../models/courseModel');
const pool = require("../db");



require('dotenv').config();
// set up your OAuth2 client once
const oAuth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);
oAuth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

async function createTransporter() {
  const { token } = await oAuth2.getAccessToken();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: token,
    },
  });
}

exports.scheduleTutorInterview = async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    const { interviewDate } = req.body;
    const dt = new Date(interviewDate);
    const dtEnd = new Date(dt.getTime() + 30 * 60000);

    // 1) Check calendar free/busy
    const calendar = google.calendar({ version: 'v3', auth: oAuth2 });
    const fb = await calendar.freebusy.query({
      resource: {
        timeMin: dt.toISOString(),
        timeMax: dtEnd.toISOString(),
        items: [{ id: 'primary' }]
      }
    });
    const busySlots = fb.data.calendars.primary.busy;
    if (busySlots && busySlots.length) {
      // there’s at least one overlap
      return res
        .status(409)
        .json({ error: 'This time slot is already booked. Please choose another.' });
    }

    // 2) It’s free → create the event
    const event = {
      summary: `SparkHub Tutor Interview`,
      start: { dateTime: dt.toISOString() },
      end: { dateTime: dtEnd.toISOString() },
      conferenceData: { createRequest: { requestId: `intv-${tutorId}-${Date.now()}` } }
    };
    const created = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1
    });
    const meetLink = created.data.hangoutLink;

    // 1) sign a one-time JWT for their confirm/decline link
    const emailToken = jwt.sign({ tutorId, dt }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    // 2) just update the scheduled date & token in the DB
    await User.updateTutorStatus(
      tutorId,
      'scheduled',   // status
      dt,            // interview_date
      null,          // meet_link (still null)
      emailToken
    );

    // 3) email invitation WITHOUT a meet link
    const tutor = await User.findById(tutorId);
    const baseUrl = process.env.APP_URL;
    const acceptUrl = `${baseUrl}/api/auth/tutor/requests/respond?token=${emailToken}&decision=accept`;
    const rejectUrl = `${baseUrl}/api/auth/tutor/requests/respond?token=${emailToken}&decision=reject`;

    const transporter = await createTransporter();
    await transporter.sendMail({
      to: tutor.email,
      from: process.env.EMAIL_USER,
      subject: 'Please Confirm Your Tutor Interview',
      html: `
         <p>Hi ${tutor.name},</p>
         <p>Your interview is tentatively set for <strong>${dt.toLocaleString()}</strong>.</p>
         <p>
         <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:8px 12px;
        background:#4CAF50;color:#fff;border-radius:4px;text-decoration:none">
        ✅ Confirm
       </a>
       &nbsp;
       <a href="${rejectUrl}" target="_blank" style="display:inline-block;padding:8px 12px;
       background:#F44336;color:#fff;border-radius:4px;text-decoration:none">
        ❌ Decline
       </a>
       </p>
      `
    });

    res.json({ message: 'Invitation sent; waiting on confirmation.' });
  } catch (err) {
    next(err);
  }
};

exports.approveTutor = async (req, res, next) => {
  try {
    const tutorId = req.params.id;

    // 1) Flip status → 'approved'
    await User.updateTutorStatus(
      tutorId,
      'approved',    // new status
      null,          // clear interviewDate if you like
      null,          // clear meetLink
      null           // clear emailToken
    );

    // 2) Optionally let the tutor know by e-mail:
    const tutor = await User.findById(tutorId);
    const transporter = await createTransporter();
    await transporter.sendMail({
      to: tutor.email,
      from: process.env.EMAIL_USER,
      subject: 'You’re now a SparkHub Tutor!',
      html: `<p>Congratulations, ${tutor.name}!<br>
                Your application has been approved—you can now log in as a tutor.</p>`
    });

    res.json({ message: 'Tutor approved and notified.' });
  } catch (err) {
    next(err);
  }
};

exports.listTutorRequests = async (req, res, next) => {
  try {
    const apps = await User.findTutorApplications();
    res.json({ apps });
  } catch (err) {
    next(err);
  }
};

exports.rejectTutorRequest = async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    await User.deleteById(tutorId);
    res.json({ message: 'Tutor request removed.' });
  } catch (err) {
    next(err);
  }
};

//list all session requests for admin overview
exports.listAllSessions = async (req, res) => {
  try {
    const sql = `
     SELECT 
    s.id, 
    s.preferredat   AS "preferredAt", 
    s.scheduledat   AS "scheduledAt", 
    s.meet_link     AS "meetLink", 
    s.status,
    st.name         AS "studentName", 
    tt.name         AS "tutorName"
  FROM sessions AS s
  JOIN users AS st ON s.studentid = st.id
  JOIN users AS tt ON s.tutorid = tt.id
  ORDER BY s.preferredat DESC
`;
    const result = await pool.query(sql, []);
    // result.rows will be an array of objects with keys: id, preferredAt, scheduledAt, meetLink, status, studentName, tutorName
    return res.json({ sessions: result.rows });
  } catch (err) {
    console.error('Server error listing sessions:', err);
    return res.status(500).json({ error: 'Server error listing sessions' });
  }
};


// ======================
// 6) cancelSession
//    (admin action: cancel one session by setting status = 'cancelled')
// ======================
exports.cancelSession = async (req, res) => {
  const sessionId = Number(req.params.id);
  try {
    const sql = `UPDATE sessions SET status = $1 WHERE id = $2`;
    const params = ['cancelled', sessionId];
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ message: 'Session cancelled' });
  } catch (err) {
    console.error('Server error cancelling session:', err);
    return res.status(500).json({ error: 'Server error cancelling session' });
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    // optional ?role=student or ?role=tutor
    const role = req.query.role;
    const users = await User.findByRoles(['student', 'tutor'], role);
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const { title, description, tutor_id } = req.body;

    if (!tutor_id) {
      return res.status(400).json({ error: "Missing tutor_id" });
    }
    // If Multer parsed a file, req.file.buffer is the raw bytes,
    // and req.file.mimetype might be "image/jpeg" or "image/png".
    let thumbnailBuffer = null;
    let thumbnailFormat = null;
    if (req.file && req.file.buffer) {
      thumbnailBuffer = req.file.buffer;
      // Split off the subtype: e.g. "jpeg" from "image/jpeg"
      thumbnailFormat = req.file.mimetype.split('/')[1];
    }

    // Pass BOTH the BLOB and its format string to the model
    const newId = await courseModel.createCourse({
      title,
      description,
      thumbnail: thumbnailBuffer,
      thumbnail_format: thumbnailFormat,
      tutor_id//: tutorId
    });
    res.status(201).json({ message: 'Course created', id: newId });
  } catch (err) {
    console.error("🔥 Error in createCourse:", err);
    res.status(500).json({ error: "Failed to create course", details: err.message });
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id;
    const { title, description, tutor_id } = req.body;

    let thumbnailBuffer = null;
    let thumbnailFormat = null;
    if (req.file && req.file.buffer) {
      thumbnailBuffer = req.file.buffer;
      thumbnailFormat = req.file.mimetype.split('/')[1];
    }

    await courseModel.updateCourse(courseId, {
      title,
      description,
      tutor_id: parseInt(tutor_id),
      thumbnail: thumbnailBuffer,
      thumbnail_format: thumbnailFormat // if no new file, remains null and model won’t overwrite
    });

    res.json({ message: 'Course updated' });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id;
    await courseModel.deleteCourse(courseId);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const course = await require('../models/courseModel').getById(req.params.id);
    res.json({ course });
  } catch (err) {
    next(err);
  }
};

exports.listCourses = async (req, res, next) => {
  try {
    const courses = await courseModel.getAll();
    res.json({ courses });
  } catch (err) {
    next(err);
  }
};