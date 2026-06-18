const { sendResponse, sendError, parseQueryParams } = require("../utils/helpers");
const { Request, Response } = require('express');
const { InventoryService } = require('../services/inventoryService');
const settingsService = require('../services/settingsService');
const puppeteer = require('puppeteer');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');

class InventoryController {
  static async getStockSummary(req, res) {
    try {
      const { page, limit, locationId, search } = parseQueryParams(req.query);
      const result = await InventoryService.getStockSummary(page, limit, locationId, search);
      return res.status(200).json({
        success: true,
        data: result.data,
        lowStockItems: result.lowStockItems,
        globalStats: result.globalStats,
        pagination: result.pagination,
        message: 'Stock summary retrieved successfully'
      });
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async getAvailableStock(req, res) {
    try {
      const { productId, locationId, includeIds } = req.query;
      
      if (!productId) {
        return sendError(res, 400, 'Product ID is required');
      }

      const includeIdsArray = includeIds ? (Array.isArray(includeIds) ? includeIds : [includeIds]) : [];

      const result = await InventoryService.getAvailableStock(
        productId,
        locationId,
        includeIdsArray
      );
      return sendResponse(res, 200, true, result, 'Available stock retrieved successfully');
    } catch (error) {
      return sendError(res, 500, error.message);
    }
  }

  static async generateStockReportPDF(req, res) {
    let browser = null;
    try {
      const { locationId, reportType } = req.query;
      
      if (!reportType || !['location', 'all'].includes(reportType)) {
        return sendError(res, 400, 'Invalid report type. Use "location" or "all"');
      }

      if (reportType === 'location' && !locationId) {
        return sendError(res, 400, 'Location ID is required for location-wise report');
      }

      // Fetch stock data - use locationId only for location filter, not for summary totals
      const filterLocationId = reportType === 'location' ? locationId : null;
      const result = await InventoryService.getStockSummary(1, 1000, filterLocationId, null);
      const data = result.data;
      
      // For all-locations report, also get full inventory data for accurate totals
      let fullData = data;
      if (reportType === 'all') {
        const fullResult = await InventoryService.getStockSummary(1, 1000, null, null);
        fullData = fullResult.data;
      }

      if (data.length === 0) {
        return sendError(res, 404, 'No stock data available for report');
      }

      // Get settings
      const settings = await settingsService.getSettings();

      // Convert logo to base64
      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      // Get location name if location-wise report
      let locationName = null;
      if (reportType === 'location' && locationId) {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const location = await prisma.location.findUnique({ where: { id: parseInt(locationId) } });
        locationName = location?.name;
        await prisma.$disconnect();
      }

      // Calculate totals from fullData for accurate summary
      const totalBoxes = fullData.reduce((sum, item) => sum + item.totalBoxes, 0);
      const totalPcs = fullData.reduce((sum, item) => sum + item.totalPcs, 0);
      const totalValue = fullData.reduce((sum, item) => sum + item.totalValue, 0);
      const lowStockCount = fullData.filter(item => item.totalPcs < 100).length;
      
      const locationSet = new Set();
      fullData.forEach(item => {
        if (item.locations) {
          item.locations.forEach(loc => locationSet.add(loc.locationName));
        }
      });
      const locationCount = locationSet.size;

      // Render EJS template
      const templatePath = path.join(__dirname, '../templates/stockReportTemplate.ejs');
      const html = await ejs.renderFile(templatePath, {
        data,
        reportType,
        locationName,
        totalBoxes,
        totalPcs,
        totalValue,
        lowStockCount,
        locationCount,
        settings,
        logoBase64
      });

      // Generate PDF using Puppeteer with same settings as quote
      browser = await puppeteer.launch({ 
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
      browser = null;

      // Set response headers with inline disposition (like quote)
      const fileName = reportType === 'location' 
        ? `Stock-Report-${locationName}-${new Date().getTime()}.pdf`
        : `Stock-Report-All-Locations-${new Date().getTime()}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.end(pdfBuffer);
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      // Ensure browser is closed
      if (browser) {
        await browser.close().catch(() => {});
      }
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = { InventoryController };
