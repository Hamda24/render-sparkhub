const User   = require('../models/userModel');

exports.getProfile = async (req, res, next) => {
    try {
      // authMiddleware has put { id, role } on req.user
      const user = await User.findById(req.user.id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  };