import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { productSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', validateRequest(productSchema), ProductController.create);
router.put('/:id', validateRequest(productSchema.partial()), ProductController.update);
router.delete('/:id', ProductController.delete);

export default router;