const { Router } = require('express');
const { InwardController } = require('../controllers/inwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { inwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/inward', InwardController.getAll);
router.get('/inward/:id', InwardController.getById);
router.post('/inward', validateRequest(inwardInvoiceSchema), InwardController.create);
router.put('/inward/:id', validateRequest(inwardInvoiceSchema), InwardController.update);
router.delete('/inward/:id', InwardController.delete);

module.exports = router;