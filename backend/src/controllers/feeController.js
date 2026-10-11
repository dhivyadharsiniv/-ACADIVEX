const crypto = require('crypto');
const db = require('../config/database');

exports.getAllFees = (req, res) => {
  try {
    const { status, studentId } = req.query;
    let fees = db.getFees(req.user);

    if (status) {
      fees = fees.filter(f => f.status.toLowerCase() === status.toLowerCase());
    }
    if (studentId && req.user?.role !== 'STUDENT') {
      fees = fees.filter(f => f.studentId === studentId || f.rollNumber === studentId || f.registerNumber === studentId);
    }

    const totalFees = fees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const totalPaid = fees.reduce((acc, f) => {
      if (f.status === 'PAID' || f.status === 'PARTIAL') {
        return acc + Number(f.paidAmount || (f.status === 'PAID' ? f.amount : 0));
      }
      return acc;
    }, 0);
    const totalAdjustments = fees.reduce((acc, f) => acc + Number(f.adjustmentAmount || 0), 0);
    const outstandingBalance = Math.max(0, totalFees - totalPaid - totalAdjustments);

    res.status(200).json({
      success: true,
      count: fees.length,
      summary: {
        totalFees,
        totalPaid,
        totalAdjustments,
        outstandingBalance
      },
      data: fees
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPaymentConfig = (req, res) => {
  try {
    const config = db.getPaymentConfig(req.user);
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentFeeSummary = (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user && req.user.role === 'STUDENT') {
      const ownStudent = db.resolveAuthenticatedStudent(req.user);
      const isOwn = ownStudent && (
        ownStudent.id === studentId ||
        ownStudent.rollNumber === studentId ||
        ownStudent.registerNumber === studentId
      );
      if (!isOwn && req.user.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: 'FORBIDDEN_STUDENT_FEE: Students may only view their own fee summary.'
        });
      }
    }

    const allFees = db.getFees(req.user);
    const fees = allFees.filter(f =>
      f.studentId === studentId ||
      f.rollNumber === studentId ||
      f.registerNumber === studentId
    );

    const totalFees = fees.reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const paidAmount = fees.reduce((acc, f) => {
      if (f.status === 'PAID' || f.status === 'PARTIAL') {
        return acc + Number(f.paidAmount || (f.status === 'PAID' ? f.amount : 0));
      }
      return acc;
    }, 0);
    const pendingVerificationAmount = fees.reduce((acc, f) => {
      if (f.status === 'VERIFICATION_PENDING') {
        return acc + Number(f.pendingPayment?.submittedAmount || f.outstandingBalance || f.amount || 0);
      }
      return acc;
    }, 0);
    const totalAdjustments = fees.reduce((acc, f) => acc + Number(f.adjustmentAmount || 0), 0);
    const outstandingBalance = Math.max(0, totalFees - paidAmount - totalAdjustments);

    res.status(200).json({
      success: true,
      data: {
        studentId,
        totalFees,
        paidAmount,
        totalPaid: paidAmount,
        pendingVerificationAmount,
        totalAdjustments,
        outstandingBalance,
        invoices: fees
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFeeInvoice = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only administrators can issue fee invoices.' });
    }
    const invoice = db.createFeeInvoice(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Fee invoice created successfully',
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitStudentPayment = (req, res) => {
  try {
    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required.' });
    }

    const updatedInvoice = db.submitStudentFeePayment(invoiceId, req.body, req.user);
    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Fee invoice record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment reference submitted successfully and marked as Pending Verification. Your balance will update once verified by the Accounts Office.',
      data: updatedInvoice
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && (error.message.startsWith('DUPLICATE') || error.message.startsWith('INVALID'))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyFeePayment = (req, res) => {
  try {
    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required.' });
    }

    const action = String(req.body.action || req.body.decision || 'APPROVE').toUpperCase();
    const verifiedInvoice = db.verifyFeePayment(invoiceId, { ...req.body, action }, req.user);
    if (!verifiedInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Fee invoice record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: action === 'REJECT'
        ? 'Payment submission rejected and marked as FAILED.'
        : action === 'REFUND'
          ? 'Payment marked as REFUNDED.'
          : `Payment verified and approved! Official Receipt ${verifiedInvoice.receiptNumber || ''} generated.`,
      data: verifiedInvoice
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && error.message.startsWith('DUPLICATE')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.payFeeInvoice = (req, res) => {
  try {
    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    const paidInvoice = db.payFee(invoiceId, req.body, req.user);
    if (!paidInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Fee invoice record not found'
      });
    }

    const isPendingVerif = paidInvoice.status === 'VERIFICATION_PENDING';
    res.status(200).json({
      success: true,
      message: isPendingVerif
        ? 'Payment reference submitted and queued for Administrator verification.'
        : 'Payment processed and verified successfully',
      data: paidInvoice
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && (error.message.startsWith('DUPLICATE') || error.message.startsWith('INVALID'))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGatewayOrder = (req, res) => {
  try {
    const { invoiceId } = req.body;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(400).json({
        success: false,
        configured: false,
        status: 'AWAITING_CONFIGURATION',
        message: 'Payment Gateway is awaiting configuration (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set in backend/.env). Please use UPI or Bank Transfer (NEFT/RTGS/IMPS), or configure gateway credentials.'
      });
    }

    const invoice = db.getFees(req.user).find(f => f.id === invoiceId || f.invoiceNo === invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Fee invoice not found.' });
    }
    if (invoice.status === 'PAID' || invoice.outstandingBalance <= 0) {
      return res.status(400).json({ success: false, message: 'This fee invoice is already paid.' });
    }

    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    const amountPaise = Math.round(Number(invoice.outstandingBalance) * 100);

    res.status(200).json({
      success: true,
      configured: true,
      data: {
        orderId,
        invoiceId: invoice.id,
        amount: amountPaise,
        currency: 'INR',
        keyId // Public key ID only; secret is never exposed
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyGatewayPayment = (req, res) => {
  try {
    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(400).json({
        success: false,
        configured: false,
        message: 'Payment Gateway secret is not configured on the server. Cannot verify gateway transaction.'
      });
    }

    if (!invoiceId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing gateway verification parameters (order_id, payment_id, signature).'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'GATEWAY_SIGNATURE_MISMATCH: Cryptographic signature verification failed.'
      });
    }

    // Verified cryptographically on the server -> mark invoice as paid
    const rawInvoice = db.feeInvoices.find(f => f.id === invoiceId || f.invoiceNo === invoiceId);
    if (!rawInvoice) {
      return res.status(404).json({ success: false, message: 'Fee invoice not found.' });
    }

    const verified = db.verifyFeePayment(rawInvoice.id, {
      action: 'APPROVE',
      paymentMethod: 'Razorpay Online Gateway',
      transactionRef: razorpay_payment_id
    }, { role: 'ADMIN', name: 'Razorpay Verified Webhook/Gateway', institutionId: rawInvoice.institutionId || 'inst-001' });

    res.status(200).json({
      success: true,
      message: 'Gateway payment cryptographically verified and settled.',
      data: verified
    });
  } catch (error) {
    if (error.message && error.message.startsWith('DUPLICATE')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReceipt = (req, res) => {
  try {
    const invoiceId = req.params.invoiceId || req.params.id;
    const receiptData = db.getFeeReceiptData(invoiceId, req.user);

    if (!receiptData) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: receiptData
    });
  } catch (error) {
    if (error.message && error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && error.message.startsWith('RECEIPT_NOT_AVAILABLE')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFeeInvoice = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only administrators can update fee invoices.' });
    }
    const updated = db.updateFeeInvoice(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fee invoice record not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Fee invoice updated successfully',
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFeeInvoice = (req, res) => {
  try {
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete fee invoices.' });
    }
    const deleted = db.deleteFeeInvoice(req.params.id, req.user);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fee invoice record not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Fee invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
