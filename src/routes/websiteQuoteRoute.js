const express = require('express');
const { getWebsiteQuotes, updateWebsiteQuoteStatus, deleteWebsiteQuote, updateWebsiteQuote, updateWebsiteQuotePrices, generateWebsiteQuotePDF, convertWebsiteQuoteToQuote } = require('../controllers/websiteQuoteController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/website-quotes', authenticateToken, getWebsiteQuotes);
router.put('/website-quotes/:id', authenticateToken, updateWebsiteQuote);
router.put('/website-quotes/:id/status', authenticateToken, updateWebsiteQuoteStatus);
router.put('/website-quotes/:id/prices', authenticateToken, updateWebsiteQuotePrices);
router.get('/website-quotes/:id/pdf', authenticateToken, generateWebsiteQuotePDF);
router.post('/website-quotes/:id/convert', authenticateToken, convertWebsiteQuoteToQuote);
router.delete('/website-quotes/:id', authenticateToken, deleteWebsiteQuote);

module.exports = router;
