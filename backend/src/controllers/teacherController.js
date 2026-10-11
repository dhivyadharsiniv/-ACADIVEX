const db = require('../config/database');

exports.getAllTeachers = (req, res) => {
  try {
    const teachers = db.getTeachers(req.query, req.user);
    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeacherById = (req, res) => {
  try {
    const teacher = db.getTeacherById(req.params.id, req.user);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }
    res.status(200).json({ success: true, data: teacher });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTeacher = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'FORBIDDEN_ADMIN_ONLY: Only institutional administrators can appoint new faculty.'
      });
    }
    if (!req.body.firstName && req.body.name) {
      const parts = String(req.body.name).trim().split(/\s+/);
      req.body.firstName = parts[0] || '';
      req.body.lastName = req.body.lastName || parts.slice(1).join(' ');
    }
    const { firstName, email } = req.body;
    if (!firstName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide firstName and email for faculty appointment.'
      });
    }

    const newTeacher = db.createTeacher(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Staff created successfully. Staff can now login using the provided email and password.',
      data: newTeacher
    });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.startsWith('DUPLICATE_EMAIL')) {
      return res.status(400).json({ success: false, message: 'This email is already registered.' });
    }
    if (error.message.startsWith('INVALID_EMAIL')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTeacher = (req, res) => {
  try {
    const updated = db.updateTeacher(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Faculty appointment details updated successfully.',
      data: updated
    });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTeacher = (req, res) => {
  try {
    const deleted = db.deleteTeacher(req.params.id, req.user);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Faculty member deactivated (soft-deleted) successfully.'
    });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
