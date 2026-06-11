const { Router } = require('express');
const { BarcodeController } = require('../controllers/barcodeController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/barcodes/lookup/:barcode', BarcodeController.lookup);
router.post('/barcodes/scan', BarcodeController.scan);
router.get('/barcodes/print/:source/:id', BarcodeController.getBarcodesForPrint);

module.exports = router;