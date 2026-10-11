const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/payment-config', feeController.getPaymentConfig);
router.get('/student/:studentId/summary', feeController.getStudentFeeSummary);
router.get('/', feeController.getAllFees);
router.post('/', feeController.createFeeInvoice);
router.post('/pay', feeController.payFeeInvoice);
router.post('/pay/:invoiceId', feeController.payFeeInvoice);
router.post('/:invoiceId/pay', feeController.payFeeInvoice);
router.post('/submit-payment', feeController.submitStudentPayment);
router.post('/:invoiceId/submit-payment', feeController.submitStudentPayment);
router.post('/verify-payment', feeController.verifyFeePayment);
router.post('/:invoiceId/verify-payment', feeController.verifyFeePayment);
router.post('/:invoiceId/verify', feeController.verifyFeePayment);
router.patch('/:invoiceId/verify', feeController.verifyFeePayment);
router.post('/gateway/create-order', feeController.createGatewayOrder);
router.post('/gateway/verify', feeController.verifyGatewayPayment);
router.get('/receipt/:invoiceId', feeController.getReceipt);
router.get('/:invoiceId/receipt', feeController.getReceipt);
router.put('/:id', feeController.updateFeeInvoice);
router.delete('/:id', feeController.deleteFeeInvoice);

module.exports = router;
