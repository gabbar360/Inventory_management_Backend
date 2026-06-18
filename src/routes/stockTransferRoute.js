const express = require('express');
const { transferStock, getTransferHistory } = require('../controllers/stockTransferController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/stock-transfers/transfer', authenticateToken, transferStock);
router.get('/stock-transfers/history', authenticateToken, getTransferHistory);

module.exports = router;
