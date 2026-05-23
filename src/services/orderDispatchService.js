const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const includeRelations = {
  salesOrder: {
    include: {
      customer: true,
      items: { include: { product: { include: { category: true } } } },
    },
  },
};

const generateDispatchNo = async () => {
  const last = await prisma.orderDispatch.findFirst({ orderBy: { id: 'desc' } });
  return `DISP-${String((last?.id || 0) + 1).padStart(6, '0')}`;
};

const createOrderDispatch = async (data) => {
  const dispatchNo = await generateDispatchNo();
  
  const dispatch = await prisma.orderDispatch.create({
    data: {
      dispatchNo,
      salesOrderId: data.salesOrderId,
      dispatchDate: new Date(data.dispatchDate),
      status: data.status || 'pending',
      shippingMethod: data.shippingMethod,
      trackingNumber: data.trackingNumber || null,
      carrier: data.carrier || null,
      estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
      shippingAddress: data.shippingAddress,
      shippingCity: data.shippingCity,
      shippingState: data.shippingState,
      shippingPincode: data.shippingPincode,
      shippingCountry: data.shippingCountry || 'India',
      weight: data.weight || null,
      dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
      packageCount: data.packageCount || 1,
      shippingCost: data.shippingCost || 0,
      insuranceAmount: data.insuranceAmount || 0,
      notes: data.notes || null,
      toTheOrder: data.toTheOrder || false,
    },
    include: includeRelations,
  });

  return dispatch;
};

const getOrderDispatches = async ({ page = 1, limit = 10, search, status } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { dispatchNo: { contains: search, mode: 'insensitive' } },
      { trackingNumber: { contains: search, mode: 'insensitive' } },
      { salesOrder: { orderNo: { contains: search, mode: 'insensitive' } } },
      { salesOrder: { customer: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [dispatches, total] = await Promise.all([
    prisma.orderDispatch.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderDispatch.count({ where }),
  ]);

  return { dispatches, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getOrderDispatchById = async (id) => {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { id: parseInt(id) },
    include: includeRelations,
  });
  if (!dispatch) throw new Error('Order dispatch not found');
  return dispatch;
};

const updateOrderDispatch = async (id, data) => {
  const dispatch = await prisma.orderDispatch.findUnique({ where: { id: parseInt(id) } });
  if (!dispatch) throw new Error('Order dispatch not found');

  const updateData = {};
  
  if (data.status) updateData.status = data.status;
  if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
  if (data.carrier !== undefined) updateData.carrier = data.carrier;
  if (data.estimatedDelivery) updateData.estimatedDelivery = new Date(data.estimatedDelivery);
  if (data.actualDelivery) updateData.actualDelivery = new Date(data.actualDelivery);
  if (data.shippingMethod) updateData.shippingMethod = data.shippingMethod;
  if (data.shippingAddress) updateData.shippingAddress = data.shippingAddress;
  if (data.shippingCity) updateData.shippingCity = data.shippingCity;
  if (data.shippingState) updateData.shippingState = data.shippingState;
  if (data.shippingPincode) updateData.shippingPincode = data.shippingPincode;
  if (data.shippingCountry) updateData.shippingCountry = data.shippingCountry;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.dimensions) updateData.dimensions = JSON.stringify(data.dimensions);
  if (data.packageCount) updateData.packageCount = data.packageCount;
  if (data.shippingCost !== undefined) updateData.shippingCost = data.shippingCost;
  if (data.insuranceAmount !== undefined) updateData.insuranceAmount = data.insuranceAmount;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.toTheOrder !== undefined) updateData.toTheOrder = data.toTheOrder;

  const updatedDispatch = await prisma.orderDispatch.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: includeRelations,
  });

  // Update sales order status based on dispatch status
  if (data.status === 'dispatched') {
    await prisma.salesOrder.update({
      where: { id: updatedDispatch.salesOrderId },
      data: { status: 'shipped' },
    });
  } else if (data.status === 'delivered') {
    await prisma.salesOrder.update({
      where: { id: updatedDispatch.salesOrderId },
      data: { status: 'delivered' },
    });
  } else if (data.status === 'cancelled') {
    await prisma.salesOrder.update({
      where: { id: updatedDispatch.salesOrderId },
      data: { status: 'confirmed' },
    });
  }

  return updatedDispatch;
};

const deleteOrderDispatch = async (id) => {
  const dispatch = await prisma.orderDispatch.findUnique({ where: { id: parseInt(id) } });
  if (!dispatch) throw new Error('Order dispatch not found');

  // Reset sales order status to 'confirmed'
  await prisma.salesOrder.update({
    where: { id: dispatch.salesOrderId },
    data: { status: 'confirmed' },
  });

  await prisma.orderDispatch.delete({ where: { id: parseInt(id) } });
};

const getDispatchBySalesOrderId = async (salesOrderId) => {
  return prisma.orderDispatch.findUnique({
    where: { salesOrderId: parseInt(salesOrderId) },
    include: includeRelations,
  });
};

module.exports = {
  createOrderDispatch,
  getOrderDispatches,
  getOrderDispatchById,
  updateOrderDispatch,
  deleteOrderDispatch,
  getDispatchBySalesOrderId,
};
