const { PaymentService } = require('../services/paymentService');
const settingsService = require('../services/settingsService');
const { sendResponse, sendError } = require("../utils/helpers");
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class PaymentController {
  /**
   * Record a payment against an invoice
   */
  static async recordPayment(req, res) {
    try {
      const { id } = req.params; // Invoice ID
      const { amount, paymentDate, paymentMethod, transactionId, notes } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return sendError(res, 400, 'Amount is required and must be greater than zero');
      }

      const receipt = await PaymentService.recordPayment(id, {
        amount,
        paymentDate,
        paymentMethod,
        transactionId,
        notes,
      });

      return sendResponse(res, 201, true, receipt, 'Payment recorded successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  /**
   * Get payments for a specific invoice
   */
  static async getPayments(req, res) {
    try {
      const { id } = req.params; // Invoice ID
      const payments = await PaymentService.getPaymentsForInvoice(id);
      return sendResponse(res, 200, true, payments, 'Payments retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  /**
   * Generate professional PDF Receipt for a payment
   */
  static async generateReceiptPDF(req, res) {
    try {
      const { id } = req.params; // Payment Receipt ID
      const receipt = await PaymentService.getPaymentReceiptById(id);
      const settings = await settingsService.getSettings();

      // Convert logo to base64
      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/receiptTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { receipt, logoBase64, settings });

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
          top: '12mm',
          right: '12mm',
          bottom: '12mm',
          left: '12mm'
        }
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Receipt-${receipt.receiptNo}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.end(pdfBuffer);

    } catch (error) {
      console.error('Receipt PDF Error:', error);
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { PaymentController };
