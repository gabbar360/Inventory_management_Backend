const { Router } = require('express');
const { SampleController } = require('../controllers/sampleController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { sampleSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/samples', SampleController.getAll);
router.get('/samples/:id', SampleController.getById);
router.post('/samples', validateRequest(sampleSchema), SampleController.create);
router.put('/samples/:id', validateRequest(sampleSchema.partial()), SampleController.update);
router.delete('/samples/:id', SampleController.delete);

module.exports = router;
