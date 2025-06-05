require('dotenv').config();
const pool = require('../db');


module.exports = {
  // (1) Mark a single item done. If it already exists, IGNORE.
  markDone: async (userId, courseId, itemType, itemId) => {
    const sql = `
      INSERT INTO progress (user_id, course_id, item_type, item_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, course_id, item_type, item_id) DO NOTHING
      RETURNING id
    `;
    const params = [userId, courseId, itemType, itemId];
    const result = await pool.query(sql, params);
    // If the row was inserted, result.rows[0].id is the new ID; otherwise result.rows.length === 0
    return result.rows[0]?.id || null;
  },

  // (2) Return a Set of “type:id” strings BUT ignore the dummy "__started__" row
  getCompleted: async (userId, courseId) => {
    const sql = `
      SELECT item_type, item_id
      FROM progress
      WHERE user_id   = $1
        AND course_id = $2
        AND item_type NOT IN ('__started__', '')
    `;
    const params = [userId, courseId];
    const result = await pool.query(sql, params);
    // Build a Set of strings "type:id"
    return new Set(result.rows.map(r => `${r.item_type}:${r.item_id}`));
  },

  hasAnyProgress: async (userId, courseId) => {
    const sql = `
      SELECT 1
      FROM progress
      WHERE user_id   = $1
        AND course_id = $2
      LIMIT 1
    `;
    const params = [userId, courseId];
    const result = await pool.query(sql, params);
    return result.rows.length > 0;
  },
  // (4) DELETE all progress (dummy + real) for a given user + course
  deleteAllForUserCourse: async (userId, courseId) => {
  const sql = `
      DELETE FROM progress
      WHERE user_id   = $1
        AND course_id = $2
    `;
    await pool.query(sql, [userId, courseId]);
  },
};