import { PrismaClient } from '@prisma/client';
import { calculatePagination } from '../utils/response';
import { InventoryService } from './inventoryService';

const prisma = new PrismaClient();

export class OutwardService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' as const } },
            { customer: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const total = await prisma.outwardInvoice.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const invoices = await prisma.outwardInvoice.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: {
          select: { name: true, code: true },
        },
        location: {
          select: { name: true },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                grade: true,
                category: {
                  select: { name: true },
                },
              },
            },
            stockBatch: {
              select: {
                vendor: {
                  select: { name: true, code: true },
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

  static async getById(id: string) {
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

  static async create(data: {
    invoiceNo: string;
    date: string;
    customerId: string;
    locationId: string;
    saleType: 'export' | 'domestic';
    expense: number;
    items: Array<{
      productId: string;
      stockBatchId: string;
      saleUnit: 'box' | 'piece';
      quantity: number;
      ratePerUnit: number;
    }>;
  }) {
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

  static async update(id: string, data: {
    invoiceNo: string;
    date: string;
    customerId: string;
    locationId: string;
    saleType: 'export' | 'domestic';
    expense: number;
    items: Array<{
      productId: string;
      stockBatchId: string;
      saleUnit: 'box' | 'piece';
      quantity: number;
      ratePerUnit: number;
    }>;
  }) {
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
        const stockBatch = await tx.stockBatch.findUnique({ where: { id: item.stockBatchId } });
        if (stockBatch) {
          const restoredBoxes = item.saleUnit === 'box' 
            ? stockBatch.remainingBoxes + item.quantity
            : stockBatch.remainingBoxes;
          const restoredPcs = item.saleUnit === 'piece'
            ? stockBatch.remainingPcs + item.quantity
            : stockBatch.remainingPcs + (item.quantity * stockBatch.pcsPerBox);

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: { remainingBoxes: restoredBoxes, remainingPcs: restoredPcs },
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
              product: { include: { category: true } },
              stockBatch: { include: { vendor: true } },
            },
          },
        },
      });
    }, { timeout: 10000 });
  }

  static async delete(id: string) {
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
          let restoredPcs = stockBatch.remainingPcs;

          if (item.saleUnit === 'box') {
            restoredBoxes += item.quantity;
            restoredPcs += item.quantity * stockBatch.pcsPerBox;
          } else {
            restoredPcs += item.quantity;
            // Convert excess pieces to boxes if possible
            const additionalBoxes = Math.floor(restoredPcs / stockBatch.pcsPerBox);
            if (additionalBoxes > 0) {
              restoredBoxes += additionalBoxes;
              restoredPcs = restoredPcs % stockBatch.pcsPerBox;
            }
          }

          await tx.stockBatch.update({
            where: { id: item.stockBatchId },
            data: {
              remainingBoxes: restoredBoxes,
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

  static async getProfitLoss(startDate?: string, endDate?: string) {
    const where: any = {};
    
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
          type: 'outward' as const,
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