const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, getNextNumberPreview } = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/settings', authenticateToken, getSettings);
router.put('/settings', authenticateToken, updateSettings);
router.get('/settings/preview/:type', authenticateToken, getNextNumberPreview);

module.exports = router;
