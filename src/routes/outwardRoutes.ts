import { Router } from 'express';
import { OutwardController } from '../controllers/outwardController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { outwardInvoiceSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', OutwardController.getAll);
router.get('/:id', OutwardController.getById);
router.post('/', validateRequest(outwardInvoiceSchema), OutwardController.create);
router.put('/:id', validateRequest(outwardInvoiceSchema), OutwardController.update);
router.delete('/:id', OutwardController.delete);
router.get('/reports/profit-loss', OutwardController.getProfitLoss);

export default router;