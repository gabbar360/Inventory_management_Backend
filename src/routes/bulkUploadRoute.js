const { Router } = require('express');
const { BulkUploadController, uploadMiddleware } = require('../controllers/bulkUploadController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

// Upload endpoints
router.post('/bulk-upload/categories', uploadMiddleware, BulkUploadController.uploadCategories);
router.post('/bulk-upload/products', uploadMiddleware, BulkUploadController.uploadProducts);
router.post('/bulk-upload/vendors', uploadMiddleware, BulkUploadController.uploadVendors);
router.post('/bulk-upload/customers', uploadMiddleware, BulkUploadController.uploadCustomers);
router.post('/bulk-upload/locations', uploadMiddleware, BulkUploadController.uploadLocations);
router.post('/bulk-upload/inward', uploadMiddleware, BulkUploadController.uploadInward);
router.post('/bulk-upload/outward', uploadMiddleware, BulkUploadController.uploadOutward);

// Template download endpoints
router.get('/bulk-upload/template/:type', BulkUploadController.downloadTemplate);

// Export endpoints
router.get('/bulk-upload/export/:type', BulkUploadController.exportData);

module.exports = router;