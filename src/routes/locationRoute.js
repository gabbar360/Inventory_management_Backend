const { Router } = require('express');
const { LocationController } = require('../controllers/locationController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { locationSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/locations', LocationController.getAll);
router.get('/locations/:id', LocationController.getById);
router.post('/locations', validateRequest(locationSchema), LocationController.create);
router.put('/locations/:id', validateRequest(locationSchema.partial()), LocationController.update);
router.delete('/locations/:id', LocationController.delete);

module.exports = router;