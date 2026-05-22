const express = require('express');
const salesOrderController = require('../controllers/salesOrderController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/sales-orders', authenticateToken, salesOrderController.createSalesOrder);
router.get('/sales-orders', authenticateToken, salesOrderController.getSalesOrders);
router.get('/sales-orders/:id', authenticateToken, salesOrderController.getSalesOrderById);
router.put('/sales-orders/:id', authenticateToken, salesOrderController.updateSalesOrder);
router.delete('/sales-orders/:id', authenticateToken, salesOrderController.deleteSalesOrder);
router.post('/sales-orders/convert-from-quote/:quoteId', authenticateToken, salesOrderController.convertFromQuote);
router.get('/sales-orders/:id/pdf', authenticateToken, salesOrderController.generateSalesOrderPDF);
router.post('/sales-orders/:id/convert-to-invoice', authenticateToken, salesOrderController.convertSalesOrderToInvoice);

module.exports = router;
