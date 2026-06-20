const { sendDocumentEmail, sendLedgerEmail, generatePDF } = require('../services/emailService');
const settingsService = require('../services/settingsService');
const { sendResponse, sendError } = require('../utils/helpers');

// Map docType to the service method that fetches the document
const fetchDocumentData = async (docType, docId) => {
  switch (docType) {
    case 'quote': {
      const { getQuoteById } = require('../services/quoteService');
      return getQuoteById(docId);
    }
    case 'invoice': {
      const { OutwardService } = require('../services/outwardService');
      return OutwardService.getById(docId);
    }
    case 'salesOrder': {
      const { getSalesOrderById } = require('../services/salesOrderService');
      return getSalesOrderById(docId);
    }
    case 'purchaseOrder': {
      const { getPurchaseOrderById } = require('../services/purchaseOrderService');
      return getPurchaseOrderById(docId);
    }
    case 'orderDispatch': {
      const { getOrderDispatchById } = require('../services/orderDispatchService');
      return getOrderDispatchById(docId);
    }
    case 'paymentMade': {
      const { PaymentsMadeService } = require('../services/paymentsMadeService');
      return PaymentsMadeService.getById(docId);
    }
    case 'paymentReceived': {
      const { PaymentsReceivedService } = require('../services/paymentsReceivedService');
      return PaymentsReceivedService.getById(docId);
    }
    default:
      throw new Error(`Unsupported docType: ${docType}`);
  }
};

const sendDocument = async (req, res) => {
  try {
    const { to, cc, subject, message, docType, docId } = req.body;

    if (!to || !subject || !docType || !docId) {
      return sendError(res, 400, 'to, subject, docType, and docId are required');
    }

    const [data, settings] = await Promise.all([
      fetchDocumentData(docType, docId),
      settingsService.getSettings(),
    ]);

    await sendDocumentEmail({ to, cc, subject, message: message || '', docType, docId, data, settings });

    return sendResponse(res, 200, true, null, 'Document sent successfully via email');
  } catch (error) {
    console.error('Email send error:', error);
    return sendError(res, 500, error.message);
  }
};

const sendLedger = async (req, res) => {
  try {
    const { to, cc, subject, message, ledgerType, entityId, startDate, endDate } = req.body;
    if (!to || !subject || !ledgerType || !entityId) {
      return sendError(res, 400, 'to, subject, ledgerType, and entityId are required');
    }

    const settings = await settingsService.getSettings();
    let ledger, templateName, filename;

    if (ledgerType === 'customer') {
      const { CustomerService } = require('../services/customerService');
      ledger = await CustomerService.getLedger(entityId, startDate, endDate);
      templateName = 'customerLedgerTemplate';
      filename = `CustomerLedger-${ledger.customer.code}.pdf`;
    } else if (ledgerType === 'vendor') {
      const { VendorService } = require('../services/vendorService');
      ledger = await VendorService.getLedger(entityId, startDate, endDate);
      templateName = 'vendorLedgerTemplate';
      filename = `VendorLedger-${ledger.vendor.code}.pdf`;
    } else {
      return sendError(res, 400, `Unsupported ledgerType: ${ledgerType}`);
    }

    const pdfBuffer = await generatePDF(templateName, { ledger, settings, startDate, endDate });
    await sendLedgerEmail({ to, cc, subject, message: message || '', pdfBuffer, filename });

    return sendResponse(res, 200, true, null, 'Ledger statement sent successfully via email');
  } catch (error) {
    console.error('Ledger email error:', error);
    return sendError(res, 500, error.message);
  }
};

module.exports = { sendDocument, sendLedger };
