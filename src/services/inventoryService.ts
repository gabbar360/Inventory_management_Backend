import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  static async createStockBatch(inwardItem: any, inwardInvoice: any) {
    const totalPacks = inwardItem.boxes * inwardItem.packPerBox;
    const totalPcs = totalPacks * inwardItem.packPerPiece;
    const costPerBox = inwardItem.totalCost / inwardItem.boxes;
    const costPerPack = inwardItem.totalCost / totalPacks;
    const costPerPcs = inwardItem.totalCost / totalPcs;

    return await prisma.stockBatch.create({
      data: {
        productId: inwardItem.productId,
        vendorId: inwardInvoice.vendorId,
        locationId: inwardInvoice.locationId,
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
      },
    });
  }

  static async getAvailableStock(productId: string, locationId?: string) {
    const where: any = {
      productId,
      OR: [
        { remainingBoxes: { gt: 0 } },
        { remainingPcs: { gt: 0 } },
      ],
    };

    if (locationId) {
      where.locationId = locationId;
    }

    return await prisma.stockBatch.findMany({
      where,
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
        vendor: {
          select: { name: true, code: true },
        },
        location: {
          select: { name: true },
        },
      },
      orderBy: { inwardDate: 'asc' }, // FIFO
    });
  }

  static async validateStockAvailability(items: any[]) {
    for (const item of items) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: item.stockBatchId },
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

  static async updateStockOnSale(outwardItems: any[]) {
    for (const item of outwardItems) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: item.stockBatchId },
      });

      if (!stockBatch) continue;

      let updatedRemainingBoxes = stockBatch.remainingBoxes;
      let updatedRemainingPacks = stockBatch.remainingPacks;
      let updatedRemainingPcs = stockBatch.remainingPcs;

      if (item.saleUnit === 'box') {
        updatedRemainingBoxes -= item.quantity;
        updatedRemainingPacks -= item.quantity * stockBatch.packPerBox;
        updatedRemainingPcs -= item.quantity * stockBatch.packPerBox * stockBatch.packPerPiece;
      } else if (item.saleUnit === 'pack') {
        const boxesToDeduct = Math.floor(item.quantity / stockBatch.packPerBox);
        const packsToDeduct = item.quantity % stockBatch.packPerBox;
        
        updatedRemainingBoxes -= boxesToDeduct;
        updatedRemainingPacks -= item.quantity;
        updatedRemainingPcs -= item.quantity * stockBatch.packPerPiece;
      } else {
        const packsToDeduct = Math.floor(item.quantity / stockBatch.packPerPiece);
        const boxesToDeduct = Math.floor(packsToDeduct / stockBatch.packPerBox);
        
        updatedRemainingBoxes -= boxesToDeduct;
        updatedRemainingPacks -= packsToDeduct;
        updatedRemainingPcs -= item.quantity;
      }

      await prisma.stockBatch.update({
        where: { id: item.stockBatchId },
        data: {
          remainingBoxes: Math.max(0, updatedRemainingBoxes),
          remainingPacks: Math.max(0, updatedRemainingPacks),
          remainingPcs: Math.max(0, updatedRemainingPcs),
        },
      });
    }
  }

  static async getStockSummary(locationId?: string) {
    const where: any = {
      OR: [
        { remainingBoxes: { gt: 0 } },
        { remainingPcs: { gt: 0 } },
      ],
    };

    if (locationId) {
      where.locationId = locationId;
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
      const value = batch.remainingBoxes * batch.costPerBox + 
                   (batch.remainingPacks || 0) * (batch.costPerPack || batch.costPerBox / (batch.packPerBox || 1)) +
                   (batch.remainingPcs % ((batch.packPerBox || 1) * (batch.packPerPiece || 1))) * batch.costPerPcs;

      if (summary.has(key)) {
        const existing = summary.get(key);
        existing.totalBoxes += batch.remainingBoxes;
        existing.totalPacks = (existing.totalPacks || 0) + (batch.remainingPacks || 0);
        existing.totalPcs += batch.remainingPcs;
        existing.totalValue += value;
        
        const locationIndex = existing.locations.findIndex((l: any) => l.locationId === batch.locationId);
        if (locationIndex >= 0) {
          existing.locations[locationIndex].boxes += batch.remainingBoxes;
          existing.locations[locationIndex].packs = (existing.locations[locationIndex].packs || 0) + (batch.remainingPacks || 0);
          existing.locations[locationIndex].pcs += batch.remainingPcs;
          existing.locations[locationIndex].value += value;
        } else {
          existing.locations.push({
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
            packs: batch.remainingPacks || 0,
            pcs: batch.remainingPcs,
            value,
          });
        }
      } else {
        summary.set(key, {
          productId: batch.productId,
          productName: batch.product.name,
          categoryName: batch.product.category.name,
          totalBoxes: batch.remainingBoxes,
          totalPacks: batch.remainingPacks || 0,
          totalPcs: batch.remainingPcs,
          totalValue: value,
          locations: [{
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
            packs: batch.remainingPacks || 0,
            pcs: batch.remainingPcs,
            value,
          }],
        });
      }
    });

    return Array.from(summary.values());
  }

  static async calculateCOGS(outwardItems: any[]) {
    let totalCOGS = 0;

    for (const item of outwardItems) {
      const stockBatch = await prisma.stockBatch.findUnique({
        where: { id: item.stockBatchId },
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