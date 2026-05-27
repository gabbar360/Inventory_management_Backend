const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { authenticateToken } = require('../middleware/auth');

router.post('/purchase-orders', authenticateToken, purchaseOrderController.createPurchaseOrder);
router.get('/purchase-orders', authenticateToken, purchaseOrderController.getPurchaseOrders);
router.get('/purchase-orders/:id/pdf', authenticateToken, purchaseOrderController.generatePOPDF);
router.get('/purchase-orders/:id', authenticateToken, purchaseOrderController.getPurchaseOrderById);
router.put('/purchase-orders/:id', authenticateToken, purchaseOrderController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', authenticateToken, purchaseOrderController.deletePurchaseOrder);

module.exports = router;
