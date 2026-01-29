import { Router } from 'express';
import { VendorController } from '../controllers/vendorController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { vendorSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', VendorController.getAll);
router.get('/:id', VendorController.getById);
router.post('/', validateRequest(vendorSchema), VendorController.create);
router.put('/:id', validateRequest(vendorSchema.partial()), VendorController.update);
router.delete('/:id', VendorController.delete);

export default router;