const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const identifier = req.body.email || req.body.username || req.body.userId || req.body.rollNumber || req.body.registerNumber;
  const { password, role, institutionId } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username / Email / Roll Number and password are required.'
    });
  }

  const result = db.authenticate(identifier, password, role, institutionId);
  if (!result.success) {
    const status = result.statusCode || 401;
    return res.status(status).json({
      success: false,
      message: result.message
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Authentication successful.',
    token: result.token,
    user: result.user
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated.' });
  }
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const authHeader = req.headers.authorization;
  let token = req.body?.token || null;
  if (!token && authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  }

  const requestedInstId = req.body?.institutionId || req.user?.institutionId || null;
  const result = db.logout(token, req.user, requestedInstId);

  res.clearCookie('acadivex_token');
  res.clearCookie('edumanage_token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.body?.role === 'SUPER_ADMIN';
  const inst = result.institution;
  const redirectRoute = isSuperAdmin
    ? '/'
    : (inst && inst.id
        ? `/login?institutionId=${encodeURIComponent(inst.id)}&campus=${encodeURIComponent(inst.campusName || 'Main Campus')}`
        : '/login');

  return res.status(200).json({
    success: true,
    message: 'Session securely terminated.',
    redirectTo: isSuperAdmin ? 'landing' : 'login',
    redirectRoute,
    institution: isSuperAdmin ? null : (inst || null)
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  const { email, userId, username, currentPassword, newPassword } = req.body;
  const identifier = email || userId || username || (req.user ? (req.user.id || req.user.email) : null);

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long.'
    });
  }

  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: 'User identifier is required.'
    });
  }

  const result = db.changePassword(identifier, currentPassword, newPassword, req.user);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message
    });
  }

  return res.status(200).json({
    success: true,
    message: result.message
  });
});

// POST /api/auth/forgot-password (Password Recovery Request)
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  const user = db.getUsers().find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    // For security, do not expose whether email exists
    return res.status(200).json({
      success: true,
      message: 'If the provided email is associated with an active account, password recovery instructions have been sent.'
    });
  }

  const recoveryToken = `recov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  user.resetPasswordToken = recoveryToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

  db.logAudit({
    institutionId: user.institutionId || 'inst-001',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    role: user.role,
    action: 'PASSWORD_RESET_REQUESTED',
    resource: 'AUTH',
    resourceId: user.id,
    details: `Password recovery token generated for ${user.email}`
  });

  return res.status(200).json({
    success: true,
    message: 'If the provided email is associated with an active account, password recovery instructions have been sent.',
    ...(process.env.NODE_ENV !== 'production' ? { debugRecoveryToken: recoveryToken } : {})
  });
});

// POST /api/auth/reset-password (Password Recovery Confirm)
router.post('/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, recovery token, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  const user = db.getUsers().find(u => 
    u.email?.toLowerCase() === email.trim().toLowerCase() && 
    u.resetPasswordToken === token &&
    u.resetPasswordExpires > Date.now()
  );

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
  }

  const bcrypt = require('bcryptjs');
  const newHash = bcrypt.hashSync(newPassword, 10);
  user.password = newHash;
  user.passwordHash = newHash;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;

  db.logAudit({
    institutionId: user.institutionId || 'inst-001',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    role: user.role,
    action: 'PASSWORD_RESET_COMPLETED',
    resource: 'AUTH',
    resourceId: user.id,
    details: `Password successfully reset via recovery token for ${user.email}`
  });

  return res.status(200).json({
    success: true,
    message: 'Password successfully reset. You may now login with your new credentials.'
  });
});

// PUT /api/auth/admin-profile
router.put('/admin-profile', authenticate, (req, res) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'FORBIDDEN: Only authorized administrators/deans can update admin profile.'
      });
    }

    const identifier = req.body.id || req.body.email || req.body.username || req.user.id;
    const updatedUser = db.updateAdminProfile(identifier, req.body, req.user);

    return res.status(200).json({
      success: true,
      message: 'Dean/Administrator profile updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    if (err.message && err.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/profile (Generic role profile updater)
router.put('/profile', authenticate, (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated.' });
    }

    if (req.user.role === 'ADMIN') {
      const updatedUser = db.updateAdminProfile(req.user.id, req.body, req.user);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        user: updatedUser
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Profile update via this endpoint is currently configured for Dean/Administrator.'
    });
  } catch (err) {
    if (err.message && err.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
