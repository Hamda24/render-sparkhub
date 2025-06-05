const path = require('path');
const { google } = require('googleapis');
const sessionModel = require('../models/sessionModel');
const User = require('../models/userModel');


const oAuth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);
oAuth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const calendar = google.calendar({
    version: 'v3',
    auth: oAuth2     // <-- make sure this is your OAuth2 client
});

// 1. List all tutors for students to browse
exports.listTutors = async (req, res) => {
    try {
        const tutors = await sessionModel.getAllTutors();
        // map profile_pic → profile_pic_url
        const out = tutors.map(t => ({
            id: t.id,
            name: t.name,
            specialty: t.specialty,
        }));
        return res.json({ tutors: out });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error listing tutors' });
    }
};

// 2. Get single tutor details
exports.getTutorById = async (req, res) => {
    const tutorId = req.params.id;
    try {
        const tutor = await sessionModel.getTutorById(tutorId);
        if (!tutor) return res.status(404).json({ error: 'Tutor not found' });
        res.json({ tutor });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching tutor' });
    }
};

// 3. Student creates a session request
exports.createSessionRequest = async (req, res) => {
    const studentId = req.user.id;
    const { tutorId, preferredAt, note } = req.body;
    try {
        const id = await sessionModel.createRequest(studentId, tutorId, preferredAt, note);
        res.status(201).json({ message: 'Request created', id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error creating request' });
    }
};

// 4. Student views their requests
exports.listStudentSessions = async (req, res) => {
    const studentId = req.user.id;
    try {
        const sessions = await sessionModel.getStudentSessions(studentId);
        res.json({ sessions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error listing your sessions' });
    }
};

// 5. Tutor views incoming requests
exports.listTutorSessions = async (req, res) => {
    const tutorId = req.user.id;
    try {
        const sessions = await sessionModel.getTutorSessions(tutorId);
        res.json({ sessions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error listing incoming requests' });
    }
};

// 6. Tutor approves (schedules) a session
exports.approveSession = async (req, res) => {
    const sessionId = req.params.id;
    const tutorId = req.user.id;
    const { scheduledAt } = req.body;

    // 3) Load the session so we can verify permissions and grab studentId
    const session = await sessionModel.getOne(sessionId);
    if (!session || session.tutorId !== tutorId) {
        return res.status(404).json({ error: 'Not found or unauthorized' });
    }

    // 4) Load student & tutor names for the event title
    const student = await User.findById(session.studentId);
    const tutor = await User.findById(tutorId);

    // 5) Build the event
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    const requestId = `sess-${sessionId}-${Date.now()}`;
    const event = {
        summary: `Tutoring: ${student.name} ↔︎ ${tutor.name}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: {
            createRequest: { requestId }
        }
    };

    // 6) Insert with conferenceDataVersion=1 to generate a real Meet link
    const created = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1
    });

    const meetLink = created.data.hangoutLink;
    if (!meetLink) {
        return res.status(500).json({ error: 'Couldn’t generate a Meet link' });
    }

    // 7) Save it in your sessions table
    const affected = await sessionModel.saveMeetLink(
        sessionId, tutorId, scheduledAt, meetLink
    );
    if (!affected) {
        return res.status(500).json({ error: 'Database save error' });
    }

    // 8) Return it to the front-end
    res.json({ message: 'Session scheduled', meetLink });
};

// 7. Tutor declines a request
exports.declineSession = async (req, res) => {
    const sessionId = req.params.id;
    const tutorId = req.user.id;
    try {
        const affected = await sessionModel.deleteRequest(sessionId, tutorId);
        if (!affected) return res.status(404).json({ error: 'No pending request found or not permitted' });
        res.json({ message: 'Request declined' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error declining request' });
    }
};

// 8. Tutor cancels an approved session
exports.cancelSessionByTutor = async (req, res) => {
    const sessionId = req.params.id;
    const tutorId = req.user.id;
    try {
        const affected = await sessionModel.cancelSession(sessionId, tutorId);
        if (!affected) return res.status(404).json({ error: 'Session not found or not cancellable' });
        res.json({ message: 'Session cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error cancelling session' });
    }
};
