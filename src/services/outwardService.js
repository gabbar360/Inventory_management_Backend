const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./inventoryService');

const prisma = new PrismaClient();

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

    const orderBy = sortBy
      ? { [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        customer: {
          select: {
            name: true,
            code: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            stockBatch: {
              select: {
                vendor: {
                  select: {
                    name: true,
                  },
                },
                inwardDate: true,
              },
            },
          },
        },
      },
    });

    return {
      invoices,
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id) {
    const invoice = await prisma.outwardInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        location: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            stockBatch: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return invoice;
  }

  static async create(data) {
    return await prisma.$transaction(async (tx) => {
      // Validate stock availability
      await InventoryService.validateStockAvailability(data.items);

      // Calculate totals for each item
      const processedItems = data.items.map((item) => ({
        ...item,
        totalCost: item.quantity * item.ratePerUnit,
      }));

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Create invoice
      const invoice = await tx.outwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: data.customerId,
          locationId: data.locationId,
          saleType: data.saleType,
          expense: data.expense,
          totalCost: totalInvoiceCost,
        },
      });

      // Create invoice items
      const items = await Promise.all(
        processedItems.map((item) =>
          tx.outwardItem.create({
            data: {
              outwardInvoiceId: invoice.id,
              productId: item.productId,
              stockBatchId: item.stockBatchId,
              saleUnit: item.saleUnit,
              quantity: item.quantity,
              ratePerUnit: item.ratePerUnit,
              totalCost: item.totalCost,
            },
          })
        )
      );

      // Update stock batches
      await InventoryService.updateStockOnSale(items);

      // Create stock movements
      await Promise.all(
        items.map((item) =>
          tx.stockMovement.create({
            data: {
              type: 'outward',
              referenceId: invoice.id,
              productId: item.productId,
              locationId: data.locationId,
              quantity: -item.quantity, // Negative for outward
              movementDate: new Date(data.date),
            },
          })
        )
      );

      return await tx.outwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          location: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              stockBatch: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
      });
    });
  }

  static async update(id, data) {
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.outwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw new Error('Invoice not found');
      }

      // Restore stock from existing items
      for (const item of existingInvoice.items) {
        const stockBatch = await tx.stockBatch.findUnique({ 
          where: { id: item.stockBatchId } 
        });
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
          } else {
            restoredPcs += item.quantity;
          }

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { 
              remainingBoxes: restoredBoxes, 
              remainingPacks: restoredPacks,
              remainingPcs: restoredPcs 
            },
          });
        }
      }

      // Delete existing items and movements
      await tx.outwardItem.deleteMany({ where: { outwardInvoiceId: id } });
      await tx.stockMovement.deleteMany({ where: { referenceId: id, type: 'outward' } });

      // Validate new stock availability
      await InventoryService.validateStockAvailability(data.items);

      const processedItems = data.items.map((item) => ({
        ...item,
        totalCost: item.quantity * item.ratePerUnit,
      }));

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Update invoice
      const invoice = await tx.outwardInvoice.update({
        where: { id },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          customerId: data.customerId,
          locationId: data.locationId,
          saleType: data.saleType,
          expense: data.expense,
          totalCost: totalInvoiceCost,
        },
      });

      // Create new items
      const items = await Promise.all(
        processedItems.map((item) =>
          tx.outwardItem.create({
            data: {
              outwardInvoiceId: invoice.id,
              productId: item.productId,
              stockBatchId: item.stockBatchId,
              saleUnit: item.saleUnit,
              quantity: item.quantity,
              ratePerUnit: item.ratePerUnit,
              totalCost: item.totalCost,
            },
          })
        )
      );

      // Update stock and create movements
      await InventoryService.updateStockOnSale(items);
      
      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            type: 'outward',
            referenceId: invoice.id,
            productId: item.productId,
            locationId: data.locationId,
            quantity: -item.quantity,
            movementDate: new Date(data.date),
          },
        });
      }

      return await tx.outwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: true,
          location: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              stockBatch: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
      });
    }, { timeout: 10000 });
  }

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.outwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Restore stock quantities
      for (const item of invoice.items) {
        const stockBatch = await tx.stockBatch.findUnique({
          where: { id: item.stockBatchId },
        });

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
          } else {
            restoredPcs += item.quantity;
          }

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: {
              remainingBoxes: restoredBoxes,
              remainingPacks: restoredPacks,
              remainingPcs: restoredPcs,
            },
          });
        }
      }

      // Delete stock movements
      await tx.stockMovement.deleteMany({
        where: {
          referenceId: id,
          type: 'outward',
        },
      });

      // Delete invoice (items will be deleted by cascade)
      await tx.outwardInvoice.delete({
        where: { id },
      });

      return { message: 'Invoice deleted successfully' };
    });
  }

  static async getProfitLoss(startDate, endDate) {
    const where = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      include: {
        items: {
          include: {
            stockBatch: true,
          },
        },
      },
    });

    const profitLossData = await Promise.all(
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

    return profitLossData;
  }
}
module.exports = { OutwardService };