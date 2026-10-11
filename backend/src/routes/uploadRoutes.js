const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// POST /api/upload/profile-image
router.post('/profile-image', authenticate, (req, res) => {
  try {
    const image = req.body.image || req.body.imageData;
    const { targetType, targetId } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required.' });
    }

    // Validate format: JPG, JPEG, PNG, WEBP
    const matches = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Please upload JPG, JPEG, PNG, or WEBP image.'
      });
    }

    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 5MB limit. Please upload a smaller image.'
      });
    }

    // Role-based permission checks if targetId and targetType are provided
    const user = req.user;
    if (user && targetId && targetType) {
      if (user.role === 'STUDENT') {
        const isOwn = (user.id === targetId || user.studentId === targetId || user.email?.toLowerCase() === targetId.toLowerCase());
        if (!isOwn) {
          return res.status(403).json({ success: false, message: 'FORBIDDEN: Students can only change their own profile image.' });
        }
      } else if (user.role === 'TEACHER') {
        if (targetType === 'STUDENT') {
          const student = db.getStudentById(targetId, user);
          if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found.' });
          }
          const teacher = db.getTeachers().find(t => t.id === user.teacherId || t.userId === user.id || t.email?.toLowerCase() === user.email?.toLowerCase());
          const myClasses = teacher?.assignedClasses || [];
          if (!myClasses.includes(student.className) && teacher?.id !== student.teacherId) {
            return res.status(403).json({ success: false, message: `FORBIDDEN: You may only update profile images for students in your assigned class batches (${myClasses.join(', ')}).` });
          }
        } else if (targetType === 'TEACHER') {
          if (user.id !== targetId && user.teacherId !== targetId) {
            return res.status(403).json({ success: false, message: 'FORBIDDEN: Faculty cannot edit other faculty members images.' });
          }
        } else {
          return res.status(403).json({ success: false, message: 'FORBIDDEN: Insufficient permissions.' });
        }
      }
      // ADMIN can update any profile image
    }

    // Save image to disk
    const fileName = `avatar-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/avatars/${fileName}`;

    // If targetId is provided, persist immediately into database record
    if (targetId && targetType) {
      if (targetType === 'STUDENT') {
        db.updateStudent(targetId, { avatar: relativeUrl, profileImageUrl: relativeUrl }, user);
      } else if (targetType === 'TEACHER') {
        db.updateTeacher(targetId, { avatar: relativeUrl, profileImageUrl: relativeUrl }, user);
      } else if (targetType === 'ADMIN' || targetType === 'USER') {
        const u = db.getUsers().find(x => x.id === targetId || x.email?.toLowerCase() === String(targetId).toLowerCase()) || (user && user.role === 'ADMIN' ? user : null);
        if (u) {
          u.avatar = relativeUrl;
          u.profileImageUrl = relativeUrl;
          db.saveToDisk();
        }
      }
    } else if (user) {
      if (user.role === 'STUDENT' && user.studentId) {
        db.updateStudent(user.studentId, { avatar: relativeUrl, profileImageUrl: relativeUrl }, user);
      } else if (user.role === 'TEACHER' && user.teacherId) {
        db.updateTeacher(user.teacherId, { avatar: relativeUrl, profileImageUrl: relativeUrl }, user);
      }
      user.avatar = relativeUrl;
      user.profileImageUrl = relativeUrl;
      db.saveToDisk();
    }

    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded and updated successfully.',
      url: relativeUrl,
      imageUrl: relativeUrl
    });
  } catch (err) {
    if (err.message && err.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/upload/profile-image
router.delete('/profile-image', authenticate, (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    const user = req.user;
    const defaultAvatar = null;

    if (user && targetId && targetType) {
      if (user.role === 'STUDENT' && user.id !== targetId && user.studentId !== targetId) {
        return res.status(403).json({ success: false, message: 'FORBIDDEN: Students can only manage their own profile image.' });
      }
      if (user.role === 'TEACHER' && targetType === 'STUDENT') {
        const student = db.getStudentById(targetId, user);
        const teacher = db.getTeachers().find(t => t.id === user.teacherId || t.userId === user.id);
        const myClasses = teacher?.assignedClasses || [];
        if (!myClasses.includes(student?.className) && teacher?.id !== student?.teacherId) {
          return res.status(403).json({ success: false, message: 'FORBIDDEN: You can only remove profile images for students in your assigned class.' });
        }
      }

      if (targetType === 'STUDENT') {
        db.updateStudent(targetId, { avatar: defaultAvatar, profileImageUrl: defaultAvatar }, user);
      } else if (targetType === 'TEACHER') {
        db.updateTeacher(targetId, { avatar: defaultAvatar, profileImageUrl: defaultAvatar }, user);
      } else {
        const u = db.getUsers().find(x => x.id === targetId || x.email?.toLowerCase() === targetId.toLowerCase());
        if (u) { u.avatar = defaultAvatar; u.profileImageUrl = defaultAvatar; db.saveToDisk(); }
      }
    } else if (user) {
      if (user.role === 'STUDENT' && user.studentId) {
        db.updateStudent(user.studentId, { avatar: defaultAvatar, profileImageUrl: defaultAvatar }, user);
      } else if (user.role === 'TEACHER' && user.teacherId) {
        db.updateTeacher(user.teacherId, { avatar: defaultAvatar, profileImageUrl: defaultAvatar }, user);
      }
      user.avatar = defaultAvatar;
      user.profileImageUrl = defaultAvatar;
      db.saveToDisk();
    }

    return res.status(200).json({
      success: true,
      message: 'Profile image removed.',
      url: defaultAvatar
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/upload/institution-logo
router.post('/institution-logo', authenticate, (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({
        success: false,
        message: 'FORBIDDEN: Only institution Administrators or Super Admins can update campus logos.'
      });
    }

    const image = req.body.image || req.body.logoData;
    const requestedInstId = req.body.institutionId || user.institutionId;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Logo image data is required.' });
    }

    // Tenant isolation verification: Admin can only upload for their own institution
    if (user.role !== 'SUPER_ADMIN') {
      const tenantId = user.institutionId || 'inst-001';
      if (requestedInstId && requestedInstId !== tenantId) {
        return res.status(403).json({
          success: false,
          message: 'FORBIDDEN_CROSS_TENANT_ACCESS: You cannot upload or modify another institution logo.'
        });
      }
    }

    const targetInstId = (user.role === 'SUPER_ADMIN' && requestedInstId) ? requestedInstId : (user.institutionId || 'inst-001');

    // Validate PNG, JPG, JPEG, WebP and max 2 MB and save to uploads/avatars
    let logoUrl;
    try {
      logoUrl = db.saveInstitutionLogoData(targetInstId, image);
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        message: validationErr.message
      });
    }

    // Update institution branding record
    const updatedInst = db.updateInstitutionBranding(targetInstId, { logoUrl }, user);

    return res.status(200).json({
      success: true,
      message: 'Institution logo successfully uploaded and applied.',
      url: logoUrl,
      logoUrl: logoUrl,
      institutionId: targetInstId,
      institution: updatedInst
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/upload/institution-logo
router.delete('/institution-logo', authenticate, (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({
        success: false,
        message: 'FORBIDDEN: Only institution Administrators or Super Admins can remove campus logos.'
      });
    }
    const targetInstId = (user.role === 'SUPER_ADMIN' && req.body.institutionId) ? req.body.institutionId : user.institutionId;
    const updatedInst = db.updateInstitutionBranding(targetInstId, { logoUrl: null }, user);
    return res.status(200).json({
      success: true,
      message: 'Institution logo removed.',
      url: null,
      logoUrl: null,
      institution: updatedInst
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
