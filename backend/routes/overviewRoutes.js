const express = require('express');
const router = express.Router();

const pool = require("../db");



// ───────────────────────────────────────────────────────────────────────────────
// 1) GET /api/courses/latest
//    Returns an array of the three most‐recent courses.
//    Each object should have: { id, title, price, imageUrl }.
router.get('/courses/latest', async (req, res) => {
  try {
    const sql = `
      SELECT
        id,
        title,
        'data:' || thumbnail_format || ';base64,' || encode(thumbnail, 'base64') AS "imageUrl"
      FROM courses
      ORDER BY created_at DESC
      LIMIT 3
    `;
    const result = await pool.query(sql);
    return res.json(result.rows);
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
    const coursesSql = `SELECT COUNT(*) AS "coursesAvailable" FROM courses;`;
    const coursesResult = await pool.query(coursesSql);
    const coursesAvailable = Number(coursesResult.rows[0].coursesAvailable);

    // B) Count total students (role='student' in users table)
    const studentsSql = `
      SELECT COUNT(*) AS "studentsCount"
      FROM users
      WHERE role = 'student';
    `;
    const studentsResult = await pool.query(studentsSql);
    const studentsCount = Number(studentsResult.rows[0].studentsCount);

    // C) Count total tutors (role='tutor' in users table)
    const tutorsSql = `
      SELECT COUNT(*) AS "tutorsCount"
      FROM users
      WHERE role = 'tutor';
    `;
    const tutorsResult = await pool.query(tutorsSql);
    const tutorsCount = Number(tutorsResult.rows[0].tutorsCount);

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
  const tutorId = Number(req.params.id);
  try {
    const sql = `
      SELECT
        id,
        title,
        created_at
      FROM courses
      WHERE tutor_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(sql, [tutorId]);
    return res.json({ courses: result.rows });
  } catch (err) {
    console.error('Error fetching tutor courses:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 4) GET /api/tutors/:id/active-students
//    Count of distinct students who have any progress on this tutor’s courses.
router.get('/tutors/:id/active-students', async (req, res) => {
  const tutorId = Number(req.params.id);
  try {
    const sql = `
      SELECT
        COUNT(DISTINCT p.user_id) AS "activeStudentCount"
      FROM progress AS p
      JOIN courses AS c ON p.course_id = c.id
      WHERE c.tutor_id = $1
    `;
    const result = await pool.query(sql, [tutorId]);
    const activeStudentCount = Number(result.rows[0].activeStudentCount) || 0;
    return res.json({ activeStudentCount });
  } catch (err) {
    console.error('Error fetching active students for tutor:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;