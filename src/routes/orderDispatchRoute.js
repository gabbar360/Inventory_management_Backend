const express = require('express');
const orderDispatchController = require('../controllers/orderDispatchController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/order-dispatches', authenticateToken, orderDispatchController.createOrderDispatch);
router.get('/order-dispatches', authenticateToken, orderDispatchController.getOrderDispatches);
router.get('/order-dispatches/sales-order/:salesOrderId', authenticateToken, orderDispatchController.getDispatchBySalesOrderId);
router.get('/order-dispatches/:id/pdf', authenticateToken, orderDispatchController.generateDispatchPDF);
router.get('/order-dispatches/:id', authenticateToken, orderDispatchController.getOrderDispatchById);
router.put('/order-dispatches/:id', authenticateToken, orderDispatchController.updateOrderDispatch);
router.delete('/order-dispatches/:id', authenticateToken, orderDispatchController.deleteOrderDispatch);

module.exports = router;
