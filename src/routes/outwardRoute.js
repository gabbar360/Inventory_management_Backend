const { Router } = require('express');
const { OutwardController } = require('../controllers/outwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { outwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/outward', OutwardController.getAll);
router.get('/outward/:id', OutwardController.getById);
router.post('/outward', validateRequest(outwardInvoiceSchema), OutwardController.create);
router.put('/outward/:id', validateRequest(outwardInvoiceSchema), OutwardController.update);
router.delete('/outward/:id', OutwardController.delete);
router.get('/outward/reports/profit-loss', OutwardController.getProfitLoss);

module.exports = router;