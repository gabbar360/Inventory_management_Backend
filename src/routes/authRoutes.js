const { Router } = require('express');
const { AuthController } = require('../controllers/authController');
const { validateRequest } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../utils/validation');

const router = Router();

router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);

module.exports = router;