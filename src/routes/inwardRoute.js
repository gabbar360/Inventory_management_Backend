const { Router } = require('express');
const { InwardController } = require('../controllers/inwardController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { inwardInvoiceSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-inward', InwardController.getAll);
router.get('/get-inward/:id', InwardController.getById);
router.post('/add-inward', validateRequest(inwardInvoiceSchema), InwardController.create);
router.put('/update-inward/:id', validateRequest(inwardInvoiceSchema), InwardController.update);
router.delete('/delete-inward/:id', InwardController.delete);
module.exports = router;