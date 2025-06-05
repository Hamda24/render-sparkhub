const express                 = require('express');
const { register, login }     = require('../controllers/authController');
const tutorRequestController = require('../controllers/tutorRequestController');
const router = express.Router();

const multer  = require('multer');
const storage = multer.memoryStorage();
const upload  = multer({ storage });

router.post(
  '/register',
  upload.fields([
    { name: 'resume_file', maxCount: 1 },
    { name: 'profile_pic', maxCount: 1 }
  ]),
  register
);

router.post('/login', login);

// add tutor “respond” link here, see step 6:
router.get(
  '/tutor/requests/respond',
  tutorRequestController.respondRequest
);
module.exports = router;