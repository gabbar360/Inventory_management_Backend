const { Router } = require('express');
const { LocationController } = require('../controllers/locationController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { locationSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', LocationController.getAll);
router.get('/:id', LocationController.getById);
router.post('/', validateRequest(locationSchema), LocationController.create);
router.put('/:id', validateRequest(locationSchema.partial()), LocationController.update);
router.delete('/:id', LocationController.delete);

module.exports = router;