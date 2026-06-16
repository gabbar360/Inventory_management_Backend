const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { PaymentsMadeService } = require('../services/paymentsMadeService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class PaymentsMadeController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder, startDate, endDate } = parseQueryParams(req.query);
      const vendorId = req.query.vendorId ? parseInt(req.query.vendorId) : null;
      const paymentMode = req.query.paymentMode || null;

      const result = await PaymentsMadeService.getAll(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        vendorId,
        paymentMode,
        startDate,
        endDate
      );

      return sendResponse(res, 200, true, result.payments, 'Payments made retrieved successfully', {
        ...result.pagination,
        summary: result.summary
      });
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const payment = await PaymentsMadeService.getById(id);
      return sendResponse(res, 200, true, payment, 'Payment made retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const payment = await PaymentsMadeService.create(req.body);
      return sendResponse(res, 201, true, payment, 'Payment made created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const payment = await PaymentsMadeService.update(id, req.body);
      return sendResponse(res, 200, true, payment, 'Payment made updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async applyCredits(req, res) {
    try {
      const result = await PaymentsMadeService.applyCredits(req.body);
      return sendResponse(res, 201, true, result, 'Credit application record created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await PaymentsMadeService.delete(id);
      return sendResponse(res, 200, true, result, 'Payment made deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async generatePDF(req, res) {
    try {
      const { id } = req.params;
      const payment = await PaymentsMadeService.getById(id);
      const settings = await settingsService.getSettings();

      // Convert logo to base64
      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/paymentMadeTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { payment, logoBase64, settings });

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
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        }
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="PaymentReceipt-${payment.paymentNumber}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.end(pdfBuffer);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      return sendError(res, 500, error.message);
    }
  }
}

module.exports = { PaymentsMadeController };
