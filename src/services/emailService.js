const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const QRCode = require('qrcode');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function generatePDF(templateName, templateData) {
  const logoPath = path.join(__dirname, '../public/images/vegnar.webp');
  let logoBase64 = null;
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64');
  }

  const upiString = `upi://pay?pa=7570000553-3@ybl&pn=Vegnar%20Greens`;
  const qrCodeDataUrl = await QRCode.toDataURL(upiString, { margin: 1, width: 150 });

  const templatePath = path.join(__dirname, `../templates/${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, { ...templateData, logoBase64, qrCodeDataUrl });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  });
  await browser.close();
  return pdfBuffer;
}

async function sendPasswordResetEmail(email, name, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = await ejs.renderFile(
    path.join(__dirname, '../templates/resetPassword.ejs'),
    { name, resetUrl }
  );
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Password Reset Request - Inventory Management',
    html,
  });
}

async function sendDocumentEmail({ to, cc, subject, message, docType, docId, data, settings }) {
  const docTypeMap = {
    quote:          { template: 'quoteTemplate',          key: 'quote',         filename: (d) => `Quote-${d.quoteNo}.pdf` },
    invoice:        { template: 'invoiceTemplate',        key: 'invoice',       filename: (d) => `Invoice-${d.invoiceNo}.pdf` },
    salesOrder:     { template: 'salesOrderTemplate',     key: 'order',         filename: (d) => `SalesOrder-${d.orderNo}.pdf` },
    purchaseOrder:  { template: 'purchaseOrderTemplate',  key: 'po',            filename: (d) => `PO-${d.poNo}.pdf` },
    orderDispatch:  { template: 'orderDispatchTemplate',  key: 'dispatch',      filename: (d) => `Dispatch-${d.dispatchNo || d.id}.pdf` },
    paymentMade:    { template: 'paymentMadeTemplate',    key: 'payment',       filename: (d) => `PaymentMade-${d.id}.pdf` },
    paymentReceived:{ template: 'paymentReceivedTemplate',key: 'payment',       filename: (d) => `PaymentReceived-${d.id}.pdf` },
  };

  const config = docTypeMap[docType];
  if (!config) throw new Error(`Unsupported document type: ${docType}`);

  const pdfBuffer = await generatePDF(config.template, { [config.key]: data, settings });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    cc: cc || undefined,
    subject,
    text: message,
    attachments: [{ filename: config.filename(data), content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

async function sendLedgerEmail({ to, cc, subject, message, pdfBuffer, filename }) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    cc: cc || undefined,
    subject,
    text: message,
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

module.exports = { sendPasswordResetEmail, sendDocumentEmail, sendLedgerEmail, generatePDF };
