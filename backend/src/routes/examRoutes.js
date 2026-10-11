const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', examController.getAllExams);
router.post('/', examController.createExam);
router.get('/results', examController.getExamResults);
router.post('/marks', examController.enterMarks);
router.delete('/results/:studentId/:subjectCode', examController.deleteExamResult);
router.get('/report-card/:studentId', examController.getReportCard);
router.get('/hall-ticket/:studentId', examController.getHallTicket);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);

module.exports = router;
