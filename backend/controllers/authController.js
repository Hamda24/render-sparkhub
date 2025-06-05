const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Missing fields' });

    if (await User.findByEmail(email)) {
      return res.status(409).json({ error: 'Email in use' });
    }

    // 1️⃣ hash
    const passwordHash = await bcrypt.hash(password, 12);

    // 2️⃣ pull files out of RAM
    const resumeFile = req.files['resume_file']?.[0]?.originalname || null;
    const profilePic = req.files['profile_pic']?.[0]?.originalname || null;
    const specialty = req.body.specialty || null;

    // 3️⃣ create via your model
    const userId = await User.create({
      name,
      email,
      passwordHash,
      role,
      resumeFile,
      profilePic,
      specialty
    });

    // 4️⃣ respond
    if (role === 'tutor') {
      return res
        .status(201)
        .json({ message: 'Tutor application received—pending admin review.' });
    }
    res.status(201).json({ message: 'User registered.', userId });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // NEW: lock out any tutor who isn’t approved yet
    if (user.role === 'tutor' && user.status !== 'approved') {
      return res
        .status(403)
        .json({ error: 'Your tutor application is still under review.' });
    }

    // everyone else (students & approved tutors) gets a token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Authenticated',
      token,
      role: user.role
    });
  } catch (err) {
    next(err);
  }
};

