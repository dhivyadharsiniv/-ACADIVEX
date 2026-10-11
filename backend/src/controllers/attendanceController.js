const db = require('../config/database');

exports.getAttendance = (req, res) => {
  try {
    const {
      date,
      className,
      classId,
      class: classParam,
      subject,
      subjectId,
      studentId,
      academicYear,
      semester,
      department,
      session,
      period,
      search
    } = req.query;

    const records = db.getAttendance({
      date,
      className: className || classParam || classId,
      classId,
      subject: subject || subjectId,
      subjectId,
      studentId,
      academicYear,
      semester,
      department,
      session: session || period,
      search
    }, req.user);

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markBulkAttendance = (req, res) => {
  try {
    let records = req.body.records;
    if (!records && req.body.studentId) {
      records = [req.body];
    }
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required'
      });
    }

    const enrichedRecords = records.map(r => ({
      date: req.body.date || r.date,
      className: req.body.className || req.body.class || r.className || r.class,
      classId: req.body.classId || r.classId,
      subject: req.body.subject || req.body.subjectId || r.subject || r.subjectId,
      subjectId: req.body.subjectId || r.subjectId,
      semester: req.body.semester || r.semester,
      academicYear: req.body.academicYear || r.academicYear,
      department: req.body.department || r.department,
      session: req.body.session || req.body.period || r.session || r.period,
      ...r
    }));

    const saved = db.markAttendance(enrichedRecords, req.user);
    res.status(200).json({
      success: true,
      message: `Successfully recorded attendance for ${records.length} student(s)`,
      data: saved
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAttendanceRecord = (req, res) => {
  try {
    const updated = db.updateAttendanceRecord(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: updated
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAttendanceRecord = (req, res) => {
  try {
    const ok = db.deleteAttendanceRecord(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
