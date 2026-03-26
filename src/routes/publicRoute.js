const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_PUBLIC_ORIGINS = [
  'https://vegnar.com',
  'https://www.vegnar.com',
  'http://localhost:3000',
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

module.exports = router;
