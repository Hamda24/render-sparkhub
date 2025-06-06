require('dotenv').config();
const pool = require("../db");


module.exports = {
  getAll: async () => {
     const sql = `
      SELECT
        c.id,
        c.title,
        c.description,
        c.thumbnail,
        c.thumbnail_format,
        u.name AS "tutorName",
        c.created_at AS "createdAt"
      FROM courses AS c
      JOIN users AS u ON c.tutor_id = u.id
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(sql, []);
    return result.rows;
  },
async createCourse(tutorId, title, description, thumbnail, thumbnailFormat) {
    const sql = `
      INSERT INTO courses
        (tutor_id, title, description, thumbnail, thumbnail_format)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        tutor_id         AS "tutorId",
        title,
        description,
        created_at       AS "createdAt",
        updated_at       AS "updatedAt",
        thumbnail,
        thumbnail_format AS "thumbnailFormat"
    `;
    const params = [tutorId, title, description, thumbnail, thumbnailFormat];
    const result = await pool.query(sql, params);
    return result.rows[0].id;
  },

  updateCourse: async (id, { title, description, tutor_id, thumbnail, thumbnail_format }) => {
     if (thumbnail && thumbnail_format) {
      const sql = `
        UPDATE courses
        SET
          title            = $1,
          description      = $2,
          tutor_id         = $3,
          thumbnail        = $4,
          thumbnail_format = $5,
          updated_at       = CURRENT_TIMESTAMP
        WHERE id = $6
      `;
      const params = [title, description, tutor_id, thumbnail, thumbnail_format, id];
      await pool.query(sql, params);
    } else {
      const sql = `
        UPDATE courses
        SET
          title       = $1,
          description = $2,
          tutor_id    = $3,
          updated_at  = CURRENT_TIMESTAMP
        WHERE id = $4
      `;
      const params = [title, description, tutor_id, id];
      await pool.query(sql, params);
    }
  },

  deleteCourse: async (id) => {
  const sql = `DELETE FROM courses WHERE id = $1`;
    await pool.query(sql, [id]);
  },

  getById: async (id) => {
     const sql = `SELECT * FROM courses WHERE id = $1`;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },
};