import { PrismaClient } from '@prisma/client';
import { calculatePagination } from '../utils/response';
import { InventoryService } from './inventoryService';

const prisma = new PrismaClient();

export class InwardService {
  static async getAll(page: number, limit: number, search: string, sortBy: string, sortOrder: 'asc' | 'desc') {
    const where = search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' as const } },
            { vendor: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const total = await prisma.inwardInvoice.count({ where });
    const { offset } = calculatePagination(page, limit, total);

    const invoices = await prisma.inwardInvoice.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        vendor: {
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
    const invoice = await prisma.inwardInvoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        location: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
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
    vendorId: string;
    locationId: string;
    items: Array<{
      productId: string;
      boxes: number;
      pcsPerBox: number;
      ratePerBox: number;
    }>;
  }) {
    return await prisma.$transaction(async (tx) => {
      // Calculate totals for each item
      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { category: true },
          });

          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          const totalPcs = item.boxes * item.pcsPerBox;
          const ratePerPcs = item.ratePerBox / item.pcsPerBox;
          const baseAmount = item.boxes * item.ratePerBox;
          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return {
            ...item,
            totalPcs,
            ratePerPcs,
            gstAmount,
            totalCost,
          };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Create invoice
      const invoice = await tx.inwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: data.vendorId,
          locationId: data.locationId,
          totalCost: totalInvoiceCost,
        },
      });

      // Create invoice items
      const items = await Promise.all(
        processedItems.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: item.productId,
              boxes: item.boxes,
              pcsPerBox: item.pcsPerBox,
              totalPcs: item.totalPcs,
              ratePerBox: item.ratePerBox,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
            },
          })
        )
      );

      // Create stock batches
      await Promise.all(
        items.map((item) => InventoryService.createStockBatch(item, invoice))
      );

      // Create stock movements
      await Promise.all(
        items.map((item) =>
          tx.stockMovement.create({
            data: {
              type: 'inward',
              referenceId: invoice.id,
              productId: item.productId,
              locationId: data.locationId,
              quantity: item.totalPcs,
              movementDate: new Date(data.date),
            },
          })
        )
      );

      return await tx.inwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          vendor: true,
          location: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
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
    vendorId: string;
    locationId: string;
    items: Array<{
      productId: string;
      boxes: number;
      pcsPerBox: number;
      ratePerBox: number;
    }>;
  }) {
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.inwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw new Error('Invoice not found');
      }

      // Check if any stock has been sold
      const soldItems = await tx.outwardItem.findMany({
        where: {
          stockBatch: {
            productId: { in: existingInvoice.items.map(item => item.productId) },
            vendorId: existingInvoice.vendorId,
            locationId: existingInvoice.locationId,
            inwardDate: existingInvoice.date,
          },
        },
      });

      if (soldItems.length > 0) {
        throw new Error('Cannot update invoice with sold stock');
      }

      // Delete existing data
      await tx.stockBatch.deleteMany({
        where: {
          productId: { in: existingInvoice.items.map(item => item.productId) },
          vendorId: existingInvoice.vendorId,
          locationId: existingInvoice.locationId,
          inwardDate: existingInvoice.date,
        },
      });
      await tx.stockMovement.deleteMany({ where: { referenceId: id, type: 'inward' } });
      await tx.inwardItem.deleteMany({ where: { inwardInvoiceId: id } });

      // Process new items
      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { category: true },
          });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          const totalPcs = item.boxes * item.pcsPerBox;
          const ratePerPcs = item.ratePerBox / item.pcsPerBox;
          const baseAmount = item.boxes * item.ratePerBox;
          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return { ...item, totalPcs, ratePerPcs, gstAmount, totalCost };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      // Update invoice
      const invoice = await tx.inwardInvoice.update({
        where: { id },
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: data.vendorId,
          locationId: data.locationId,
          totalCost: totalInvoiceCost,
        },
      });

      // Create new items
      const items = await Promise.all(
        processedItems.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: item.productId,
              boxes: item.boxes,
              pcsPerBox: item.pcsPerBox,
              totalPcs: item.totalPcs,
              ratePerBox: item.ratePerBox,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
            },
          })
        )
      );

      // Create stock batches and movements
      for (const item of items) {
        await InventoryService.createStockBatch(item, invoice);
        await tx.stockMovement.create({
          data: {
            type: 'inward',
            referenceId: invoice.id,
            productId: item.productId,
            locationId: data.locationId,
            quantity: item.totalPcs,
            movementDate: new Date(data.date),
          },
        });
      }

      return await tx.inwardInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          vendor: true,
          location: true,
          items: { include: { product: { include: { category: true } } } },
        },
      });
    }, { timeout: 10000 });
  }

  static async delete(id: string) {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.inwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if any stock from this invoice has been sold
      const soldItems = await tx.outwardItem.findMany({
        where: {
          stockBatch: {
            productId: { in: invoice.items.map(item => item.productId) },
            vendorId: invoice.vendorId,
            locationId: invoice.locationId,
            inwardDate: invoice.date,
          },
        },
      });

      if (soldItems.length > 0) {
        throw new Error('Cannot delete invoice with sold stock');
      }

      // Delete stock batches
      await tx.stockBatch.deleteMany({
        where: {
          productId: { in: invoice.items.map(item => item.productId) },
          vendorId: invoice.vendorId,
          locationId: invoice.locationId,
          inwardDate: invoice.date,
        },
      });

      // Delete stock movements
      await tx.stockMovement.deleteMany({
        where: {
          referenceId: id,
          type: 'inward',
        },
      });

      // Delete invoice (items will be deleted by cascade)
      await tx.inwardInvoice.delete({
        where: { id },
      });

      return { message: 'Invoice deleted successfully' };
    });
  }
}