const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', attendanceController.getAttendance);
router.post('/', attendanceController.markBulkAttendance);
router.post('/mark', attendanceController.markBulkAttendance);
router.put('/:id', attendanceController.updateAttendanceRecord);
router.patch('/:id', attendanceController.updateAttendanceRecord);
router.patch('/:id/student', attendanceController.updateAttendanceRecord);
router.delete('/:id', attendanceController.deleteAttendanceRecord);

module.exports = router;
