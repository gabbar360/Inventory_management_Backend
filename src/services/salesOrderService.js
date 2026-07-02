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
  const last = await prisma.salesOrder.findFirst({ orderBy: { id: 'desc' }, select: { orderNo: true } });
  const lastNum = last ? parseInt(last.orderNo.replace('SO-', '')) : 0;
  return `SO-${String(lastNum + 1).padStart(5, '0')}`;
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
      referenceBy: data.referenceBy || null,
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
    reference: data.reference !== undefined ? data.reference : undefined,
    referenceBy: data.referenceBy !== undefined ? data.referenceBy : undefined,
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
  const order = await prisma.salesOrder.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  });
  if (!order) return;

  await prisma.$transaction(async (tx) => {
    // Release booked stock for all items
    for (const item of order.items) {
      if (item.stockBatchId) {
        const stockBatch = await tx.stockBatch.findUnique({
          where: { id: item.stockBatchId }
        });
        if (stockBatch) {
          const qty = item.quantity;
          const saleUnit = item.unit || 'box';
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

          // Decrement booked fields (release them)
          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: {
              bookedBoxes: { decrement: Math.max(0, boxDecrement) },
              bookedPacks: { decrement: Math.max(0, packDecrement) },
              bookedPcs: { decrement: Math.max(0, pcsDecrement) },
            }
          });
        }
      }
    }

    // Update Quote status back to 'sent' if it was converted from a Quote
    if (order.quoteId) {
      await tx.quote.update({
        where: { id: order.quoteId },
        data: { status: 'sent' }
      });
    }

    // Now delete the Sales Order
    await tx.salesOrder.delete({
      where: { id: parseInt(id) }
    });
  });
};

const convertFromQuote = async (quoteId, itemsPayload = []) => {
  const quote = await prisma.quote.findUnique({
    where: { id: parseInt(quoteId) },
    include: { items: { include: { product: true } } },
  });
  if (!quote) throw new Error('Quote not found');

  const existingOrder = await prisma.salesOrder.findFirst({
    where: { quoteId: parseInt(quoteId) },
    include: { items: true }
  });

  const totalAmount = quote.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const orderNo = await generateOrderNo();

  return await prisma.$transaction(async (tx) => {
    let order;

    if (existingOrder) {
      // 1. Release booked stock for all existing items of the existing sales order
      for (const oldItem of existingOrder.items) {
        if (oldItem.stockBatchId) {
          const stockBatch = await tx.stockBatch.findUnique({
            where: { id: oldItem.stockBatchId }
          });
          if (stockBatch) {
            const qty = oldItem.quantity;
            const saleUnit = oldItem.unit || 'box';
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

            // Decrement booked fields (release them)
            await tx.stockBatch.update({
              where: { id: oldItem.stockBatchId },
              data: {
                bookedBoxes: { decrement: Math.max(0, boxDecrement) },
                bookedPacks: { decrement: Math.max(0, packDecrement) },
                bookedPcs: { decrement: Math.max(0, pcsDecrement) },
              }
            });
          }
        }
      }

      // 2. Delete all existing items for this sales order
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: existingOrder.id }
      });

      // 3. Update the Sales Order details
      order = await tx.salesOrder.update({
        where: { id: existingOrder.id },
        data: {
          totalAmount,
          orderDate: new Date(),
          shippingCharge: quote.shippingCharge || 0,
        }
      });
    } else {
      // 1. Create the Sales Order first
      order = await tx.salesOrder.create({
        data: {
          orderNo,
          customerId: quote.customerId,
          quoteId: quote.id,
          orderDate: new Date(),
          status: 'confirmed',
          saleType: 'domestic',
          totalAmount,
          reference: quote.quoteNo,
          notes: null,
          shippingCharge: quote.shippingCharge || 0,
        },
      });
    }

    // 2. Loop through each item from quote and create salesOrderItem + book stock
    for (const item of quote.items) {
      // Find matching selection from payload (supporting both quoteItemId and productId)
      const payloadItem = itemsPayload.find(p => 
        (p.quoteItemId && parseInt(p.quoteItemId) === item.id) || 
        (p.productId && p.productId.toString() === item.productId.toString())
      );
      const stockBatchId = payloadItem?.stockBatchId ? parseInt(payloadItem.stockBatchId) : null;
      const saleUnit = payloadItem?.saleUnit || item.unit || 'box';

      if (stockBatchId) {
        const stockBatch = await tx.stockBatch.findUnique({
          where: { id: stockBatchId }
        });
        if (!stockBatch) {
          throw new Error(`Stock batch #${stockBatchId} not found for product ${item.product?.name}`);
        }

        // Calculate booking increments
        const qty = item.quantity;
        let boxIncrement = 0;
        let packIncrement = 0;
        let pcsIncrement = 0;

        if (saleUnit === 'box') {
          boxIncrement = qty;
          packIncrement = qty * stockBatch.packPerBox;
          pcsIncrement = qty * stockBatch.packPerBox * stockBatch.packPerPiece;
        } else if (saleUnit === 'pack') {
          packIncrement = qty;
          pcsIncrement = qty * stockBatch.packPerPiece;
          boxIncrement = Math.floor(qty / stockBatch.packPerBox);
        } else {
          pcsIncrement = qty;
          const packsReduced = Math.floor(qty / stockBatch.packPerPiece);
          packIncrement = packsReduced;
          boxIncrement = Math.floor(packsReduced / stockBatch.packPerBox);
        }

        // Check if available stock (remaining - current booked) is sufficient
        const availableBoxes = stockBatch.remainingBoxes - (stockBatch.bookedBoxes || 0);
        const availablePacks = stockBatch.remainingPacks - (stockBatch.bookedPacks || 0);
        const availablePcs = stockBatch.remainingPcs - (stockBatch.bookedPcs || 0);

        if (saleUnit === 'box' && availableBoxes < qty) {
          throw new Error(`Insufficient available stock in batch ${stockBatch.batchCode || stockBatch.id} for ${item.product?.name || item.productId}`);
        }
        if (saleUnit === 'pack' && availablePacks < qty) {
          throw new Error(`Insufficient available stock in batch ${stockBatch.batchCode || stockBatch.id} for ${item.product?.name || item.productId}`);
        }
        if (saleUnit === 'piece' && availablePcs < qty) {
          throw new Error(`Insufficient available stock in batch ${stockBatch.batchCode || stockBatch.id} for ${item.product?.name || item.productId}`);
        }

        // Update StockBatch booking fields
        await tx.stockBatch.update({
          where: { id: stockBatchId },
          data: {
            bookedBoxes: { increment: boxIncrement },
            bookedPacks: { increment: packIncrement },
            bookedPcs: { increment: pcsIncrement },
          }
        });
      }

      // Create the SalesOrderItem
      await tx.salesOrderItem.create({
        data: {
          salesOrderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unit: saleUnit,
          rate: item.rate,
          taxRate: item.taxRate || 0,
          amount: item.quantity * item.rate,
          description: item.description,
          stockBatchId: stockBatchId,
        }
      });
    }

    // Update Quote status to accepted
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted' }
    });

    // Return the created order with relations
    return await tx.salesOrder.findUnique({
      where: { id: order.id },
      include: includeRelations
    });
  }, { timeout: 30000 });
};

const convertSalesOrderToInvoice = async (id, itemSelections = []) => {
  // itemSelections: [{ salesOrderItemId, stockBatchId, saleUnit }]
  const order = await prisma.salesOrder.findUnique({
    where: { id: parseInt(id) },
    include: { items: { include: { product: { select: { name: true, description: true } } } } },
  });
  if (!order) throw new Error('Sales order not found');

  let selections = itemSelections;
  if (!selections || selections.length === 0) {
    selections = order.items.map(item => {
      if (!item.stockBatchId) {
        throw new Error(`Item "${item.product?.name || item.productId}" does not have a booked stock batch. Please select a batch first.`);
      }
      return {
        salesOrderItemId: item.id,
        stockBatchId: item.stockBatchId,
        saleUnit: item.unit
      };
    });
  }

  const lastInvoice = await prisma.outwardInvoice.findFirst({ orderBy: { id: 'desc' }, select: { invoiceNo: true } });
  const lastInvoiceNum = lastInvoice ? parseInt(lastInvoice.invoiceNo.replace('INV-', '')) : 0;
  const invoiceNo = `INV-${String(lastInvoiceNum + 1).padStart(5, '0')}`;

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

    for (const sel of selections) {
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

      // Check if this item had booking
      const hasBooking = orderItem.stockBatchId !== null;

      await tx.stockBatch.update({
        where: { id: stockBatch.id },
        data: {
          remainingBoxes: { decrement: boxDecrement },
          remainingPacks: { decrement: packDecrement },
          remainingPcs: { decrement: pcsDecrement },
          ...(hasBooking && {
            bookedBoxes: { decrement: Math.max(0, boxDecrement) },
            bookedPacks: { decrement: Math.max(0, packDecrement) },
            bookedPcs: { decrement: Math.max(0, pcsDecrement) },
          })
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
