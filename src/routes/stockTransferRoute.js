const express = require('express');
const { transferStock, getTransferHistory } = require('../controllers/stockTransferController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/transfer', authenticateToken, transferStock);
router.get('/history', authenticateToken, getTransferHistory);

module.exports = router;
