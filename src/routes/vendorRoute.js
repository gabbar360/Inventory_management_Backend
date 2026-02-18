const { Router } = require('express');
const { VendorController } = require('../controllers/vendorController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { vendorSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/vendors', VendorController.getAll);
router.get('/vendors/:id', VendorController.getById);
router.post('/vendors', validateRequest(vendorSchema), VendorController.create);
router.put('/vendors/:id', validateRequest(vendorSchema.partial()), VendorController.update);
router.delete('/vendors/:id', VendorController.delete);

module.exports = router;