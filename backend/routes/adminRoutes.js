const express = require('express');
const authMw     = require('../middleware/authMiddleware');
const isAdmin    = authMw.isAdmin;    
const contentRoutes = require('./admin_contentRoutes');
const upload = require('../middleware/upload');

const {
  listTutorRequests,
  scheduleTutorInterview,
  approveTutor,
  rejectTutorRequest,
  listAllSessions,
  cancelSession,
  listUsers,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMw(), isAdmin);



router.get(
  '/tutors/requests',
  listTutorRequests
);

router.put(
  '/tutors/:id/schedule',
  scheduleTutorInterview
);

router.put(
  '/tutors/:id/approve',
  approveTutor
);

router.delete(
  '/tutors/:id',
  rejectTutorRequest
);


// Session requests overview and cancellation
router.get(
  '/sessions',
  listAllSessions
);

router.put(
  '/sessions/:id/cancel',
  cancelSession
);

router.get(
  '/users',     
  listUsers
);


//admin courses
router.get(
  '/courses',
  listCourses
);

router.post(
  '/courses',
  upload.single('thumbnail'),
  createCourse
);

router.put(
  '/courses/:id',
  upload.single('thumbnail'), 
  updateCourse
);

router.delete(
  '/courses/:id',
  deleteCourse
);

router.get(
  '/courses/:id',
  getCourseById
);

router.use('/', contentRoutes);

module.exports = router;