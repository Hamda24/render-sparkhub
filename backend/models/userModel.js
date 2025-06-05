require('dotenv').config();
const pool = require("../db");

module.exports = {
  findByEmail: async (email) => {
    const sql = `SELECT * FROM users WHERE email = $1`;
    const result = await pool.query(sql, [email]);
    return result.rows[0] || null;
  },

  // 2. Create a new user (student or tutor). If tutor, status = 'pending'; otherwise 'approved'
  create: async ({ name, email, passwordHash, role, resumeFile = null, profilePic = null, specialty = null }) => {
    const status = role === 'tutor' ? 'pending' : 'approved';
    const sql = `
      INSERT INTO users
        (name, email, password_hash, role, status, resume_file, profile_pic, specialty)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const params = [name, email, passwordHash, role, status, resumeFile, profilePic, specialty];
    const result = await pool.query(sql, params);
    return result.rows[0].id;
  },

  // 3. Fetch all tutor applications with status 'pending' or 'scheduled'
  findTutorApplications: async () => {
    const sql = `
      SELECT 
        id, 
        name, 
        email, 
        created_at AS "createdAt", 
        status, 
        interview_date AS "interviewDate"
      FROM users
      WHERE role = 'tutor'
        AND status IN ('pending', 'scheduled')
      ORDER BY created_at DESC
    `;
    const result = await pool.query(sql, []);
    return result.rows;
  },

  // 4. Update tutor’s status, interview date, meet link, and email token
  updateTutorStatus: async (id, status, interviewDate = null, meetLink = null, emailToken = null) => {
    const sql = `
      UPDATE users
      SET
        status         = $1,
        interview_date = $2,
        meet_link      = $3,
        email_token    = $4
      WHERE id = $5
    `;
    const params = [status, interviewDate, meetLink, emailToken, id];
    await pool.query(sql, params);
  },

  // 5. Find a user by ID
  findById: async (id) => {
    const sql = `SELECT * FROM users WHERE id = $1`;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },

  // 6. Update a user’s role and status
  updateRoleAndStatus: async (id, role, status) => {
    const sql = `UPDATE users SET role = $1, status = $2 WHERE id = $3`;
    const params = [role, status, id];
    await pool.query(sql, params);
  },

  // 7. Delete a user by ID
  deleteById: async (id) => {
    const sql = `DELETE FROM users WHERE id = $1`;
    await pool.query(sql, [id]);
  },

  // 8. Clear a user’s email token
  clearEmailToken: async (id) => {
    const sql = `
      UPDATE users
      SET email_token = NULL
      WHERE id = $1
    `;
    await pool.query(sql, [id]);
  },

  // 9. Fetch users by roles. If onlyRole is provided, filter further by that single role.
  findByRoles: async (allowedRoles, onlyRole) => {
    if (onlyRole && allowedRoles.includes(onlyRole)) {
      // Only fetch users with exactly that role
      const sql = `
        SELECT * 
        FROM users 
        WHERE role = $1
        ORDER BY created_at DESC
      `;
      const result = await pool.query(sql, [onlyRole]);
      return result.rows;
    } else {
      // Fetch users whose role is any in allowedRoles array
      const sql = `
        SELECT *
        FROM users
        WHERE role = ANY($1::text[])
        ORDER BY created_at DESC
      `;
      const result = await pool.query(sql, [allowedRoles]);
      return result.rows;
    }
  },

  // 10. Update a user’s email by ID
  updateEmailById: async (id, email) => {
    const sql = `UPDATE users SET email = $1 WHERE id = $2`;
    await pool.query(sql, [email, id]);
  },

  // 11. Update a user’s password hash by ID
  updatePasswordById: async (id, password_hash) => {
    const sql = `UPDATE users SET password_hash = $1 WHERE id = $2`;
    await pool.query(sql, [password_hash, id]);
  }

};