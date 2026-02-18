const { Router } = require('express');
const { LocationController } = require('../controllers/locationController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { locationSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-locations', LocationController.getAll);
router.get('/get-locations/:id', LocationController.getById);
router.post('/add-locations', validateRequest(locationSchema), LocationController.create);
router.put('/update-locations/:id', validateRequest(locationSchema.partial()), LocationController.update);
router.delete('/delete-locations/:id', LocationController.delete);

module.exports = router;