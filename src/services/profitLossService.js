const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

class ProfitLossService {
  static async generateProfitLossReport(startDate, endDate) {
    const where = {};
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: { include: { category: true } },
            stockBatch: { include: { vendor: true } },
            location: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const reportData = [];

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const stockBatch = item.stockBatch;
        
        let purchasePrice = 0;
        if (item.saleUnit === 'box') {
          purchasePrice = stockBatch.costPerBox;
        } else if (item.saleUnit === 'pack') {
          purchasePrice = stockBatch.costPerPack || (stockBatch.costPerBox / stockBatch.packPerBox);
        } else {
          purchasePrice = stockBatch.costPerPcs;
        }

        const totalPurchasePrice = purchasePrice * item.quantity;
        const totalSalesPrice = item.totalCost;
        const profit = totalSalesPrice - totalPurchasePrice;
        const profitMargin = totalSalesPrice > 0 ? ((profit / totalSalesPrice) * 100).toFixed(2) : 0;

        reportData.push({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.date,
          productName: item.product.name,
          productGrade: item.product.grade || 'N/A',
          categoryName: item.product.category.name,
          uom: item.saleUnit,
          packPerPiece: stockBatch.packPerPiece,
          packPerBox: stockBatch.packPerBox,
          pcsPerBox: stockBatch.packPerBox * stockBatch.packPerPiece,
          orderQty: item.quantity,
          dispatchQty: item.quantity,
          saleUnit: item.saleUnit,
          vendorName: stockBatch.vendor.name,
          purchasePrice: purchasePrice.toFixed(2),
          salesPrice: (item.ratePerUnit).toFixed(2),
          totalPurchasePrice: totalPurchasePrice.toFixed(2),
          totalSalesPrice: totalSalesPrice.toFixed(2),
          difference: profit.toFixed(2),
          profitMargin: profitMargin,
          customerName: invoice.customer.name,
        });
      }
    }

    return reportData;
  }

  static async generateProfitLossPDF(startDate, endDate, settings) {
    try {
      const reportData = await this.generateProfitLossReport(startDate, endDate);

      if (reportData.length === 0) {
        throw new Error('No data available for the selected date range');
      }

      const summary = {
        totalRevenue: reportData.reduce((sum, item) => sum + parseFloat(item.totalSalesPrice), 0),
        totalCOGS: reportData.reduce((sum, item) => sum + parseFloat(item.totalPurchasePrice), 0),
        totalProfit: reportData.reduce((sum, item) => sum + parseFloat(item.difference), 0),
        totalItems: reportData.length,
      };

      summary.profitMargin = summary.totalRevenue > 0 
        ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(2) 
        : 0;

      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/profitLossTemplate.ejs');
      const html = await ejs.renderFile(templatePath, {
        reportData,
        summary,
        logoBase64,
        settings,
        startDate: startDate ? new Date(startDate).toLocaleDateString('en-IN') : 'All',
        endDate: endDate ? new Date(endDate).toLocaleDateString('en-IN') : 'All',
      });

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      await browser.close();

      return pdfBuffer;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw error;
    }
  }

  static async generateSingleInvoiceProfitLossPDF(invoiceId, settings) {
    try {
      const invoice = await prisma.outwardInvoice.findUnique({
        where: { id: parseInt(invoiceId) },
        include: {
          customer: true,
          items: {
            include: {
              product: { include: { category: true } },
              stockBatch: { include: { vendor: true } },
              location: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const reportData = [];

      for (const item of invoice.items) {
        const stockBatch = item.stockBatch;
        
        let purchasePrice = 0;
        if (item.saleUnit === 'box') {
          purchasePrice = stockBatch.costPerBox;
        } else if (item.saleUnit === 'pack') {
          purchasePrice = stockBatch.costPerPack || (stockBatch.costPerBox / stockBatch.packPerBox);
        } else {
          purchasePrice = stockBatch.costPerPcs;
        }

        const totalPurchasePrice = purchasePrice * item.quantity;
        const totalSalesPrice = item.totalCost;
        const profit = totalSalesPrice - totalPurchasePrice;
        const profitMargin = totalSalesPrice > 0 ? ((profit / totalSalesPrice) * 100).toFixed(2) : 0;

        reportData.push({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.date,
          productName: item.product.name,
          productGrade: item.product.grade || 'N/A',
          categoryName: item.product.category.name,
          uom: item.saleUnit,
          packPerPiece: stockBatch.packPerPiece,
          packPerBox: stockBatch.packPerBox,
          pcsPerBox: stockBatch.packPerBox * stockBatch.packPerPiece,
          orderQty: item.quantity,
          dispatchQty: item.quantity,
          saleUnit: item.saleUnit,
          vendorName: stockBatch.vendor.name,
          purchasePrice: purchasePrice.toFixed(2),
          salesPrice: (item.ratePerUnit).toFixed(2),
          totalPurchasePrice: totalPurchasePrice.toFixed(2),
          totalSalesPrice: totalSalesPrice.toFixed(2),
          difference: profit.toFixed(2),
          profitMargin: profitMargin,
          customerName: invoice.customer.name,
        });
      }

      const summary = {
        totalRevenue: reportData.reduce((sum, item) => sum + parseFloat(item.totalSalesPrice), 0),
        totalCOGS: reportData.reduce((sum, item) => sum + parseFloat(item.totalPurchasePrice), 0),
        totalProfit: reportData.reduce((sum, item) => sum + parseFloat(item.difference), 0),
        totalItems: reportData.length,
      };

      summary.profitMargin = summary.totalRevenue > 0 
        ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(2) 
        : 0;

      const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }

      const templatePath = path.join(__dirname, '../templates/profitLossTemplate.ejs');
      const html = await ejs.renderFile(templatePath, {
        reportData,
        summary,
        logoBase64,
        settings,
        startDate: new Date(invoice.date).toLocaleDateString('en-IN'),
        endDate: new Date(invoice.date).toLocaleDateString('en-IN'),
      });

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      await browser.close();

      return pdfBuffer;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw error;
    }
  }

  static async getProfitLossData(startDate, endDate) {
    return await this.generateProfitLossReport(startDate, endDate);
  }
}

module.exports = { ProfitLossService };
