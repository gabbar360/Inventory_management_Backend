const { Router } = require('express');
const { VendorController } = require('../controllers/vendorController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { vendorSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-vendors', VendorController.getAll);
router.get('/get-vendors/:id', VendorController.getById);
router.post('/add-vendors', validateRequest(vendorSchema), VendorController.create);
router.put('/update-vendors/:id', validateRequest(vendorSchema.partial()), VendorController.update);
router.delete('/delete-vendors/:id', VendorController.delete);

module.exports = router;