const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { VendorService } = require('../services/vendorService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');


class VendorController {
  static async getAll(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parseQueryParams(req.query);
      const result = await VendorService.getAll(page, limit, search, sortBy, sortOrder);
      return sendResponse(res, 200, true, result.vendors, 'Vendors retrieved successfully', result.pagination);
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.getById(id);
      return sendResponse(res, 200, true, vendor, 'Vendor retrieved successfully');
    } catch (error) {
      return sendError(res, 404, error.message);
    }
  }

  static async create(req, res) {
    try {
      const vendor = await VendorService.create(req.body);
      return sendResponse(res, 201, true, vendor, 'Vendor created successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.update(id, req.body);
      return sendResponse(res, 200, true, vendor, 'Vendor updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await VendorService.delete(id);
      return sendResponse(res, 200, true, result, 'Vendor deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  }

  static async getLedger(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const ledger = await VendorService.getLedger(id, startDate, endDate);
      return sendResponse(res, 200, true, ledger, 'Vendor ledger retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async downloadLedgerPDF(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const ledger = await VendorService.getLedger(id, startDate, endDate);
      const settings = await settingsService.getSettings();

      // Convert logo to base64
      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/vendorLedgerTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { ledger, logoBase64, settings, startDate, endDate });

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      try {
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

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="VendorLedger-${ledger.vendor.code}.pdf"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.end(pdfBuffer);
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      return sendError(res, 500, error.message);
    }
  }
}
module.exports = { VendorController };
