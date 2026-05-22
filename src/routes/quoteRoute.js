const express = require('express');
const quoteController = require('../controllers/quoteController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/quotes', authenticateToken, quoteController.createQuote);
router.get('/quotes', authenticateToken, quoteController.getQuotes);
router.get('/quotes/:id', authenticateToken, quoteController.getQuoteById);
router.get('/quotes/:id/pdf', authenticateToken, quoteController.generateQuotePDF);
router.post('/quotes/:id/convert-to-invoice', authenticateToken, quoteController.convertQuoteToInvoice);
router.get('/quotes/:id/test', authenticateToken, (req, res) => {
  res.json({ message: 'Test endpoint working', id: req.params.id });
});
router.put('/quotes/:id', authenticateToken, quoteController.updateQuote);
router.put('/quotes/:id/items', authenticateToken, quoteController.updateQuoteItems);
router.delete('/quotes/:id', authenticateToken, quoteController.deleteQuote);

module.exports = router;
