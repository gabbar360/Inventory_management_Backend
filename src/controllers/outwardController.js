const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { OutwardService } = require('../services/outwardService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');


class OutwardController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await OutwardService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.invoices, 'Outward invoices retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await OutwardService.getById(id);
      return sendResponse(res, 200, true, invoice, 'Outward invoice retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const invoice = await OutwardService.create(req.body);
      return sendResponse(res, 201, true, invoice, 'Outward invoice created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const invoice = await OutwardService.update(id, req.body);
      return sendResponse(res, 200, true, invoice, 'Outward invoice updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await OutwardService.delete(id);
      return sendResponse(res, 200, true, result, 'Outward invoice deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getProfitLoss(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const result = await OutwardService.getProfitLoss(
        startDate,
        endDate
      );
      return sendResponse(res, 200, true, result, 'Profit & Loss report retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async generateInvoicePDF(req, res) {
    try {
      // Fetch fresh data from database
      const invoice = await OutwardService.getById(req.params.id);
      const settings = await settingsService.getSettings();
      
      // Convert logo to base64
      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }
      
      const templatePath = path.join(__dirname, '../templates/invoiceTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { invoice, logoBase64, settings });
      
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
      res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNo}.pdf"`);
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
module.exports = { OutwardController };
