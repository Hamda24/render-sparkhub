const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432
});

module.exports = {
  // (1) Mark a single item done. If it already exists, IGNORE.
  markDone: async (userId, courseId, itemType, itemId) => {
    const [res] = await pool.query(
      `INSERT IGNORE INTO progress
         (user_id, course_id, item_type, item_id)
       VALUES (?,       ?,         ?,         ?)`,
      [userId, courseId, itemType, itemId]
    );
    return res.insertId;
  },

  // (2) Return a Set of “type:id” strings BUT ignore the dummy "__started__" row
  getCompleted: async (userId, courseId) => {
    const [rows] = await pool.query(
      `SELECT item_type, item_id
       FROM progress
      WHERE user_id   = ?
        AND course_id = ?
         AND (item_type <> '__started__' AND item_type <> '' )`,
      [userId, courseId]
    );
    return new Set(rows.map(r => `${r.item_type}:${r.item_id}`));
  },

  hasAnyProgress: async (userId, courseId) => {
    const [rows] = await pool.query(
      `SELECT 1
         FROM progress
        WHERE user_id   = ?
          AND course_id = ?
        LIMIT 1`,
      [userId, courseId]
    );
    return rows.length > 0;
  },

  // (4) DELETE all progress (dummy + real) for a given user + course
  deleteAllForUserCourse: async (userId, courseId) => {
    await pool.query(
      `DELETE
         FROM progress
        WHERE user_id   = ?
          AND course_id = ?`,
      [userId, courseId]
    );
  }
};