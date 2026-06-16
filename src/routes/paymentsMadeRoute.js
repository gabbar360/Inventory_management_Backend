const { Router } = require('express');
const { PaymentsMadeController } = require('../controllers/paymentsMadeController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { paymentMadeSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-paymentsmade', PaymentsMadeController.getAll);
router.get('/paymentsmade/:id', PaymentsMadeController.getById);
router.post('/add-paymentsmade', validateRequest(paymentMadeSchema), PaymentsMadeController.create);
router.put('/update-paymentsmade/:id', validateRequest(paymentMadeSchema), PaymentsMadeController.update);
router.delete('/delete-paymentsmade/:id', PaymentsMadeController.delete);
router.get('/paymentsmade/:id/pdf', PaymentsMadeController.generatePDF);
router.post('/paymentsmade/apply-credits', PaymentsMadeController.applyCredits);

module.exports = router;
