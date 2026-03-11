const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateQuoteNo = async () => {
  const lastQuote = await prisma.quote.findFirst({
    orderBy: { id: 'desc' },
  });
  const nextNumber = (lastQuote?.id || 0) + 1;
  return `QT-${String(nextNumber).padStart(6, '0')}`;
};

const createQuote = async (data) => {
  const quoteNo = await generateQuoteNo();
  
  const quote = await prisma.quote.create({
    data: {
      quoteNo,
      customerId: data.customerId,
      quoteDate: new Date(data.quoteDate),
      expiryDate: new Date(data.expiryDate),
      status: 'draft',
      totalAmount: data.totalAmount || 0,
      discount: data.discount || 0,
      tax: data.tax || 0,
      notes: data.notes,
      termsAndConditions: data.termsAndConditions,
      items: {
        create: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.quantity * item.rate,
        })),
      },
    },
    include: {
      customer: true,
      items: {
        include: { 
          product: {
            include: {
              category: true
            }
          }
        },
      },
    },
  });

  return quote;
};

const getQuotes = async (filters = {}) => {
  const where = {};
  if (filters.customerId) where.customerId = parseInt(filters.customerId);
  if (filters.status) where.status = filters.status;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      items: {
        include: { 
          product: {
            include: {
              category: true
            }
          }
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return quotes;
};

const getQuoteById = async (id) => {
  const quote = await prisma.quote.findUnique({
    where: { id: parseInt(id) },
    include: {
      customer: true,
      items: {
        include: { 
          product: {
            include: {
              category: true
            }
          }
        },
      },
    },
  });

  if (!quote) throw new Error('Quote not found');
  return quote;
};

const updateQuote = async (id, data) => {
  const quote = await prisma.quote.update({
    where: { id: parseInt(id) },
    data: {
      status: data.status,
      discount: data.discount,
      tax: data.tax,
      totalAmount: data.totalAmount,
      notes: data.notes,
      termsAndConditions: data.termsAndConditions,
    },
    include: {
      customer: true,
      items: {
        include: { 
          product: {
            include: {
              category: true
            }
          }
        },
      },
    },
  });

  return quote;
};

const updateQuoteItems = async (quoteId, items) => {
  await prisma.quoteItem.deleteMany({
    where: { quoteId: parseInt(quoteId) },
  });

  const quote = await prisma.quote.update({
    where: { id: parseInt(quoteId) },
    data: {
      items: {
        create: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.quantity * item.rate,
        })),
      },
    },
    include: {
      customer: true,
      items: {
        include: { 
          product: {
            include: {
              category: true
            }
          }
        },
      },
    },
  });

  return quote;
};

const deleteQuote = async (id) => {
  await prisma.quote.delete({
    where: { id: parseInt(id) },
  });
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  updateQuoteItems,
  deleteQuote,
};
