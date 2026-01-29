import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { customerSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', CustomerController.getAll);
router.get('/:id', CustomerController.getById);
router.post('/', validateRequest(customerSchema), CustomerController.create);
router.put('/:id', validateRequest(customerSchema.partial()), CustomerController.update);
router.delete('/:id', CustomerController.delete);

export default router;