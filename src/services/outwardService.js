const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./inventoryService');

const prisma = new PrismaClient();

const ITEM_INCLUDE = {
  product: {
    select: {
      name: true,
      grade: true,
      description: true,
      sku: true,
      category: { select: { name: true, gstRate: true, hsnCode: true } },
    },
  },
  stockBatch: {
    select: {
      vendor: { select: { name: true } },
      inwardDate: true,
      costPerBox: true,
      costPerPack: true,
      costPerPcs: true,
      packPerBox: true,
      packPerPiece: true,
    },
  },
  location: { select: { name: true } },
};

class OutwardService {
  static async getAll(page, limit, search, sortBy, sortOrder, startDate, endDate, customerId) {
    const where = {};
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const total = await prisma.outwardInvoice.count({ where });
    const { offset } = calculatePagination(page, limit, total);
    const orderBy = sortBy && ['invoiceNo', 'date', 'customerId', 'createdAt'].includes(sortBy)
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        customer: { select: { name: true, code: true, email: true } },
        items: { include: ITEM_INCLUDE },
      },
    });

    const enrichedInvoices = invoices.map((invoice) => {
      let totalQty = 0;
      let totalBoxes = 0;
      let totalCOGS = 0;
      let totalBaseSale = 0;

      invoice.items?.forEach((item) => {
        totalQty += item.quantity;
        if (item.saleUnit === 'box') {
          totalBoxes += item.quantity;
        } else if (item.saleUnit === 'pack') {
          totalBoxes += item.quantity / (item.stockBatch?.packPerBox || 1);
        } else {
          totalBoxes += item.quantity / ((item.stockBatch?.packPerBox || 1) * (item.stockBatch?.packPerPiece || 1));
        }
        const unitCost =
          item.saleUnit === 'box' ? item.stockBatch?.costPerBox :
          item.saleUnit === 'pack' ? (item.stockBatch?.costPerPack || item.stockBatch?.costPerBox / (item.stockBatch?.packPerBox || 1)) :
          item.stockBatch?.costPerPcs;
        totalCOGS += (unitCost || 0) * item.quantity;
        totalBaseSale += item.quantity * item.ratePerUnit;
      });

      const revenue = invoice.totalCost || 0;
      const grossProfit = revenue - totalCOGS;
      const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      return {
        ...invoice,
        totalQty,
        totalBoxes: Math.round(totalBoxes * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
      };
    });

    return { invoices: enrichedInvoices, pagination: calculatePagination(page, limit, total) };
  }

  static async getById(id) {
    const invoice = await prisma.outwardInvoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            product: { include: { category: true } },
            stockBatch: { include: { vendor: true } },
            location: true,
          },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  static async create(data) {
    if (!data.customerId || isNaN(parseInt(data.customerId))) {
      throw new Error('Valid customer ID is required');
    }
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.outwardInvoice.findFirst({
        where: { invoiceNo: data.invoiceNo },
      });
      if (existingInvoice) throw new Error('Invoice number already exists');

      const processedItems = data.items.map((item) => ({
        ...item,
        totalCost: item.quantity * item.ratePerUnit,
      }));

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Fetch GST rates for all items to calculate correct grand total
      const productIds = [...new Set(processedItems.map(i => parseInt(i.productId)))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: { select: { gstRate: true } } }
      });
      const gstRateMap = Object.fromEntries(products.map(p => [p.id, p.category?.gstRate || 0]));

      let gstSum = 0;
      for (const item of processedItems) {
        const gstRate = gstRateMap[parseInt(item.productId)] || 0;
        gstSum += (item.totalCost * gstRate) / 100;
      }
      const allGstRates = Object.values(gstRateMap);
      const shippingVal = parseFloat(data.shippingCharge || 0);
      const shippingGstRate = allGstRates.includes(18) ? 18 : allGstRates.includes(5) ? 5 : 0;
      const shippingGstAmt = shippingVal > 0 ? shippingVal * (shippingGstRate / 100) : 0;
      const rawTotal = totalInvoiceCost + gstSum + shippingGstAmt + parseFloat(data.expense || 0) + shippingVal - parseFloat(data.discount || 0);
      const grandTotal = Math.round(rawTotal);

      const invoice = await tx.outwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: parseInt(data.customerId),
          saleType: data.saleType,
          expense: data.expense,
          totalCost: grandTotal,
          adjustment: data.adjustment !== undefined ? parseFloat(data.adjustment) : 0,
          amountReceived: data.amountReceived !== undefined ? parseFloat(data.amountReceived) : 0,
          referenceNo: data.referenceNo || null,
          shippingCharge: data.shippingCharge !== undefined ? parseFloat(data.shippingCharge) : 0,
          discount: data.discount !== undefined ? parseFloat(data.discount) : 0,
        },
      });

      const items = await Promise.all(
        processedItems.map((item) =>
          tx.outwardItem.create({
            data: {
              outwardInvoiceId: invoice.id,
              productId: parseInt(item.productId),
              stockBatchId: parseInt(item.stockBatchId),
              locationId: parseInt(item.locationId),
              saleUnit: item.saleUnit,
              quantity: item.quantity,
              ratePerUnit: item.ratePerUnit,
              totalCost: item.totalCost,
              description: item.description || null,
            },
          })
        )
      );

      for (const item of items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (!stockBatch) throw new Error('Stock batch not found');

        let updatedPcs = stockBatch.remainingPcs;

        if (item.saleUnit === 'box') {
          updatedPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
        } else if (item.saleUnit === 'pack') {
          updatedPcs -= item.quantity * stockBatch.packPerPiece;
        } else {
          updatedPcs -= item.quantity;
        }

        if (updatedPcs < 0) throw new Error('Insufficient stock');
        const updatedPacks = Math.floor(updatedPcs / stockBatch.packPerPiece);
        const updatedBoxes = Math.floor(updatedPacks / stockBatch.packPerBox);

        await tx.stockBatch.update({
          where: { id: item.stockBatchId },
          data: { remainingBoxes: updatedBoxes, remainingPacks: updatedPacks, remainingPcs: updatedPcs },
        });

        await tx.stockMovement.create({
          data: {
            type: 'outward',
            referenceId: invoice.id,
            productId: parseInt(item.productId),
            locationId: item.locationId,
            quantity: -item.quantity,
            movementDate: new Date(data.date),
          },
        });

        // Deduct specific BoxDetail records
        if (item.saleUnit === 'box') {
          const boxesToDeduct = item.quantity;
          let boxesToUpdate = [];

          if (data.scannedBarcodes && data.scannedBarcodes.length > 0) {
            boxesToUpdate = await tx.boxDetail.findMany({
              where: {
                barcode: { in: data.scannedBarcodes },
                stockBatchId: item.stockBatchId,
                status: 'inwarded'
              },
              take: boxesToDeduct
            });
          }

          if (boxesToUpdate.length < boxesToDeduct) {
            const extraNeeded = boxesToDeduct - boxesToUpdate.length;
            const extraBoxes = await tx.boxDetail.findMany({
              where: {
                stockBatchId: item.stockBatchId,
                status: 'inwarded',
                id: { notIn: boxesToUpdate.map(b => b.id) }
              },
              take: extraNeeded
            });
            boxesToUpdate = [...boxesToUpdate, ...extraBoxes];
          }

          for (const box of boxesToUpdate) {
            await tx.boxDetail.update({
              where: { id: box.id },
              data: {
                status: 'outwarded',
                outwardInvoiceId: invoice.id
              }
            });
          }
        }
      }

      return await tx.outwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: { include: { product: { include: { category: true } }, stockBatch: { include: { vendor: true } }, location: true } },
        },
      });
    }, { timeout: 30000 });
  }

  static async update(id, data) {
    if (!data.customerId || isNaN(parseInt(data.customerId))) {
      throw new Error('Valid customer ID is required');
    }
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.outwardInvoice.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });
      if (!existingInvoice) throw new Error('Invoice not found');

      const duplicateInvoice = await tx.outwardInvoice.findFirst({
        where: { invoiceNo: data.invoiceNo, id: { not: parseInt(id) } },
      });
      if (duplicateInvoice) throw new Error('Invoice number already exists');

      // Restore stock for old items
      for (const item of existingInvoice.items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (stockBatch) {
          let restoredPcs = stockBatch.remainingPcs;

          if (item.saleUnit === 'box') {
            restoredPcs += item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
          } else if (item.saleUnit === 'pack') {
            restoredPcs += item.quantity * stockBatch.packPerPiece;
          } else {
            restoredPcs += item.quantity;
          }

          const restoredPacks = Math.floor(restoredPcs / stockBatch.packPerPiece);
          const restoredBoxes = Math.floor(restoredPacks / stockBatch.packPerBox);

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { remainingBoxes: restoredBoxes, remainingPacks: restoredPacks, remainingPcs: restoredPcs },
          });

          await tx.boxDetail.updateMany({
            where: { stockBatchId: item.stockBatchId, outwardInvoiceId: existingInvoice.id },
            data: {
              status: 'inwarded',
              outwardInvoiceId: null
            }
          });
        }
      }

      await tx.outwardItem.deleteMany({ where: { outwardInvoiceId: parseInt(id) } });
      await tx.stockMovement.deleteMany({ where: { referenceId: parseInt(id), type: 'outward' } });

      const processedItems = data.items.map((item) => ({
        ...item,
        totalCost: item.quantity * item.ratePerUnit,
      }));

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Fetch GST rates for all items to calculate correct grand total
      const productIdsUpdate = [...new Set(processedItems.map(i => parseInt(i.productId)))];
      const productsUpdate = await tx.product.findMany({
        where: { id: { in: productIdsUpdate } },
        select: { id: true, category: { select: { gstRate: true } } }
      });
      const gstRateMapUpdate = Object.fromEntries(productsUpdate.map(p => [p.id, p.category?.gstRate || 0]));

      let gstSumUpdate = 0;
      for (const item of processedItems) {
        const gstRate = gstRateMapUpdate[parseInt(item.productId)] || 0;
        gstSumUpdate += (item.totalCost * gstRate) / 100;
      }
      const allGstRatesUpdate = Object.values(gstRateMapUpdate);
      const shippingValUpdate = parseFloat(data.shippingCharge || 0);
      const shippingGstRateUpdate = allGstRatesUpdate.includes(18) ? 18 : allGstRatesUpdate.includes(5) ? 5 : 0;
      const shippingGstAmtUpdate = shippingValUpdate > 0 ? shippingValUpdate * (shippingGstRateUpdate / 100) : 0;
      const rawTotalUpdate = totalInvoiceCost + gstSumUpdate + shippingGstAmtUpdate + parseFloat(data.expense || 0) + shippingValUpdate - parseFloat(data.discount || 0);
      const grandTotalUpdate = Math.round(rawTotalUpdate);

      const invoice = await tx.outwardInvoice.update({
        where: { id: parseInt(id) },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: parseInt(data.customerId),
          saleType: data.saleType,
          expense: data.expense,
          totalCost: grandTotalUpdate,
          adjustment: data.adjustment !== undefined ? parseFloat(data.adjustment) : undefined,
          amountReceived: data.amountReceived !== undefined ? parseFloat(data.amountReceived) : undefined,
          referenceNo: data.referenceNo !== undefined ? data.referenceNo : undefined,
          shippingCharge: data.shippingCharge !== undefined ? parseFloat(data.shippingCharge) : undefined,
          discount: data.discount !== undefined ? parseFloat(data.discount) : undefined,
        },
      });

      const items = await Promise.all(
        processedItems.map((item) =>
          tx.outwardItem.create({
            data: {
              outwardInvoiceId: invoice.id,
              productId: parseInt(item.productId),
              stockBatchId: parseInt(item.stockBatchId),
              locationId: parseInt(item.locationId),
              saleUnit: item.saleUnit,
              quantity: item.quantity,
              ratePerUnit: item.ratePerUnit,
              totalCost: item.totalCost,
              description: item.description || null,
            },
          })
        )
      );

      for (const item of items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (!stockBatch) throw new Error('Stock batch not found');

        let updatedPcs = stockBatch.remainingPcs;

        if (item.saleUnit === 'box') {
          updatedPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
        } else if (item.saleUnit === 'pack') {
          updatedPcs -= item.quantity * stockBatch.packPerPiece;
        } else {
          updatedPcs -= item.quantity;
        }

        if (updatedPcs < 0) throw new Error('Insufficient stock');
        const updatedPacks = Math.floor(updatedPcs / stockBatch.packPerPiece);
        const updatedBoxes = Math.floor(updatedPacks / stockBatch.packPerBox);

        await tx.stockBatch.update({
          where: { id: item.stockBatchId },
          data: { remainingBoxes: updatedBoxes, remainingPacks: updatedPacks, remainingPcs: updatedPcs },
        });

        await tx.stockMovement.create({
          data: {
            type: 'outward',
            referenceId: invoice.id,
            productId: parseInt(item.productId),
            locationId: item.locationId,
            quantity: -item.quantity,
            movementDate: new Date(data.date),
          },
        });

        // Deduct specific BoxDetail records
        if (item.saleUnit === 'box') {
          const boxesToDeduct = item.quantity;
          let boxesToUpdate = [];

          if (data.scannedBarcodes && data.scannedBarcodes.length > 0) {
            boxesToUpdate = await tx.boxDetail.findMany({
              where: {
                barcode: { in: data.scannedBarcodes },
                stockBatchId: item.stockBatchId,
                status: 'inwarded'
              },
              take: boxesToDeduct
            });
          }

          if (boxesToUpdate.length < boxesToDeduct) {
            const extraNeeded = boxesToDeduct - boxesToUpdate.length;
            const extraBoxes = await tx.boxDetail.findMany({
              where: {
                stockBatchId: item.stockBatchId,
                status: 'inwarded',
                id: { notIn: boxesToUpdate.map(b => b.id) }
              },
              take: extraNeeded
            });
            boxesToUpdate = [...boxesToUpdate, ...extraBoxes];
          }

          for (const box of boxesToUpdate) {
            await tx.boxDetail.update({
              where: { id: box.id },
              data: {
                status: 'outwarded',
                outwardInvoiceId: invoice.id
              }
            });
          }
        }
      }

      return await tx.outwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          items: { include: { product: { include: { category: true } }, stockBatch: { include: { vendor: true } }, location: true } },
        },
      });
    }, { timeout: 30000 });
  }

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.outwardInvoice.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });
      if (!invoice) throw new Error('Invoice not found');

      for (const item of invoice.items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (stockBatch) {
          let restoredPcs = stockBatch.remainingPcs;

          if (item.saleUnit === 'box') {
            restoredPcs += item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
          } else if (item.saleUnit === 'pack') {
            restoredPcs += item.quantity * stockBatch.packPerPiece;
          } else {
            restoredPcs += item.quantity;
          }

          const restoredPacks = Math.floor(restoredPcs / stockBatch.packPerPiece);
          const restoredBoxes = Math.floor(restoredPacks / stockBatch.packPerBox);

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { remainingBoxes: restoredBoxes, remainingPacks: restoredPacks, remainingPcs: restoredPcs },
          });

          await tx.boxDetail.updateMany({
            where: { stockBatchId: item.stockBatchId, outwardInvoiceId: invoice.id },
            data: {
              status: 'inwarded',
              outwardInvoiceId: null
            }
          });
        }
      }

      await tx.stockMovement.deleteMany({ where: { referenceId: parseInt(id), type: 'outward' } });
      await tx.outwardInvoice.delete({ where: { id: parseInt(id) } });

      return { message: 'Invoice deleted successfully' };
    });
  }

  static async getProfitLoss(startDate, endDate) {
    const where = {};
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      include: { items: { include: { stockBatch: true } } },
    });

    return Promise.all(
      invoices.map(async (invoice) => {
        const revenue = invoice.totalCost;
        const cogs = await InventoryService.calculateCOGS(invoice.items);
        const grossProfit = revenue - cogs - invoice.expense;
        const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        return {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          date: invoice.date.toISOString(),
          type: 'outward',
          revenue,
          cogs,
          grossProfit,
          margin,
        };
      })
    );
  }
}
module.exports = { OutwardService };