const db = require('../config/database');

exports.getAllStudents = (req, res) => {
  try {
    const students = db.getStudents(req.query, req.user);
    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentById = (req, res) => {
  try {
    const student = db.getStudentById(req.params.id, req.user);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createStudent = (req, res) => {
  try {
    if (req.user && req.user.role === 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'FORBIDDEN_STUDENT: Students are not permitted to enroll new students.'
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
        message: 'Please provide both firstName and email.'
      });
    }

    const newStudent = db.createStudent(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Student created successfully. Student can now login using the provided email and password.',
      data: newStudent
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
    if (error.message.includes('department') || error.message.includes('Invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudent = (req, res) => {
  try {
    const updated = db.updateStudent(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Student record updated successfully.',
      data: updated
    });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStudent = (req, res) => {
  try {
    const deleted = db.deleteStudent(req.params.id, req.user);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Student deactivated (soft-deleted) successfully. Academic history preserved.'
    });
  } catch (error) {
    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
