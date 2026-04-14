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
router.get('/outward/:id/pdf', OutwardController.generateInvoicePDF);
router.get('/reports/profit-loss-pdf', OutwardController.generateProfitLossPDF);
router.get('/reports/profit-loss-pdf/:id', OutwardController.generateSingleInvoiceProfitLossPDF);

module.exports = router;