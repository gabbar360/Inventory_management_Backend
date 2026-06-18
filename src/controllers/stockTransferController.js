const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const transferStock = async (req, res) => {
  try {
    const { stockBatchId, toLocationId, boxes = 0, packs = 0, pieces = 0, remarks } = req.body;

    const stockBatch = await prisma.stockBatch.findUnique({
      where: { id: parseInt(stockBatchId) },
      include: { product: true, location: true, vendor: true },
    });

    if (!stockBatch) {
      return res.status(404).json({ message: 'Stock batch not found' });
    }

    if (stockBatch.locationId === parseInt(toLocationId)) {
      return res.status(400).json({ message: 'Cannot transfer to same location' });
    }

    const totalPcsToTransfer =
      boxes * stockBatch.packPerBox * stockBatch.packPerPiece +
      packs * stockBatch.packPerPiece +
      pieces;

    // Bug 3 Fix: zero quantity check
    if (totalPcsToTransfer <= 0) {
      return res.status(400).json({ message: 'Transfer quantity must be greater than 0' });
    }

    if (totalPcsToTransfer > stockBatch.remainingPcs) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const transferNo = `TRF-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      const newSourcePcs = Math.max(0, stockBatch.remainingPcs - totalPcsToTransfer);
      const newSourcePacks = Math.floor(newSourcePcs / stockBatch.packPerPiece);
      const newSourceBoxes = Math.floor(newSourcePacks / stockBatch.packPerBox);

      // Deduct from source batch
      await tx.stockBatch.update({
        where: { id: stockBatch.id },
        data: {
          remainingBoxes: newSourceBoxes,
          remainingPacks: newSourcePacks,
          remainingPcs: newSourcePcs,
        },
      });

      // Bug 1 & 2 Fix: calculate dest packs/boxes from totalPcsToTransfer
      const destPacks = Math.floor(totalPcsToTransfer / stockBatch.packPerPiece);
      const destBoxes = Math.floor(destPacks / stockBatch.packPerBox);

      // Create or update batch at destination
      const existingBatch = await tx.stockBatch.findFirst({
        where: {
          productId: stockBatch.productId,
          vendorId: stockBatch.vendorId,
          locationId: parseInt(toLocationId),
          inwardDate: stockBatch.inwardDate,
          costPerBox: stockBatch.costPerBox,
        },
      });

      if (existingBatch) {
        const newDestPcs = existingBatch.remainingPcs + totalPcsToTransfer;
        const newDestPacks = Math.floor(newDestPcs / stockBatch.packPerPiece);
        const newDestBoxes = Math.floor(newDestPacks / stockBatch.packPerBox);

        await tx.stockBatch.update({
          where: { id: existingBatch.id },
          data: {
            remainingBoxes: newDestBoxes,
            remainingPacks: newDestPacks,
            remainingPcs: newDestPcs,
            boxes: existingBatch.boxes + destBoxes,
            totalPacks: existingBatch.totalPacks + newDestPacks,
            totalPcs: existingBatch.totalPcs + totalPcsToTransfer,
          },
        });
      } else {
        await tx.stockBatch.create({
          data: {
            productId: stockBatch.productId,
            vendorId: stockBatch.vendorId,
            locationId: parseInt(toLocationId),
            inwardDate: stockBatch.inwardDate,
            boxes: destBoxes,
            packPerBox: stockBatch.packPerBox,
            packPerPiece: stockBatch.packPerPiece,
            totalPacks: destPacks,
            totalPcs: totalPcsToTransfer,
            remainingBoxes: destBoxes,
            remainingPacks: destPacks,
            remainingPcs: totalPcsToTransfer,
            costPerBox: stockBatch.costPerBox,
            costPerPack: stockBatch.costPerPack,
            costPerPcs: stockBatch.costPerPcs,
          },
        });
      }

      // Record transfer
      await tx.stockTransfer.create({
        data: {
          transferNo,
          stockBatchId: stockBatch.id,
          fromLocationId: stockBatch.locationId,
          toLocationId: parseInt(toLocationId),
          boxes,
          packs,
          pieces,
          transferDate: new Date(),
          remarks,
        },
      });
    });

    res.json({ message: 'Stock transferred successfully', transferNo });
  } catch (error) {
    console.error('Transfer stock error:', error);
    res.status(500).json({ message: 'Failed to transfer stock' });
  }
};

const getTransferHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Bug 5 Fix: use include instead of N+1 queries
    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          stockBatch: { include: { product: true, vendor: true } },
          fromLocation: true,
          toLocation: true,
        },
      }),
      prisma.stockTransfer.count(),
    ]);

    res.json({ transfers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({ message: 'Failed to fetch transfer history' });
  }
};

module.exports = { transferStock, getTransferHistory };
