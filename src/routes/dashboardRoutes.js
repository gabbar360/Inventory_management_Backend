const { Router } = require('express');
const { DashboardController } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/kpis', DashboardController.getKPIs);
router.get('/revenue-chart', DashboardController.getRevenueChart);
router.get('/top-products', DashboardController.getTopProducts);
router.get('/top-customers', DashboardController.getTopCustomers);
router.get('/inventory-alerts', DashboardController.getInventoryAlerts);
router.get('/performance-metrics', DashboardController.getPerformanceMetrics);

module.exports = router;