const { Router } = require('express');
const { ProductController } = require('../controllers/productController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { productSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', validateRequest(productSchema), ProductController.create);
router.put('/:id', validateRequest(productSchema.partial()), ProductController.update);
router.delete('/:id', ProductController.delete);

module.exports = router;