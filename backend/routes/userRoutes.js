const express = require('express');
const authMw  = require('../middleware/authMiddleware');
const User        = require('../models/userModel');       
const { getProfile } = require('../controllers/userController');

const router = express.Router();

// GET /api/user/me — any logged-in user
router.get('/me', authMw(), getProfile);

// Apply tutor
router.post('/apply-tutor',
  authMw(),             
  async (req, res, next) => {
    try {
      await User.updateRoleAndStatus(req.user.id, 'tutor', 'pending');
      res.json({ message: 'Applied successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;