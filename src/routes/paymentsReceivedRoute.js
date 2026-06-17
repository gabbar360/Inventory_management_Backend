const { Router } = require('express');
const { PaymentsReceivedController } = require('../controllers/paymentsReceivedController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { paymentReceivedSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-paymentsreceived', PaymentsReceivedController.getAll);
router.get('/paymentsreceived/:id', PaymentsReceivedController.getById);
router.post('/add-paymentsreceived', validateRequest(paymentReceivedSchema), PaymentsReceivedController.create);
router.put('/update-paymentsreceived/:id', validateRequest(paymentReceivedSchema), PaymentsReceivedController.update);
router.delete('/delete-paymentsreceived/:id', PaymentsReceivedController.delete);
router.get('/paymentsreceived/:id/pdf', PaymentsReceivedController.generatePDF);
router.post('/paymentsreceived/apply-credits', PaymentsReceivedController.applyCredits);

module.exports = router;
