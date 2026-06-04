const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createQuote = async (data) => {
  return await prisma.$transaction(async (tx) => {
    const count = await tx.quote.count();
    const quoteNo = `QT-${String(count + 1).padStart(5, '0')}`;

    // Create quote
    const quote = await tx.quote.create({
      data: {
        quoteNo,
        customerId: parseInt(data.customerId),
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
        adjustment: data.adjustment || 0,
        billToDetails: data.billToDetails || null,
        shipToDetails: data.shipToDetails || null,
        items: {
          create: data.items.map(item => ({
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity),
            unit: item.unit,
            rate: parseFloat(item.rate),
            taxRate: parseFloat(item.taxRate) || 0,
            amount: parseInt(item.quantity) * parseFloat(item.rate),
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
  });
};

const getQuotes = async (filters = {}) => {
  const page = parseInt(filters.page) || 1;
  const limit = Math.min(parseInt(filters.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const where = {};
  if (filters.customerId) where.customerId = parseInt(filters.customerId);
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { quoteNo: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.quoteDate = {};
    if (filters.startDate) {
      where.quoteDate.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.quoteDate.lte = end;
    }
  }

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
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
      skip: offset,
      take: limit,
    }),
    prisma.quote.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return { 
    data: quotes,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    }
  };
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
    adjustment: data.adjustment !== undefined ? data.adjustment : 0,
    billToDetails: data.billToDetails !== undefined ? data.billToDetails : null,
    shipToDetails: data.shipToDetails !== undefined ? data.shipToDetails : null,
  };

  if (data.customerId) updateData.customerId = parseInt(data.customerId);
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
  
  const existingItems = await prisma.quoteItem.findMany({
    where: { quoteId: quoteIdInt },
  });

  const itemsToUpdate = items.filter(item => item.id);
  const itemsToCreate = items.filter(item => !item.id);
  const existingItemIds = itemsToUpdate.map(item => item.id);
  
  const itemsToDelete = existingItems.filter(item => !existingItemIds.includes(item.id));
  if (itemsToDelete.length > 0) {
    await prisma.quoteItem.deleteMany({
      where: {
        id: { in: itemsToDelete.map(item => item.id) },
      },
    });
  }

  for (const item of itemsToUpdate) {
    await prisma.quoteItem.update({
      where: { id: item.id },
      data: {
        productId: parseInt(item.productId),
        quantity: parseInt(item.quantity),
        unit: item.unit,
        rate: parseFloat(item.rate),
        taxRate: parseFloat(item.taxRate) || 0,
        amount: parseInt(item.quantity) * parseFloat(item.rate),
        description: item.description || null,
      },
    });
  }

  if (itemsToCreate.length > 0) {
    await prisma.quoteItem.createMany({
      data: itemsToCreate.map(item => ({
        quoteId: quoteIdInt,
        productId: parseInt(item.productId),
        quantity: parseInt(item.quantity),
        unit: item.unit,
        rate: parseFloat(item.rate),
        taxRate: parseFloat(item.taxRate) || 0,
        amount: parseInt(item.quantity) * parseFloat(item.rate),
        description: item.description || null,
      })),
    });
  }

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

const convertQuoteToInvoice = async (id, itemSelections) => {
  const quote = await prisma.quote.findUnique({
    where: { id: parseInt(id) },
    include: { items: true },
  });
  if (!quote) throw new Error('Quote not found');

  return await prisma.$transaction(async (tx) => {
    // Generate invoice number
    const invoiceCount = await tx.outwardInvoice.count();
    const invoiceNo = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    const invoice = await tx.outwardInvoice.create({
      data: {
        invoiceNo,
        date: new Date(),
        customerId: quote.customerId,
        saleType: 'domestic',
        expense: 0,
        totalCost: 0,
        shippingCharge: quote.shippingCharge || 0,
      },
    });

    let totalCost = 0;

    for (const sel of itemSelections) {
      const quoteItem = quote.items.find(i => i.id === sel.quoteItemId);
      if (!quoteItem) continue;

      const stockBatch = await tx.stockBatch.findUnique({ where: { id: parseInt(sel.stockBatchId) } });
      if (!stockBatch) throw new Error(`Stock batch not found for item: ${quoteItem.productId}`);

      const qty = quoteItem.quantity;
      const saleUnit = sel.saleUnit || 'box';

      if (saleUnit === 'box' && stockBatch.remainingBoxes < qty) throw new Error(`Insufficient box stock for product ID ${quoteItem.productId}`);
      if (saleUnit === 'pack' && stockBatch.remainingPacks < qty) throw new Error(`Insufficient pack stock for product ID ${quoteItem.productId}`);
      if (saleUnit === 'piece' && stockBatch.remainingPcs < qty) throw new Error(`Insufficient piece stock for product ID ${quoteItem.productId}`);

      const itemTotal = qty * quoteItem.rate;
      totalCost += itemTotal;

      await tx.outwardItem.create({
        data: {
          outwardInvoiceId: invoice.id,
          productId: quoteItem.productId,
          stockBatchId: stockBatch.id,
          locationId: stockBatch.locationId,
          saleUnit,
          quantity: qty,
          ratePerUnit: quoteItem.rate,
          totalCost: itemTotal,
          description: quoteItem.description || null,
        },
      });

      let boxDecrement = 0, packDecrement = 0, pcsDecrement = 0;
      if (saleUnit === 'box') {
        boxDecrement = qty;
        packDecrement = qty * stockBatch.packPerBox;
        pcsDecrement = qty * stockBatch.packPerBox * stockBatch.packPerPiece;
      } else if (saleUnit === 'pack') {
        packDecrement = qty;
        pcsDecrement = qty * stockBatch.packPerPiece;
        boxDecrement = Math.floor(qty / stockBatch.packPerBox);
      } else {
        pcsDecrement = qty;
        const packsReduced = Math.floor(qty / stockBatch.packPerPiece);
        packDecrement = packsReduced;
        boxDecrement = Math.floor(packsReduced / stockBatch.packPerBox);
      }

      await tx.stockBatch.update({
        where: { id: stockBatch.id },
        data: {
          remainingBoxes: { decrement: boxDecrement },
          remainingPacks: { decrement: packDecrement },
          remainingPcs: { decrement: pcsDecrement },
        },
      });

      await tx.stockMovement.create({
        data: {
          type: 'outward',
          referenceId: invoice.id,
          productId: quoteItem.productId,
          locationId: stockBatch.locationId,
          quantity: -qty,
          movementDate: new Date(),
        },
      });
    }

    await tx.outwardInvoice.update({ where: { id: invoice.id }, data: { totalCost } });

    return await tx.outwardInvoice.findUnique({
      where: { id: invoice.id },
      include: { customer: true, items: { include: { product: true, location: true } } },
    });
  }, { timeout: 30000 });
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  updateQuoteItems,
  deleteQuote,
  convertQuoteToInvoice,
};
