const pool = require("../db");

module.exports = {
  findById: async (id) => {
    const sql = `
      SELECT id, title, type, file_path, course_id
      FROM content_items
      WHERE id = $1
    `;
    const result = await pool.query(sql, [id]);
    return result.rows[0] || null;
  },

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
    { course_id, title, type, file_path, display_order },
    client = pool
  ) => {
    const sql = `
      INSERT INTO content_items
        (course_id, title, type, file_path, display_order)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id
    `;
    const params = [course_id, title, type, file_path, display_order];
    const result = await client.query(sql, params);
    return result.rows[0].id;
  },

  update: async (id, { title, type, file_path }) => {
    const sql = `
      UPDATE content_items
      SET title = $1,
          type = $2,
          file_path = $3
      WHERE id = $4
    `;
    const params = [title, type, file_path, id];
    await pool.query(sql, params);
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
          `UPDATE content_items SET display_order=$1 WHERE id=$2`,
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