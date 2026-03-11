const quoteService = require('../services/quoteService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');

const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  const convertHundreds = (n) => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      n = 0;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  };

  let result = '';
  let crores = Math.floor(num / 10000000);
  if (crores > 0) {
    result += convertHundreds(crores) + 'Crore ';
    num %= 10000000;
  }

  let lakhs = Math.floor(num / 100000);
  if (lakhs > 0) {
    result += convertHundreds(lakhs) + 'Lakh ';
    num %= 100000;
  }

  let thousandsNum = Math.floor(num / 1000);
  if (thousandsNum > 0) {
    result += convertHundreds(thousandsNum) + 'Thousand ';
    num %= 1000;
  }

  if (num > 0) {
    result += convertHundreds(num);
  }

  return result.trim() + ' Only';
};

const createQuote = async (req, res) => {
  try {
    const { customerId, quoteDate, expiryDate, items, discount, tax, notes } = req.body;

    if (!customerId || !quoteDate || !expiryDate || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);

    const quote = await quoteService.createQuote({
      customerId,
      quoteDate,
      expiryDate,
      items,
      totalAmount,
      discount: discount || 0,
      tax: tax || 0,
      notes,
    });

    res.status(201).json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuotes = async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const quotes = await quoteService.getQuotes({ customerId, status });
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuoteById = async (req, res) => {
  try {
    const quote = await quoteService.getQuoteById(req.params.id);
    res.json(quote);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const updateQuote = async (req, res) => {
  try {
    const { status, discount, tax, totalAmount, notes } = req.body;
    const quote = await quoteService.updateQuote(req.params.id, {
      status,
      discount,
      tax,
      totalAmount,
      notes,
    });
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateQuoteItems = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    const quote = await quoteService.updateQuoteItems(req.params.id, items);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generateQuotePDF = async (req, res) => {
  try {
    console.log('PDF Generation started for quote ID:', req.params.id);
    
    // Get quote data
    const quote = await quoteService.getQuoteById(req.params.id);
    
    // Add total in words
    const finalTotal = quote.totalAmount + (quote.totalAmount * (quote.taxRate || 5) / 100) - (quote.discount || 0);
    quote.totalInWords = numberToWords(Math.floor(finalTotal));
    
    // Render EJS template
    const templatePath = path.join(__dirname, '../templates/quoteTemplate.ejs');
    const html = await ejs.renderFile(templatePath, { quote });
    
    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });
    
    await browser.close();
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quote-${quote.quoteNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.end(pdfBuffer);
    
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteQuote = async (req, res) => {
  try {
    await quoteService.deleteQuote(req.params.id);
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  updateQuoteItems,
  deleteQuote,
  generateQuotePDF,
};
