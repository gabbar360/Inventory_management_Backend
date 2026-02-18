const { Router } = require('express');
const { ProductController } = require('../controllers/productController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { productSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/products', ProductController.getAll);
router.get('/products/:id', ProductController.getById);
router.post('/products', validateRequest(productSchema), ProductController.create);
router.put('/products/:id', validateRequest(productSchema.partial()), ProductController.update);
router.delete('/products/:id', ProductController.delete);

module.exports = router;