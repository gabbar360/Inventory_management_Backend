const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/settings', authenticateToken, getSettings);
router.put('/settings', authenticateToken, updateSettings);

module.exports = router;
