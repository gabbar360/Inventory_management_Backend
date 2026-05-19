const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const settingsService = require('../services/settingsService');
const quoteService = require('../services/quoteService');

const getWebsiteQuotes = async (req, res) => {
  try {
    const { status, orderType, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { quoteNo: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [quotes, total] = await Promise.all([
      prisma.websiteQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.websiteQuote.count({ where }),
    ]);

    res.json({
      success: true,
      data: quotes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateWebsiteQuoteStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const quote = await prisma.websiteQuote.update({
      where: { id: parseInt(req.params.id) },
      data: { status, remarks: remarks || null },
    });
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteWebsiteQuote = async (req, res) => {
  try {
    await prisma.websiteQuote.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateWebsiteQuote = async (req, res) => {
  try {
    const {
      companyName, contactPerson, email, mobile, orderType,
      gstin, city, state, pincode, billingAddress,
      country, deliveryTerms, portOfDischarge, address,
      additionalRequirements, products,
      prices, discount, shippingCharge, tax, notes, termsAndConditions, termsOfDelivery, paymentTerms
    } = req.body;

    const data = {};
    if (companyName !== undefined) data.companyName = companyName;
    if (contactPerson !== undefined) data.contactPerson = contactPerson || null;
    if (email !== undefined) data.email = email || null;
    if (mobile !== undefined) data.mobile = mobile || null;
    if (orderType !== undefined) data.orderType = orderType;
    if (gstin !== undefined) data.gstin = gstin || null;
    if (city !== undefined) data.city = city || null;
    if (state !== undefined) data.state = state || null;
    if (pincode !== undefined) data.pincode = pincode || null;
    if (billingAddress !== undefined) data.billingAddress = billingAddress || null;
    if (country !== undefined) data.country = country || null;
    if (deliveryTerms !== undefined) data.deliveryTerms = deliveryTerms || null;
    if (portOfDischarge !== undefined) data.portOfDischarge = portOfDischarge || null;
    if (address !== undefined) data.address = address || null;
    if (additionalRequirements !== undefined) data.additionalRequirements = additionalRequirements || null;
    if (products !== undefined) data.products = JSON.stringify(products);
    if (prices !== undefined) data.prices = JSON.stringify(prices);
    if (discount !== undefined) data.discount = discount || 0;
    if (shippingCharge !== undefined) data.shippingCharge = shippingCharge || 0;
    if (tax !== undefined) data.tax = tax || 0;
    if (notes !== undefined) data.notes = notes || null;
    if (termsAndConditions !== undefined) data.termsAndConditions = termsAndConditions || null;
    if (termsOfDelivery !== undefined) data.termsOfDelivery = termsOfDelivery || null;
    if (paymentTerms !== undefined) data.paymentTerms = paymentTerms || null;

    const quote = await prisma.websiteQuote.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateWebsiteQuotePrices = async (req, res) => {
  try {
    const { prices, discount, shippingCharge, tax, notes, termsAndConditions, termsOfDelivery, paymentTerms } = req.body;
    const quote = await prisma.websiteQuote.update({
      where: { id: parseInt(req.params.id) },
      data: {
        prices: JSON.stringify(prices),
        discount: discount || 0,
        shippingCharge: shippingCharge || 0,
        tax: tax || 0,
        notes: notes || null,
        termsAndConditions: termsAndConditions || null,
        termsOfDelivery: termsOfDelivery || null,
        paymentTerms: paymentTerms || null,
      },
    });
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateWebsiteQuotePDF = async (req, res) => {
  try {
    const quote = await prisma.websiteQuote.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });

    const settings = await settingsService.getSettings();
    const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    }

    let products = [];
    try { products = JSON.parse(quote.products); } catch {}
    let prices = {};
    try { prices = JSON.parse(quote.prices || '{}'); } catch {}

    const templatePath = path.join(__dirname, '../templates/websiteQuoteTemplate.ejs');
    const html = await ejs.renderFile(templatePath, { quote, products, prices, logoBase64, settings });

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="WebsiteQuote-${quote.quoteNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Website Quote PDF Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const convertWebsiteQuoteToQuote = async (req, res) => {
  try {
    const { customerId, quoteDate, expiryDate, termsOfDelivery, paymentTerms, reference } = req.body;
    const websiteQuote = await prisma.websiteQuote.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!websiteQuote) return res.status(404).json({ success: false, error: 'Website quote not found' });

    let products = [];
    try { products = JSON.parse(websiteQuote.products); } catch {}
    let prices = {};
    try { prices = JSON.parse(websiteQuote.prices || '{}'); } catch {}

    // Map website products to quote items using saved prices
    const items = products.map((p, i) => ({
      productId: parseInt(p.productId || p.itemCode),
      quantity: p.quantity || 1,
      unit: p.unit || 'box',
      rate: prices[i]?.rate || 0,
      taxRate: prices[i]?.taxRate || 0,
      description: p.productName || '',
    })).filter(item => item.productId && !isNaN(item.productId));

    const quote = await quoteService.createQuote({
      customerId: parseInt(customerId),
      quoteDate,
      expiryDate,
      items,
      totalAmount: 0,
      discount: websiteQuote.discount || 0,
      shippingCharge: websiteQuote.shippingCharge || 0,
      tax: websiteQuote.tax || 0,
      notes: websiteQuote.notes || websiteQuote.additionalRequirements || null,
      termsAndConditions: websiteQuote.termsAndConditions || null,
      termsOfDelivery: termsOfDelivery || websiteQuote.termsOfDelivery || null,
      paymentTerms: paymentTerms || websiteQuote.paymentTerms || null,
      reference: reference || websiteQuote.quoteNo,
    });

    // Mark website quote as converted
    await prisma.websiteQuote.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'converted' },
    });

    res.json({ success: true, data: quote });
  } catch (error) {
    console.error('Convert Website Quote Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getWebsiteQuotes, updateWebsiteQuoteStatus, deleteWebsiteQuote, updateWebsiteQuote, updateWebsiteQuotePrices, generateWebsiteQuotePDF, convertWebsiteQuoteToQuote };
