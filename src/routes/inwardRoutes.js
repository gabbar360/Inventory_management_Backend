const { Router } = require('express');
const { InwardController } = require('../controllers/inwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { inwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', InwardController.getAll);
router.get('/:id', InwardController.getById);
router.post('/', validateRequest(inwardInvoiceSchema), InwardController.create);
router.put('/:id', validateRequest(inwardInvoiceSchema), InwardController.update);
router.delete('/:id', InwardController.delete);

module.exports = router;