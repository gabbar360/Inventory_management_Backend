const { Router } = require('express');
const { AuthController } = require('../controllers/authController');
const { validateRequest, authenticateToken } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../utils/validation');

const router = Router();

router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authenticateToken, AuthController.getCurrentUser);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;