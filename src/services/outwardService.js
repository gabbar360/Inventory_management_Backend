const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./inventoryService');

const prisma = new PrismaClient();

const ITEM_INCLUDE = {
  product: {
    select: {
      name: true,
      grade: true,
      category: { select: { name: true, gstRate: true } },
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
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

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
        customer: { select: { name: true, code: true } },
        items: { include: ITEM_INCLUDE },
      },
    });

    const enrichedInvoices = invoices.map((invoice) => {
      let totalQty = 0;
      let totalBoxes = 0;
      let totalCOGS = 0;

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
      });

      const grossProfit = invoice.totalCost - totalCOGS - invoice.expense;
      const grossProfitMargin = invoice.totalCost > 0 ? (grossProfit / invoice.totalCost) * 100 : 0;

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

      const invoice = await tx.outwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: parseInt(data.customerId),
          saleType: data.saleType,
          expense: data.expense,
          totalCost: totalInvoiceCost,
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
            },
          })
        )
      );

      for (const item of items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (!stockBatch) throw new Error('Stock batch not found');

        let updatedBoxes = stockBatch.remainingBoxes;
        let updatedPacks = stockBatch.remainingPacks;
        let updatedPcs = stockBatch.remainingPcs;

        if (item.saleUnit === 'box') {
          updatedBoxes -= item.quantity;
          updatedPacks -= item.quantity * stockBatch.packPerBox;
          updatedPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
        } else if (item.saleUnit === 'pack') {
          updatedPacks -= item.quantity;
          updatedPcs -= item.quantity * stockBatch.packPerPiece;
          updatedBoxes -= Math.floor(item.quantity / stockBatch.packPerBox);
        } else {
          updatedPcs -= item.quantity;
          const packsReduced = Math.floor(item.quantity / stockBatch.packPerPiece);
          updatedPacks -= packsReduced;
          updatedBoxes -= Math.floor(packsReduced / stockBatch.packPerBox);
        }

        if (updatedBoxes < 0 || updatedPacks < 0 || updatedPcs < 0) throw new Error('Insufficient stock');

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
          let restoredBoxes = stockBatch.remainingBoxes;
          let restoredPacks = stockBatch.remainingPacks;
          let restoredPcs = stockBatch.remainingPcs;

          if (item.saleUnit === 'box') {
            restoredBoxes += item.quantity;
            restoredPacks += item.quantity * stockBatch.packPerBox;
            restoredPcs += item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
          } else if (item.saleUnit === 'pack') {
            restoredPacks += item.quantity;
            restoredPcs += item.quantity * stockBatch.packPerPiece;
            restoredBoxes += Math.floor(item.quantity / stockBatch.packPerBox);
          } else {
            restoredPcs += item.quantity;
            const packsRestored = Math.floor(item.quantity / stockBatch.packPerPiece);
            restoredPacks += packsRestored;
            restoredBoxes += Math.floor(packsRestored / stockBatch.packPerBox);
          }

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { remainingBoxes: restoredBoxes, remainingPacks: restoredPacks, remainingPcs: restoredPcs },
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

      const invoice = await tx.outwardInvoice.update({
        where: { id: parseInt(id) },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: parseInt(data.customerId),
          saleType: data.saleType,
          expense: data.expense,
          totalCost: totalInvoiceCost,
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
            },
          })
        )
      );

      for (const item of items) {
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (!stockBatch) throw new Error('Stock batch not found');

        let updatedBoxes = stockBatch.remainingBoxes;
        let updatedPacks = stockBatch.remainingPacks;
        let updatedPcs = stockBatch.remainingPcs;

        if (item.saleUnit === 'box') {
          updatedBoxes -= item.quantity;
          updatedPacks -= item.quantity * stockBatch.packPerBox;
          updatedPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
        } else if (item.saleUnit === 'pack') {
          updatedPacks -= item.quantity;
          updatedPcs -= item.quantity * stockBatch.packPerPiece;
          updatedBoxes -= Math.floor(item.quantity / stockBatch.packPerBox);
        } else {
          updatedPcs -= item.quantity;
          const packsReduced = Math.floor(item.quantity / stockBatch.packPerPiece);
          updatedPacks -= packsReduced;
          updatedBoxes -= Math.floor(packsReduced / stockBatch.packPerBox);
        }

        if (updatedBoxes < 0 || updatedPacks < 0 || updatedPcs < 0) throw new Error('Insufficient stock');

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
          let restoredBoxes = stockBatch.remainingBoxes;
          let restoredPacks = stockBatch.remainingPacks;
          let restoredPcs = stockBatch.remainingPcs;

          if (item.saleUnit === 'box') {
            restoredBoxes += item.quantity;
            restoredPacks += item.quantity * stockBatch.packPerBox;
            restoredPcs += item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
          } else if (item.saleUnit === 'pack') {
            restoredPacks += item.quantity;
            restoredPcs += item.quantity * stockBatch.packPerPiece;
            restoredBoxes += Math.floor(item.quantity / stockBatch.packPerBox);
          } else {
            restoredPcs += item.quantity;
            const packsRestored = Math.floor(item.quantity / stockBatch.packPerPiece);
            restoredPacks += packsRestored;
            restoredBoxes += Math.floor(packsRestored / stockBatch.packPerBox);
          }

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { remainingBoxes: restoredBoxes, remainingPacks: restoredPacks, remainingPcs: restoredPcs },
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
