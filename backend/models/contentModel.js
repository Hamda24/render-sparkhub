require("dotenv").config();
const pool = require("../db");

module.exports = {
  // Fetch a single content row (including its BLOB "data")
  findById: async (id) => {
    const sql = `
      SELECT 
        id,
        title,
        type,
        data,
        course_id
      FROM content_items
      WHERE id = $1
    `;
    const result = await pool.query(sql, [id]);
    // result.rows is an array; return the first element (or null if not found)
    return result.rows[0] || null;
  },

  // Fetch all content items for one course (no BLOB data here)
  findByCourse: async (courseId, client = pool) => {
    const sql = `
      SELECT id, title, type, display_order
      FROM content_items
      WHERE course_id = $1
      ORDER BY display_order
    `;
    const result = await client.query(sql, [courseId]);
    return result.rows;
  },

  create: async (
    { course_id, title, type, data, display_order },
    client = pool         // default to the global pool
  ) => {
    const sql = `
      INSERT INTO content_items
        (course_id, title, type, data, display_order)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id
    `;
    const params = [course_id, title, type, data, display_order];
    const result = await client.query(sql, params);
    return result.rows[0].id;
  },

  update: async (id, { title, type, data }) => {
    const sql = `
      UPDATE content_items
      SET title = $1,
          type = $2,
          data = $3
      WHERE id = $4
    `;
    const params = [title, type, data, id];
    await pool.query(sql, params);
  },

  delete: async (id) => {
    const sql = `DELETE FROM content_items WHERE id = $1`;
    await pool.query(sql, [id]);
  },

  reorder: async (items) => {
    // items should be an array of objects: [{ id: 7, display_order: 1 }, { id: 8, display_order: 2 }, …]
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let { id, display_order } of items) {
        const sql = `
          UPDATE content_items
          SET display_order = $1
          WHERE id = $2
        `;
        await client.query(sql, [display_order, id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};