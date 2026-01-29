import { Router } from 'express';
import { LocationController } from '../controllers/locationController';
import { authenticateToken, validateRequest } from '../middleware/auth';
import { locationSchema } from '../utils/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', LocationController.getAll);
router.get('/:id', LocationController.getById);
router.post('/', validateRequest(locationSchema), LocationController.create);
router.put('/:id', validateRequest(locationSchema.partial()), LocationController.update);
router.delete('/:id', LocationController.delete);

export default router;