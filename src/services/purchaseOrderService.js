const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generatePONumber = async () => {
  const count = await prisma.purchaseOrder.count();
  return `PO-${String(count + 1).padStart(5, '0')}`;
};

const createPurchaseOrder = async (data) => {
  const poNo = await generatePONumber();

  const items = data.items || [];
  let totalAmount = 0;
  let totalTax = 0;

  items.forEach(item => {
    const lineAmount = item.quantity * item.rate;
    const taxAmount = lineAmount * (item.taxRate / 100);
    totalAmount += lineAmount;
    totalTax += taxAmount;
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      poNo,
      vendorId: parseInt(data.vendorId),
      poDate: new Date(data.poDate),
      expectedDelivery: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
      status: data.status || 'draft',
      totalAmount,
      tax: totalTax,
      notes: data.notes,
      reference: data.reference,
      termsAndConditions: data.termsAndConditions,
      paymentTerms: data.paymentTerms,
      deliveryTerms: data.deliveryTerms,
      items: {
        create: items.map(item => ({
          productId: parseInt(item.productId),
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          taxRate: item.taxRate || 0,
          amount: item.quantity * item.rate,
          description: item.description
        }))
      }
    },
    include: {
      vendor: true,
      items: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  return {
    ...po,
    id: String(po.id),
    vendorId: String(po.vendorId),
    vendor: po.vendor ? { ...po.vendor, id: String(po.vendor.id) } : null,
    items: po.items?.map(item => ({
      ...item,
      id: String(item.id),
      purchaseOrderId: String(item.purchaseOrderId),
      productId: String(item.productId)
    }))
  };
};

const getPurchaseOrders = async (filters = {}) => {
  const where = {};

  if (filters.vendorId) where.vendorId = parseInt(filters.vendorId);
  if (filters.status) where.status = filters.status;
  if (filters.poNo) where.poNo = { contains: filters.poNo, mode: 'insensitive' };

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: true,
      items: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return pos.map(po => ({
    ...po,
    id: String(po.id),
    vendorId: String(po.vendorId),
    vendor: po.vendor ? { ...po.vendor, id: String(po.vendor.id) } : null,
    items: po.items?.map(item => ({
      ...item,
      id: String(item.id),
      purchaseOrderId: String(item.purchaseOrderId),
      productId: String(item.productId)
    }))
  }));
};

const getPurchaseOrderById = async (id) => {
  if (!id) {
    throw new Error('PO ID is required');
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    throw new Error(`Invalid PO ID: ${id}`);
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: numId },
    include: {
      vendor: true,
      items: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  if (!po) return null;

  return {
    ...po,
    id: String(po.id),
    vendorId: String(po.vendorId),
    vendor: po.vendor ? { ...po.vendor, id: String(po.vendor.id) } : null,
    items: po.items?.map(item => ({
      ...item,
      id: String(item.id),
      purchaseOrderId: String(item.purchaseOrderId),
      productId: String(item.productId)
    }))
  };
};

const updatePurchaseOrder = async (id, data) => {
  if (!id) {
    throw new Error('PO ID is required');
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    throw new Error(`Invalid PO ID: ${id}`);
  }
  
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: numId },
    include: { items: true }
  });

  if (!po) throw new Error('Purchase Order not found');

  const items = data.items || [];
  let totalAmount = 0;
  let totalTax = 0;

  items.forEach(item => {
    const lineAmount = item.quantity * item.rate;
    const taxAmount = lineAmount * (item.taxRate / 100);
    totalAmount += lineAmount;
    totalTax += taxAmount;
  });

  // Delete old items
  await prisma.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: numId }
  });

  // Update PO and create new items
  const updated = await prisma.purchaseOrder.update({
    where: { id: numId },
    data: {
      vendorId: parseInt(data.vendorId),
      poDate: data.poDate ? new Date(data.poDate) : po.poDate,
      expectedDelivery: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : po.expectedDelivery,
      status: data.status || po.status,
      totalAmount,
      tax: totalTax,
      notes: data.notes || po.notes,
      reference: data.reference !== undefined ? data.reference : po.reference,
      termsAndConditions: data.termsAndConditions || po.termsAndConditions,
      paymentTerms: data.paymentTerms || po.paymentTerms,
      deliveryTerms: data.deliveryTerms || po.deliveryTerms,
      items: {
        create: items.map(item => ({
          productId: parseInt(item.productId),
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          taxRate: item.taxRate || 0,
          amount: item.quantity * item.rate,
          description: item.description
        }))
      }
    },
    include: {
      vendor: true,
      items: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  return {
    ...updated,
    id: String(updated.id),
    vendorId: String(updated.vendorId),
    vendor: updated.vendor ? { ...updated.vendor, id: String(updated.vendor.id) } : null,
    items: updated.items?.map(item => ({
      ...item,
      id: String(item.id),
      purchaseOrderId: String(item.purchaseOrderId),
      productId: String(item.productId)
    }))
  };
};

const deletePurchaseOrder = async (id) => {
  if (!id) {
    throw new Error('PO ID is required');
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    throw new Error(`Invalid PO ID: ${id}`);
  }
  await prisma.purchaseOrder.delete({
    where: { id: numId }
  });
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder
};
