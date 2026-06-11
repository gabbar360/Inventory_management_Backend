const { PrismaClient } = require('@prisma/client');
const { calculatePagination } = require("../utils/helpers");
const { BarcodeService: BarcodeServiceClass } = require('./barcodeService');
const prisma = new PrismaClient();

const generatePONumber = async () => {
  const count = await prisma.purchaseOrder.count();
  return `PO-${String(count + 1).padStart(5, '0')}`;
};

const createPurchaseOrder = async (data) => {
  const poNo = await generatePONumber();
  const items = data.items || [];

  return await prisma.$transaction(async (tx) => {
    // Process items
    const processedItems = await Promise.all(
      items.map(async (item) => {
        const product = await tx.product.findUnique({
          where: { id: parseInt(item.productId) },
          include: { category: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const totalPacks = (item.boxes || 1) * (item.packPerBox || 28);
        const totalPcs = totalPacks * (item.packPerPiece || 25);
        
        let ratePerBox, ratePerPack, ratePerPcs, baseAmount;
        const unit = item.unit || 'box';
        const rateVal = parseFloat(item.ratePerBox !== undefined ? item.ratePerBox : (item.rate || 0));
        
        if (unit === 'box') {
          ratePerBox = rateVal;
          ratePerPack = ratePerBox / (item.packPerBox || 28);
          ratePerPcs = ratePerPack / (item.packPerPiece || 25);
          baseAmount = (item.boxes || 1) * ratePerBox;
        } else if (unit === 'pack') {
          ratePerPack = rateVal;
          ratePerBox = ratePerPack * (item.packPerBox || 28);
          ratePerPcs = ratePerPack / (item.packPerPiece || 25);
          baseAmount = totalPacks * ratePerPack;
        } else {
          ratePerPcs = rateVal;
          ratePerPack = ratePerPcs * (item.packPerPiece || 25);
          ratePerBox = ratePerPack * (item.packPerBox || 28);
          baseAmount = totalPcs * ratePerPcs;
        }
        
        const gstAmount = (baseAmount * (product.category?.gstRate || 0)) / 100;
        const totalCost = baseAmount + gstAmount;

        return {
          ...item,
          unit,
          totalPacks,
          totalPcs,
          ratePerBox,
          ratePerPack,
          ratePerPcs,
          gstAmount,
          totalCost,
          taxRate: product.category?.gstRate || 0
        };
      })
    );

    let totalAmount = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
    let totalTax = processedItems.reduce((sum, item) => sum + item.gstAmount, 0);

    // Also process sub-items total if any
    let subItemsTotalCost = 0;
    let subItemsTotalTax = 0;

    for (const item of processedItems) {
      if (item.subItems && item.subItems.length > 0) {
        for (const subItem of item.subItems) {
          const subTotalPacks = (subItem.boxes || 1) * (subItem.packPerBox || 28);
          const subTotalPcs = subTotalPacks * (subItem.packPerPiece || 25);
          
          let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
          const subUnit = subItem.unit || 'box';
          const subRateVal = parseFloat(subItem.ratePerBox !== undefined ? subItem.ratePerBox : (subItem.rate || 0));
          
          if (subUnit === 'box') {
            subRatePerBox = subRateVal;
            subRatePerPack = subRatePerBox / (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = (subItem.boxes || 1) * subRatePerBox;
          } else if (subUnit === 'pack') {
            subRatePerPack = subRateVal;
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = subTotalPacks * subRatePerPack;
          } else {
            subRatePerPcs = subRateVal;
            subRatePerPack = subRatePerPcs * (subItem.packPerPiece || 25);
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subBaseAmount = subTotalPcs * subRatePerPcs;
          }
          
          const product = await tx.product.findUnique({
            where: { id: parseInt(item.productId) },
            include: { category: true }
          });
          const gstRate = product?.category?.gstRate || 0;
          const subGstAmount = (subBaseAmount * gstRate) / 100;
          subItemsTotalCost += subBaseAmount + subGstAmount;
          subItemsTotalTax += subGstAmount;
        }
      }
    }

    totalAmount += subItemsTotalCost;
    totalTax += subItemsTotalTax;

    const po = await tx.purchaseOrder.create({
      data: {
        poNo,
        vendorId: parseInt(data.vendorId),
        poDate: new Date(data.poDate),
        expectedDelivery: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        status: data.status || 'draft',
        totalAmount: totalAmount,
        tax: totalTax,
        notes: data.notes,
        reference: data.reference,
        termsAndConditions: data.termsAndConditions,
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
      }
    });

    // Create main items
    const createdItems = [];
    for (const item of processedItems) {
      const quantityVal = item.unit === 'box' ? (item.boxes || 1) : (item.unit === 'pack' ? item.totalPacks : item.totalPcs);
       const createdItem = await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productId: parseInt(item.productId),
          quantity: quantityVal,
          unit: item.unit,
          rate: item.ratePerBox,
          taxRate: item.taxRate,
          amount: item.totalCost,
          description: item.description,
          boxes: item.boxes || 1,
          packPerBox: item.packPerBox || 28,
          packPerPiece: item.packPerPiece || 25,
          totalPacks: item.totalPacks,
          totalPcs: item.totalPcs,
          ratePerBox: item.ratePerBox,
          ratePerPack: item.ratePerPack,
          ratePerPcs: item.ratePerPcs,
          batchCode: item.batchCode || null,
          mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
          color: item.color || null,
          brand: item.brand || null,
        }
      });
      createdItems.push({ ...createdItem, originalItem: item });
    }

    // Create sub items
    for (const createdItemWrapper of createdItems) {
      const originalItem = createdItemWrapper.originalItem;
      const parentItem = createdItemWrapper;
      
      if (originalItem.subItems && originalItem.subItems.length > 0) {
        for (const subItem of originalItem.subItems) {
          const subTotalPacks = (subItem.boxes || 1) * (subItem.packPerBox || 28);
          const subTotalPcs = subTotalPacks * (subItem.packPerPiece || 25);
          
          let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
          const subUnit = subItem.unit || 'box';
          const subRateVal = parseFloat(subItem.ratePerBox !== undefined ? subItem.ratePerBox : (subItem.rate || 0));
          
          if (subUnit === 'box') {
            subRatePerBox = subRateVal;
            subRatePerPack = subRatePerBox / (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = (subItem.boxes || 1) * subRatePerBox;
          } else if (subUnit === 'pack') {
            subRatePerPack = subRateVal;
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = subTotalPacks * subRatePerPack;
          } else {
            subRatePerPcs = subRateVal;
            subRatePerPack = subRatePerPcs * (subItem.packPerPiece || 25);
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subBaseAmount = subTotalPcs * subRatePerPcs;
          }
          
          const product = await tx.product.findUnique({
            where: { id: parseInt(parentItem.productId) },
            include: { category: true }
          });
          const gstRate = product?.category?.gstRate || 0;
          const subGstAmount = (subBaseAmount * gstRate) / 100;
          const subTotalCost = subBaseAmount + subGstAmount;

          const quantityVal = subUnit === 'box' ? (subItem.boxes || 1) : (subUnit === 'pack' ? subTotalPacks : subTotalPcs);

          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              productId: parseInt(parentItem.productId),
              parentItemId: parentItem.id,
              quantity: quantityVal,
              unit: subUnit,
              rate: subRatePerBox,
              taxRate: gstRate,
              amount: subTotalCost,
              description: subItem.description,
              boxes: subItem.boxes || 1,
              packPerBox: subItem.packPerBox || 28,
              packPerPiece: subItem.packPerPiece || 25,
              totalPacks: subTotalPacks,
              totalPcs: subTotalPcs,
              ratePerBox: subRatePerBox,
              ratePerPack: subRatePerPack,
              ratePerPcs: subRatePerPcs,
              batchCode: subItem.batchCode || null,
              mfgDate: subItem.mfgDate ? new Date(subItem.mfgDate) : null,
              color: subItem.color || null,
              brand: subItem.brand || null,
            }
          });
        }
      }
    }

    const poWithDetails = await tx.purchaseOrder.findUnique({
      where: { id: po.id },
      include: {
        vendor: true,
        items: {
          where: { parentItemId: null },
          include: {
            product: {
              include: {
                category: true
              }
            },
            subItems: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if ((poWithDetails.status === 'confirmed' || poWithDetails.status === 'sent') && poWithDetails.items?.length > 0) {
      await BarcodeServiceClass.generateExpectedBoxesForPO(poWithDetails.id, tx);
    }

    return poWithDetails;
  });
};

const getPurchaseOrders = async (filters = {}) => {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const search = filters.search || '';

  const where = {};

  if (filters.vendorId) where.vendorId = parseInt(filters.vendorId);
  if (filters.status) where.status = filters.status;
  if (filters.poNo) {
    where.poNo = { contains: filters.poNo, mode: 'insensitive' };
  } else if (search) {
    where.OR = [
      { poNo: { contains: search, mode: 'insensitive' } },
      { vendor: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const total = await prisma.purchaseOrder.count({ where });
  const { offset } = calculatePagination(page, limit, total);

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: true,
      items: {
        where: { parentItemId: null },
        include: {
          product: {
            include: {
              category: true
            }
          },
          subItems: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });

  const orders = pos.map(po => ({
    ...po,
    id: String(po.id),
    vendorId: String(po.vendorId),
    vendor: po.vendor ? { ...po.vendor, id: String(po.vendor.id) } : null,
    items: po.items?.map(item => ({
      ...item,
      id: String(item.id),
      purchaseOrderId: String(item.purchaseOrderId),
      productId: String(item.productId),
      subItems: item.subItems?.map(sub => ({
        ...sub,
        id: String(sub.id),
        purchaseOrderId: String(sub.purchaseOrderId),
        productId: String(sub.productId),
        parentItemId: String(sub.parentItemId)
      }))
    }))
  }));

  return {
    orders,
    pagination: calculatePagination(page, limit, total)
  };
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
        where: { parentItemId: null },
        include: {
          product: {
            include: {
              category: true
            }
          },
          subItems: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
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
      productId: String(item.productId),
      subItems: item.subItems?.map(sub => ({
        ...sub,
        id: String(sub.id),
        purchaseOrderId: String(sub.purchaseOrderId),
        productId: String(sub.productId),
        parentItemId: String(sub.parentItemId)
      }))
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
  
  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: numId },
      include: { items: true }
    });

    if (!po) throw new Error('Purchase Order not found');

    const items = data.items || [];

    // Delete old items
    await tx.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: numId }
    });

    // Process new items
    const processedItems = await Promise.all(
      items.map(async (item) => {
        const product = await tx.product.findUnique({
          where: { id: parseInt(item.productId) },
          include: { category: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const totalPacks = (item.boxes || 1) * (item.packPerBox || 28);
        const totalPcs = totalPacks * (item.packPerPiece || 25);
        
        let ratePerBox, ratePerPack, ratePerPcs, baseAmount;
        const unit = item.unit || 'box';
        const rateVal = parseFloat(item.ratePerBox !== undefined ? item.ratePerBox : (item.rate || 0));
        
        if (unit === 'box') {
          ratePerBox = rateVal;
          ratePerPack = ratePerBox / (item.packPerBox || 28);
          ratePerPcs = ratePerPack / (item.packPerPiece || 25);
          baseAmount = (item.boxes || 1) * ratePerBox;
        } else if (unit === 'pack') {
          ratePerPack = rateVal;
          ratePerBox = ratePerPack * (item.packPerBox || 28);
          ratePerPcs = ratePerPack / (item.packPerPiece || 25);
          baseAmount = totalPacks * ratePerPack;
        } else {
          ratePerPcs = rateVal;
          ratePerPack = ratePerPcs * (item.packPerPiece || 25);
          ratePerBox = ratePerPack * (item.packPerBox || 28);
          baseAmount = totalPcs * ratePerPcs;
        }
        
        const gstAmount = (baseAmount * (product.category?.gstRate || 0)) / 100;
        const totalCost = baseAmount + gstAmount;

        return {
          ...item,
          unit,
          totalPacks,
          totalPcs,
          ratePerBox,
          ratePerPack,
          ratePerPcs,
          gstAmount,
          totalCost,
          taxRate: product.category?.gstRate || 0
        };
      })
    );

    let totalAmount = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
    let totalTax = processedItems.reduce((sum, item) => sum + item.gstAmount, 0);

    // Also process sub-items total if any
    let subItemsTotalCost = 0;
    let subItemsTotalTax = 0;

    for (const item of processedItems) {
      if (item.subItems && item.subItems.length > 0) {
        for (const subItem of item.subItems) {
          const subTotalPacks = (subItem.boxes || 1) * (subItem.packPerBox || 28);
          const subTotalPcs = subTotalPacks * (subItem.packPerPiece || 25);
          
          let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
          const subUnit = subItem.unit || 'box';
          const subRateVal = parseFloat(subItem.ratePerBox !== undefined ? subItem.ratePerBox : (subItem.rate || 0));
          
          if (subUnit === 'box') {
            subRatePerBox = subRateVal;
            subRatePerPack = subRatePerBox / (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = (subItem.boxes || 1) * subRatePerBox;
          } else if (subUnit === 'pack') {
            subRatePerPack = subRateVal;
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = subTotalPacks * subRatePerPack;
          } else {
            subRatePerPcs = subRateVal;
            subRatePerPack = subRatePerPcs * (subItem.packPerPiece || 25);
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subBaseAmount = subTotalPcs * subRatePerPcs;
          }
          
          const product = await tx.product.findUnique({
            where: { id: parseInt(item.productId) },
            include: { category: true }
          });
          const gstRate = product?.category?.gstRate || 0;
          const subGstAmount = (subBaseAmount * gstRate) / 100;
          subItemsTotalCost += subBaseAmount + subGstAmount;
          subItemsTotalTax += subGstAmount;
        }
      }
    }

    totalAmount += subItemsTotalCost;
    totalTax += subItemsTotalTax;

    const updated = await tx.purchaseOrder.update({
      where: { id: numId },
      data: {
        vendorId: parseInt(data.vendorId),
        poDate: data.poDate ? new Date(data.poDate) : po.poDate,
        expectedDelivery: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : po.expectedDelivery,
        status: data.status || po.status,
        totalAmount: totalAmount,
        tax: totalTax,
        notes: data.notes || po.notes,
        reference: data.reference !== undefined ? data.reference : po.reference,
        termsAndConditions: data.termsAndConditions || po.termsAndConditions,
        paymentTerms: data.paymentTerms || po.paymentTerms,
        deliveryTerms: data.deliveryTerms || po.deliveryTerms,
      }
    });

    // Create main items
    const createdItems = [];
    for (const item of processedItems) {
      const quantityVal = item.unit === 'box' ? (item.boxes || 1) : (item.unit === 'pack' ? item.totalPacks : item.totalPcs);
      const createdItem = await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: updated.id,
          productId: parseInt(item.productId),
          quantity: quantityVal,
          unit: item.unit,
          rate: item.ratePerBox,
          taxRate: item.taxRate,
          amount: item.totalCost,
          description: item.description,
          boxes: item.boxes || 1,
          packPerBox: item.packPerBox || 28,
          packPerPiece: item.packPerPiece || 25,
          totalPacks: item.totalPacks,
          totalPcs: item.totalPcs,
          ratePerBox: item.ratePerBox,
          ratePerPack: item.ratePerPack,
          ratePerPcs: item.ratePerPcs,
          batchCode: item.batchCode || null,
          mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
          color: item.color || null,
          brand: item.brand || null,
        }
      });
      createdItems.push({ ...createdItem, originalItem: item });
    }

    // Create sub items
    for (const createdItemWrapper of createdItems) {
      const originalItem = createdItemWrapper.originalItem;
      const parentItem = createdItemWrapper;
      
      if (originalItem.subItems && originalItem.subItems.length > 0) {
        for (const subItem of originalItem.subItems) {
          const subTotalPacks = (subItem.boxes || 1) * (subItem.packPerBox || 28);
          const subTotalPcs = subTotalPacks * (subItem.packPerPiece || 25);
          
          let subRatePerBox, subRatePerPack, subRatePerPcs, subBaseAmount;
          const subUnit = subItem.unit || 'box';
          const subRateVal = parseFloat(subItem.ratePerBox !== undefined ? subItem.ratePerBox : (subItem.rate || 0));
          
          if (subUnit === 'box') {
            subRatePerBox = subRateVal;
            subRatePerPack = subRatePerBox / (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = (subItem.boxes || 1) * subRatePerBox;
          } else if (subUnit === 'pack') {
            subRatePerPack = subRateVal;
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subRatePerPcs = subRatePerPack / (subItem.packPerPiece || 25);
            subBaseAmount = subTotalPacks * subRatePerPack;
          } else {
            subRatePerPcs = subRateVal;
            subRatePerPack = subRatePerPcs * (subItem.packPerPiece || 25);
            subRatePerBox = subRatePerPack * (subItem.packPerBox || 28);
            subBaseAmount = subTotalPcs * subRatePerPcs;
          }
          
          const product = await tx.product.findUnique({
            where: { id: parseInt(parentItem.productId) },
            include: { category: true }
          });
          const gstRate = product?.category?.gstRate || 0;
          const subGstAmount = (subBaseAmount * gstRate) / 100;
          const subTotalCost = subBaseAmount + subGstAmount;

          const quantityVal = subUnit === 'box' ? (subItem.boxes || 1) : (subUnit === 'pack' ? subTotalPacks : subTotalPcs);

          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: updated.id,
              productId: parseInt(parentItem.productId),
              parentItemId: parentItem.id,
              quantity: quantityVal,
              unit: subUnit,
              rate: subRatePerBox,
              taxRate: gstRate,
              amount: subTotalCost,
              description: subItem.description,
              boxes: subItem.boxes || 1,
              packPerBox: subItem.packPerBox || 28,
              packPerPiece: subItem.packPerPiece || 25,
              totalPacks: subTotalPacks,
              totalPcs: subTotalPcs,
              ratePerBox: subRatePerBox,
              ratePerPack: subRatePerPack,
              ratePerPcs: subRatePerPcs,
              batchCode: subItem.batchCode || null,
              mfgDate: subItem.mfgDate ? new Date(subItem.mfgDate) : null,
              color: subItem.color || null,
              brand: subItem.brand || null,
            }
          });
        }
      }
    }

    if ((updated.status === 'confirmed' || updated.status === 'sent') && processedItems?.length > 0) {
      await tx.boxDetail.deleteMany({
        where: { purchaseOrderId: updated.id, status: 'expected' }
      });
      await BarcodeServiceClass.generateExpectedBoxesForPO(updated.id, tx);
    }

    const updatedPo = await tx.purchaseOrder.findUnique({
      where: { id: numId },
      include: {
        vendor: true,
        items: {
          where: { parentItemId: null },
          include: {
            product: {
              include: {
                category: true
              }
            },
            subItems: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return updatedPo;
  });
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