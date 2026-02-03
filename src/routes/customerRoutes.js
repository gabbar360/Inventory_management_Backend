const { Router } = require('express');
const { CustomerController } = require('../controllers/customerController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { customerSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', CustomerController.getAll);
router.get('/:id', CustomerController.getById);
router.post('/', validateRequest(customerSchema), CustomerController.create);
router.put('/:id', validateRequest(customerSchema.partial()), CustomerController.update);
router.delete('/:id', CustomerController.delete);

module.exports = router;