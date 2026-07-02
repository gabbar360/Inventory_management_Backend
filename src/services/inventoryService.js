const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class InventoryService {
  static async createStockBatch(inwardItem, inwardInvoice, tx = prisma) {
    const totalPacks = inwardItem.boxes * inwardItem.packPerBox;
    const totalPcs = totalPacks * inwardItem.packPerPiece;
    const costPerBox = inwardItem.totalCost / (inwardItem.boxes || 1);
    const costPerPack = inwardItem.totalCost / (totalPacks || 1);
    const costPerPcs = inwardItem.totalCost / (totalPcs || 1);

    return await tx.stockBatch.create({
      data: {
        productId: inwardItem.productId,
        vendorId: inwardInvoice.vendorId,
        locationId: inwardInvoice.locationId,
        inwardInvoiceId: inwardInvoice.id,
        inwardDate: inwardInvoice.date,
        boxes: inwardItem.boxes,
        packPerBox: inwardItem.packPerBox,
        packPerPiece: inwardItem.packPerPiece,
        totalPacks,
        totalPcs,
        remainingBoxes: inwardItem.boxes,
        remainingPacks: totalPacks,
        remainingPcs: totalPcs,
        costPerBox,
        costPerPack,
        costPerPcs,
        batchCode: inwardItem.batchCode,
        mfgDate: inwardItem.mfgDate,
      },
    });
  }

  static async getAvailableStock(productId, locationId, includeIds = []) {
    const parsedIncludeIds = includeIds.map(id => parseInt(id)).filter(Boolean);

    const where = {
      productId: parseInt(productId),
      OR: [
        { remainingBoxes: { gt: 0 } },
        { remainingPcs: { gt: 0 } },
        ...(parsedIncludeIds.length > 0 ? [{ id: { in: parsedIncludeIds } }] : []),
      ],
    };

    if (locationId) {
      where.locationId = parseInt(locationId);
    }

    return await prisma.stockBatch.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            grade: true,
            category: {
              select: {
                name: true,
                hsnCode: true,
                gstRate: true,
              },
            },
          },
        },
        vendor: {
          select: {
            name: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { inwardDate: 'asc' },
    });
  }

  /**
   * Returns ALL stock batches for a product (including fully-consumed ones),
   * ordered newest-first. Used for P&L cost-price lookups so that even
   * after stock runs out the historical purchase cost is still accessible.
   */
  static async getCostHistory(productId) {
    return await prisma.stockBatch.findMany({
      where: {
        productId: parseInt(productId),
      },
      select: {
        id: true,
        productId: true,
        inwardDate: true,
        costPerBox: true,
        costPerPack: true,
        costPerPcs: true,
        packPerBox: true,
        packPerPiece: true,
        batchCode: true,
      },
      orderBy: { inwardDate: 'desc' },
    });
  }

  static async validateStockAvailability(items) {
    for (const item of items) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: parseInt(item.stockBatchId) },
      });

      if (!stockBatch) {
        throw new Error(`Stock batch not found for item`);
      }

      const requiredQuantity = item.saleUnit === 'box' ? item.quantity : item.quantity;
      const availableQuantity = item.saleUnit === 'box' ? stockBatch.remainingBoxes :
        item.saleUnit === 'pack' ? stockBatch.remainingPacks : stockBatch.remainingPcs;

      if (requiredQuantity > availableQuantity) {
        throw new Error(`Insufficient stock. Available: ${availableQuantity}, Required: ${requiredQuantity}`);
      }
    }
  }

  static async updateStockOnSale(outwardItems) {
    for (const item of outwardItems) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: parseInt(item.stockBatchId) },
      });

      if (!stockBatch) continue;

      let updatedRemainingPcs = stockBatch.remainingPcs;

      if (item.saleUnit === 'box') {
        updatedRemainingPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
      } else if (item.saleUnit === 'pack') {
        updatedRemainingPcs -= item.quantity * stockBatch.packPerPiece;
      } else {
        updatedRemainingPcs -= item.quantity;
      }

      updatedRemainingPcs = Math.max(0, updatedRemainingPcs);
      const updatedRemainingPacks = Math.floor(updatedRemainingPcs / stockBatch.packPerPiece);
      const updatedRemainingBoxes = Math.floor(updatedRemainingPacks / stockBatch.packPerBox);

      await prisma.stockBatch.update({
        where: { id: parseInt(item.stockBatchId) },
        data: {
          remainingBoxes: updatedRemainingBoxes,
          remainingPacks: updatedRemainingPacks,
          remainingPcs: updatedRemainingPcs,
        },
      });
    }
  }

  static async getStockSummary(page, limit, locationId, search) {
    const where = {
      OR: [
        { remainingBoxes: { gt: 0 } },
        { remainingPcs: { gt: 0 } },
      ],
    };

    if (locationId) {
      where.locationId = parseInt(locationId);
    }

    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const stockBatches = await prisma.stockBatch.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
        vendor: true,
      },
    });

    const summary = new Map();

    stockBatches.forEach((batch) => {
      const key = batch.productId;
      const batchCostPerPcs = batch.costPerPcs || (batch.costPerBox / ((batch.packPerBox || 1) * (batch.packPerPiece || 1)));
      const value = batch.remainingBoxes * batch.costPerBox +
        (batch.remainingPacks - (batch.remainingBoxes * batch.packPerBox)) * batch.costPerPack +
        (batch.remainingPcs - (batch.remainingPacks * batch.packPerPiece)) * batchCostPerPcs;

      if (summary.has(key)) {
        const existing = summary.get(key);
        existing.totalBoxes += batch.remainingBoxes;
        existing.totalPacks += batch.remainingPacks || 0;
        existing.totalPcs += batch.remainingPcs;
        existing.totalBookedBoxes += batch.bookedBoxes || 0;
        existing.totalBookedPacks += batch.bookedPacks || 0;
        existing.totalBookedPcs += batch.bookedPcs || 0;
        existing.totalValue += value;

        const locIdx = existing.locations.findIndex(l => l.locationId === batch.locationId);
        if (locIdx >= 0) {
          const loc = existing.locations[locIdx];
          loc.boxes += batch.remainingBoxes;
          loc.pcs += batch.remainingPcs;
          loc.value += value;
          const vi = loc.variants.findIndex(v => v.packPerBox === batch.packPerBox && v.packPerPiece === batch.packPerPiece);
          if (vi >= 0) {
            const existingPcs = loc.variants[vi].pcs;
            const newPcs = batch.remainingPcs;
            const totalPcs = existingPcs + newPcs;
            loc.variants[vi].costPerPcs = totalPcs > 0
              ? ((loc.variants[vi].costPerPcs * existingPcs) + (batchCostPerPcs * newPcs)) / totalPcs
              : batchCostPerPcs;
            loc.variants[vi].boxes += batch.remainingBoxes;
            loc.variants[vi].pcs = totalPcs;
          } else {
            loc.variants.push({ packPerBox: batch.packPerBox, packPerPiece: batch.packPerPiece, boxes: batch.remainingBoxes, pcs: batch.remainingPcs, costPerBox: batch.costPerBox, costPerPcs: batchCostPerPcs });
          }
        } else {
          existing.locations.push({
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
            pcs: batch.remainingPcs,
            value,
            variants: [{ packPerBox: batch.packPerBox, packPerPiece: batch.packPerPiece, boxes: batch.remainingBoxes, pcs: batch.remainingPcs, costPerBox: batch.costPerBox, costPerPcs: batchCostPerPcs }],
          });
        }
      } else {
        summary.set(key, {
          productId: batch.productId,
          productName: batch.product.name,
          categoryName: batch.product.category?.name || 'N/A',
          totalBoxes: batch.remainingBoxes,
          totalPacks: batch.remainingPacks || 0,
          totalPcs: batch.remainingPcs,
          totalBookedBoxes: batch.bookedBoxes || 0,
          totalBookedPacks: batch.bookedPacks || 0,
          totalBookedPcs: batch.bookedPcs || 0,
          totalValue: value,
          locations: [{
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
            pcs: batch.remainingPcs,
            value,
            variants: [{ packPerBox: batch.packPerBox, packPerPiece: batch.packPerPiece, boxes: batch.remainingBoxes, pcs: batch.remainingPcs, costPerBox: batch.costPerBox, costPerPcs: batchCostPerPcs }],
          }],
        });
      }
    });

    const allSummaryItems = Array.from(summary.values());

    const totalStockValue = allSummaryItems.reduce((sum, item) => sum + item.totalValue, 0);
    const totalProducts = allSummaryItems.length;
    const lowStockItems = allSummaryItems.filter(item => item.totalPcs < 100);

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const paginatedItems = allSummaryItems.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(allSummaryItems.length / limitNum);

    return {
      data: paginatedItems,
      lowStockItems,
      globalStats: {
        totalStockValue,
        totalProducts,
        lowStockItemsCount: lowStockItems.length,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: allSummaryItems.length,
        totalPages,
      }
    };
  }

  static async calculateCOGS(outwardItems) {
    let totalCOGS = 0;

    for (const item of outwardItems) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: parseInt(item.stockBatchId) },
      });

      if (stockBatch) {
        const unitCost = item.saleUnit === 'box' ? stockBatch.costPerBox :
          item.saleUnit === 'pack' ? (stockBatch.costPerPack || stockBatch.costPerBox / (stockBatch.packPerBox || 1)) :
            stockBatch.costPerPcs;
        totalCOGS += unitCost * item.quantity;
      }
    }

    return totalCOGS;
  }
}
module.exports = { InventoryService };