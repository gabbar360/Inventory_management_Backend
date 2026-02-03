const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const { InventoryService } = require('./inventoryService');

const prisma = new PrismaClient();

class InwardService {
  static async getAll(page, limit, search, sortBy, sortOrder) {
    const where = search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' } },
            { vendor: { name: { contains: search, mode: 'insensitive' } } },
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

  static async getById(id) {
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

  static async create(data) {
    return await prisma.$transaction(async (tx) => {
      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { category: true },
          });

          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          const totalPacks = item.boxes * item.packPerBox;
          const totalPcs = totalPacks * item.packPerPiece;
          const ratePerPack = item.ratePerBox / item.packPerBox;
          const ratePerPcs = ratePerPack / item.packPerPiece;
          const baseAmount = item.boxes * item.ratePerBox;
          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return {
            ...item,
            totalPacks,
            totalPcs,
            ratePerPack,
            ratePerPcs,
            gstAmount,
            totalCost,
          };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

      const invoice = await tx.inwardInvoice.create({
        data: {
          invoiceNo: data.invoiceNo,
          date: new Date(data.date),
          vendorId: data.vendorId,
          locationId: data.locationId,
          totalCost: totalInvoiceCost,
        },
      });

      const items = await Promise.all(
        processedItems.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: item.productId,
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks: item.totalPacks,
              totalPcs: item.totalPcs,
              ratePerBox: item.ratePerBox,
              ratePerPack: item.ratePerPack,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
            },
          })
        )
      );

      await Promise.all(
        items.map((item) => InventoryService.createStockBatch(item, invoice))
      );

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

  static async update(id, data) {
    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.inwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw new Error('Invoice not found');
      }

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

      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { category: true },
          });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          const totalPacks = item.boxes * item.packPerBox;
          const totalPcs = totalPacks * item.packPerPiece;
          const ratePerPack = item.ratePerBox / item.packPerBox;
          const ratePerPcs = ratePerPack / item.packPerPiece;
          const baseAmount = item.boxes * item.ratePerBox;
          const gstAmount = (baseAmount * product.category.gstRate) / 100;
          const totalCost = baseAmount + gstAmount;

          return { ...item, totalPacks, totalPcs, ratePerPack, ratePerPcs, gstAmount, totalCost };
        })
      );

      const totalInvoiceCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

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

      const items = await Promise.all(
        processedItems.map((item) =>
          tx.inwardItem.create({
            data: {
              inwardInvoiceId: invoice.id,
              productId: item.productId,
              boxes: item.boxes,
              packPerBox: item.packPerBox,
              packPerPiece: item.packPerPiece,
              totalPacks: item.totalPacks,
              totalPcs: item.totalPcs,
              ratePerBox: item.ratePerBox,
              ratePerPack: item.ratePerPack,
              ratePerPcs: item.ratePerPcs,
              gstAmount: item.gstAmount,
              totalCost: item.totalCost,
            },
          })
        )
      );

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

  static async delete(id) {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.inwardInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

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

      await tx.stockBatch.deleteMany({
        where: {
          productId: { in: invoice.items.map(item => item.productId) },
          vendorId: invoice.vendorId,
          locationId: invoice.locationId,
          inwardDate: invoice.date,
        },
      });

      await tx.stockMovement.deleteMany({
        where: {
          referenceId: id,
          type: 'inward',
        },
      });

      await tx.inwardInvoice.delete({
        where: { id },
      });

      return { message: 'Invoice deleted successfully' };
    });
  }
}

module.exports = { InwardService };