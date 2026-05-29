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
  const count = await prisma.salesOrder.count();
  return `SO-${String(count + 1).padStart(5, '0')}`;
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
      reference: data.reference || null,
      expectedShipmentDate: data.expectedShipmentDate ? new Date(data.expectedShipmentDate) : null,
      placeOfSupply: data.placeOfSupply || null,
      deliveryMethod: data.deliveryMethod || null,
      adjustment: parseFloat(data.adjustment) || 0,
      amountReceived: parseFloat(data.amountReceived) || 0,
      shippingCharge: parseFloat(data.shippingCharge) || 0,
      discount: parseFloat(data.discount) || 0,
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

const getSalesOrders = async ({ page = 1, limit = 10, search, status, startDate, endDate } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNo: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (startDate || endDate) {
    where.orderDate = {};
    if (startDate) {
      where.orderDate.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.orderDate.lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: includeRelations,
      orderBy: { orderDate: 'asc' },
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
    reference: data.reference !== undefined ? data.reference : undefined,
    expectedShipmentDate: data.expectedShipmentDate ? new Date(data.expectedShipmentDate) : null,
    placeOfSupply: data.placeOfSupply !== undefined ? data.placeOfSupply : undefined,
    deliveryMethod: data.deliveryMethod !== undefined ? data.deliveryMethod : undefined,
    adjustment: data.adjustment !== undefined ? parseFloat(data.adjustment) : undefined,
    amountReceived: data.amountReceived !== undefined ? parseFloat(data.amountReceived) : undefined,
    shippingCharge: data.shippingCharge !== undefined ? parseFloat(data.shippingCharge) : undefined,
    discount: data.discount !== undefined ? parseFloat(data.discount) : undefined,
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
    reference: quote.quoteNo,
    notes: null,
    shippingCharge: quote.shippingCharge || 0,
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

const convertSalesOrderToInvoice = async (id, itemSelections) => {
  // itemSelections: [{ salesOrderItemId, stockBatchId, saleUnit }]
  const order = await prisma.salesOrder.findUnique({
    where: { id: parseInt(id) },
    include: { items: { include: { product: { select: { description: true } } } } },
  });
  if (!order) throw new Error('Sales order not found');

  const invoiceNo = `INV-${String(await prisma.outwardInvoice.count() + 1).padStart(5, '0')}`;

  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.outwardInvoice.create({
      data: {
        invoiceNo,
        date: new Date(),
        customerId: order.customerId,
        saleType: order.saleType || 'domestic',
        expense: 0,
        totalCost: 0,
        adjustment: order.adjustment || 0,
        amountReceived: order.amountReceived || 0,
        referenceNo: order.orderNo,
        shippingCharge: order.shippingCharge || 0,
      },
    });

    let totalCost = 0;

    for (const sel of itemSelections) {
      const orderItem = order.items.find(i => i.id === sel.salesOrderItemId);
      if (!orderItem) continue;

      const stockBatch = await tx.stockBatch.findUnique({ where: { id: parseInt(sel.stockBatchId) } });
      if (!stockBatch) throw new Error(`Stock batch not found for item: ${orderItem.productId}`);

      const qty = orderItem.quantity;
      const saleUnit = sel.saleUnit || 'box';

      if (saleUnit === 'box' && stockBatch.remainingBoxes < qty) throw new Error(`Insufficient box stock for product ID ${orderItem.productId}`);
      if (saleUnit === 'pack' && stockBatch.remainingPacks < qty) throw new Error(`Insufficient pack stock for product ID ${orderItem.productId}`);
      if (saleUnit === 'piece' && stockBatch.remainingPcs < qty) throw new Error(`Insufficient piece stock for product ID ${orderItem.productId}`);

      const itemTotal = qty * orderItem.rate;
      totalCost += itemTotal;

      await tx.outwardItem.create({
        data: {
          outwardInvoiceId: invoice.id,
          productId: orderItem.productId,
          stockBatchId: stockBatch.id,
          locationId: stockBatch.locationId,
          saleUnit,
          quantity: qty,
          ratePerUnit: orderItem.rate,
          totalCost: itemTotal,
          description: orderItem.description || orderItem.product?.description || null,
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
          productId: orderItem.productId,
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

module.exports = { createSalesOrder, getSalesOrders, getSalesOrderById, updateSalesOrder, deleteSalesOrder, convertFromQuote, convertSalesOrderToInvoice };
