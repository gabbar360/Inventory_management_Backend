const { Router } = require('express');
const { VendorController } = require('../controllers/vendorController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { vendorSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', VendorController.getAll);
router.get('/:id', VendorController.getById);
router.post('/', validateRequest(vendorSchema), VendorController.create);
router.put('/:id', validateRequest(vendorSchema.partial()), VendorController.update);
router.delete('/:id', VendorController.delete);

module.exports = router;