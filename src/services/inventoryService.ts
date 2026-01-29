import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  static async createStockBatch(inwardItem: any, inwardInvoice: any) {
    const totalPcs = inwardItem.boxes * inwardItem.pcsPerBox;
    const costPerBox = inwardItem.totalCost / inwardItem.boxes;
    const costPerPcs = inwardItem.totalCost / totalPcs;

    return await prisma.stockBatch.create({
      data: {
        productId: inwardItem.productId,
        vendorId: inwardInvoice.vendorId,
        locationId: inwardInvoice.locationId,
        inwardDate: inwardInvoice.date,
        boxes: inwardItem.boxes,
        pcsPerBox: inwardItem.pcsPerBox,
        totalPcs,
        remainingBoxes: inwardItem.boxes,
        remainingPcs: totalPcs,
        costPerBox,
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
      const availableQuantity = item.saleUnit === 'box' ? stockBatch.remainingBoxes : stockBatch.remainingPcs;

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
      let updatedRemainingPcs = stockBatch.remainingPcs;

      if (item.saleUnit === 'box') {
        updatedRemainingBoxes -= item.quantity;
        updatedRemainingPcs -= item.quantity * stockBatch.pcsPerBox;
      } else {
        const boxesToDeduct = Math.floor(item.quantity / stockBatch.pcsPerBox);
        const pcsToDeduct = item.quantity % stockBatch.pcsPerBox;

        updatedRemainingBoxes -= boxesToDeduct;
        updatedRemainingPcs -= item.quantity;

        // If we have loose pieces that complete a box, adjust accordingly
        if (updatedRemainingPcs < 0) {
          const additionalBoxes = Math.ceil(Math.abs(updatedRemainingPcs) / stockBatch.pcsPerBox);
          updatedRemainingBoxes -= additionalBoxes;
          updatedRemainingPcs = stockBatch.pcsPerBox - (Math.abs(updatedRemainingPcs) % stockBatch.pcsPerBox);
        }
      }

      await prisma.stockBatch.update({
        where: { id: item.stockBatchId },
        data: {
          remainingBoxes: Math.max(0, updatedRemainingBoxes),
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
                   (batch.remainingPcs % batch.pcsPerBox) * batch.costPerPcs;

      if (summary.has(key)) {
        const existing = summary.get(key);
        existing.totalBoxes += batch.remainingBoxes;
        existing.totalPcs += batch.remainingPcs;
        existing.totalValue += value;
        
        const locationIndex = existing.locations.findIndex((l: any) => l.locationId === batch.locationId);
        if (locationIndex >= 0) {
          existing.locations[locationIndex].boxes += batch.remainingBoxes;
          existing.locations[locationIndex].pcs += batch.remainingPcs;
          existing.locations[locationIndex].value += value;
        } else {
          existing.locations.push({
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
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
          totalPcs: batch.remainingPcs,
          totalValue: value,
          locations: [{
            locationId: batch.locationId,
            locationName: batch.location.name,
            boxes: batch.remainingBoxes,
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
        const unitCost = item.saleUnit === 'box' ? stockBatch.costPerBox : stockBatch.costPerPcs;
        totalCOGS += unitCost * item.quantity;
      }
    }

    return totalCOGS;
  }
}