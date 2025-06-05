// controllers/tutorRequestController.js
require('dotenv').config();
const jwt        = require('jsonwebtoken');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const User       = require('../models/userModel'); // make sure this also exports deleteById

// 1) OAuth2 setup
const oAuth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);
oAuth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

// 2) transporter helper
async function createTransporter() {
  const { token } = await oAuth2.getAccessToken();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type:         'OAuth2',
      user:         process.env.EMAIL_USER,
      clientId:     process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken:  token,
    },
  });
}

exports.respondRequest = async (req, res, next) => {
  try {
    const { token, decision } = req.query;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tutorId = payload.tutorId;

    // 1) ensure link is still valid
    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.email_token !== token) {
      // invalid or already used → send back to login
      return res.redirect(`${process.env.APP_URL}/login.html`);
    }

    if (decision === 'accept') {
      // 2) create the real Meet
      const interviewDate = new Date(payload.dt);
      const calendar = google.calendar({ version:'v3', auth:oAuth2 });
      const event = {
        summary: `SparkHub Tutor Interview`,
        start:   { dateTime: interviewDate.toISOString() },
        end:     { dateTime: new Date(interviewDate.getTime() + 30*60000).toISOString() },
        conferenceData: {
          createRequest: { requestId: `intv-${tutorId}-${Date.now()}` }
        }
      };
      const created = await calendar.events.insert({
        calendarId: 'primary',
        resource:   event,
        conferenceDataVersion: 1
      });
      const meetLink = created.data.hangoutLink;

      // 3) update DB, clear token
      await User.updateTutorStatus(
        tutorId,
        'scheduled',
        interviewDate,
        meetLink,
        null
      );

      // 4) e-mail them their Meet link
      const transporter = await createTransporter();
      await transporter.sendMail({
        to:      tutor.email,
        from:    process.env.EMAIL_USER,
        subject: 'Your Confirmed SparkHub Interview Link',
        html: `
          <p>Hi ${tutor.name},</p>
          <p>Your interview is confirmed for <strong>${interviewDate.toLocaleString()}</strong>.</p>
          <p>Join on Google Meet: <a href="${meetLink}">${meetLink}</a></p>
        `
      });

      // 5) send them home
      return res.redirect(`${process.env.APP_URL}/login.html`);
    } else {
      // they declined → drop their application
      await User.deleteById(tutorId);
      return res.send('<h1>Your application has been withdrawn.</h1>');
    }
  } catch (err) {
    // any error → safe redirect home
    return res.redirect(`${process.env.APP_URL}/login.html`);
  }
};
