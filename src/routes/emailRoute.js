const express = require('express');
const { sendDocument, sendLedger } = require('../controllers/emailController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/email/send-document', authenticateToken, sendDocument);
router.post('/email/send-ledger', authenticateToken, sendLedger);

module.exports = router;
