const express = require('express');
const { UserController } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all users (paginated)
router.get('/users', UserController.getAllUsers);

// Get user by ID
router.get('/users/:id', UserController.getUserById);

// Create new user
router.post('/users', UserController.createUser);

// Update user
router.put('/users/:id', UserController.updateUser);

// Delete user
router.delete('/users/:id', UserController.deleteUser);

// Change password for a user
router.post('/users/:id/change-password', UserController.changePassword);

module.exports = router;
