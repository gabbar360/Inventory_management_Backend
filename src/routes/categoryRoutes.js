const { Router } = require('express');
const { CategoryController } = require('../controllers/categoryController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { categorySchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.post('/', validateRequest(categorySchema), CategoryController.create);
router.put('/:id', validateRequest(categorySchema.partial()), CategoryController.update);
router.delete('/:id', CategoryController.delete);

module.exports = router;