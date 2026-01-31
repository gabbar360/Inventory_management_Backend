import { Router } from 'express';
import { InwardController } from '../controllers/inwardController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { inwardInvoiceSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', InwardController.getAll);
router.get('/:id', InwardController.getById);
router.post('/', validateRequest(inwardInvoiceSchema), InwardController.create);
router.put('/:id', validateRequest(inwardInvoiceSchema), InwardController.update);
router.delete('/:id', InwardController.delete);

export default router;