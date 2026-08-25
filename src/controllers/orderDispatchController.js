const orderDispatchService = require('../services/orderDispatchService');
const settingsService = require('../services/settingsService');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const createOrderDispatch = async (req, res) => {
  try {
    const { salesOrderId, dispatchDate, shippingMethod, shippingAddress, shippingCity, shippingState, shippingPincode, trackingNumber, carrier, estimatedDelivery, weight, dimensions, packageCount, shippingCost, insuranceAmount, toTheOrder, courierName, courierPhone, truckNumber, driverName, driverPhone, airlineCode, flightNumber, containerNumber, vesselName, portOfLoading, portOfDischarge } = req.body;

    if (!salesOrderId || !dispatchDate || !shippingMethod || !shippingAddress || !shippingCity || !shippingState || !shippingPincode) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const dispatch = await orderDispatchService.createOrderDispatch({
      salesOrderId,
      dispatchDate,
      shippingMethod,
      trackingNumber,
      carrier,
      estimatedDelivery,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingPincode,
      weight,
      dimensions,
      packageCount,
      shippingCost,
      insuranceAmount,
      toTheOrder,
      courierName,
      courierPhone,
      truckNumber,
      driverName,
      driverPhone,
      airlineCode,
      flightNumber,
      containerNumber,
      vesselName,
      portOfLoading,
      portOfDischarge,
    });

    res.status(201).json({ success: true, data: dispatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getOrderDispatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const result = await orderDispatchService.getOrderDispatches({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
    });
    res.json({ success: true, data: result.dispatches, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getOrderDispatchById = async (req, res) => {
  try {
    const dispatch = await orderDispatchService.getOrderDispatchById(req.params.id);
    res.json({ success: true, data: dispatch });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

const updateOrderDispatch = async (req, res) => {
  try {
    const dispatch = await orderDispatchService.updateOrderDispatch(req.params.id, req.body);
    res.json({ success: true, data: dispatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteOrderDispatch = async (req, res) => {
  try {
    await orderDispatchService.deleteOrderDispatch(req.params.id);
    res.json({ success: true, message: 'Order dispatch deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getDispatchBySalesOrderId = async (req, res) => {
  try {
    const dispatch = await orderDispatchService.getDispatchBySalesOrderId(req.params.salesOrderId);
    if (!dispatch) {
      return res.status(404).json({ success: false, error: 'No dispatch found for this sales order' });
    }
    res.json({ success: true, data: dispatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateDispatchPDF = async (req, res) => {
  try {
    const dispatch = await orderDispatchService.getOrderDispatchById(req.params.id);
    const settings = await settingsService.getSettings();

    const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
    let logoBase64 = null;
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    }

    const templatePath = path.join(__dirname, '../templates/orderDispatchTemplate.ejs');
    const html = await ejs.renderFile(templatePath, { dispatch, logoBase64, settings });

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
    res.setHeader('Content-Disposition', `inline; filename="Dispatch-${dispatch.dispatchNo}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createOrderDispatch,
  getOrderDispatches,
  getOrderDispatchById,
  updateOrderDispatch,
  deleteOrderDispatch,
  getDispatchBySalesOrderId,
  generateDispatchPDF,
};
