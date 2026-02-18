const { Router } = require('express');
const { OutwardController } = require('../controllers/outwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { outwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-outward', OutwardController.getAll);
router.get('/outward/:id', OutwardController.getById);
router.post('/add-outward', validateRequest(outwardInvoiceSchema), OutwardController.create);
router.put('/update-outward/:id', validateRequest(outwardInvoiceSchema), OutwardController.update);
router.delete('/delete-outward/:id', OutwardController.delete);
router.get('/get-outward/reports/profit-loss', OutwardController.getProfitLoss);

module.exports = router;