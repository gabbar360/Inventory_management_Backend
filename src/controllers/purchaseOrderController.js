const purchaseOrderService = require('../services/purchaseOrderService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const createPurchaseOrder = async (req, res) => {
  try {
    const po = await purchaseOrderService.createPurchaseOrder(req.body);
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const pos = await purchaseOrderService.getPurchaseOrders(req.query);
    res.status(200).json({ success: true, data: pos });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const po = await purchaseOrderService.getPurchaseOrderById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const po = await purchaseOrderService.updatePurchaseOrder(req.params.id, req.body);
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    await purchaseOrderService.deletePurchaseOrder(req.params.id);
    res.status(200).json({ success: true, message: 'Purchase Order deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const generatePOPDF = async (req, res) => {
  try {
    const po = await purchaseOrderService.getPurchaseOrderById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    const settings = await prisma.settings.findFirst();
    
    const templatePath = path.join(__dirname, '../templates/purchaseOrderTemplate.ejs');
    
    let html;
    try {
      html = await ejs.renderFile(templatePath, {
        po,
        settings,
        logoBase64: null,
        qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      });
    } catch (renderError) {
      return res.status(500).json({ success: false, message: 'Template rendering failed: ' + renderError.message });
    }

    let browser, pdfBuffer;
    try {
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({ format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      await browser.close();
    } catch (puppeteerError) {
      if (browser) await browser.close();
      return res.status(500).json({ success: false, message: 'PDF generation failed: ' + puppeteerError.message });
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(500).json({ success: false, message: 'PDF generation produced empty buffer' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PO-${po.poNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'PDF generation error: ' + error.message });
  }
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  generatePOPDF
};
