const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const transferStock = async (req, res) => {
  try {
    const { stockBatchId, toLocationId, boxes, packs = 0, pieces = 0, remarks } = req.body;

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

    const totalPcsToTransfer = (boxes * stockBatch.packPerBox * stockBatch.packPerPiece) + 
                                (packs * stockBatch.packPerPiece) + pieces;

    if (totalPcsToTransfer > stockBatch.remainingPcs) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const transferNo = `TRF-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // Deduct from source batch
      await tx.stockBatch.update({
        where: { id: stockBatch.id },
        data: {
          remainingBoxes: stockBatch.remainingBoxes - boxes,
          remainingPacks: (stockBatch.remainingPacks || 0) - packs,
          remainingPcs: stockBatch.remainingPcs - totalPcsToTransfer,
        },
      });

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
        await tx.stockBatch.update({
          where: { id: existingBatch.id },
          data: {
            remainingBoxes: existingBatch.remainingBoxes + boxes,
            remainingPacks: (existingBatch.remainingPacks || 0) + packs,
            remainingPcs: existingBatch.remainingPcs + totalPcsToTransfer,
            boxes: existingBatch.boxes + boxes,
            totalPacks: existingBatch.totalPacks + packs,
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
            boxes,
            packPerBox: stockBatch.packPerBox,
            packPerPiece: stockBatch.packPerPiece,
            totalPacks: packs,
            totalPcs: totalPcsToTransfer,
            remainingBoxes: boxes,
            remainingPacks: packs,
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

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockTransfer.count(),
    ]);

    const transfersWithDetails = await Promise.all(
      transfers.map(async (transfer) => {
        const batch = await prisma.stockBatch.findUnique({
          where: { id: transfer.stockBatchId },
          include: { product: true, vendor: true },
        });
        const fromLocation = await prisma.location.findUnique({
          where: { id: transfer.fromLocationId },
        });
        const toLocation = await prisma.location.findUnique({
          where: { id: transfer.toLocationId },
        });
        return { ...transfer, batch, fromLocation, toLocation };
      })
    );

    res.json({ transfers: transfersWithDetails, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({ message: 'Failed to fetch transfer history' });
  }
};

module.exports = { transferStock, getTransferHistory };
