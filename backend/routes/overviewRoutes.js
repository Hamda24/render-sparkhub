const express = require('express');
const router = express.Router();

const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});


// ───────────────────────────────────────────────────────────────────────────────
// 1) GET /api/courses/latest
//    Returns an array of the three most‐recent courses.
//    Each object should have: { id, title, price, imageUrl }.
router.get('/courses/latest', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        title,
        CONCAT(
          'data:', 
          thumbnail_format, 
          ';base64,', 
          TO_BASE64(thumbnail)
        ) AS imageUrl
      FROM courses
      ORDER BY created_at DESC
      LIMIT 3;
      `
    );

    // rows will now be an array of objects like:
    // [ { id:1, title:'Intro to Web Design', imageUrl:'data:image/png;base64,iVBORw0K...' }, … ]
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching latest courses:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 2) GET /api/stats/overview
//    Returns: { coursesAvailable, studentsCount, tutorsCount }
router.get('/stats/overview', async (req, res) => {
  try {
    // A) Count total courses
    const [coursesCountRows] = await pool.query(`
      SELECT COUNT(*) AS coursesAvailable FROM courses;
    `);
    const coursesAvailable = coursesCountRows[0].coursesAvailable;

    // B) Count total students (role='student' in users table)
    const [studentsCountRows] = await pool.query(`
      SELECT COUNT(*) AS studentsCount
      FROM users
      WHERE role = 'student';
    `);
    const studentsCount = studentsCountRows[0].studentsCount;

    // C) Count total tutors (role='tutor' in users table)
    const [tutorsCountRows] = await pool.query(`
      SELECT COUNT(*) AS tutorsCount
      FROM users
      WHERE role = 'tutor';
    `);
    const tutorsCount = tutorsCountRows[0].tutorsCount;

    return res.json({ coursesAvailable, studentsCount, tutorsCount });
  } catch (error) {
    console.error('Error fetching stats overview:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 3) GET /api/tutors/:id/courses
//    Returns { courses: [ { id, title, created_at }, … ] } for that tutor.
router.get('/tutors/:id/courses', async (req, res) => {
  const tutorId = req.params.id;
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        title,
        created_at
      FROM courses
      WHERE tutor_id = ?
      ORDER BY created_at DESC;
      `,
      [tutorId]
    );
    return res.json({ courses: rows });
  } catch (err) {
    console.error('Error fetching tutor courses:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 4) GET /api/tutors/:id/active-students
//    Count of distinct students who have any progress on this tutor’s courses.
router.get('/tutors/:id/active-students', async (req, res) => {
  const tutorId = req.params.id;
  try {
    const [rows] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT p.user_id) AS activeStudentCount
      FROM progress AS p
      JOIN courses AS c ON p.course_id = c.id
      WHERE c.tutor_id = ?;
      `,
      [tutorId]
    );
    const activeStudentCount = rows[0]?.activeStudentCount || 0;
    return res.json({ activeStudentCount });
  } catch (err) {
    console.error('Error fetching active students for tutor:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;