const { Router } = require('express');
const { CategoryController } = require('../controllers/categoryController');
const { authenticateToken, validateRequest } = require('../middleware/auth');
const { categorySchema } = require('../utils/validation');

const router = Router();

router.use(authenticateToken);

router.get('/get-categories', CategoryController.getAll);
router.get('/get-categories/:id', CategoryController.getById);
router.post('/create-categories', validateRequest(categorySchema), CategoryController.create);
router.put('/update-categories/:id', validateRequest(categorySchema.partial()), CategoryController.update);
router.delete('/delete-categories/:id', CategoryController.delete);

module.exports = router;