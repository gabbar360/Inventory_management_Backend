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
      termsOfDelivery: data.termsOfDelivery || null,
      paymentTerms: data.paymentTerms || null,
      reference: data.reference || null,
      shippingCharge: data.shippingCharge || 0,
      items: {
        create: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          taxRate: item.taxRate || 0,
          amount: item.quantity * item.rate,
          description: item.description || null,
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
  const updateData = {
    status: data.status,
    discount: data.discount !== undefined ? data.discount : 0,
    tax: data.tax !== undefined ? data.tax : 0,
    totalAmount: data.totalAmount,
    notes: data.notes,
    termsAndConditions: data.termsAndConditions,
    termsOfDelivery: data.termsOfDelivery !== undefined ? data.termsOfDelivery : null,
    paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : null,
    reference: data.reference !== undefined ? data.reference : null,
    shippingCharge: data.shippingCharge !== undefined ? data.shippingCharge : 0,
  };

  // Add optional fields if provided
  if (data.customerId) updateData.customerId = data.customerId;
  if (data.quoteDate) updateData.quoteDate = new Date(data.quoteDate);
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

  const quote = await prisma.quote.update({
    where: { id: parseInt(id) },
    data: updateData,
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
  const quoteIdInt = parseInt(quoteId);
  
  // Get existing items
  const existingItems = await prisma.quoteItem.findMany({
    where: { quoteId: quoteIdInt },
  });

  // Separate new items from existing items
  const itemsToUpdate = items.filter(item => item.id);
  const itemsToCreate = items.filter(item => !item.id);
  const existingItemIds = itemsToUpdate.map(item => item.id);
  
  // Delete items that are no longer in the list
  const itemsToDelete = existingItems.filter(item => !existingItemIds.includes(item.id));
  if (itemsToDelete.length > 0) {
    await prisma.quoteItem.deleteMany({
      where: {
        id: { in: itemsToDelete.map(item => item.id) },
      },
    });
  }

  // Update existing items
  for (const item of itemsToUpdate) {
    await prisma.quoteItem.update({
      where: { id: item.id },
      data: {
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        taxRate: item.taxRate || 0,
        amount: item.quantity * item.rate,
        description: item.description || null,
      },
    });
  }

  // Create new items
  if (itemsToCreate.length > 0) {
    await prisma.quoteItem.createMany({
      data: itemsToCreate.map(item => ({
        quoteId: quoteIdInt,
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        taxRate: item.taxRate || 0,
        amount: item.quantity * item.rate,
        description: item.description || null,
      })),
    });
  }

  // Return updated quote
  const quote = await prisma.quote.findUnique({
    where: { id: quoteIdInt },
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
