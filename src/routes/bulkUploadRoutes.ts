import { Router } from 'express';
import { BulkUploadController, uploadMiddleware } from '../controllers/bulkUploadController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Upload endpoints
router.post('/categories', uploadMiddleware, BulkUploadController.uploadCategories);
router.post('/products', uploadMiddleware, BulkUploadController.uploadProducts);
router.post('/vendors', uploadMiddleware, BulkUploadController.uploadVendors);
router.post('/customers', uploadMiddleware, BulkUploadController.uploadCustomers);
router.post('/locations', uploadMiddleware, BulkUploadController.uploadLocations);
router.post('/inward', uploadMiddleware, BulkUploadController.uploadInward);
router.post('/outward', uploadMiddleware, BulkUploadController.uploadOutward);

// Template download endpoints
router.get('/template/:type', BulkUploadController.downloadTemplate);

// Export endpoints
router.get('/export/:type', BulkUploadController.exportData);

export default router;