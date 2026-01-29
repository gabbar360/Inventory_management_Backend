import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/stock-summary', InventoryController.getStockSummary);
router.get('/available-stock', InventoryController.getAvailableStock);

export default router;