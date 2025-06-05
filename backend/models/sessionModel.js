require('dotenv').config();
const pool = require("../db");

function rand3() {
  return Math.random().toString(36).substr(2, 3);
}

module.exports = {
  // 1. Fetch approved tutors
   async getAllTutors() {
    const sql = `
      SELECT id, name, specialty, profile_pic
      FROM users
      WHERE role = 'tutor' AND status = 'approved'
    `;
    const result = await pool.query(sql);
    return result.rows;
  },

  // 2. Fetch one tutor by id
    async getTutorById(id) {
    const sql = `
      SELECT id, name, specialty, profile_pic
      FROM users
      WHERE id = $1 AND role = 'tutor'
    `;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },

  // 3. Create a new session request
  async createRequest(studentId, tutorId, preferredAt, note) {
    const sql = `
      INSERT INTO sessions ("studentId","tutorId","preferredAt", note)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const params = [studentId, tutorId, preferredAt, note];
    const result = await pool.query(sql, params);
    return result.rows[0].id;
  },

  // 4. List sessions for a student
  async getStudentSessions(studentId) {
    const sql = `
      SELECT 
        s.id,
        s."preferredAt",
        s."scheduledAt",
        s.meet_link   AS "meetLink",
        s.status,
        s.reply,
        u.name        AS "tutorName"
      FROM sessions AS s
      JOIN users    AS u ON s."tutorId" = u.id
      WHERE s."studentId" = $1
      ORDER BY s."preferredAt" DESC
    `;
    const result = await pool.query(sql, [studentId]);
    return result.rows;
  },

  // 5. List sessions for a tutor
  async getTutorSessions(tutorId) {
    const sql = `
      SELECT 
        s.id,
        s."preferredAt",
        s."scheduledAt",
        s.meet_link     AS "meetLink",
        s.status,
        s.note,
        u.name          AS "studentName"
      FROM sessions AS s
      JOIN users    AS u ON s."studentId" = u.id
      WHERE s."tutorId" = $1
      ORDER BY s."preferredAt" DESC
    `;
    const result = await pool.query(sql, [tutorId]);
    return result.rows;
  },


  async saveMeetLink(id, tutorId, scheduledAt, meetLink) {
    const sql = `
      UPDATE sessions
      SET 
        status      = 'scheduled',
        "scheduledAt" = $1,
        meet_link   = $2
      WHERE id = $3 AND "tutorId" = $4
    `;
    const params = [scheduledAt, meetLink, id, tutorId];
    const result = await pool.query(sql, params);
    return result.rowCount; // number of rows updated
  },


  async getOne(id) {
    const sql = `SELECT * FROM sessions WHERE id = $1`;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },


  // 7. Decline (delete) a pending session request
 async deleteRequest(id, tutorId) {
    const sql = `
      DELETE 
      FROM sessions
      WHERE id = $1 
        AND "tutorId" = $2 
        AND status = 'pending'
    `;
    const result = await pool.query(sql, [id, tutorId]);
    return result.rowCount;
  },

  // 8. Cancel an approved session by tutor
 async cancelSession(id, tutorId) {
    const sql = `
      UPDATE sessions
      SET status = 'cancelled'
      WHERE id = $1 
        AND "tutorId" = $2 
        AND status IN ('scheduled','approved')
    `;
    const result = await pool.query(sql, [id, tutorId]);
    return result.rowCount;
  }
};