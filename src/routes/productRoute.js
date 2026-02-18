const { Router } = require('express');
const { ProductController } = require('../controllers/productController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { productSchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/getall-products', ProductController.getAll);
router.get('/get-products/:id', ProductController.getById);
router.post('/add-products', validateRequest(productSchema), ProductController.create);
router.put('/update-products/:id', validateRequest(productSchema.partial()), ProductController.update);
router.delete('/delete-products/:id', ProductController.delete);

module.exports = router;