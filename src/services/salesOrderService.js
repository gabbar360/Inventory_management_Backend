const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const includeRelations = {
  customer: true,
  quote: { select: { quoteNo: true } },
  items: {
    include: {
      product: { include: { category: true } },
    },
  },
};

const generateOrderNo = async () => {
  const last = await prisma.salesOrder.findFirst({ orderBy: { id: 'desc' } });
  return `SO-${String((last?.id || 0) + 1).padStart(6, '0')}`;
};

const createSalesOrder = async (data) => {
  const orderNo = await generateOrderNo();
  return prisma.salesOrder.create({
    data: {
      orderNo,
      customerId: data.customerId,
      quoteId: data.quoteId || null,
      orderDate: new Date(data.orderDate),
      status: data.status || 'pending',
      saleType: data.saleType || 'domestic',
      totalAmount: data.totalAmount || 0,
      notes: data.notes || null,
      items: {
        create: data.items.map((item) => ({
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
    include: includeRelations,
  });
};

const getSalesOrders = async ({ page = 1, limit = 10, search, status } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNo: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getSalesOrderById = async (id) => {
  const order = await prisma.salesOrder.findUnique({
    where: { id: parseInt(id) },
    include: includeRelations,
  });
  if (!order) throw new Error('Sales order not found');
  return order;
};

const updateSalesOrder = async (id, data) => {
  const updateData = {
    status: data.status,
    saleType: data.saleType,
    totalAmount: data.totalAmount,
    notes: data.notes,
  };
  if (data.customerId) updateData.customerId = data.customerId;
  if (data.orderDate) updateData.orderDate = new Date(data.orderDate);

  if (data.items) {
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: parseInt(id) } });
    updateData.items = {
      create: data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        taxRate: item.taxRate || 0,
        amount: item.quantity * item.rate,
        description: item.description || null,
      })),
    };
  }

  return prisma.salesOrder.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: includeRelations,
  });
};

const deleteSalesOrder = async (id) => {
  await prisma.salesOrder.delete({ where: { id: parseInt(id) } });
};

const convertFromQuote = async (quoteId) => {
  const quote = await prisma.quote.findUnique({
    where: { id: parseInt(quoteId) },
    include: { items: { include: { product: true } } },
  });
  if (!quote) throw new Error('Quote not found');

  const totalAmount = quote.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);

  const order = await createSalesOrder({
    customerId: quote.customerId,
    quoteId: quote.id,
    orderDate: new Date().toISOString(),
    status: 'confirmed',
    saleType: 'domestic',
    totalAmount,
    notes: `Converted from Quote ${quote.quoteNo}`,
    items: quote.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      taxRate: item.taxRate || 0,
      description: item.description,
    })),
  });

  // Update quote status to accepted
  await prisma.quote.update({ where: { id: quote.id }, data: { status: 'accepted' } });

  return order;
};

module.exports = { createSalesOrder, getSalesOrders, getSalesOrderById, updateSalesOrder, deleteSalesOrder, convertFromQuote };
