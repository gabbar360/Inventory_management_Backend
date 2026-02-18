const { Router } = require('express');
const { DashboardController } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/dashboard/kpis', DashboardController.getKPIs);
router.get('/dashboard/revenue-chart', DashboardController.getRevenueChart);
router.get('/dashboard/top-products', DashboardController.getTopProducts);
router.get('/dashboard/top-customers', DashboardController.getTopCustomers);
router.get('/dashboard/inventory-alerts', DashboardController.getInventoryAlerts);
router.get('/dashboard/performance-metrics', DashboardController.getPerformanceMetrics);

module.exports = router;