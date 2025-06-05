require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432
});
function rand3() {
  return Math.random().toString(36).substr(2, 3);
}

module.exports = {
  // 1. Fetch approved tutors
  async getAllTutors() {
    const [rows] = await pool.query(
      `SELECT id, name, specialty, profile_pic
       FROM users
       WHERE role = 'tutor' AND status = 'approved'`
    );
    return rows;
  },

  // 2. Fetch one tutor by id
  async getTutorById(id) {
    const [rows] = await pool.query(
      `SELECT id, name, specialty, profile_pic
       FROM users
       WHERE id = ? AND role = 'tutor'`,
      [id]
    );
    return rows[0] || null;
  },

  // 3. Create a new session request
  async createRequest(studentId, tutorId, preferredAt, note) {
    const [result] = await pool.query(
      `INSERT INTO sessions (studentId, tutorId, preferredAt, note)
       VALUES (?, ?, ?, ?)`,
      [studentId, tutorId, preferredAt, note]
    );
    return result.insertId;
  },

  // 4. List sessions for a student
  async getStudentSessions(studentId) {
    const [rows] = await pool.query(
      `SELECT s.id, s.preferredAt, s.scheduledAt, s.meet_link AS meetLink, s.status, s.reply,
              u.name AS tutorName
       FROM sessions s
       JOIN users u ON s.tutorId = u.id
       WHERE s.studentId = ?
       ORDER BY s.preferredAt DESC`,
      [studentId]
    );
    return rows;
  },

  // 5. List sessions for a tutor
  async getTutorSessions(tutorId) {
    const [rows] = await pool.query(
      `SELECT s.id, s.preferredAt, s.scheduledAt, s.meet_link AS meetLink, s.status, s.note,
              u.name AS studentName
       FROM sessions s
       JOIN users u ON s.studentId = u.id
       WHERE s.tutorId = ?
       ORDER BY s.preferredAt DESC`,
      [tutorId]
    );
    return rows;
  },


  async saveMeetLink(id, tutorId, scheduledAt, meetLink) {
  const [result] = await pool.query(
    `UPDATE sessions
       SET status      = 'scheduled',
           scheduledAt = ?,
           meet_link   = ?
     WHERE id = ? AND tutorId = ?`,
    [scheduledAt, meetLink, id, tutorId]
  );
  return result.affectedRows;
},

async getOne(id) {
  const [rows] = await pool.query(`SELECT * FROM sessions WHERE id = ?`, [id]);
  return rows[0] || null;
},


  // // 6. Approve and schedule a session
  // async scheduleSession(id, tutorId, scheduledAt) {
  //   // 1) build a pseudo–Google-Meet URL
  //   const code    = `${rand3()}-${rand3()}-${rand3()}`;
  //   const meetLink = `https://meet.google.com/${code}`;

  //   // 2) update status, scheduledAt AND meet_link
  //   const [result] = await pool.query(
  //     `UPDATE sessions
  //        SET status      = 'scheduled',
  //            scheduledAt = ?,
  //            meet_link   = ?
  //      WHERE id = ? AND tutorId = ?`,
  //     [scheduledAt, meetLink, id, tutorId]
  //   );

  //   // 3) return both the count and the URL
  //   return {
  //     affected:  result.affectedRows,
  //     meetLink
  //   };
  // },

  // 7. Decline (delete) a pending session request
  async deleteRequest(id, tutorId) {
    const [result] = await pool.query(
      `DELETE FROM sessions WHERE id = ? AND tutorId = ? AND status = 'pending'`,
      [id, tutorId]
    );
    return result.affectedRows;
  },

  // 8. Cancel an approved session by tutor
  async cancelSession(id, tutorId) {
    const [result] = await pool.query(
      `UPDATE sessions SET status = 'cancelled'
       WHERE id = ? AND tutorId = ? AND status IN ('scheduled','approved')`,
      [id, tutorId]
    );
    return result.affectedRows;
  }
};