const { Router } = require('express');
const { InventoryController } = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/stock-summary', InventoryController.getStockSummary);
router.get('/available-stock', InventoryController.getAvailableStock);

module.exports = router;