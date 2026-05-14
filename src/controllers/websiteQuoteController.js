const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getWebsiteQuotes = async (req, res) => {
  try {
    const { status, orderType, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { quoteNo: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [quotes, total] = await Promise.all([
      prisma.websiteQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.websiteQuote.count({ where }),
    ]);

    res.json({
      success: true,
      data: quotes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateWebsiteQuoteStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const quote = await prisma.websiteQuote.update({
      where: { id: parseInt(req.params.id) },
      data: { status, remarks: remarks || null },
    });
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteWebsiteQuote = async (req, res) => {
  try {
    await prisma.websiteQuote.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getWebsiteQuotes, updateWebsiteQuoteStatus, deleteWebsiteQuote };
