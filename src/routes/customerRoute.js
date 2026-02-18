const { Router } = require('express');
const { CustomerController } = require('../controllers/customerController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { customerSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/customers', CustomerController.getAll);
router.get('/customers/:id', CustomerController.getById);
router.post('/customers', validateRequest(customerSchema), CustomerController.create);
router.put('/customers/:id', validateRequest(customerSchema.partial()), CustomerController.update);
router.delete('/customers/:id', CustomerController.delete);

module.exports = router;