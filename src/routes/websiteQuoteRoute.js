const express = require('express');
const { getWebsiteQuotes, updateWebsiteQuoteStatus, deleteWebsiteQuote } = require('../controllers/websiteQuoteController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/website-quotes', authenticateToken, getWebsiteQuotes);
router.put('/website-quotes/:id/status', authenticateToken, updateWebsiteQuoteStatus);
router.delete('/website-quotes/:id', authenticateToken, deleteWebsiteQuote);

module.exports = router;
