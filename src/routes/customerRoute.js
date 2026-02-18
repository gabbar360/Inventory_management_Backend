const { Router } = require('express');
const { CustomerController } = require('../controllers/customerController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { customerSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-customers', CustomerController.getAll);
router.get('/get-customers/:id', CustomerController.getById);
router.post('/add-customers', validateRequest(customerSchema), CustomerController.create);
router.put('/update-customers/:id', validateRequest(customerSchema.partial()), CustomerController.update);
router.delete('/delete-customers/:id', CustomerController.delete);

module.exports = router;