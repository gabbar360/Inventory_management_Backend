const { Router } = require('express');
const { SampleController } = require('../controllers/sampleController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { sampleSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-samples', SampleController.getAll);
router.get('/get-samples/:id', SampleController.getById);
router.post('/add-samples', validateRequest(sampleSchema), SampleController.create);
router.put('/update-samples/:id', validateRequest(sampleSchema.partial()), SampleController.update);
router.delete('/delete-samples/:id', SampleController.delete);

module.exports = router;
