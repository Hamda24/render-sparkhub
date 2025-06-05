const bcrypt    = require('bcryptjs');
const userModel = require('../models/userModel');

async function updateCredentials(req, res) {
  try {
    const userId      = req.user.id;
    const { oldEmail, newEmail, oldPassword, newPassword } = req.body;
    const user        = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ─── EMAIL ─────────────────────────
    if (newEmail) {
      if (!oldEmail || oldEmail !== user.email) {
        return res.status(403).json({ error: 'Current email incorrect' });
      }
      if (newEmail === user.email) {
        return res.status(400).json({ error: 'New email must differ from current' });
      }
      const exists = await userModel.findByEmail(newEmail);
      if (exists) {
        return res.status(400).json({ error: 'E-mail already in use' });
      }
      await userModel.updateEmailById(userId, newEmail);
    }

    // ─── PASSWORD ──────────────────────
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }
      if (newPassword === oldPassword) {
        return res.status(400).json({ error: 'New password must differ from current' });
      }
      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) {
        return res.status(403).json({ error: 'Current password incorrect' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 chars' });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await userModel.updatePasswordById(userId, hash);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { updateCredentials };