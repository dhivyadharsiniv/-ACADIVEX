const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// Overview / Dashboard Stats alias
router.get('/overview', (req, res) => {
  const analytics = db.getAnalytics(req.user);
  res.status(200).json({
    success: true,
    stats: analytics.metrics,
    data: analytics
  });
});

// Departments
router.get('/departments', (req, res) => {
  res.status(200).json({ success: true, data: db.getDepartments(req.user) });
});
router.post('/departments', (req, res) => {
  const dept = db.createDepartment(req.body, req.user);
  res.status(201).json({ success: true, data: dept });
});
router.put('/departments/:id', (req, res) => {
  try {
    const dept = db.updateDepartment(req.params.id, req.body, req.user);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.status(200).json({ success: true, data: dept });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/departments/:id', (req, res) => {
  try {
    const ok = db.deleteDepartment(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Courses
router.get('/courses', (req, res) => {
  res.status(200).json({ success: true, data: db.getCourses(req.user) });
});
router.post('/courses', (req, res) => {
  const crs = db.createCourse(req.body, req.user);
  res.status(201).json({ success: true, data: crs });
});
router.put('/courses/:id', (req, res) => {
  try {
    const crs = db.updateCourse(req.params.id, req.body, req.user);
    if (!crs) return res.status(404).json({ success: false, message: 'Course not found' });
    res.status(200).json({ success: true, data: crs });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/courses/:id', (req, res) => {
  try {
    const ok = db.deleteCourse(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Classes
router.get('/classes', (req, res) => {
  res.status(200).json({ success: true, data: db.getClasses(req.user) });
});
router.post('/classes', (req, res) => {
  const cls = db.createClass(req.body, req.user);
  res.status(201).json({ success: true, data: cls });
});
router.put('/classes/:id', (req, res) => {
  try {
    const cls = db.updateClass(req.params.id, req.body, req.user);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.status(200).json({ success: true, data: cls });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/classes/:id', (req, res) => {
  try {
    const ok = db.deleteClass(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Subjects
router.get('/subjects', (req, res) => {
  res.status(200).json({ success: true, data: db.getSubjects(req.user) });
});
router.post('/subjects', (req, res) => {
  const sub = db.createSubject(req.body, req.user);
  res.status(201).json({ success: true, data: sub });
});
router.put('/subjects/:id', (req, res) => {
  try {
    const sub = db.updateSubject(req.params.id, req.body, req.user);
    if (!sub) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.status(200).json({ success: true, data: sub });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/subjects/:id', (req, res) => {
  try {
    const ok = db.deleteSubject(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Assignments
router.get('/assignments', (req, res) => {
  const data = db.getAssignments(req.query, req.user);
  res.status(200).json({ success: true, data });
});
router.post('/assignments', (req, res) => {
  const asg = db.createAssignment(req.body, req.user);
  res.status(201).json({ success: true, data: asg });
});
router.put('/assignments/:id', (req, res) => {
  try {
    const asg = db.updateAssignment(req.params.id, req.body, req.user);
    if (!asg) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.status(200).json({ success: true, data: asg });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/assignments/:id', (req, res) => {
  try {
    const ok = db.deleteAssignment(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Submissions
router.get('/submissions', (req, res) => {
  const data = db.getSubmissions(req.query, req.user);
  res.status(200).json({ success: true, data });
});
router.post('/submissions/submit', (req, res) => {
  try {
    const subm = db.submitAssignment(req.body, req.user);
    res.status(201).json({ success: true, data: subm });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.post('/submissions/grade/:id', (req, res) => {
  try {
    const subm = db.gradeSubmission(req.params.id, req.body, req.user);
    if (!subm) return res.status(404).json({ success: false, message: 'Submission not found' });
    res.status(200).json({ success: true, data: subm });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Timetable
router.get('/timetable', (req, res) => {
  const data = db.getTimetable(req.query, req.user);
  res.status(200).json({ success: true, data });
});
router.post('/timetable', (req, res) => {
  const slot = db.createTimetableSlot(req.body, req.user);
  res.status(201).json({ success: true, data: slot });
});

// Notifications
router.get('/notifications', (req, res) => {
  const role = req.query.role;
  const data = db.getNotifications(role, req.user);
  res.status(200).json({ success: true, data });
});
router.post('/notifications', (req, res) => {
  const notif = db.createNotification(req.body, req.user);
  res.status(201).json({ success: true, data: notif });
});

// Announcements
router.get('/announcements', (req, res) => {
  const data = db.getAnnouncements(req.user);
  res.status(200).json({ success: true, data });
});
router.post('/announcements', (req, res) => {
  const ann = db.createAnnouncement(req.body, req.user);
  res.status(201).json({ success: true, data: ann });
});
router.put('/announcements/:id', (req, res) => {
  try {
    const ann = db.updateAnnouncement(req.params.id, req.body, req.user);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.status(200).json({ success: true, data: ann });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/announcements/:id', (req, res) => {
  try {
    const ok = db.deleteAnnouncement(req.params.id, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Marks Entry & Results
router.get('/marks/results', (req, res) => {
  try {
    const data = db.getExamResults(req.user);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/marks/enter', (req, res) => {
  try {
    const { studentId, marksData } = req.body;
    const result = db.enterStudentMarks(studentId, marksData || req.body, req.user);
    if (!result) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});
router.delete('/marks/results/:studentId/:subjectCode', (req, res) => {
  try {
    const ok = db.deleteExamResult(req.params.studentId, req.params.subjectCode, req.user);
    res.status(200).json({ success: ok });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Next auto-generated Register Number preview
router.get(['/next-register-number', '/academic/next-register-number'], (req, res) => {
  const deptId = req.query.departmentId || req.query.department || 'GEN';
  const regNo = db.generateNextRegisterNumber(deptId, new Date().getFullYear());
  res.status(200).json({ success: true, registerNumber: regNo, nextRegisterNumber: regNo });
});

// Next auto-generated Staff Employee ID preview
router.get(['/next-employee-id', '/academic/next-employee-id'], (req, res) => {
  const deptId = req.query.departmentId || req.query.department || 'GEN';
  const empId = db.generateNextEmployeeId(deptId);
  res.status(200).json({ success: true, employeeId: empId, nextEmployeeId: empId });
});

module.exports = router;
