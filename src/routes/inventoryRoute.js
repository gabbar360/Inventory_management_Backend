const { Router } = require('express');
const { InventoryController } = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/inventory/stock-summary', InventoryController.getStockSummary);
router.get('/inventory/available-stock', InventoryController.getAvailableStock);

module.exports = router;
