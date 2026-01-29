import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { categorySchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.post('/', validateRequest(categorySchema), CategoryController.create);
router.put('/:id', validateRequest(categorySchema.partial()), CategoryController.update);
router.delete('/:id', CategoryController.delete);

export default router;