const db = require('../config/database');

exports.getAllExams = (req, res) => {
  try {
    const exams = db.getExams(req.user);
    res.status(200).json({
      success: true,
      count: exams.length,
      data: exams
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createExam = (req, res) => {
  try {
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF', 'FACULTY'];
    if (req.user && !allowedRoles.includes(String(req.user.role || '').toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const title = req.body.title || req.body.name;
    const { date } = req.body;
    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide examination title and date'
      });
    }
    req.body.title = title;

    const newExam = db.createExam(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Exam schedule published successfully',
      data: newExam
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateExam = (req, res) => {
  try {
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF', 'FACULTY'];
    if (req.user && !allowedRoles.includes(String(req.user.role || '').toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const updated = db.updateExam(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Exam schedule not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Exam schedule updated successfully',
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteExam = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete exam schedules' });
    }
    const deleted = db.deleteExam(req.params.id, req.user);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Exam schedule not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Exam schedule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExamResults = (req, res) => {
  try {
    const results = db.getExamResults(req.query || {}, req.user);
    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enterMarks = (req, res) => {
  try {
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF', 'FACULTY'];
    if (req.user && !allowedRoles.includes(String(req.user.role || '').toUpperCase())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const result = db.enterStudentMarks(req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Examination marks saved and transcript recalculated',
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteExamResult = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete examination results' });
    }
    const { studentId, subjectCode } = req.params;
    const deleted = db.deleteExamResult(studentId, subjectCode, req.user);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Exam result not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Examination result deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReportCard = (req, res) => {
  try {
    const { studentId } = req.params;
    const transcript = db.getStudentTranscript(studentId, req.user);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Student transcript not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transcript
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHallTicket = (req, res) => {
  try {
    const { studentId } = req.params;
    const hallTicket = db.getStudentHallTicket(studentId, req.user);

    if (!hallTicket) {
      return res.status(404).json({
        success: false,
        message: 'Hall ticket record not found for student'
      });
    }

    res.status(200).json({
      success: true,
      data: hallTicket
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
