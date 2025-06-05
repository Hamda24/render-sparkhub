require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432
});

module.exports = {
  findByEmail: async (email) => {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?', [email]
    );
    return rows[0];
  },

  create: async ({
    name, email, passwordHash, role,
    resumeFile = null, profilePic = null, specialty = null
  }) => {
    const status = role === 'tutor' ? 'pending' : 'approved';
    const [res] = await pool.query(
      `INSERT INTO users  
       (name, email, password_hash, role, status, resume_file, profile_pic, specialty)
     VALUES (?,?,?,?,?,?,?,?)`,
      [name, email, passwordHash, role, status, resumeFile, profilePic, specialty]
    );
    return res.insertId;
  },

  findTutorApplications: async () => {
    const [rows] = await pool.query(
      `SELECT
       id,
       name,
       email,
       created_at,
       status,
       interview_date
     FROM users
    WHERE role = 'tutor'
      AND status IN ('pending','scheduled')`
    );
    return rows;
  },

  updateTutorStatus: async (
    id,
    status,
    interviewDate = null,
    meetLink = null,
    emailToken = null
  ) => {
    await pool.query(
      `UPDATE users SET
       status         = ?,
       interview_date = ?,
       meet_link      = ?,
       email_token    = ?
     WHERE id = ?`,
      [status, interviewDate, meetLink, emailToken, id]
    );
  },

  findById: async (id) => {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ?', [id]
    );
    return rows[0];
  },

  updateRoleAndStatus: async (id, role, status) => {
    await pool.query(
      'UPDATE users SET role=?, status=? WHERE id=?',
      [role, status, id]
    );
  },

  deleteById: async (id) => {
    await pool.query(
      `DELETE FROM users WHERE id = ?`,
      [id]
    );
  },

  clearEmailToken: async (id) => {
    await pool.query(
      `UPDATE users
        SET email_token = NULL
      WHERE id = ?`,
      [id]
    );
  },

  findByRoles: async (allowedRoles, onlyRole) => {
    let sql = 'SELECT * FROM users WHERE role IN (?)';
    const params = [allowedRoles];
    if (onlyRole && allowedRoles.includes(onlyRole)) {
      sql += ' AND role = ?';
      params.push(onlyRole);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  updateEmailById: async (id, email) => {
    await pool.query(
      'UPDATE users SET email = ? WHERE id = ?',
      [email, id]
    );
  },

  updatePasswordById: async (id, password_hash) => {
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, id]
    );
  }

};