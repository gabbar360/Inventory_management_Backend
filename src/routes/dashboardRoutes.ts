import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/kpis', DashboardController.getKPIs);
router.get('/revenue-chart', DashboardController.getRevenueChart);
router.get('/top-products', DashboardController.getTopProducts);
router.get('/top-customers', DashboardController.getTopCustomers);
router.get('/inventory-alerts', DashboardController.getInventoryAlerts);

export default router;