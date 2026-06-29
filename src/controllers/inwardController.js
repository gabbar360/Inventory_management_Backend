const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { InwardService } = require('../services/inwardService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class InwardController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder, startDate, endDate } = parseQueryParams(req.query);
      const vendorId = req.query.vendorId ? parseInt(req.query.vendorId) : null;
      const result = await InwardService.getAll(page, limit, search, sortBy, sortOrder, startDate, endDate, vendorId);
      return sendResponse(res, 200, true, result.invoices, 'Inward invoices retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Inward invoice retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const invoice = await InwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Inward invoice created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InwardService.update(id, req.body);
      return sendResponse(res, 200, true, invoice, 'Inward invoice updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await InwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Inward invoice deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }
  static async generateInwardPDF(req, res) {
    try {
      const invoice = await InwardService.getById(req.params.id);
      const settings = await settingsService.getSettings();

      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/inwardPdfTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { invoice, logoBase64, settings });

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
      res.setHeader('Content-Disposition', `inline; filename="Inward-${invoice.invoiceNo}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Inward PDF Error:', error);
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { InwardController };
