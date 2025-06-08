const express = require('express');
const router  = express.Router();
const fs      = require("fs");
const student = require('../controllers/studentController');
const authMw  = require('../middleware/authMiddleware');

router.use(authMw());  // protect all student routes

// List all courses that the student has access to
router.get('/courses', student.listCourses);

// Return courseTitle + videos/pdfs/quizzes arrays
router.get('/courses/:courseId/content', student.listCourseContent);

// ** Student raw‐content endpoint **
// Must come before /courses/:courseId/progress
router.get('/content/:contentId/raw', student.serveRawContent);

router.post(
  '/courses/:courseId/start',
  student.startCourse
);

router.get('/courses/:courseId/hasStarted', student.hasStartedCourse);

// Get this student’s completed progress for a given course
router.get('/courses/:courseId/progress', student.getCourseProgress);
router.post('/courses/:courseId/progress', student.markProgress);



module.exports = router;