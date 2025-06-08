const pool = require("../db");

module.exports = {
  findById: async (id) => {
    const { rows } = await pool.query(
      `SELECT id, title, type, file_path, course_id
       FROM content_items
       WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },

  findByCourse: async (courseId) => {
    const { rows } = await pool.query(
      `SELECT id, title, type, display_order
       FROM content_items
       WHERE course_id = $1
       ORDER BY display_order`, [courseId]
    );
    return rows;
  },

  create: async ({ course_id, title, type, file_path, display_order }) => {
    const { rows } = await pool.query(
      `INSERT INTO content_items
         (course_id, title, type, file_path, display_order)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [course_id, title, type, file_path, display_order]
    );
    return rows[0].id;
  },

  update: async (id, { title, type, file_path }) => {
    await pool.query(
      `UPDATE content_items
         SET title = $1,
             type = $2,
             file_path = $3,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [title, type, file_path, id]
    );
  },

  delete: async (id) => {
    await pool.query(`DELETE FROM content_items WHERE id = $1`, [id]);
  },

  reorder: async (items) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let { id, display_order } of items) {
        await client.query(
          `UPDATE content_items
            SET display_order = $1
          WHERE id = $2`,
          [display_order, id]
        );
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
