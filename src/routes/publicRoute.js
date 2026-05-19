const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { generateCode } = require('../utils/helpers');

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_PUBLIC_ORIGINS = [
  'https://vegnar.com',
  'https://www.vegnar.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

const restrictToVegnar = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowed = ALLOWED_PUBLIC_ORIGINS.some((o) => origin.startsWith(o));
  if (!isAllowed) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

// Public endpoint - only accessible from vegnar.com
router.post('/lead', restrictToVegnar, async (req, res) => {
  try {
    const { name, email, phone, company, country, message, formType } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    // Duplicate email check - agar email hai toh same email se lead already exist kare toh skip
    if (email) {
      const existing = await prisma.lead.findFirst({
        where: { email: email.toLowerCase() },
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Lead already exists',
          leadId: existing.id,
        });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email: email ? email.toLowerCase() : null,
        phone: phone || null,
        company: company || null,
        country: country || null,
        message: message || null,
        formType: formType || 'Unknown',
        status: 'new',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Lead saved successfully',
      leadId: lead.id,
    });
  } catch (error) {
    console.error('Public lead error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Public endpoint - create sample from vegnar website (after payment)
router.post('/sample', restrictToVegnar, async (req, res) => {
  try {
    const { 
      invoiceNumber, timestamp, userType, customerName, customerEmail, customerPhone, 
      state, customerAddress, products, gstNumber, panNumber, paymentId, orderId, 
      subtotal, tax, kitPrice 
    } = req.body;

    if (!customerName || !paymentId) {
      return res.status(400).json({ success: false, message: 'Customer name and payment ID are required' });
    }

    const lastSample = await prisma.sample.findFirst({ orderBy: { sampleNo: 'desc' } });
    const sampleNo = generateCode('SMP', lastSample?.sampleNo);

    const sample = await prisma.sample.create({
      data: {
        sampleNo,
        source: 'website',
        invoiceNumber: invoiceNumber || null,
        userType: userType || null,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        customerAddress: customerAddress || null,
        state: state || null,
        gstNumber: gstNumber || null,
        panNumber: panNumber || null,
        products: products || null,
        paymentId,
        orderId: orderId || null,
        kitPrice: parseFloat(kitPrice) || 3150,
        subtotal: subtotal ? parseFloat(subtotal) : null,
        tax: tax ? parseFloat(tax) : null,
        sampleType: 'domestic',
        dispatchMethod: 'courier',
        sentDate: timestamp ? new Date(timestamp) : new Date(),
        status: 'pending',
      },
    });

    return res.status(201).json({ success: true, message: 'Sample request saved', sampleNo: sample.sampleNo });
  } catch (error) {
    console.error('Public sample error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Public endpoint - save website quote to inventory
router.post('/website-quote', restrictToVegnar, async (req, res) => {
  try {
    const {
      companyName, contactPerson, email, mobile, orderType,
      gstin, city, state, pincode, billingAddress,
      country, deliveryTerms, portOfDischarge, address,
      additionalRequirements, products, totalPieces, totalWeight, totalCBM,
      quoteNo, quoteDate
    } = req.body;

    if (!companyName || !products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Company name and products are required' });
    }

    // Build prices map from products' rate field
    const pricesMap = {};
    products.forEach((p, i) => {
      if (p.rate !== undefined) {
        pricesMap[i] = { rate: p.rate, taxRate: parseFloat(p.taxRate) || 0 };
      }
    });

    const websiteQuote = await prisma.websiteQuote.create({
      data: {
        quoteNo: quoteNo || `WQ-${Date.now()}`,
        companyName,
        contactPerson: contactPerson || null,
        email: email || null,
        mobile: mobile || null,
        orderType: orderType || 'domestic',
        gstin: gstin || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        billingAddress: billingAddress || null,
        country: country || null,
        deliveryTerms: deliveryTerms || null,
        portOfDischarge: portOfDischarge || null,
        address: address || null,
        additionalRequirements: additionalRequirements || null,
        totalPieces: totalPieces ? parseInt(totalPieces) : 0,
        totalWeight: totalWeight || null,
        totalCBM: totalCBM || null,
        quoteDate: quoteDate ? new Date(quoteDate) : new Date(),
        products: JSON.stringify(products),
        prices: Object.keys(pricesMap).length > 0 ? JSON.stringify(pricesMap) : null,
        status: 'new',
      },
    });

    return res.status(201).json({ success: true, message: 'Quote saved', id: websiteQuote.id });
  } catch (error) {
    console.error('Website quote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Facebook Webhook ────────────────────────────────────────────────────────

// Step 1: Meta webhook verification (GET)
router.get('/facebook/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FB_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ success: false, message: 'Forbidden' });
});

// Step 2: Receive lead notification from Meta (POST)
router.post('/facebook/webhook', async (req, res) => {
  // Acknowledge immediately so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;

        const leadgenId = change.value.leadgen_id;
        await fetchAndSaveFacebookLead(leadgenId);
      }
    }
  } catch (error) {
    console.error('Facebook webhook error:', error.message);
  }
});

async function fetchAndSaveFacebookLead(leadgenId) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v25.0/${leadgenId}`,
      { params: { access_token: process.env.FB_PAGE_ACCESS_TOKEN } }
    );

    // Parse field_data array into key-value object
    const fields = {};
    for (const f of data.field_data || []) {
      fields[f.name] = f.values?.[0] || null;
    }

    const email = fields['email'] ? fields['email'].toLowerCase() : null;
    const phone = fields['phone_number'] || fields['phone'] || null;
    const name = fields['full_name'] || fields['first_name']
      ? `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim()
      : fields['full_name'] || 'Facebook Lead';
    const company = fields['company_name'] || fields['company'] || null;
    const country = fields['country'] || null;

    // Duplicate check
    if (email) {
      const existing = await prisma.lead.findFirst({ where: { email } });
      if (existing) return;
    }

    await prisma.lead.create({
      data: {
        name,
        email,
        phone,
        company,
        country,
        message: `Facebook Lead ID: ${leadgenId}`,
        formType: 'FacebookAd',
        source: 'facebook',
        status: 'new',
      },
    });

    console.log(`✅ Facebook lead saved: ${name} (${email})`);
  } catch (error) {
    console.error('fetchAndSaveFacebookLead error:', error.response?.data || error.message);
  }
}

module.exports = router;
