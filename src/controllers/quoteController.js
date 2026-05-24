const quoteService = require('../services/quoteService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

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
    const { customerId, quoteDate, expiryDate, items, discount, tax, notes, termsAndConditions, termsOfDelivery, paymentTerms, reference, shippingCharge } = req.body;

    if (!customerId || !quoteDate || !expiryDate || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
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
      termsAndConditions,
      termsOfDelivery: termsOfDelivery || null,
      paymentTerms: paymentTerms || null,
      reference: reference || null,
      shippingCharge: shippingCharge || 0,
    });

    res.status(201).json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getQuotes = async (req, res) => {
  try {
    const { customerId, status, page, limit, search, startDate, endDate } = req.query;
    const quotes = await quoteService.getQuotes({ customerId, status, page, limit, search, startDate, endDate });
    res.json({ success: true, data: quotes.data, pagination: quotes.pagination });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getQuoteById = async (req, res) => {
  try {
    const quote = await quoteService.getQuoteById(req.params.id);
    res.status(200).json({ success: true, data: quote });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

const updateQuote = async (req, res) => {
  try {
    const { customerId, quoteDate, expiryDate, status, discount, tax, totalAmount, notes, termsAndConditions, termsOfDelivery, paymentTerms, reference, items, shippingCharge } = req.body;
    
    let quote;
    if (items && items.length > 0) {
      await quoteService.updateQuoteItems(req.params.id, items);
    }
    
    quote = await quoteService.updateQuote(req.params.id, {
      customerId,
      quoteDate,
      expiryDate,
      status,
      discount: discount !== undefined ? discount : 0,
      tax: tax !== undefined ? tax : 0,
      totalAmount,
      notes,
      termsAndConditions,
      termsOfDelivery: termsOfDelivery !== undefined ? termsOfDelivery : null,
      paymentTerms: paymentTerms !== undefined ? paymentTerms : null,
      reference: reference !== undefined ? reference : null,
      shippingCharge: shippingCharge !== undefined ? shippingCharge : 0,
    });
    
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateQuoteItems = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items are required' });
    }
    const quote = await quoteService.updateQuoteItems(req.params.id, items);
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateQuotePDF = async (req, res) => {
  try {
    // Fetch fresh data from database
    const quote = await quoteService.getQuoteById(req.params.id);
    const settings = await settingsService.getSettings();  
    // Remove old calculation - let template handle it
    // Template will calculate everything correctly
    
    // Convert logo to base64
    const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    }
    
    const templatePath = path.join(__dirname, '../templates/quoteTemplate.ejs');
    const html = await ejs.renderFile(templatePath, { quote, logoBase64, settings });
    
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
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
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quote-${quote.quoteNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.end(pdfBuffer);
    
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteQuote = async (req, res) => {
  try {
    await quoteService.deleteQuote(req.params.id);
    res.json({ success: true, message: 'Quote deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const convertQuoteToInvoice = async (req, res) => {
  try {
    const invoice = await quoteService.convertQuoteToInvoice(req.params.id, req.body.items);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
  convertQuoteToInvoice,
};
