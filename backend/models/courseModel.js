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
  getAll: async () => {
    const [rows] = await pool.query(
      `SELECT c.id,
              c.title,
              c.description,
              c.thumbnail,
              c.thumbnail_format,   /* make sure this is selected! */
              u.name AS tutorName,
              c.created_at AS createdAt
       FROM courses c
       JOIN users u ON c.tutor_id = u.id
       ORDER BY c.created_at DESC`
    );
    return rows;
  },

  createCourse: async ({ title, description, thumbnail, thumbnail_format, tutor_id }) => {
    const [res] = await pool.query(
      `INSERT INTO courses
         (title, description, thumbnail, thumbnail_format, tutor_id)
       VALUES (?,     ?,           ?,         ?,                ?)`,
      [title, description, thumbnail, thumbnail_format, tutor_id]
    );
    return res.insertId;
  },

  updateCourse: async (id, { title, description, tutor_id, thumbnail, thumbnail_format }) => {
    if (thumbnail && thumbnail_format) {
      await pool.query(
        `UPDATE courses
           SET title            = ?,
               description      = ?,
               tutor_id         = ?,
               thumbnail        = ?,
               thumbnail_format = ?,
               updated_at       = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, description, tutor_id, thumbnail, thumbnail_format, id]
      );
    } else {
      // If no new file, leave thumbnail and thumbnail_format unchanged
      await pool.query(
        `UPDATE courses
           SET title       = ?,
               description = ?,
               tutor_id    = ?,
               updated_at  = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, description, tutor_id, id]
      );
    }
  },

  deleteCourse: async (id) => {
    await pool.query(`DELETE FROM courses WHERE id = ?`, [id]);
  },

  getById: async (id) => {
    const [rows] = await pool.query(`SELECT * FROM courses WHERE id = ?`, [id]);
    return rows[0];
  },
};