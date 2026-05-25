const { Router } = require('express');
const { PaymentController } = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// Secure all payment routes with authentication token middleware
router.use(authenticateToken);

// Record a payment against an outward invoice
router.post('/outward/:id/payments', PaymentController.recordPayment);

// Fetch all recorded payments for an outward invoice
router.get('/outward/:id/payments', PaymentController.getPayments);

// Download/view a professional PDF receipt for a payment
router.get('/payments/receipt/:id/pdf', PaymentController.generateReceiptPDF);

module.exports = router;
