require("dotenv").config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432
});

module.exports = {
  // Fetch a single content row (including its BLOB "data")
  findById: async (id) => {
    const [rows] = await pool.query(
      `SELECT 
         id,
         title,
         type,
         data,
         course_id
       FROM content_items
       WHERE id = ?`,
      [id]
    );
    return rows[0];
  },

  // Fetch all content items for one course (no BLOB data here)
  findByCourse: async (courseId) => {
    const [rows] = await pool.query(
      `SELECT id, title, type, display_order
         FROM content_items
        WHERE course_id = ?
        ORDER BY display_order`,
      [courseId]
    );
    return rows;
  },

  create: async ({ course_id, title, type, data, display_order }) => {
    const [res] = await pool.execute(
      `INSERT INTO content_items
         (course_id, title, type, data, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [course_id, title, type, data, display_order]
    );
    return res.insertId;
  },

  update: async (id, { title, type, data }) => {
    await pool.execute(
      `UPDATE content_items
         SET title = ?, type = ?, data = ?
       WHERE id = ?`,
      [title, type, data, id]
    );
  },

  delete: async (id) => {
    await pool.query(`DELETE FROM content_items WHERE id = ?`, [id]);
  },

  reorder: async (items) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let { id, display_order } of items) {
        await conn.query(
          `UPDATE content_items
             SET display_order = ?
           WHERE id = ?`,
          [display_order, id]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};