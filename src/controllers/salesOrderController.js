const salesOrderService = require('../services/salesOrderService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const createSalesOrder = async (req, res) => {
  try {
    const { customerId, orderDate, items, saleType, status, totalAmount, notes, reference, referenceBy, expectedShipmentDate, placeOfSupply, deliveryMethod, adjustment, amountReceived } = req.body;
    if (!customerId || !orderDate || !items || items.length === 0)
      return res.status(400).json({ success: false, error: 'Missing required fields' });

    const order = await salesOrderService.createSalesOrder({ customerId, orderDate, items, saleType, status, totalAmount, notes, reference, referenceBy, expectedShipmentDate, placeOfSupply, deliveryMethod, adjustment, amountReceived });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSalesOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, startDate, endDate } = req.query;
    const result = await salesOrderService.getSalesOrders({ page: parseInt(page), limit: parseInt(limit), search, status, startDate, endDate });
    res.json({ success: true, data: result.orders, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSalesOrderById = async (req, res) => {
  try {
    const order = await salesOrderService.getSalesOrderById(req.params.id);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

const updateSalesOrder = async (req, res) => {
  try {
    const order = await salesOrderService.updateSalesOrder(req.params.id, req.body);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteSalesOrder = async (req, res) => {
  try {
    await salesOrderService.deleteSalesOrder(req.params.id);
    res.json({ success: true, message: 'Sales order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const convertFromQuote = async (req, res) => {
  try {
    const order = await salesOrderService.convertFromQuote(req.params.quoteId, req.body.items);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateSalesOrderPDF = async (req, res) => {
  try {
    const order = await salesOrderService.getSalesOrderById(req.params.id);
    const settings = await settingsService.getSettings();

    const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    }

    // Generate dynamic UPI QR Code base64 Data URL (Vegnar Greens details)
    const QRCode = require('qrcode');
    const upiString = `upi://pay?pa=7570000553-3@ybl&pn=Vegnar%20Greens`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiString, {
      margin: 1,
      width: 150,
      color: {
        dark: '#0f2a24',
        light: '#ffffff'
      }
    });

    const templatePath = path.join(__dirname, '../templates/salesOrderTemplate.ejs');
    const html = await ejs.renderFile(templatePath, { order, logoBase64, settings, qrCodeDataUrl });

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SalesOrder-${order.orderNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const convertSalesOrderToInvoice = async (req, res) => {
  try {
    const invoice = await salesOrderService.convertSalesOrderToInvoice(req.params.id, req.body.items);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { createSalesOrder, getSalesOrders, getSalesOrderById, updateSalesOrder, deleteSalesOrder, convertFromQuote, generateSalesOrderPDF, convertSalesOrderToInvoice };
