const { Router } = require('express');
const { OutwardController } = require('../controllers/outwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { outwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', OutwardController.getAll);
router.get('/:id', OutwardController.getById);
router.post('/', validateRequest(outwardInvoiceSchema), OutwardController.create);
router.put('/:id', validateRequest(outwardInvoiceSchema), OutwardController.update);
router.delete('/:id', OutwardController.delete);
router.get('/reports/profit-loss', OutwardController.getProfitLoss);

module.exports = router;